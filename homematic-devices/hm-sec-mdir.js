module.exports = class HmSecMdir {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        function lux(val) {
            return Math.round(10 ** (val / 50));
        }

        const datapointMotion = config.iface + '.' + config.description.ADDRESS + ':1.MOTION';
        let valueMotion = Boolean(ccu.values && ccu.values[datapointMotion] && ccu.values[datapointMotion].value);

        const datapointBrightness = config.iface + '.' + config.description.ADDRESS + ':1.BRIGHTNESS';
        let valueBrightness = lux((ccu.values && ccu.values[datapointBrightness] && ccu.values[datapointBrightness].value) || 0);

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
        const subtypeMotion = '0';
        const subtypeBrightness = '1';

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

            acc.addService(hap.Service.MotionSensor, config.name, subtypeMotion)
                .updateCharacteristic(hap.Characteristic.MotionDetected, valueMotion)
                .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat)
                .updateCharacteristic(hap.Characteristic.StatusTampered, tampered)
                .updateCharacteristic(hap.Characteristic.StatusFault, unreach);

            acc.addService(hap.Service.LightSensor, config.name, subtypeBrightness)
                .updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, valueBrightness);

            acc.isConfigured = true;
        }

        const getListenerBrightness = callback => {
            homematic.debug('get ' + config.name + ' 1 CurrentAmbientLightLevel ' + getError() + ' ' + valueBrightness);
            callback(null, valueBrightness);
        };

        const getListenerMotion = callback => {
            homematic.debug('get ' + config.name + ' 0 MotionDetected ' + getError() + ' ' + valueMotion);
            callback(null, valueMotion);
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

        acc.getService(subtypeMotion).getCharacteristic(hap.Characteristic.MotionDetected).on('get', getListenerMotion);
        acc.getService(subtypeMotion).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);
        acc.getService(subtypeMotion).getCharacteristic(hap.Characteristic.StatusTampered).on('get', getListenerTampered);
        acc.getService(subtypeMotion).getCharacteristic(hap.Characteristic.StatusFault).on('get', getListenerFault);
        acc.getService(subtypeBrightness).getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel).on('get', getListenerBrightness);

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
                    acc.getService(subtypeMotion).updateCharacteristic(hap.Characteristic.StatusFault, unreach);
                    break;
                case '0.LOWBAT':
                    lowbat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' 0 StatusLowBattery ' + lowbat);
                    acc.getService(subtypeMotion).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);
                    break;
                case '1.ERROR':
                    tampered = Boolean(msg.value);
                    homematic.debug('update ' + config.name + ' 0 StatusTampered ' + tampered);
                    acc.getService(subtypeMotion).updateCharacteristic(hap.Characteristic.StatusTampered, tampered);
                    break;
                case '1.MOTION':
                    valueMotion = msg.value;
                    homematic.debug('update ' + config.name + ' 0 MotionDetected ' + valueMotion);
                    acc.getService(subtypeMotion).updateCharacteristic(hap.Characteristic.MotionDetected, valueMotion);
                    break;
                case '1.BRIGHTNESS':
                    valueBrightness = lux(msg.value);
                    homematic.debug('update ' + config.name + ' 1 CurrentAmbientLightLevel ' + valueBrightness);
                    acc.getService(subtypeBrightness).updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, valueBrightness);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtypeBrightness).getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel).removeListener('get', getListenerBrightness);
            acc.getService(subtypeMotion).getCharacteristic(hap.Characteristic.MotionDetected).removeListener('get', getListenerMotion);
            acc.getService(subtypeMotion).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat);
            acc.getService(subtypeMotion).getCharacteristic(hap.Characteristic.StatusTampered).removeListener('get', getListenerTampered);
            acc.getService(subtypeMotion).getCharacteristic(hap.Characteristic.StatusFault).removeListener('get', getListenerFault);
        });
    }
};
