module.exports = class HmSecSwsd {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const datapointSmoke = config.iface + '.' + config.description.ADDRESS + ':1.SMOKE_DETECTOR_ALARM_STATUS';
        let smoke = (ccu.values && ccu.values[datapointSmoke] && ccu.values[datapointSmoke].value) ?
            hap.Characteristic.SmokeDetected.SMOKE_DETECTED :
            hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;

        const datapointLowbat = config.iface + '.' + config.description.ADDRESS + ':0.LOW_BAT';
        let lowbat = (ccu.values && ccu.values[datapointLowbat] && ccu.values[datapointLowbat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointSmokeChamber = config.iface + '.' + config.description.ADDRESS + ':1.SMOKE_DETECTOR_TEST_RESULT';
        let errorSmokeChamber = Boolean(ccu.values && ccu.values[datapointSmokeChamber] && ccu.values[datapointSmokeChamber].value === 2);

        function getFault() {
            return unreach || errorSmokeChamber;
        }

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

            acc.addService(hap.Service.SmokeSensor, config.name, subtype);
            acc.isConfigured = true;
        }

        const getListenerSmoke = callback => {
            homematic.debug('get ' + config.name + ' 0 SmokeDetected ' + getError() + ' ' + smoke);
            callback(null, smoke);
        };

        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' 0 StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        const getListenerFault = callback => {
            homematic.debug('get ' + config.name + ' 0 StatusFault ' + getError() + ' ' + getFault());
            callback(null, unreach);
        };

        acc.getService(subtype).getCharacteristic(hap.Characteristic.SmokeDetected).on('get', getListenerSmoke);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusFault).on('get', getListenerFault);

        const idSubscription = ccu.subscribe({
            iface: config.iface,
            device: config.description.ADDRESS,
            cache: true,
            change: true
        }, msg => {
            switch (msg.channelIndex + '.' + msg.datapoint) {
                case '1.SMOKE_DETECTOR_TEST_RESULT':
                    errorSmokeChamber = msg.value === 2;
                    homematic.debug('update ' + config.name + ' 0 StatusFault ' + unreach);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.StatusFault, getFault());
                    break;
                case '0.UNREACH':
                    unreach = msg.value;
                    homematic.debug('update ' + config.name + ' 0 StatusFault ' + unreach);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.StatusFault, getFault());
                    break;
                case '0.LOW_BAT':
                    lowbat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' 0 StatusLowBattery ' + lowbat);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);
                    break;
                case '1.SMOKE_DETECTOR_ALARM_STATUS':
                    smoke = msg.value ? hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED : hap.Characteristic.SmokeDetected.SMOKE_DETECTED;
                    homematic.debug('update ' + config.name + ' 0 SmokeDetected ' + smoke);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.ContactSensorState, smoke);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.SmokeDetected).removeListener('get', getListenerSmoke);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusFault).removeListener('get', getListenerFault);
        });
    }
};
