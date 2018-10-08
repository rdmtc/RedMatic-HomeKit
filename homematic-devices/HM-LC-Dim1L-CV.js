module.exports = class HMLCDim1LCV {
    constructor(config, iface) {
        const {bridge, hap, log} = iface;
        const uuid = hap.uuid.generate(config.description.ADDRESS);
        log.info('creating Homematic Device ' + config.description.TYPE + ' ' + config.name + ' ' + uuid);
        const acc = new hap.Accessory(config.name, uuid, hap.Accessory.Categories.OTHER);

        let unreach;
        let currentLevel;

        acc.getService(hap.Service.AccessoryInformation)
            .setCharacteristic(hap.Characteristic.Manufacturer, 'eQ-3')
            .setCharacteristic(hap.Characteristic.Model, config.description.TYPE)
            .setCharacteristic(hap.Characteristic.SerialNumber, config.description.ADDRESS)
            .setCharacteristic(hap.Characteristic.FirmwareRevision, config.description.FIRMWARE);

        acc.on('identify', (paired, callback) => {
            log.info('[homekit] hap identify ' + config.name + ' ' + config.description.TYPE + ' ' + config.description.ADDRESS);
            callback();
        });

        acc.addService(hap.Service.Lightbulb, config.name, '0')
            .getCharacteristic(hap.Characteristic.On)
            .on('set', (value, callback) => {
                log.trace('[homekit] < hap ' + config.name + ' On ' + value);
                if (value && !currentLevel) {
                    iface.emit('setValue', {address: config.description.ADDRESS + ':1', datapoint: 'LEVEL', value: 100});
                } else if (!value) {
                    iface.emit('setValue', {address: config.description.ADDRESS + ':1', datapoint: 'LEVEL', value: 0});
                }
                callback();
            });

        acc.getService('0')
            .getCharacteristic(hap.Characteristic.Brightness)
            .on('set', (value, callback) => {
                log.trace('[homekit] < hap ' + config.name + ' Brightness ' + value);
                iface.emit('setValue', {
                    address: config.description.ADDRESS + ':1',
                    datapoint: 'LEVEL',
                    value: value / 100
                });
                callback();
            });

        iface.on('event', msg => {
            let val;
            if (msg.device === config.description.ADDRESS) {
                switch (msg.channelType) {
                    case 'DIMMER':
                        switch (msg.datapoint) {
                            case 'LEVEL':
                                if (msg.working || msg.direction) {
                                    return;
                                }
                                val = msg.value * 100;
                                currentLevel = val;
                                log.trace('[homekit] > hap ' + config.name + ' On ' + Boolean(val));
                                acc.getService('0').updateCharacteristic(hap.Characteristic.On, unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : Boolean(val));
                                log.trace('[homekit] > hap ' + config.name + ' Brightness ' + val);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.Brightness, unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : val);
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
                                    log.trace('[homekit] > hap ' + config.name + ' SERVICE_COMMUNICATION_FAILURE');
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
