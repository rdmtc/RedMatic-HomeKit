module.exports = class HmSecKey {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        const datapointLowbat = config.iface + '.' + config.description.ADDRESS + ':0.LOWBAT';
        let lowbat = (ccu.values && ccu.values[datapointLowbat] && ccu.values[datapointLowbat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtypeLock = '0';
        const subtypeBattery = '1';

        const getCurrentState = () => {
            const address = config.iface + '.' + config.description.ADDRESS + ':1';
            const dpJammed = address + '.ERROR';
            const dpUnknown = address + '.STATE_UNCERTAIN';
            const dpState = address + '.STATE';

            const jammed = ccu.values && ccu.values[dpJammed] && ccu.values[dpJammed].value;
            const unknown = ccu.values && ccu.values[dpUnknown] && ccu.values[dpUnknown].value;
            const state = ccu.values && ccu.values[dpState] && ccu.values[dpState].value;

            if (jammed) {
                return hap.Characteristic.LockCurrentState.JAMMED;
            }
            if (unknown) {
                return hap.Characteristic.LockCurrentState.UNKNOWN;
            }
            if (!state) {
                return hap.Characteristic.LockCurrentState.SECURED;
            }
            return hap.Characteristic.LockCurrentState.UNSECURED;
        };

        const getTargetState = () => {
            const address = config.iface + '.' + config.description.ADDRESS + ':1';
            const dpState = address + '.STATE';

            const state = ccu.values && ccu.values[dpState] && ccu.values[dpState].value;

            if (!state) {
                return hap.Characteristic.LockCurrentState.SECURED;
            }
            return hap.Characteristic.LockCurrentState.UNSECURED;
        };

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

            acc.addService(hap.Service.LockMechanism, config.name, subtypeLock)
                .updateCharacteristic(hap.Characteristic.LockCurrentState, getCurrentState())
                .updateCharacteristic(hap.Characteristic.LockTargetState, getTargetState());

            acc.addService(hap.Service.BatteryService, config.name, subtypeBattery)
                .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);

            acc.isConfigured = true;
        }

        const setListener = (value, callback) => {
            homematic.debug('set ' + config.name + ' ' + subtypeLock + ' LockTargetState ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'STATE', !value)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const getListener = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeLock + ' LockTargetState ' + getError() + ' ' + getTargetState());
            callback(getError(), getCurrentState());
        };

        const getListenerCurrent = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeLock + ' LockCurrentState ' + getError() + ' ' + getCurrentState());
            callback(getError(), getCurrentState());
        };

        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        acc.getService(subtypeLock).getCharacteristic(hap.Characteristic.LockCurrentState).on('get', getListenerCurrent);
        acc.getService(subtypeLock).getCharacteristic(hap.Characteristic.LockTargetState).on('get', getListener);
        acc.getService(subtypeLock).getCharacteristic(hap.Characteristic.LockTargetState).on('set', setListener);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);

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
                case '0.LOWBAT':
                    lowbat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + lowbat);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);
                    break;
                case '1.STATE':
                    homematic.debug('update ' + config.name + ' ' + subtypeLock + ' LockCurrentState ' + getCurrentState());
                    acc.getService(subtypeLock).updateCharacteristic(hap.Characteristic.LockCurrentState, getCurrentState());
                    acc.getService(subtypeLock).updateCharacteristic(hap.Characteristic.LockTargetState, getTargetState());
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtypeLock).getCharacteristic(hap.Characteristic.LockCurrentState).removeListener('get', getListenerLowbat);
            acc.getService(subtypeLock).getCharacteristic(hap.Characteristic.LockCurrentState).removeListener('get', getListenerCurrent);
            acc.getService(subtypeLock).getCharacteristic(hap.Characteristic.LockTargetState).removeListener('get', getListener);
            acc.getService(subtypeLock).getCharacteristic(hap.Characteristic.LockTargetState).removeListener('set', setListener);
        });
    }
};

