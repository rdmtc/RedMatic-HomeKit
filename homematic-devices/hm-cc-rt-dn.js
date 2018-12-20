const Accessory = require('./lib/accessory');

module.exports = class HmCcRtDn extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        let valveState = 0;
        let valueSetpoint;
        let controlMode;
        let target;

        const that = this;


        function targetState() {
            // 0=off, 1=heat, 3=auto
            switch (controlMode) {
                case 1:
                    // Manu
                    target = valueSetpoint > 4.5 ? 1 : 0;
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
            return (valveState > 0 || controlMode === 3) ? 1 : 0;
        }

        const serviceThermostat = this.addService('Thermostat', config.name);
        const subtypeThermostat = serviceThermostat.subtype;

        serviceThermostat
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', config.deviceAddress + ':4.ACTUAL_TEMPERATURE')

            .setProps('TargetTemperature', {minValue: 4.5, maxValue: 30.5, minStep: 0.5})
            .get('TargetTemperature', config.deviceAddress + ':4.SET_TEMPERATURE', value => {
                valueSetpoint = value;
                updateHeatingCoolingState();
                return value;
            })
            .set('TargetTemperature', config.deviceAddress + ':4.SET_TEMPERATURE')

            .setProps('CurrentHeatingCoolingState', {validValues: [0, 1], maxValue: 1})
            .get('CurrentHeatingCoolingState', config.deviceAddress + ':4.SET_TEMPERATURE', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return currentState();
            })

            .setProps('TargetHeatingCoolingState', {validValues: [0, 1, 3]})
            .get('TargetHeatingCoolingState', config.deviceAddress + ':4.SET_TEMPERATURE', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return targetState();
            })
            .set('TargetHeatingCoolingState', (value, callback) => {
                // 0=off, 1=heat, 3=auto
                if (value === 0) {
                    ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'MANU_MODE', 4.5)
                        .then(() => {
                            callback();
                        })
                        .catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                } else if (value === 1) {
                    ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'MANU_MODE', 21)
                        .then(() => {
                            callback();
                        })
                        .catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                } else {
                    ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'AUTO_MODE', true)
                        .then(() => {
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

        this.subscriptions.push(ccu.subscribe({
            cache: true,
            change: true,
            datapointName: config.deviceAddress + ':4.VALVE_STATE'
        }, msg => {
            valveState = msg.value;
            node.debug('update ' + config.name + ' valveState ' + msg.value);
            updateHeatingCoolingState();
        }));

        this.subscriptions.push(ccu.subscribe({
            cache: true,
            change: true,
            datapointName: config.deviceAddress + ':4.CONTROL_MODE'
        }, msg => {
            controlMode = msg.value;
            node.debug('update ' + config.name + ' controlMode ' + msg.value);

            updateHeatingCoolingState();
        }));

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':4.BATTERY_STATE', this.percent);

        if (this.option('BoostSwitch')) {
            this.addService('Switch', 'Boost ' + config.name, 'Boost')
                .set('On', (value, callback) => {
                    if (value) {
                        ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'BOOST_MODE', true)
                            .then(() => {
                                callback();
                            })
                            .catch(() => {
                                callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                            });
                    } else {
                        if (target === 0) {
                            ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'MANU_MODE', valueSetpoint)
                                .then(() => {
                                    callback();
                                })
                                .catch(() => {
                                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                                });
                        } else if (target === 1) {
                            ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'MANU_MODE', valueSetpoint)
                                .then(() => {
                                    callback();
                                })
                                .catch(() => {
                                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                                });
                        } else {
                            ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'AUTO_MODE', true)
                                .then(() => {
                                    callback();
                                })
                                .catch(() => {
                                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                                });
                        }
                    }
                })
                .get('On', config.deviceAddress + ':4.CONTROL_MODE', value => {
                    return value === 3;
                })

        }
    }
};
