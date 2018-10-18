module.exports = class HmCcTc {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const links = ccu.getLinks(config.iface, config.description.ADDRESS + ':2');
        homematic.debug(config.name + ' ' + config.description.ADDRESS + ' linked to ' + JSON.stringify(links));

        let datapointValveState;
        let valveStateDevice;
        if (links[0]) {
            valveStateDevice = links[0].split(':')[0];
            datapointValveState = config.iface + '.' + valveStateDevice + ':1.VALVE_STATE';
        }

        const datapointTemperature = config.iface + '.' + config.description.ADDRESS + ':1.TEMPERATURE';
        let temperature = (ccu.values && ccu.values[datapointTemperature] && ccu.values[datapointTemperature].value) || 0;

        const datapointHumidity = config.iface + '.' + config.description.ADDRESS + ':1.HUMIDITY';
        let humidity = (ccu.values && ccu.values[datapointHumidity] && ccu.values[datapointHumidity].value) || 0;

        let valveState = datapointValveState ? ((ccu.values && ccu.values[datapointValveState] && ccu.values[datapointValveState].value) || 0) : 0;

        const datapointSetpoint = config.iface + '.' + config.description.ADDRESS + ':2.SETPOINT';
        let valueSetpoint = (ccu.values && ccu.values[datapointSetpoint] && ccu.values[datapointSetpoint].value) || 0;

        const datapointLowbat = config.iface + '.' + config.description.ADDRESS + ':0.LOWBAT';
        let lowbat = (ccu.values && ccu.values[datapointLowbat] && ccu.values[datapointLowbat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        function targetState() {
            // 0=off, 1=heat, 3=auto
            const target = valueSetpoint > 5.5 ? 1 : 0;
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
        const subtypeHumidity = '2';

        if (!acc.isConfigured) {
            acc.getService(hap.Service.AccessoryInformation)
                .setCharacteristic(hap.Characteristic.Manufacturer, 'eQ-3')
                .setCharacteristic(hap.Characteristic.Model, config.description.TYPE)
                .setCharacteristic(hap.Characteristic.SerialNumber, config.description.ADDRESS)
                .setCharacteristic(hap.Characteristic.FirmwareRevision, config.description.FIRMWARE);

            acc.on('identify', (paired, callback) => {
                homematic.debug('identify ' + config.name + ' ' + config.description.TYPE + ' ' + config.description.ADDRESS);
                callback();
            });

            acc.addService(hap.Service.Thermostat, config.name, subtypeThermostat)
                .getCharacteristic(hap.Characteristic.CurrentTemperature)
                .setProps({minValue: -40, maxValue: 80})
                .updateValue(temperature);

            acc.getService(subtypeThermostat)
                .getCharacteristic(hap.Characteristic.TargetTemperature)
                .setProps({minValue: 5.5, maxValue: 30.5, minStep: 0.5})
                .updateValue(valueSetpoint);

            acc.getService(subtypeThermostat)
                .getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
                .setProps({validValues: [0, 1], maxValue: 1})
                .updateValue(currentState());

            acc.getService(subtypeThermostat)
                .getCharacteristic(hap.Characteristic.TargetHeatingCoolingState)
                .setProps({validValues: [0, 1]})
                .updateValue(targetState());

            acc.addService(hap.Service.HumiditySensor, config.name, subtypeHumidity)
                .updateCharacteristic(hap.Characteristic.CurrentRelativeHumidity, humidity);

            acc.addService(hap.Service.BatteryService, config.name, subtypeBattery);

            acc.isConfigured = true;
        }

        const getListenerCurrentTemperature = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeThermostat + ' CurrentTemperature ' + getError() + ' ' + temperature);
            callback(null, temperature);
        };

        const getListenerCurrentRelativeHumidity = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeHumidity + ' CurrentRelativeHumidity ' + getError() + ' ' + humidity);
            callback(null, humidity);
        };

        const getListenerTargetTemperature = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeThermostat + ' TargetTemperature ' + getError() + ' ' + valueSetpoint);
            callback(null, valueSetpoint);
        };

        const setListenerTargetTemperature = (value, callback) => {
            homematic.debug('set ' + config.name + ' ' + subtypeThermostat + ' TargetTemperature ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':2', 'SETPOINT', value)
                .then(() => {
                    callback();
                    updateHeatingCoolingState();
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

        const getListenerCurrentHeatingCoolingState = callback => {
            const state = currentState();
            homematic.debug('get ' + config.name + ' ' + subtypeThermostat + ' CurrentHeatingCoolingState ' + getError() + ' ' + state);
            callback(null, state);
            setTimeout(() => {
                updateHeatingCoolingState();
            }, 1000);
        };

        const setListenerTargetHeatingCoolingState = (value, callback) => {
            // 0=off, 1=heat, 3=auto
            homematic.debug('set ' + config.name + ' 0 TargetHeatingCoolingState ' + value);
            if (value === 0) {
                ccu.setValue(config.iface, config.description.ADDRESS + ':2', 'SETPOINT', 5.5)
                    .then(() => {
                        callback();
                    })
                    .catch(() => {
                        callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
            } else {
                ccu.setValue(config.iface, config.description.ADDRESS + ':2', 'SETPOINT', 21)
                    .then(() => {
                        callback();
                    })
                    .catch(() => {
                        callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
            }
        };

        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetTemperature).on('get', getListenerTargetTemperature);
        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetTemperature).on('set', setListenerTargetTemperature);
        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetHeatingCoolingState).on('set', setListenerTargetHeatingCoolingState);
        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.CurrentTemperature).on('get', getListenerCurrentTemperature);
        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetHeatingCoolingState).on('get', getListenerTargetHeatingCoolingState);
        acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState).on('get', getListenerCurrentTemperature);
        acc.getService(subtypeHumidity).getCharacteristic(hap.Characteristic.CurrentRelativeHumidity).on('get', getListenerCurrentRelativeHumidity);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);

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
                case '1.TEMPERATURE':
                    temperature = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeThermostat + ' CurrentTemperature ' + temperature);
                    acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.CurrentTemperature, temperature);
                    break;
                case '1.HUMIDITY':
                    humidity = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeHumidity + ' CurrentTemperature ' + humidity);
                    acc.getService(subtypeHumidity).updateCharacteristic(hap.Characteristic.CurrentRelativeHumidity, humidity);
                    break;
                case '2.SETPOINT':
                    valueSetpoint = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeThermostat + ' TargetTemperature ' + valueSetpoint);
                    acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.TargetTemperature, valueSetpoint);
                    updateHeatingCoolingState();
                    break;
                default:
            }
        });

        let idSubscriptionValveState;

        if (datapointValveState) {
            idSubscriptionValveState = ccu.subscribe({
                iface: config.iface,
                device: valveStateDevice,
                cache: true,
                change: true
            }, msg => {
                switch (msg.channelIndex + '.' + msg.datapoint) {
                    case '1.VALVE_STATE':
                        valveState = msg.value;
                        updateHeatingCoolingState();
                        break;
                    default:
                }
            });
        }

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            if (idSubscriptionValveState) {
                ccu.unsubscribe(idSubscriptionValveState);
            }
            acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetTemperature).removeListener('get', getListenerTargetTemperature);
            acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetTemperature).removeListener('set', setListenerTargetTemperature);
            acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetHeatingCoolingState).removeListener('set', setListenerTargetHeatingCoolingState);
            acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.CurrentTemperature).removeListener('get', getListenerCurrentTemperature);
            acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.TargetHeatingCoolingState).removeListener('get', getListenerTargetHeatingCoolingState);
            acc.getService(subtypeThermostat).getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState).removeListener('get', getListenerCurrentTemperature);
            acc.getService(subtypeHumidity).getCharacteristic(hap.Characteristic.CurrentRelativeHumidity).removeListener('get', getListenerCurrentRelativeHumidity);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat);
        });
    }
};
