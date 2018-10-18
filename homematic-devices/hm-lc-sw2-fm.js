module.exports = class HmSw2 {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const name1 = ccu.channelNames[config.description.ADDRESS + ':1'];
        const name2 = ccu.channelNames[config.description.ADDRESS + ':2'];

        const datapointOn1 = config.iface + '.' + config.description.ADDRESS + ':1.STATE';
        let valueOn1 = ccu.values && ccu.values[datapointOn1] && ccu.values[datapointOn1].value;

        const datapointOn2 = config.iface + '.' + config.description.ADDRESS + ':2.STATE';
        const valueOn2 = ccu.values && ccu.values[datapointOn2] && ccu.values[datapointOn2].value;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtype1 = '1';
        const subtype2 = '2';

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

        const getListener1 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype1 + ' On ' + getError() + ' ' + valueOn1);
            callback(getError(), valueOn1);
        };

        const getListener2 = callback => {
            homematic.debug('get ' + config.name + ' ' + subtype2 + ' On ' + getError() + ' ' + valueOn2);
            callback(getError(), valueOn1);
        };

        acc.getService(subtype1).getCharacteristic(hap.Characteristic.On).on('get', getListener1);
        acc.getService(subtype2).getCharacteristic(hap.Characteristic.On).on('get', getListener2);
        acc.getService(subtype1).getCharacteristic(hap.Characteristic.On).on('set', setListener1);
        acc.getService(subtype2).getCharacteristic(hap.Characteristic.On).on('set', setListener2);

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
                    valueOn1 = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtype2 + ' On ' + valueOn2);
                    acc.getService(subtype2).updateCharacteristic(hap.Characteristic.On, valueOn2);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype1).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener1);
            acc.getService(subtype2).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener2);
            acc.getService(subtype1).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener1);
            acc.getService(subtype2).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener2);
        });
    }
};

