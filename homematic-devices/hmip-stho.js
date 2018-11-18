module.exports = class HmipStho {
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

        const datapointLowbat = config.iface + '.' + config.description.ADDRESS + ':0.LOW_BAT';
        let lowbat = (ccu.values && ccu.values[datapointLowbat] && ccu.values[datapointLowbat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointVoltage = config.iface + '.' + config.description.ADDRESS + ':0.OPERATING_VOLTAGE';
        let voltage = batteryPercent(ccu.values && ccu.values[datapointVoltage] && ccu.values[datapointVoltage].value) || 0;

        const datapointTemperature = config.iface + '.' + config.description.ADDRESS + ':1.ACTUAL_TEMPERATURE';
        let valueTemperature = (ccu.values && ccu.values[datapointTemperature] && ccu.values[datapointTemperature].value) || 0;

        const datapointHumidity = config.iface + '.' + config.description.ADDRESS + ':1.HUMIDITY';
        let valueHumidity = (ccu.values && ccu.values[datapointHumidity] && ccu.values[datapointHumidity].value) || 0;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtypeTemperature = '0';
        const subtypeHumidity = '1';
        const subtypeBattery = '2';

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

            acc.addService(hap.Service.TemperatureSensor, config.name, subtypeTemperature)
                .updateCharacteristic(hap.Characteristic.StatusFault, unreach)
                .getCharacteristic(hap.Characteristic.CurrentTemperature)
                .setProps({minValue: -40, maxValue: 80})
                .updateValue(valueTemperature);

            acc.addService(hap.Service.HumiditySensor, config.name, subtypeHumidity)
                .updateCharacteristic(hap.Characteristic.CurrentRelativeHumidity, valueHumidity);

            acc.addService(hap.Service.BatteryService, config.name, subtypeBattery);

            acc.isConfigured = true;
        }

        const getListenerTemperature = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeTemperature + ' CurrentTemperature ' + getError() + ' ' + valueTemperature);
            callback(null, valueTemperature);
        };

        const getListenerHumidity = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeHumidity + ' CurrentRelativeHumidity ' + getError() + ' ' + valueHumidity);
            callback(null, valueHumidity);
        };

        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        const getListenerVoltage = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' BatteryLevel ' + getError() + ' ' + voltage);
            callback(null, voltage);
        };

        const getListenerFault = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeTemperature + ' StatusFault ' + getError() + ' ' + unreach);
            callback(null, unreach);
        };

        acc.getService(subtypeHumidity).getCharacteristic(hap.Characteristic.CurrentRelativeHumidity).on('get', getListenerHumidity);
        acc.getService(subtypeTemperature).getCharacteristic(hap.Characteristic.CurrentTemperature).on('get', getListenerTemperature);
        acc.getService(subtypeTemperature).getCharacteristic(hap.Characteristic.StatusFault).on('get', getListenerFault);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).on('get', getListenerVoltage);

        const idSubscription = ccu.subscribe({
            iface: config.iface,
            device: config.description.ADDRESS,
            cache: true,
            change: true
        }, msg => {
            switch (msg.channelIndex + '.' + msg.datapoint) {
                case '0.UNREACH':
                    unreach = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeTemperature + ' StatusFault ' + unreach);
                    acc.getService(subtypeTemperature).updateCharacteristic(hap.Characteristic.StatusFault, unreach);
                    break;
                case '0.LOW_BAT':
                    lowbat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + lowbat);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);
                    break;
                case '0.OPERATING_VOLTAGE':
                    voltage = batteryPercent(msg.value);
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' BatteryLevel ' + voltage);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.BatteryLevel, voltage);
                    break;
                case '1.ACTUAL_TEMPERATURE':
                    valueTemperature = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeTemperature + ' CurrentTemperature ' + valueTemperature);
                    acc.getService(subtypeTemperature).updateCharacteristic(hap.Characteristic.CurrentTemperature, valueTemperature);
                    break;
                case '1.HUMIDITY':
                    valueHumidity = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeHumidity + ' CurrentRelativeHumidity ' + valueHumidity);
                    acc.getService(subtypeHumidity).updateCharacteristic(hap.Characteristic.CurrentRelativeHumidity, valueHumidity);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtypeHumidity).getCharacteristic(hap.Characteristic.CurrentRelativeHumidity).removeListener('get', getListenerHumidity);
            acc.getService(subtypeTemperature).getCharacteristic(hap.Characteristic.CurrentTemperature).removeListener('get', getListenerTemperature);
            acc.getService(subtypeTemperature).getCharacteristic(hap.Characteristic.StatusFault).removeListener('get', getListenerFault);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).removeListener('get', getListenerVoltage);
        });
    }
};
