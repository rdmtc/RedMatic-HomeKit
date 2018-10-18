module.exports = class HmipEtrv {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        function batteryPercent(val) {
            let p = Math.round((val - 2) * 100);
            if (p < 0) {
                p = 0;
            } else if (p > 100) {
                p = 100;
            }
            return p;
        }

        const datapointTemperature = config.iface + '.' + config.description.ADDRESS + ':4.ACTUAL_TEMPERATURE';
        let actualTemperature = (ccu.values && ccu.values[datapointTemperature] && ccu.values[datapointTemperature].value) || 0;

        const datapointLevel = config.iface + '.' + config.description.ADDRESS + ':4.VALVE_STATE';
        let valveState = (ccu.values && ccu.values[datapointLevel] && ccu.values[datapointLevel].value) || 0;

        const datapointSetpoint = config.iface + '.' + config.description.ADDRESS + ':4.SET_TEMPERATURE';
        let setTemperature = (ccu.values && ccu.values[datapointSetpoint] && ccu.values[datapointSetpoint].value) || 0;

        const datapointControlMode = config.iface + '.' + config.description.ADDRESS + ':4.CONTROL_MODE';
        let controlMode = (ccu.values && ccu.values[datapointControlMode] && ccu.values[datapointControlMode].value) || 0;

        const datapointLowbat = config.iface + '.' + config.description.ADDRESS + ':0.LOWBAT';
        let lowbat = (ccu.values && ccu.values[datapointLowbat] && ccu.values[datapointLowbat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointVoltage = config.iface + '.' + config.description.ADDRESS + ':4.BATTERY_STATE';
        let battery = batteryPercent(ccu.values && ccu.values[datapointVoltage] && ccu.values[datapointVoltage].value);

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        function targetState() {
            // 0=off, 1=heat, 3=auto
            let target;
            switch (controlMode) {
                case 1:
                    // Manu
                    target = setTemperature > 4.5 ? 1 : 0;
                    break;
                default:
                    // Auto/Party
                    target = 3;
            }
            return target;
        }

        function currentState() {
            // 0=off, 1=heat
            const current = valveState > 0 ? 1 : 0;
            return current;
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtypeThermostat = '0';
        const subtypeBattery = '1';

        if (!acc.isConfigured) {
            acc.getService(hap.Service.AccessoryInformation)
                .setCharacteristic(hap.Characteristic.Manufacturer, 'eQ-3')
                .setCharacteristic(hap.Characteristic.Model, config.description.TYPE)
                .setCharacteristic(hap.Characteristic.SerialNumber, config.description.ADDRESS)
                .setCharacteristic(hap.Characteristic.FirmwareRevision, config.description.FIRMWARE);

            acc.on('identify', (paired, callback) => {
                homematic.log('identify ' + config.name + ' ' + config.description.TYPE + ' ' + config.description.ADDRESS);
                callback();
            });

            acc.addService(hap.Service.Thermostat, config.name, subtypeThermostat)
                .getCharacteristic(hap.Characteristic.CurrentTemperature)
                .setProps({minValue: -40, maxValue: 80})
                .updateValue(actualTemperature);

            acc.getService(subtypeThermostat)
                .getCharacteristic(hap.Characteristic.TargetTemperature)
                .setProps({minValue: 4.5, maxValue: 30.5, minStep: 0.5})
                .updateValue(setTemperature);

            acc.getService(subtypeThermostat)
                .getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
                .setProps({validValues: [0, 1], maxValue: 1})
                .updateValue(currentState());

            acc.getService(subtypeThermostat)
                .getCharacteristic(hap.Characteristic.TargetHeatingCoolingState)
                .setProps({validValues: [0, 1, 3]})
                .updateValue(targetState());

            acc.addService(hap.Service.BatteryService, config.name, subtypeBattery)
                .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat)
                .updateCharacteristic(hap.Characteristic.BatteryLevel, battery);

            acc.isConfigured = true;
        }

        const getListenerCurrentTemperature = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeThermostat + ' CurrentTemperature ' + getError() + ' ' + actualTemperature);
            callback(null, actualTemperature);
        };

        const getListenerTargetTemperature = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeThermostat + ' TargetTemperature ' + getError() + ' ' + setTemperature);
            callback(null, setTemperature);
        };

        const setListenerTargetTemperature = (value, callback) => {
            homematic.debug('set ' + config.name + ' ' + subtypeThermostat + ' TargetTemperature ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'SET_TEMPERATURE', value)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const getListenerTargetHeatingCoolingState = callback => {
            const state = targetState();
            homematic.debug('get ' + config.name + ' ' + subtypeThermostat + ' TargetHeatingCoolingState ' + getError() + ' ' + state);
            callback(null, state);
            setTimeout(() => {
                updateHeatingCoolingState();
            }, 1000);
        };

        const setListenerTargetHeatingCoolingState = (value, callback) => {
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
        };

        const getListenerCurrentHeatingCoolingState = callback => {
            const state = currentState();
            homematic.debug('get ' + config.name + ' ' + subtypeThermostat + ' CurrentHeatingCoolingState ' + getError() + ' ' + state);
            callback(null, state);
            setTimeout(() => {
                updateHeatingCoolingState();
            }, 1000);
        };

        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        const getListenerBattery = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' BatteryLevel ' + getError() + ' ' + battery);
            callback(null, battery);
        };

        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetTemperature).on('get', getListenerTargetTemperature);
        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetTemperature).on('set', setListenerTargetTemperature);
        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.CurrentTemperature).on('get', getListenerCurrentTemperature);
        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetHeatingCoolingState).on('get', getListenerTargetHeatingCoolingState);
        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetHeatingCoolingState).on('set', setListenerTargetHeatingCoolingState);
        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState).on('get', getListenerCurrentTemperature);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).on('get', getListenerBattery);

        function updateHeatingCoolingState() {
            const current = currentState();
            homematic.debug('update ' + config.name + ' 0 CurrentHeatingCoolingState ' + current);
            acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.CurrentHeatingCoolingState, current);
            const target = targetState();
            homematic.debug('update ' + config.name + ' 0 TargetHeatingCoolingState ' + target);
            acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.TargetHeatingCoolingState, target);
        }

        const idSubscription = ccu.subscribe({
            iface: config.iface,
            device: config.description.ADDRESS,
            cache: true,
            change: true
        }, msg => {
            switch (msg.channelIndex + '.' + msg.datapoint) {
                case '0.UNREACH':
                    unreach = msg.value;
                    break;
                case '0.LOWBAT':
                    lowbat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + lowbat);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);
                    break;
                case '4.BATTERY_STATE':
                    battery = batteryPercent(msg.value);
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' BatteryLevel ' + battery);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.BatteryLevel, battery);
                    break;
                case '4.ACTUAL_TEMPERATURE':
                    actualTemperature = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeThermostat + ' CurrentTemperature ' + actualTemperature);
                    acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.CurrentTemperature, actualTemperature);
                    break;
                case '4.SET_TEMPERATURE':
                    setTemperature = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeThermostat + ' TargetTemperature ' + setTemperature);
                    acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.TargetTemperature, setTemperature);
                    updateHeatingCoolingState();
                    break;
                case '4.VALVE_STATE':
                    valveState = msg.value;
                    updateHeatingCoolingState();
                    break;
                case '4.CONTROL_MODE':
                    controlMode = msg.value;
                    updateHeatingCoolingState();
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).removeListener('get', getListenerBattery);
            acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetTemperature).removeListener('get', getListenerTargetTemperature);
            acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.CurrentTemperature).removeListener('get', getListenerCurrentTemperature);
            acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetHeatingCoolingState).removeListener('get', getListenerTargetHeatingCoolingState);
            acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState).removeListener('get', getListenerCurrentHeatingCoolingState);
        });
    }
};
