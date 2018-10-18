module.exports = class HmSw2 {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const name1 = ccu.channelNames[config.description.ADDRESS + ':1'];
        const name2 = ccu.channelNames[config.description.ADDRESS + ':2'];
        const name3 = ccu.channelNames[config.description.ADDRESS + ':3'];
        const name4 = ccu.channelNames[config.description.ADDRESS + ':4'];

        const datapointOn1 = config.iface + '.' + config.description.ADDRESS + ':1.STATE';
        let valueOn1 = ccu.values && ccu.values[datapointOn1] && ccu.values[datapointOn1].value;

        const datapointOn2 = config.iface + '.' + config.description.ADDRESS + ':2.STATE';
        let valueOn2 = ccu.values && ccu.values[datapointOn2] && ccu.values[datapointOn2].value;

        const datapointOn3 = config.iface + '.' + config.description.ADDRESS + ':3.STATE';
        let valueOn3 = ccu.values && ccu.values[datapointOn3] && ccu.values[datapointOn3].value;

        const datapointOn4 = config.iface + '.' + config.description.ADDRESS + ':4.STATE';
        let valueOn4 = ccu.values && ccu.values[datapointOn4] && ccu.values[datapointOn4].value;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtype1 = '1';
        const subtype2 = '2';
        const subtype3 = '3';
        const subtype4 = '4';

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

            acc.addService(hap.Service.Switch, name1, subtype1)
                .updateCharacteristic(hap.Characteristic.On, valueOn1);

            acc.addService(hap.Service.Switch, name2, subtype2)
                .updateCharacteristic(hap.Characteristic.On, valueOn2);

            acc.addService(hap.Service.Switch, name3, subtype3)
                .updateCharacteristic(hap.Characteristic.On, valueOn3);

            acc.addService(hap.Service.Switch, name4, subtype4)
                .updateCharacteristic(hap.Characteristic.On, valueOn4);

            acc.isConfigured = true;
        }

        const setListener1 = (value, callback) => {
            homematic.debug('set ' + config.name + ' ' + subtype1 + ' On ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'STATE', value)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const setListener2 = (value, callback) => {
            homematic.debug('set ' + config.name + ' ' + subtype2 + ' On ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':2', 'STATE', value)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const setListener3 = (value, callback) => {
            homematic.debug('set ' + config.name + ' ' + subtype3 + ' On ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':3', 'STATE', value)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const setListener4 = (value, callback) => {
            homematic.debug('set ' + config.name + ' ' + subtype4 + ' On ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'STATE', value)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const getListener1 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype1 + ' On ' + getError() + ' ' + valueOn1);
            callback(getError(), valueOn1);
        };

        const getListener2 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype2 + ' On ' + getError() + ' ' + valueOn2);
            callback(getError(), valueOn2);
        };

        const getListener3 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype3 + ' On ' + getError() + ' ' + valueOn3);
            callback(getError(), valueOn3);
        };

        const getListener4 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype4 + ' On ' + getError() + ' ' + valueOn4);
            callback(getError(), valueOn4);
        };

        acc.getService(subtype1).getCharacteristic(hap.Characteristic.On).on('get', getListener1);
        acc.getService(subtype2).getCharacteristic(hap.Characteristic.On).on('get', getListener2);
        acc.getService(subtype3).getCharacteristic(hap.Characteristic.On).on('get', getListener3);
        acc.getService(subtype4).getCharacteristic(hap.Characteristic.On).on('get', getListener4);
        acc.getService(subtype1).getCharacteristic(hap.Characteristic.On).on('set', setListener1);
        acc.getService(subtype2).getCharacteristic(hap.Characteristic.On).on('set', setListener2);
        acc.getService(subtype3).getCharacteristic(hap.Characteristic.On).on('set', setListener3);
        acc.getService(subtype4).getCharacteristic(hap.Characteristic.On).on('set', setListener4);

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
                case '1.STATE':
                    valueOn1 = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtype1 + ' On ' + valueOn1);
                    acc.getService(subtype1).updateCharacteristic(hap.Characteristic.On, valueOn1);
                    break;
                case '2.STATE':
                    valueOn2 = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtype2 + ' On ' + valueOn2);
                    acc.getService(subtype2).updateCharacteristic(hap.Characteristic.On, valueOn2);
                    break;
                case '3.STATE':
                    valueOn3 = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtype3 + ' On ' + valueOn3);
                    acc.getService(subtype3).updateCharacteristic(hap.Characteristic.On, valueOn3);
                    break;
                case '4.STATE':
                    valueOn4 = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtype4 + ' On ' + valueOn4);
                    acc.getService(subtype4).updateCharacteristic(hap.Characteristic.On, valueOn4);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype1).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener1);
            acc.getService(subtype2).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener2);
            acc.getService(subtype3).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener3);
            acc.getService(subtype4).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener4);
            acc.getService(subtype1).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener1);
            acc.getService(subtype2).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener2);
            acc.getService(subtype3).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener3);
            acc.getService(subtype4).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener4);
        });
    }
};

