module.exports = class HmSecSc {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const datapointContact = config.iface + '.' + config.description.ADDRESS + ':1.STATE';
        let valueContact = (ccu.values && ccu.values[datapointContact] && ccu.values[datapointContact].value) ?
            hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
            hap.Characteristic.ContactSensorState.CONTACT_DETECTED;

        const datapointLowbat = config.iface + '.' + config.description.ADDRESS + ':0.LOWBAT';
        let lowbat = (ccu.values && ccu.values[datapointLowbat] && ccu.values[datapointLowbat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        const datapointTampered = config.iface + '.' + config.description.ADDRESS + ':1.ERROR';
        let tampered = Boolean(ccu.values && ccu.values[datapointTampered] && ccu.values[datapointTampered].value);

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtype = '0';

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

            acc.addService(hap.Service.ContactSensor, config.name, subtype)
                .updateCharacteristic(hap.Characteristic.ContactSensorState, valueContact)
                .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat)
                .updateCharacteristic(hap.Characteristic.StatusTampered, tampered)
                .updateCharacteristic(hap.Characteristic.StatusFault, unreach);

            acc.isConfigured = true;
        }

        const getListenerContact = callback => {
            homematic.debug('get ' + config.name + ' 0 ContactSensorState ' + getError() + ' ' + valueContact);
            callback(null, valueContact);
        };

        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' 0 StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        const getListenerTampered = callback => {
            homematic.debug('get ' + config.name + ' 0 StatusTampered ' + getError() + ' ' + tampered);
            callback(null, tampered);
        };

        const getListenerFault = callback => {
            homematic.debug('get ' + config.name + ' 0 StatusFault ' + getError() + ' ' + unreach);
            callback(null, unreach);
        };

        acc.getService(subtype).getCharacteristic(hap.Characteristic.ContactSensorState).on('get', getListenerContact);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusTampered).on('get', getListenerTampered);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusFault).on('get', getListenerFault);

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
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.StatusFault, unreach);
                    break;
                case '0.LOWBAT':
                    lowbat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' 0 StatusLowBattery ' + lowbat);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);
                    break;
                case '1.ERROR':
                    tampered = Boolean(msg.value);
                    homematic.debug('update ' + config.name + ' 0 StatusTampered ' + tampered);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.StatusTampered, tampered);
                    break;
                case '1.STATE':
                    valueContact = msg.value ? hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
                    homematic.debug('update ' + config.name + ' 0 ContactSensorState ' + valueContact);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.ContactSensorState, valueContact);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.ContactSensorState).removeListener('get', getListenerContact);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusTampered).removeListener('get', getListenerTampered);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusFault).removeListener('get', getListenerFault);
        });
    }
};
