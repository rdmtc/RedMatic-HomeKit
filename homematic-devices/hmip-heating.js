const Accessory = require('./lib/accessory.js');

module.exports = class HmipHeating extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        const levels = {};
        let level = 0;
        let currentSetpoint;
        let valueSetpoint = 21;
        let setpointMode;
        let target;

        function targetState() {
            // target: 0=off, 1=heat, 3=auto
            switch (setpointMode) {
                case 1:
                    // Manu
                    target = currentSetpoint > 4.5 ? 1 : 0;
                    break;
                default:
                    // Auto / Party
                    target = 3;
            }

            return target;
        }

        function currentState() {
            // 0=off, 1=heat
            return level > 0 ? 1 : 0;
        }

        const valveDevices = [];
        let valueDevice;
        let humidityDp;

        const lowbatDps = {};

        const group = ccu.groups && ccu.groups[config.deviceAddress.replace(/VirtualDevices\.INT0*/, '')];

        if (!group) {
            node.error(config.deviceAddress + ' group configuration not found');
            return;
        }

        node.debug(config.deviceAddress + ' ' + group.groupProperties.NAME + ' ' + group.groupType.id + ' has ' + group.groupMembers.length + ' members');
        for (const member of group.groupMembers) {
            if (member.memberType.id.startsWith('RADIATOR')) {
                valveDevices.push('HmIP-RF.' + member.id);
                valueDevice = valueDevice || ('HmIP-RF.' + member.id);
            } else if (member.memberType.id.startsWith('WALLMOUNTED')) {
                valueDevice = 'HmIP-RF.' + member.id;
                humidityDp = 'HmIP-RF.' + member.id + '.HUMIDITY';
            }

            lowbatDps['HmIP-RF.' + (member.id.split(':')[0]) + ':0.LOW_BAT'] = false;
            node.debug(config.deviceAddress + ' member ' + member.memberType.id + ' ' + member.id);
        }

        if (valueDevice) {
            node.debug(config.deviceAddress + ' valueDevice ' + valueDevice);
        } else {
            node.error(config.deviceAddress + ' group has neither thermostat nor valve device');
            return;
        }

        const serviceThermostat = this.addService('Thermostat', config.name);
        const subtypeThermostat = serviceThermostat.subtype;

        serviceThermostat
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', valueDevice + '.ACTUAL_TEMPERATURE')

            .setProps('TargetTemperature', {minValue: 4.5, maxValue: 30.5, minStep: 0.5})
            .get('TargetTemperature', valueDevice + '.SET_POINT_TEMPERATURE', value => {
                currentSetpoint = value;
                if (value > 4.5) {
                    valueSetpoint = value;
                }

                updateHeatingCoolingState();
                return value;
            })
            .set('TargetTemperature', config.deviceAddress + ':1.SET_POINT_TEMPERATURE')

            .setProps('CurrentHeatingCoolingState', {validValues: [0, 1], maxValue: 1})

            .get('CurrentHeatingCoolingState', valueDevice + '.LEVEL', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return currentState();
            })

            .setProps('TargetHeatingCoolingState', {validValues: [0, 1, 3]})
            .get('TargetHeatingCoolingState', valueDevice + '.SET_POINT_TEMPERATURE', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return targetState();
            })
            .set('TargetHeatingCoolingState', (value, callback) => {
            // 0=off, 1=heat, 3=auto
                if (value === 0) {
                    const parameters = {
                        CONTROL_MODE: 1,
                        SET_POINT_TEMPERATURE: 4.5,
                    };
                    node.debug('set ' + config.name + ' (' + subtypeThermostat + ') TargetHeatingCoolingState ' + value + ' -> ' + config.description.ADDRESS + ':1 ' + JSON.stringify(parameters));

                    ccu.methodCall(config.iface, 'putParamset', [config.description.ADDRESS + ':1', 'VALUES', parameters])
                        .then(() => {
                            setpointMode = 1;
                            callback();
                        }).catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                } else if (value === 1) {
                    const parameters = {
                        CONTROL_MODE: 1,
                        SET_POINT_TEMPERATURE: valueSetpoint,
                    };
                    node.debug('set ' + config.name + ' (' + subtypeThermostat + ') TargetHeatingCoolingState ' + value + ' -> ' + config.description.ADDRESS + ':1 ' + JSON.stringify(parameters));
                    ccu.methodCall(config.iface, 'putParamset', [config.description.ADDRESS + ':1', 'VALUES', parameters])
                        .then(() => {
                            serviceThermostat.update('TargetTemperature', valueSetpoint);
                            setpointMode = 1;
                            callback();
                        }).catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                } else {
                    node.debug('set ' + config.name + ' (' + subtypeThermostat + ') TargetHeatingCoolingState ' + value + ' -> ' + config.description.ADDRESS + ':1.CONTROL_MODE ' + (value === 3 ? 0 : 1));
                    ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'CONTROL_MODE', value === 3 ? 0 : 1)
                        .then(() => {
                            setpointMode = 0;
                            callback();
                        }).catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                }
            });

        function updateHeatingCoolingState() {
            serviceThermostat.update('CurrentHeatingCoolingState', currentState());
            serviceThermostat.update('TargetHeatingCoolingState', targetState());
        }

        for (const valveStateDevice of valveDevices) {
            const datapointLevel = valveStateDevice + '.LEVEL';
            this.subscribe(datapointLevel, value => {
                levels[datapointLevel] = value;
                let max = 0;
                for (const dp of Object.keys(levels)) {
                    if (levels[dp] > max) {
                        max = levels[dp];
                    }
                }

                if (level !== max) {
                    level = max;
                    node.debug('update ' + config.name + ' level ' + level);
                    updateHeatingCoolingState();
                }
            });
        }

        this.subscribe(valueDevice + '.SET_POINT_MODE', value => {
            setpointMode = value;
            node.debug('update ' + config.name + ' setpointMode ' + setpointMode);
            updateHeatingCoolingState();
        });

        const battery = this.addService('Battery', config.name, 'Battery');
        for (const dp of Object.keys(lowbatDps)) {
            this.subscribe(dp, value => {
                lowbatDps[dp] = value;
                let lowbat = false;
                for (const ldp of Object.keys(lowbatDps)) {
                    lowbat = lowbat || lowbatDps[ldp];
                }

                battery.update('StatusLowBattery', lowbat ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
                battery.update('BatteryLevel', lowbat ? 0 : 100);
            });
        }

        if (this.option('HumiditySensor') && humidityDp) {
            this.addService('HumiditySensor', config.name)
                .get('CurrentRelativeHumidity', humidityDp);
        }

        if (this.option('BoostSwitch')) {
            this.addService('Switch', 'Boost ' + config.name, 'Boost')
                .set('On', (value, callback) => {
                    this.ccuSetValue(config.deviceAddress + ':1.BOOST_MODE', value, callback);
                })
                .get('On', valueDevice + '.BOOST_MODE');
        }
    }
};
