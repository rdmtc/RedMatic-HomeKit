module.exports = class HmCcScd {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const datapointCarbonDioxide = config.iface + '.' + config.description.ADDRESS + ':1.STATE';
        let carbonDioxide = (ccu.values && ccu.values[datapointCarbonDioxide] && ccu.values[datapointCarbonDioxide].value) > 0 ?
            hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL :
            hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        function getValue() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : carbonDioxide;
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

            acc.addService(hap.Service.CarbonDioxideSensor, config.name, subtype)
                .updateCharacteristic(hap.Characteristic.CarbonDioxideDetected, getValue());

            acc.isConfigured = true;
        }

        const getListenerCarbonDioxideDetected = callback => {
            homematic.debug('get ' + config.name + ' 0 CarbonDioxideDetected ' + getValue() + ' ' + carbonDioxide);
            callback(null, getValue());
        };

        acc.getService(subtype).getCharacteristic(hap.Characteristic.CarbonDioxideDetected).on('get', getListenerCarbonDioxideDetected);

        const idSubscription = ccu.subscribe({
            iface: config.iface,
            device: config.description.ADDRESS,
            cache: true,
            change: true
        }, msg => {
            switch (msg.channelIndex + '.' + msg.datapoint) {
                case '0.UNREACH':
                    unreach = msg.value;
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.CarbonDioxideDetected, getValue());
                    break;
                case '1.STATE':
                    carbonDioxide = msg.value > 0 ? hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL : hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL;
                    homematic.debug('update ' + config.name + ' 0 CarbonDioxideDetected ' + carbonDioxide);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.CarbonDioxideDetected, getValue());
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.CarbonDioxideDetected).removeListener('get', getListenerCarbonDioxideDetected);
        });
    }
};
