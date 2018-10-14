module.exports = class HmipSpi {
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

        const datapointOccupancy = config.iface + '.' + config.description.ADDRESS + ':1.PRESENCE_DETECTION_STATE';
        let valueOccupancy = Boolean(ccu.values && ccu.values[datapointOccupancy] && ccu.values[datapointOccupancy].value);

        const datapointBrightness = config.iface + '.' + config.description.ADDRESS + ':1.ILLUMINATION';
        let valueBrightness = (ccu.values && ccu.values[datapointBrightness] && ccu.values[datapointBrightness].value) || 0;

        const datapointLowbat = config.iface + '.' + config.description.ADDRESS + ':0.LOW_BAT';
        let lowbat = (ccu.values && ccu.values[datapointLowbat] && ccu.values[datapointLowbat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointVoltage = config.iface + '.' + config.description.ADDRESS + ':0.OPERATING_VOLTAGE';
        let voltage = batteryPercent(ccu.values && ccu.values[datapointVoltage] && ccu.values[datapointVoltage].value) || 0;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        const datapointTampered = config.iface + '.' + config.description.ADDRESS + ':0.SABOTAGE';
        let tampered = Boolean(ccu.values && ccu.values[datapointTampered] && ccu.values[datapointTampered].value);

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtypeOccupancy = '0';
        const subtypeBrightness = '1';
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

            acc.addService(hap.Service.OccupancySensor, config.name, subtypeOccupancy);
            acc.addService(hap.Service.LightSensor, config.name, subtypeBrightness);
            acc.addService(hap.Service.BatteryService, config.name, subtypeBattery);
            acc.isConfigured = true;
        }

        const getListenerBrightness = callback => {
            homematic.debug('get ' + config.name + ' 1 CurrentAmbientLightLevel ' + getError() + ' ' + valueBrightness);
            callback(null, valueBrightness);
        };

        const getListenerOccupancy = callback => {
            homematic.debug('get ' + config.name + ' 0 OccupancyDetected ' + getError() + ' ' + valueOccupancy);
            callback(null, valueOccupancy);
        };

        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' 2 StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        const getListenerVoltage = callback => {
            homematic.debug('get ' + config.name + ' 2 BatteryLevel ' + getError() + ' ' + voltage);
            callback(null, voltage);
        };

        const getListenerTampered = callback => {
            homematic.debug('get ' + config.name + ' 0 StatusTampered ' + getError() + ' ' + tampered);
            callback(null, tampered);
        };

        const getListenerFault = callback => {
            homematic.debug('get ' + config.name + ' 0 StatusFault ' + getError() + ' ' + unreach);
            callback(null, unreach);
        };

        acc.getService(subtypeOccupancy).getCharacteristic(hap.Characteristic.OccupancyDetected).on('get', getListenerOccupancy);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).on('get', getListenerVoltage);
        acc.getService(subtypeOccupancy).getCharacteristic(hap.Characteristic.StatusTampered).on('get', getListenerTampered);
        acc.getService(subtypeOccupancy).getCharacteristic(hap.Characteristic.StatusFault).on('get', getListenerFault);
        acc.getService(subtypeBrightness).getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel).on('get', getListenerBrightness);

        const idSubscription = ccu.subscribe({
            iface: config.iface,
            device: config.description.ADDRESS,
            cache: true,
            change: true
        }, msg => {
            switch (msg.channelIndex + '.' + msg.datapoint) {
                case '0.UNREACH':
                    unreach = msg.value;
                    homematic.debug('update ' + config.name + ' 0 StatusFault ' + unreach);
                    acc.getService(subtypeOccupancy).updateCharacteristic(hap.Characteristic.StatusFault, unreach);
                    break;
                case '0.LOW_BAT':
                    lowbat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' 2 StatusLowBattery ' + lowbat);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);
                    break;
                case '0.OPERATING_VOLTAGE':
                    voltage = batteryPercent(msg.value);
                    homematic.debug('update ' + config.name + ' 2 BatteryLevel ' + voltage);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.BatteryLevel, voltage);
                    break;
                case '0.SABOTAGE':
                    tampered = msg.value;
                    homematic.debug('update ' + config.name + ' 0 StatusTampered ' + tampered);
                    acc.getService(subtypeOccupancy).updateCharacteristic(hap.Characteristic.StatusTampered, tampered);
                    break;
                case '1.PRESENCE_DETECTION_STATE':
                    valueOccupancy = msg.value;
                    homematic.debug('update ' + config.name + ' 0 OccupancyDetected ' + valueOccupancy);
                    acc.getService(subtypeOccupancy).updateCharacteristic(hap.Characteristic.OccupancyDetected, valueOccupancy);
                    break;
                case '1.ILLUMINATION':
                    valueBrightness = msg.value;
                    homematic.debug('update ' + config.name + ' 1 CurrentAmbientLightLevel ' + valueBrightness);
                    acc.getService(subtypeBrightness).updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, valueBrightness);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtypeBrightness).getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel).removeListener('get', getListenerBrightness);
            acc.getService(subtypeOccupancy).getCharacteristic(hap.Characteristic.OccupancyDetected).removeListener('get', getListenerOccupancy);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).removeListener('get', getListenerVoltage);
            acc.getService(subtypeOccupancy).getCharacteristic(hap.Characteristic.StatusTampered).removeListener('get', getListenerTampered);
            acc.getService(subtypeOccupancy).getCharacteristic(hap.Characteristic.StatusFault).removeListener('get', getListenerFault);
        });
    }
};
