const Accessory = require('./lib/accessory');

module.exports = class HmCcVg1 extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        let currentSetpoint;
        let valueSetpoint = 21;

        let controlMode;
        let target;

        const levels = {};
        let level = 0;

        const that = this;

        const valveDevices = [];

        const lowbatDps = {};

        let valueChannel = null;
        let humidityDp;

        const group = ccu.groups && ccu.groups[config.deviceAddress.replace(/VirtualDevices\.INT0*/, '')];

        if (!group) {
            node.error(config.deviceAddress + ' group configuration not found');
            return;
        }

        node.debug(config.deviceAddress + ' ' + group.groupProperties.NAME + ' ' + group.groupType.id + ' has ' + group.groupMembers.length + ' members');
        group.groupMembers.forEach(member => {
            if (member.memberType.id.startsWith('HM-CC')) {
                valveDevices.push('BidCos-RF.' + member.id);
                valueChannel = valueChannel || ('BidCos-RF.' + member.id + ':4');
            } else if (member.memberType.id.startsWith('HM-TC')) {
                valueChannel = 'BidCos-RF.' + member.id + ':2';
                humidityDp = 'BidCos-RF.' + member.id + ':1.HUMIDITY';
            }

            lowbatDps['BidCos-RF.' + member.id + ':0.LOWBAT'] = false;
            node.debug(config.deviceAddress + ' member ' + member.memberType.id + ' ' + member.id);
        });

        if (valueChannel) {
            node.debug(config.deviceAddress + ' valueChannel ' + valueChannel);
        } else {
            node.error(config.deviceAddress + ' group has neither thermostat nor valve device');
            return;
        }

        function targetState() {
            // 0=off, 1=heat, 3=auto
            switch (controlMode) {
                case 1:
                    // Manu
                    target = currentSetpoint > 4.5 ? 1 : 0;
                    break;
                case 0:
                    // Auto
                    target = 3;
                    break;
                case 2:
                    // Party
                    target = 3;
                    break;
                case 3:
                    // Boost
                    // don't change targetState so we can switch back to previous state when boost mode is deactivated
                    break;
                default:
            }

            return controlMode === 3 ? 1 : target;
        }

        function currentState() {
            // 0=off, 1=heat
            return (level > 0 || controlMode === 3) ? 1 : 0;
        }

        const serviceThermostat = this.addService('Thermostat', config.name);
        const subtypeThermostat = serviceThermostat.subtype;

        serviceThermostat
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', valueChannel + '.ACTUAL_TEMPERATURE')

            .setProps('TargetTemperature', {minValue: 4.5, maxValue: 30.5, minStep: 0.5})
            .get('TargetTemperature', valueChannel + '.SET_TEMPERATURE', value => {
                currentSetpoint = value;
                if (value > 4.5) {
                    valueSetpoint = value;
                }
                updateHeatingCoolingState();
                return value;
            })
            .set('TargetTemperature', config.deviceAddress + ':1.SET_TEMPERATURE')

            .setProps('CurrentHeatingCoolingState', {validValues: [0, 1], maxValue: 1})
            .get('CurrentHeatingCoolingState', valueChannel + '.SET_TEMPERATURE', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return currentState();
            })

            .setProps('TargetHeatingCoolingState', {validValues: [0, 1, 3]})
            .get('TargetHeatingCoolingState', valueChannel + '.SET_TEMPERATURE', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return targetState();
            })
            .set('TargetHeatingCoolingState', (value, callback) => {
            // 0=off, 1=heat, 3=auto
                if (value === 0) {
                    ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'MANU_MODE', 4.5)
                        .then(() => {
                            controlMode = 1;
                            callback();
                        })
                        .catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                } else if (value === 1) {
                    ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'MANU_MODE', valueSetpoint)
                        .then(() => {
                            serviceThermostat.update('TargetTemperature', valueSetpoint);
                            controlMode = 1;
                            callback();
                        })
                        .catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                } else {
                    ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'AUTO_MODE', true)
                        .then(() => {
                            controlMode = 0;
                            callback();
                        })
                        .catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                }
            });

        function updateHeatingCoolingState() {
            const current = currentState();
            node.debug('update ' + config.name + ' (' + subtypeThermostat + ') CurrentHeatingCoolingState ' + current);
            that.acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.CurrentHeatingCoolingState, current);
            const target = targetState();
            node.debug('update ' + config.name + ' (' + subtypeThermostat + ') TargetHeatingCoolingState ' + target);
            that.acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.TargetHeatingCoolingState, target);
        }

        valveDevices.forEach(valveStateDevice => {
            const datapointLevel = valveStateDevice + ':4.VALVE_STATE';
            this.subscribe(datapointLevel, value => {
                levels[datapointLevel] = value;
                let max = 0;
                Object.keys(levels).forEach(dp => {
                    if (levels[dp] > max) {
                        max = levels[dp];
                    }
                });
                if (level !== max) {
                    level = max;
                    node.debug('update ' + config.name + ' level ' + level);
                    updateHeatingCoolingState();
                }
            });
        });

        this.subscriptions.push(ccu.subscribe({
            cache: true,
            change: true,
            datapointName: valueChannel + '.CONTROL_MODE'
        }, msg => {
            controlMode = msg.value;
            node.debug('update ' + config.name + ' controlMode ' + msg.value);
            updateHeatingCoolingState();
        }));

        const batteryService = this.addService('BatteryService', config.name, 'Battery');
        Object.keys(lowbatDps).forEach(dp => {
            this.subscribe(dp, value => {
                lowbatDps[dp] = value;
                let lowbat = false;
                Object.keys(lowbatDps).forEach(ldp => {
                    lowbat = lowbat || lowbatDps[ldp];
                });
                batteryService.update('StatusLowBattery', lowbat ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
                batteryService.update('BatteryLevel', lowbat ? 0 : 100);
            });
        });

        if (this.option('HumiditySensor') && humidityDp) {
            this.addService('HumiditySensor', config.name, 'HumiditySensor')
                .get('CurrentRelativeHumidity', humidityDp);
        }

        if (this.option('BoostSwitch')) {
            this.addService('Switch', 'Boost ' + config.name, 'Boost')
                .set('On', (value, callback) => {
                    let dp;
                    if (value) {
                        dp = 'BOOST_MODE';
                    } else if (target === 0 || target === 1) {
                        dp = 'MANU_MODE';
                        value = valueSetpoint;
                    } else {
                        dp = 'AUTO_MODE';
                        value = true;
                    }

                    this.ccuSetValue(config.iface + '.' + config.description.ADDRESS + ':1.' + dp, value, res => {
                        callback(res);
                    });
                })
                .get('On', valueChannel + '.CONTROL_MODE', value => {
                    return value === 3;
                });
        }
    }
};
