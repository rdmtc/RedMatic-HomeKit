module.exports = class HmDim1 {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const datapointBrightness = config.iface + '.' + config.description.ADDRESS + ':1.LEVEL';
        let valueBrightness = ((ccu.values && ccu.values[datapointBrightness] && ccu.values[datapointBrightness].value) * 100) || 0;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

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

            acc.addService(hap.Service.Lightbulb, config.name, subtype)
                .updateCharacteristic(hap.Characteristic.On, Boolean(valueBrightness))
                .updateCharacteristic(hap.Characteristic.Brightness, valueBrightness);

            acc.isConfigured = true;
        }

        const setListenerBrightness = (value, callback) => {
            homematic.debug('set ' + config.name + ' 0 Brightness ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'LEVEL', value / 100)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const setListenerOn = (value, callback) => {
            homematic.debug('set ' + config.name + ' 0 On ' + value);
            if (valueBrightness === 0 || !value) {
                ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'LEVEL', value ? 1 : 0)
                    .then(() => {
                        callback();
                    })
                    .catch(() => {
                        callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
            } else {
                callback();
            }
        };

        const getListenerBrightness = callback => {
            homematic.debug('get ' + config.name + ' 0 Brightness ' + getError() + ' ' + valueBrightness);
            callback(getError(), valueBrightness);
        };

        const getListenerOn = callback => {
            homematic.debug('get ' + config.name + ' 0 On ' + getError() + ' ' + valueBrightness);
            callback(getError(), Boolean(valueBrightness));
        };

        acc.getService(subtype).getCharacteristic(hap.Characteristic.Brightness).on('get', getListenerBrightness);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('get', getListenerOn);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.Brightness).on('set', setListenerBrightness);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('set', setListenerOn);

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
                case '1.LEVEL':
                    if (!msg.working) {
                        valueBrightness = msg.value * 100;
                        const valueOn = Boolean(msg.value);
                        homematic.debug('update ' + config.name + ' 0 On ' + valueOn);
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.On, valueOn);
                        homematic.debug('update ' + config.name + ' 0 Brightness ' + valueBrightness);
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.Brightness, valueBrightness);
                    }
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.Brightness).removeListener('get', getListenerBrightness);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('get', getListenerOn);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.Brightness).removeListener('set', setListenerBrightness);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('set', setListenerOn);
        });
    }
};

