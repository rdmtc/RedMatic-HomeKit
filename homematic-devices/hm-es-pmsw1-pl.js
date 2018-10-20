module.exports = class HmEsPmsw1Pl {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const datapointState = config.iface + '.' + config.description.ADDRESS + ':1.STATE';
        let valueOn = ccu.values && ccu.values[datapointState] && ccu.values[datapointState].value;

        const datapointPower = config.iface + '.' + config.description.ADDRESS + ':2.POWER';
        let valueOutletInUse = (ccu.values && ccu.values[datapointPower] && ccu.values[datapointPower].value) > 0;

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

            acc.addService(hap.Service.Outlet, config.name, subtype)
                .updateCharacteristic(hap.Characteristic.On, valueOn)
                .updateCharacteristic(hap.Characteristic.OutletInUse, valueOutletInUse);

            acc.isConfigured = true;
        }

        const setListener = (value, callback) => {
            homematic.debug('set ' + config.name + ' 0 On ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'STATE', value)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const getListener = callback => {
            homematic.debug('get ' + config.name + ' 0 On ' + getError() + ' ' + valueOn);
            callback(getError(), valueOn);
        };

        const getListenerOutletInUse = callback => {
            homematic.debug('get ' + config.name + ' 0 OutletInUse ' + getError() + ' ' + valueOutletInUse);
            callback(getError(), valueOn);
        };

        acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('get', getListener);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.OutletInUse).on('get', getListenerOutletInUse);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('set', setListener);

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
                    valueOn = msg.value;
                    homematic.debug('update ' + config.name + ' 0 On ' + valueOn);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.On, valueOn);
                    break;
                case '2.POWER':
                    valueOutletInUse = msg.value > 0;
                    homematic.debug('update ' + config.name + ' 0 OutletInUse ' + valueOutletInUse);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.OutletInUse, valueOutletInUse);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.OutletInUse).removeListener('get', getListenerOutletInUse);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener);
        });
    }
};
