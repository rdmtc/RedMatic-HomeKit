module.exports = class HMLCSw1FM {
    constructor(config, iface) {
        const {bridge, hap, log} = iface;
        const uuid = hap.uuid.generate(config.description.ADDRESS);
        log.info('creating Homematic Device ' + config.description.TYPE + ' ' + config.name + ' ' + uuid);
        const acc = new hap.Accessory(config.name, uuid, hap.Accessory.Categories.OTHER);

        let unreach;

        acc.getService(hap.Service.AccessoryInformation)
            .setCharacteristic(hap.Characteristic.Manufacturer, 'eQ-3')
            .setCharacteristic(hap.Characteristic.Model, config.description.TYPE)
            .setCharacteristic(hap.Characteristic.SerialNumber, config.description.ADDRESS)
            .setCharacteristic(hap.Characteristic.FirmwareRevision, config.description.FIRMWARE);

        acc.on('identify', (paired, callback) => {
            log.info('hap identify ' + config.name + ' ' + config.description.TYPE + ' ' + config.description.ADDRESS);
            callback();
        });

        acc.addService(hap.Service.Switch, config.name, '0')
            .getCharacteristic(hap.Characteristic.On)
            .on('set', (value, callback) => {
                log.debug('< hap set', config.name, 'On', value);
                iface.emit('setValue', {address: config.description.ADDRESS + ':1', datapoint: 'STATE', value});
                callback();
            });

        iface.on('event', msg => {
            if (msg.device === config.description.ADDRESS) {
                switch (msg.channelType) {
                    case 'SWITCH':
                        switch (msg.datapoint) {
                            case 'STATE':
                                log.debug('> hap ' + config.name + ' On ' + msg.value);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.On, unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : msg.value);
                                break;

                            case 'ERROR':

                                break;
                            default:
                        }
                        break;
                    case 'MAINTENANCE':
                        switch (msg.datapoint) {
                            case 'UNREACH':
                                unreach = msg.value;
                                if (msg.value) {
                                    log.debug('> hap ' + config.name + ' SERVICE_COMMUNICATION_FAILURE');
                                    acc.getService('0').updateCharacteristic(hap.Characteristic.On, new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                                }
                                break;

                        }
                        break;
                }
            }
        });


        bridge.addBridgedAccessory(acc);
    }
};
