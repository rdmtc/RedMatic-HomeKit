const Accessory = require('./lib/accessory.js');

module.exports = class HmTcItWmWEu extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        let currentSetpoint;
        let valueSetpoint = 21;

        let controlMode;
        let target;

        const levels = {};
        let level = 0;

        const links = ccu.getLinks(config.iface, config.description.ADDRESS + ':2') || [];
        node.debug(config.name + ' linked to ' + JSON.stringify(links));

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
            .get('CurrentTemperature', config.deviceAddress + ':2.ACTUAL_TEMPERATURE')

            .setProps('TargetTemperature', {minValue: 4.5, maxValue: 30.5, minStep: 0.5})
            .get('TargetTemperature', config.deviceAddress + ':2.SET_TEMPERATURE', value => {
                currentSetpoint = value;
                if (value > 4.5) {
                    valueSetpoint = value;
                }

                updateHeatingCoolingState();
                return value;
            })
            .set('TargetTemperature', config.deviceAddress + ':2.SET_TEMPERATURE')

            .setProps('CurrentHeatingCoolingState', {validValues: [0, 1], maxValue: 1})
            .get('CurrentHeatingCoolingState', config.deviceAddress + ':2.SET_TEMPERATURE', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return currentState();
            })

            .setProps('TargetHeatingCoolingState', {validValues: [0, 1, 3]})
            .get('TargetHeatingCoolingState', config.deviceAddress + ':2.SET_TEMPERATURE', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return targetState();
            })
            .set('TargetHeatingCoolingState', (value, callback) => {
                // 0=off, 1=heat, 3=auto
                if (value === 0) {
                    ccu.setValue(config.iface, config.description.ADDRESS + ':2', 'MANU_MODE', 4.5)
                        .then(() => {
                            callback();
                        })
                        .catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                } else if (value === 1) {
                    ccu.setValue(config.iface, config.description.ADDRESS + ':2', 'MANU_MODE', valueSetpoint)
                        .then(() => {
                            serviceThermostat.update('TargetTemperature', valueSetpoint);
                            callback();
                        })
                        .catch(() => {
                            callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                        });
                } else {
                    ccu.setValue(config.iface, config.description.ADDRESS + ':2', 'AUTO_MODE', true)
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
            this.acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.CurrentHeatingCoolingState, current);
            const target = targetState();
            node.debug('update ' + config.name + ' (' + subtypeThermostat + ') TargetHeatingCoolingState ' + target);
            this.acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.TargetHeatingCoolingState, target);
        }

        for (const link of links) {
            const valveStateDevice = link.split(':')[0];
            const datapointLevel = config.iface + '.' + valveStateDevice + ':4.VALVE_STATE';
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

        this.subscriptions.push(ccu.subscribe({
            cache: true,
            change: true,
            datapointName: config.deviceAddress + ':2.CONTROL_MODE',
        }, message => {
            controlMode = message.value;
            node.debug('update ' + config.name + ' controlMode ' + message.value);
            updateHeatingCoolingState();
        }));

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('BatteryLevel', config.deviceAddress + ':2.BATTERY_STATE', this.percent);

        if (this.option('HumiditySensor')) {
            this.addService('HumiditySensor', config.name, 'HumiditySensor')
                .get('CurrentRelativeHumidity', config.deviceAddress + ':2.ACTUAL_HUMIDITY');
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

                    this.ccuSetValue(config.iface + '.' + config.description.ADDRESS + ':2.' + dp, value, response => {
                        for (const [i, link] of links.entries()) {
                            const linkedDevice = link.split(':')[0];
                            setTimeout(() => {
                                this.ccuSetValue(config.iface + '.' + linkedDevice + ':4.' + dp, value);
                            }, i * 3000);
                        }

                        callback(response);
                    });
                })
                .get('On', config.deviceAddress + ':2.CONTROL_MODE', value => value === 3);
        }
    }
};
