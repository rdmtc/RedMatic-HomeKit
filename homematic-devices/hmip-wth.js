const Accessory = require('./lib/accessory');

module.exports = class HmipWth extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        const levels = {};
        let level = 0;
        let valueSetpoint;
        let setpointMode;
        let target;

        function targetState() {
            // 0=off, 1=heat, 3=auto
            switch (setpointMode) {
                case 1:
                    // Manu
                    target = valueSetpoint > 4.5 ? 1 : 0;
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

        const links = ccu.getLinks(config.iface, config.description.ADDRESS + ':3') || [];
        node.debug(config.name + ' linked to ' + JSON.stringify(links));

        const serviceThermostat = this.addService('Thermostat', config.name);
        const subtypeThermostat = serviceThermostat.subtype;

        serviceThermostat
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', config.deviceAddress + ':1.ACTUAL_TEMPERATURE')

            .setProps('TargetTemperature', {minValue: 4.5, maxValue: 30.5, minStep: 0.5})
            .get('TargetTemperature', config.deviceAddress + ':1.SET_POINT_TEMPERATURE', value => {
                valueSetpoint = value;
                updateHeatingCoolingState();
                return value;
            })
            .set('TargetTemperature', config.deviceAddress + ':1.SET_POINT_TEMPERATURE')

            .setProps('CurrentHeatingCoolingState', {validValues: [0, 1], maxValue: 1})
            .get('CurrentHeatingCoolingState', config.deviceAddress + ':1.LEVEL', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return currentState();
            })

            .setProps('TargetHeatingCoolingState', {validValues: [0, 1, 3]})
            .get('TargetHeatingCoolingState', config.deviceAddress + ':1.SET_POINT_TEMPERATURE', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return targetState();
            })
            .set('TargetHeatingCoolingState', (value, callback) => {
                // 0=off, 1=heat, 3=auto
                if (value === 0) {
                    const params = {
                        CONTROL_MODE: 1,
                        SET_POINT_TEMPERATURE: 4.5
                    };
                    node.debug('set ' + config.name + ' (' + subtypeThermostat + ') TargetHeatingCoolingState ' + value + ' -> ' + config.description.ADDRESS + ':1 ' + JSON.stringify(params));

                    ccu.methodCall(config.iface, 'putParamset', [config.description.ADDRESS + ':1', 'VALUES', params])
                        .then(() => {
                            callback();
                        }).catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                } else if (value === 1) {
                    const params = {
                        CONTROL_MODE: 1,
                        SET_POINT_TEMPERATURE: 21
                    };
                    node.debug('set ' + config.name + ' (' + subtypeThermostat + ') TargetHeatingCoolingState ' + value + ' -> ' + config.description.ADDRESS + ':1 ' + JSON.stringify(params));
                    ccu.methodCall(config.iface, 'putParamset', [config.description.ADDRESS + ':1', 'VALUES', params])
                        .then(() => {
                            callback();
                        }).catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                } else {
                    node.debug('set ' + config.name + ' (' + subtypeThermostat + ') TargetHeatingCoolingState ' + value + ' -> ' + config.description.ADDRESS + ':1.CONTROL_MODE ' + (value === 3 ? 0 : 1));
                    ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'CONTROL_MODE', value === 3 ? 0 : 1)
                        .then(() => {
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

        links.forEach(link => {
            const valveStateDevice = link.split(':')[0];
            const datapointLevel = config.iface + '.' + valveStateDevice + ':1.LEVEL';
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

        this.subscribe(config.deviceAddress + ':1.SET_POINT_MODE', value => {
            setpointMode = value;
            node.debug('update ' + config.name + ' setpointMode ' + setpointMode);
            updateHeatingCoolingState();
        });

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', this.percent);

        if (this.option('HumiditySensor')) {
            this.addService('HumiditySensor', config.name)
                .get('CurrentRelativeHumidity', config.deviceAddress + ':1.HUMIDITY');
        }

        if (this.option('BoostSwitch')) {
            this.addService('Switch', 'Boost ' + config.name, 'Boost')
                .set('On', (value, callback) => {
                    this.ccuSetValue(config.deviceAddress + ':1.BOOST_MODE', value, callback);
                    links.forEach(link => {
                        const linkedDevice = link.split(':')[0];
                        this.ccuSetValue(config.iface + '.' + linkedDevice + ':1.BOOST_MODE', value);
                    });
                })
                .get('On', config.deviceAddress + ':1.BOOST_MODE');
        }
    }
};
