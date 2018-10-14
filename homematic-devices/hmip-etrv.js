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

        const datapointTemperature = config.iface + '.' + config.description.ADDRESS + ':1.ACTUAL_TEMPERATURE';
        let valueTemperature = (ccu.values && ccu.values[datapointTemperature] && ccu.values[datapointTemperature].value) || 0;

        const datapointLevel = config.iface + '.' + config.description.ADDRESS + ':1.LEVEL';
        let valueLevel = (ccu.values && ccu.values[datapointLevel] && ccu.values[datapointLevel].value) || 0;

        const datapointSetpoint = config.iface + '.' + config.description.ADDRESS + ':1.SET_POINT_TEMPERATURE';
        let valueSetpoint = (ccu.values && ccu.values[datapointSetpoint] && ccu.values[datapointSetpoint].value) || 0;


        const datapointLowbat = config.iface + '.' + config.description.ADDRESS + ':0.LOW_BAT';
        let lowbat = (ccu.values && ccu.values[datapointLowbat] && ccu.values[datapointLowbat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointVoltage = config.iface + '.' + config.description.ADDRESS + ':0.OPERATING_VOLTAGE';
        let battery = batteryPercent(ccu.values && ccu.values[datapointVoltage] && ccu.values[datapointVoltage].value);

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;



        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        function targetState() {
            // 0=off, 1=heat, 3=auto
            return valueSetpoint > 12 ? 3 : 0;
        }

        function currentState() {
            // 0=off, 1=heat
            return (valueLevel > 0 && valueSetpoint > 12) ? 1 : 0;

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
                .updateValue(valueTemperature)

            acc.getService(subtypeThermostat)
                .getCharacteristic(hap.Characteristic.TargetTemperature)
                .setProps({minValue: 4.5, maxValue: 30.5, minStep: 0.5})
                .updateValue(valueSetpoint);

            acc.getService(subtypeThermostat)
                .getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
                .setProps({validValues: [0, 1], maxValue: 1})
                .updateValue(currentState());

            acc.getService(subtypeThermostat)
                .getCharacteristic(hap.Characteristic.TargetHeatingCoolingState)
                .setProps({validValues: [0, 3]})
                .updateValue(targetState());

            acc.addService(hap.Service.BatteryService, config.name, subtypeBattery);

            acc.isConfigured = true;
        }

        const getListenerCurrentTemperature = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeThermostat + ' CurrentTemperature ' + getError() + ' ' + valueTemperature);
            callback(null, valueTemperature);
        };

        const getListenerTargetTemperature = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeThermostat + ' TargetTemperature ' + getError() + ' ' + valueSetpoint);
            callback(null, valueSetpoint);
        };

        const setListenerTargetTemperature = (value, callback) => {
            homematic.log('set ' + config.name + ' ' + subtypeThermostat + ' TargetTemperature ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'SET_POINT_TEMPERATURE', value)
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
        };

        const setListenerTargetHeatingCoolingState = (value, callback) => {
            homematic.log('set ' + config.name + ' 0 TargetHeatingCoolingState ' + value);
            callback();
        };

        const getListenerCurrentHeatingCoolingState = callback => {
            const state = currentState();
            homematic.debug('get ' + config.name + ' ' + subtypeThermostat + ' CurrentHeatingCoolingState ' + getError() + ' ' + state);
            callback(null, state);
        };


        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        const getListenerBattery = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' Batterylevel ' + getError() + ' ' + battery);
            callback(null, lowbat);
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
                    homematic.debug('update ' + config.name + ' ' + subtypeThermostat + ' StatusFault ' + unreach);
                    acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.StatusFault, unreach);
                    break;
                case '0.OPERATING_VOLTAGE':
                    battery = batteryPercent(msg.value);
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' BatteryLevel ' + battery);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.BatteryLevel, battery);
                    break;
                case '0.LOW_BAT':
                    lowbat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + lowbat);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);
                    break;
                case '1.ACTUAL_TEMPERATURE':
                    valueTemperature = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeThermostat + ' CurrentTemperature ' + valueTemperature);
                    acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.CurrentTemperature, valueTemperature);
                    break;
                case '1.SET_POINT_TEMPERATURE':
                    valueSetpoint = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeThermostat + ' TargetTemperature ' + valueSetpoint);
                    acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.TargetTemperature, valueSetpoint);
                    updateHeatingCoolingState();
                    break;
                case '1.LEVEL':
                    valueLevel = msg.value;
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
