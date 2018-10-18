module.exports = class hmwIo12Sw7Dr {
    hmChannelSwitch(channel, config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        const address = config.description.ADDRESS + ':' + channel;
        const name = ccu.channelNames[address];

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        homematic.debug('creating Homematic Channel ' + address + ' ' + name);

        const acc = bridgeConfig.accessory({id: address, name});
        const subtype = '0';

        const datapointOn = config.iface + '.' + address + '.STATE';
        let valueOn = ccu.values && ccu.values[datapointOn] && ccu.values[datapointOn].value;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

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

            acc.addService(hap.Service.Switch, name, subtype)
                .updateCharacteristic(hap.Characteristic.On, valueOn);

            acc.isConfigured = true;
        }

        const setListener = (value, callback) => {
            homematic.debug('set ' + config.name + ' ' + channel + ' On ' + value);
            ccu.setValue(config.iface, address, 'STATE', value)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const getListener = callback => {
            homematic.debug('get ' + config.name + ' ' + channel + ' On ' + getError() + ' ' + valueOn);
            callback(getError(), valueOn);
        };

        acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('get', getListener);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('set', setListener);

        const idSubscription = ccu.subscribe({
            iface: config.iface,
            device: config.description.ADDRESS,
            cache: true,
            change: true
        }, msg => {
            const stateDp = channel + '.STATE';
            switch (msg.channelIndex + '.' + msg.datapoint) {
                case '0.UNREACH':
                    unreach = msg.value;
                    break;
                case stateDp:
                    valueOn = msg.value;
                    homematic.debug('update ' + config.name + ' 0 On ' + valueOn);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.On, valueOn);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener);
        });
    }

    constructor(config, homematic) {
        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        for (let channel = 13; channel <= 19; channel++) {
            this.hmChannelSwitch(channel, config, homematic);
        }
    }
};

