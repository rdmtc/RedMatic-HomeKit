module.exports = class HmSci3Fm {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const name1 = ccu.channelNames[config.description.ADDRESS + ':1'];
        const name2 = ccu.channelNames[config.description.ADDRESS + ':2'];
        const name3 = ccu.channelNames[config.description.ADDRESS + ':3'];

        const datapointContact1 = config.iface + '.' + config.description.ADDRESS + ':1.STATE';
        let valueContact1 = (ccu.values && ccu.values[datapointContact1] && ccu.values[datapointContact1].value) ?
            hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
            hap.Characteristic.ContactSensorState.CONTACT_DETECTED;

        const datapointContact2 = config.iface + '.' + config.description.ADDRESS + ':2.STATE';
        let valueContact2 = (ccu.values && ccu.values[datapointContact2] && ccu.values[datapointContact2].value) ?
            hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
            hap.Characteristic.ContactSensorState.CONTACT_DETECTED;

        const datapointContact3 = config.iface + '.' + config.description.ADDRESS + ':3.STATE';
        let valueContact3 = (ccu.values && ccu.values[datapointContact3] && ccu.values[datapointContact3].value) ?
            hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
            hap.Characteristic.ContactSensorState.CONTACT_DETECTED;

        const datapointLowbat = config.iface + '.' + config.description.ADDRESS + ':0.LOWBAT';
        let lowbat = (ccu.values && ccu.values[datapointLowbat] && ccu.values[datapointLowbat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtype1 = '1';
        const subtype2 = '2';
        const subtype3 = '3';

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

            acc.addService(hap.Service.ContactSensor, name1, subtype1)
                .updateCharacteristic(hap.Characteristic.ContactSensorState, valueContact1)
                .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat)
                .updateCharacteristic(hap.Characteristic.StatusFault, unreach);

            acc.addService(hap.Service.ContactSensor, name2, subtype2)
                .updateCharacteristic(hap.Characteristic.ContactSensorState, valueContact2)
                .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat)
                .updateCharacteristic(hap.Characteristic.StatusFault, unreach);

            acc.addService(hap.Service.ContactSensor, name3, subtype3)
                .updateCharacteristic(hap.Characteristic.ContactSensorState, valueContact3)
                .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat)
                .updateCharacteristic(hap.Characteristic.StatusFault, unreach);

            acc.isConfigured = true;
        }

        const getListenerContact1 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype1 + ' ContactSensorState ' + getError() + ' ' + valueContact1);
            callback(null, valueContact1);
        };
        const getListenerContact2 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype2 + ' ContactSensorState ' + getError() + ' ' + valueContact2);
            callback(null, valueContact1);
        };
        const getListenerContact3 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype3 + ' ContactSensorState ' + getError() + ' ' + valueContact3);
            callback(null, valueContact1);
        };

        const getListenerLowbat1 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype1 + ' StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        const getListenerFault1 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype1 + ' StatusFault ' + getError() + ' ' + unreach);
            callback(null, unreach);
        };

        const getListenerLowbat2 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype2 + ' StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        const getListenerFault2 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype2 + ' StatusFault ' + getError() + ' ' + unreach);
            callback(null, unreach);
        };

        const getListenerLowbat3 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype3 + ' StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        const getListenerFault3 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype3 + ' StatusFault ' + getError() + ' ' + unreach);
            callback(null, unreach);
        };

        acc.getService(subtype1).getCharacteristic(hap.Characteristic.ContactSensorState).on('get', getListenerContact1);
        acc.getService(subtype2).getCharacteristic(hap.Characteristic.ContactSensorState).on('get', getListenerContact2);
        acc.getService(subtype3).getCharacteristic(hap.Characteristic.ContactSensorState).on('get', getListenerContact3);
        acc.getService(subtype1).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat1);
        acc.getService(subtype1).getCharacteristic(hap.Characteristic.StatusFault).on('get', getListenerFault1);
        acc.getService(subtype2).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat2);
        acc.getService(subtype2).getCharacteristic(hap.Characteristic.StatusFault).on('get', getListenerFault2);
        acc.getService(subtype3).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat3);
        acc.getService(subtype3).getCharacteristic(hap.Characteristic.StatusFault).on('get', getListenerFault3);

        const idSubscription = ccu.subscribe({
            iface: config.iface,
            device: config.description.ADDRESS,
            cache: true,
            change: true
        }, msg => {
            switch (msg.channelIndex + '.' + msg.datapoint) {
                case '0.UNREACH':
                    unreach = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtype1 + ' StatusFault ' + unreach);
                    acc.getService(subtype1).updateCharacteristic(hap.Characteristic.StatusFault, unreach);
                    break;
                case '0.LOWBAT':
                    lowbat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' ' + subtype1 + ' StatusLowBattery ' + lowbat);
                    acc.getService(subtype1).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);
                    break;
                case '1.STATE':
                    valueContact1 = msg.value ? hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
                    homematic.debug('update ' + config.name + ' ' + subtype1 + ' ContactSensorState ' + valueContact1);
                    acc.getService(subtype1).updateCharacteristic(hap.Characteristic.ContactSensorState, valueContact1);
                    break;
                case '2.STATE':
                    valueContact2 = msg.value ? hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
                    homematic.debug('update ' + config.name + ' ' + subtype2 + ' ContactSensorState ' + valueContact2);
                    acc.getService(subtype2).updateCharacteristic(hap.Characteristic.ContactSensorState, valueContact2);
                    break;
                case '3.STATE':
                    valueContact3 = msg.value ? hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
                    homematic.debug('update ' + config.name + ' ' + subtype3 + ' ContactSensorState ' + valueContact3);
                    acc.getService(subtype3).updateCharacteristic(hap.Characteristic.ContactSensorState, valueContact3);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype1).getCharacteristic(hap.Characteristic.ContactSensorState).removeListener('get', getListenerContact1);
            acc.getService(subtype2).getCharacteristic(hap.Characteristic.ContactSensorState).removeListener('get', getListenerContact2);
            acc.getService(subtype3).getCharacteristic(hap.Characteristic.ContactSensorState).removeListener('get', getListenerContact3);
            acc.getService(subtype1).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat1);
            acc.getService(subtype1).getCharacteristic(hap.Characteristic.StatusFault).removeListener('get', getListenerFault1);
            acc.getService(subtype2).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat2);
            acc.getService(subtype2).getCharacteristic(hap.Characteristic.StatusFault).removeListener('get', getListenerFault2);
            acc.getService(subtype3).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat3);
            acc.getService(subtype3).getCharacteristic(hap.Characteristic.StatusFault).removeListener('get', getListenerFault3);
        });
    }
};
