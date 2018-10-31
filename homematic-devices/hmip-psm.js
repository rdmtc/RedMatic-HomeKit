const Accessory = require('./lib/accessory');

module.exports = class HmipPsm extends Accessory {
    constructor(config, homematic) {
        super(config, homematic);

        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const datapointOn = config.iface + '.' + config.description.ADDRESS + ':3.STATE';
        let valueOn = ccu.values && ccu.values[datapointOn] && ccu.values[datapointOn].value;

        const datapointPower = config.iface + '.' + config.description.ADDRESS + ':6.POWER';
        let valueOutletInUse = (ccu.values && ccu.values[datapointPower] && ccu.values[datapointPower].value) > 0;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

         const subtype = '0';

        if (!this.acc.isConfigured) {

            this.acc.addService(hap.Service.Outlet, config.name, subtype)
                .updateCharacteristic(hap.Characteristic.On, valueOn)
                .updateCharacteristic(hap.Characteristic.OutletInUse, valueOutletInUse);

            this.acc.isConfigured = true;
        }

        const setListener = (value, callback) => {
            homematic.debug('set ' + config.name + ' 0 On ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':3', 'STATE', value)
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

        this.acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('get', getListener);
        this.acc.getService(subtype).getCharacteristic(hap.Characteristic.OutletInUse).on('get', getListenerOutletInUse);
        this.acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('set', setListener);

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
                case '3.STATE':
                    valueOn = msg.value;
                    homematic.debug('update ' + config.name + ' 0 On ' + valueOn);
                    this.acc.getService(subtype).updateCharacteristic(hap.Characteristic.On, valueOn);
                    break;
                case '6.POWER':
                    valueOutletInUse = msg.value > 0;
                    homematic.debug('update ' + config.name + ' 0 OutletInUse ' + valueOutletInUse);
                    this.acc.getService(subtype).updateCharacteristic(hap.Characteristic.OutletInUse, valueOutletInUse);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            this.acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener);
            this.acc.getService(subtype).getCharacteristic(hap.Characteristic.OutletInUse).removeListener('get', getListenerOutletInUse);
            this.acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener);
        });
    }
};
