const Accessory = require('./lib/accessory');
const thermostat = require('./lib/thermostat');

module.exports = class HmCcRtDn extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        let valveState = 0;
        let currentSetpoint;
        const setpoint = thermostat.createSetpoint();
        let controlMode;
        let target;

        function targetState() {
            // 0=off, 1=heat, 3=auto
            switch (controlMode) {
                case 1:
                    // Manu
                    target = thermostat.targetState(true, currentSetpoint);
                    break;
                case 0:
                    // Auto
                    target = thermostat.targetState(false, currentSetpoint);
                    break;
                case 2:
                    // Party
                    target = thermostat.targetState(false, currentSetpoint);
                    break;
                case 3:
                    // Boost
                    // don't change targetState so we can switch back to previous state when boost mode is deactivated
                    break;
                default:
            }

            return controlMode === 3 ? 1 : (target ?? 3);
        }

        function currentState() {
            // 0=off, 1=heat
            return valveState > 0 || controlMode === 3 ? 1 : 0;
        }

        const serviceThermostat = this.addService('Thermostat', config.name);

        serviceThermostat
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', config.deviceAddress + ':4.ACTUAL_TEMPERATURE')

            .setProps('TargetTemperature', {minValue: 4.5, maxValue: 30.5, minStep: 0.5})
            .get('TargetTemperature', config.deviceAddress + ':4.SET_TEMPERATURE', (value) => {
                currentSetpoint = value;
                setpoint.read(value);

                updateHeatingCoolingState();
                return value;
            })
            .set('TargetTemperature', config.deviceAddress + ':4.SET_TEMPERATURE', (value) => setpoint.write(value))

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
            .set(
                'TargetHeatingCoolingState',
                thermostat.hmModeSetter({
                    ccu,
                    hap,
                    node,
                    config,
                    channel: 4,
                    setpoint,
                    service: serviceThermostat,
                }),
            );

        function updateHeatingCoolingState() {
            serviceThermostat.update('CurrentHeatingCoolingState', currentState());
            serviceThermostat.update('TargetHeatingCoolingState', targetState());
        }

        this.subscribe(config.deviceAddress + ':4.VALVE_STATE', (value) => {
            valveState = value;
            node.debug('update ' + config.name + ' valveState ' + valveState);
            updateHeatingCoolingState();
        });

        this.subscribe(config.deviceAddress + ':4.CONTROL_MODE', (value) => {
            controlMode = value;
            node.debug('update ' + config.name + ' controlMode ' + controlMode);
            updateHeatingCoolingState();
        });

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':4.BATTERY_STATE', this.percent)
            .update('ChargingState', 2);

        if (this.option('BoostSwitch')) {
            this.addService('Switch', 'Boost ' + config.name, 'Boost')
                .set('On', (value, callback) => {
                    if (value) {
                        ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'BOOST_MODE', true)
                            .then(() => {
                                callback();
                            })
                            .catch(() => {
                                callback(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
                            });
                    } else if (target === 0) {
                        ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'MANU_MODE', setpoint.value)
                            .then(() => {
                                callback();
                            })
                            .catch(() => {
                                callback(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
                            });
                    } else if (target === 1) {
                        ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'MANU_MODE', setpoint.value)
                            .then(() => {
                                callback();
                            })
                            .catch(() => {
                                callback(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
                            });
                    } else {
                        ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'AUTO_MODE', true)
                            .then(() => {
                                callback();
                            })
                            .catch(() => {
                                callback(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
                            });
                    }
                })
                .get('On', config.deviceAddress + ':4.CONTROL_MODE', (value) => {
                    return value === 3;
                });
        }
    }
};
