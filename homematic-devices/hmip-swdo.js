module.exports = class HmipSwdo {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        function batteryPercent(val) {
            let p = Math.round((val - 1) * 200);
            if (p < 0) {
                p = 0;
            } else if (p > 100) {
                p = 100;
            }
            return p;
        }

        const datapointContact = config.iface + '.' + config.description.ADDRESS + ':1.STATE';
        let valueContact = (ccu.values && ccu.values[datapointContact] && ccu.values[datapointContact].value) ?
            hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
            hap.Characteristic.ContactSensorState.CONTACT_DETECTED;

        const datapointLowBat = config.iface + '.' + config.description.ADDRESS + ':0.LOWBAT';
        let lowBat = (ccu.values && ccu.values[datapointLowBat] && ccu.values[datapointLowBat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointOperatingVoltage = config.iface + '.' + config.description.ADDRESS + ':0.OPERATING_VOLTAGE';
        let battery = batteryPercent(ccu.values && ccu.values[datapointOperatingVoltage] && ccu.values[datapointOperatingVoltage].value);

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        const datapointSabotage = config.iface + '.' + config.description.ADDRESS + ':0.SABOTAGE';
        let tampered = Boolean(ccu.values && ccu.values[datapointSabotage] && ccu.values[datapointSabotage].value);

        const datapointError = config.iface + '.' + config.description.ADDRESS + ':0.ERROR_CODE';
        let fault = Boolean(ccu.values && ccu.values[datapointError] && ccu.values[datapointError].value);

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtypeContactSensor = '0';
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

            acc.addService(hap.Service.ContactSensor, config.name, subtypeContactSensor)
                .updateCharacteristic(hap.Characteristic.ContactSensorState, valueContact)
                .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowBat)
                .updateCharacteristic(hap.Characteristic.StatusTampered, tampered)
                .updateCharacteristic(hap.Characteristic.StatusFault, unreach);

            acc.addService(hap.Service.BatteryService, config.name, subtypeBattery)
                .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowBat)
                .updateCharacteristic(hap.Characteristic.BatteryLevel, battery);

            acc.isConfigured = true;
        }

        const getListenerContact = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeContactSensor + ' ContactSensorState ' + getError() + ' ' + valueContact);
            callback(null, valueContact);
        };

        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + getError() + ' ' + lowBat);
            callback(null, lowBat);
        };

        const getListenerBattery = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' BatteryLevel ' + getError() + ' ' + battery);
            callback(null, lowBat);
        };

        const getListenerTampered = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeContactSensor + ' StatusTampered ' + getError() + ' ' + tampered);
            callback(null, tampered);
        };

        const getListenerFault = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeContactSensor + ' StatusFault ' + getError() + ' ' + unreach);
            callback(null, unreach);
        };

        acc.getService(subtypeContactSensor).getCharacteristic(hap.Characteristic.ContactSensorState).on('get', getListenerContact);
        acc.getService(subtypeContactSensor).getCharacteristic(hap.Characteristic.StatusTampered).on('get', getListenerTampered);
        acc.getService(subtypeContactSensor).getCharacteristic(hap.Characteristic.StatusFault).on('get', getListenerFault);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).on('get', getListenerBattery);

        const idSubscription = ccu.subscribe({
            iface: config.iface,
            device: config.description.ADDRESS,
            cache: true,
            change: true
        }, msg => {
            switch (msg.channelIndex + '.' + msg.datapoint) {
                case '0.UNREACH':
                    unreach = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtypeContactSensor + ' StatusFault ' + unreach);
                    acc.getService(subtypeContactSensor).updateCharacteristic(hap.Characteristic.StatusFault, unreach);
                    break;
                case '0.LOW_BAT':
                    lowBat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + lowBat);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowBat);
                    break;
                case '0.OPERATING_VOLTAGE':
                    battery = batteryPercent(msg.value);
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' BatteryLevel ' + battery);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.BatteryLevel, battery);
                    break;
                case '0.SABOTAGE':
                    tampered = Boolean(msg.value);
                    homematic.debug('update ' + config.name + ' ' + subtypeContactSensor + ' StatusTampered ' + tampered);
                    acc.getService(subtypeContactSensor).updateCharacteristic(hap.Characteristic.StatusTampered, tampered);
                    break;
                case '0.ERROR_CODE':
                    fault = Boolean(msg.value);
                    homematic.debug('update ' + config.name + ' ' + subtypeContactSensor + ' StatusFault ' + fault);
                    acc.getService(subtypeContactSensor).updateCharacteristic(hap.Characteristic.StatusFault, fault);
                    break;
                case '1.STATE':
                    valueContact = msg.value ? hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
                    homematic.debug('update ' + config.name + ' ' + subtypeContactSensor + ' ContactSensorState ' + valueContact);
                    acc.getService(subtypeContactSensor).updateCharacteristic(hap.Characteristic.ContactSensorState, valueContact);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtypeContactSensor).getCharacteristic(hap.Characteristic.ContactSensorState).removeListener('get', getListenerContact);
            acc.getService(subtypeContactSensor).getCharacteristic(hap.Characteristic.StatusTampered).removeListener('get', getListenerTampered);
            acc.getService(subtypeContactSensor).getCharacteristic(hap.Characteristic.StatusFault).removeListener('get', getListenerFault);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).removeListener('get', getListenerBattery);
        });
    }
};
