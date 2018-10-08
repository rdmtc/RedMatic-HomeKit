module.exports = class HMSecSD {
    constructor(config, iface) {
        const {bridge, hap, log} = iface;
        const uuid = hap.uuid.generate(config.description.ADDRESS);
        log.info('creating Homematic Device ' + config.description.TYPE + ' ' + config.name + ' ' + uuid);
        const acc = new hap.Accessory(config.name, uuid, hap.Accessory.Categories.OTHER);

        acc.getService(hap.Service.AccessoryInformation)
            .setCharacteristic(hap.Characteristic.Manufacturer, 'eQ-3')
            .setCharacteristic(hap.Characteristic.Model, config.description.TYPE)
            .setCharacteristic(hap.Characteristic.SerialNumber, config.description.ADDRESS)
            .setCharacteristic(hap.Characteristic.FirmwareRevision, config.description.FIRMWARE);

        acc.on('identify', (paired, callback) => {
            log.info('hap identify ' + config.name + ' ' + config.description.TYPE + ' ' + config.description.ADDRESS);
            callback();
        });

        acc.addService(hap.Service.SmokeSensor, config.name, '0');

        iface.on('event', msg => {
            if (msg.device === config.description.ADDRESS) {
                let val;
                switch (msg.channelType) {
                    case 'SMOKE_DETECTOR':
                        switch (msg.datapoint) {
                            case 'STATE':
                                val = msg.value ? hap.Characteristic.SmokeDetected.SMOKE_DETECTED : hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
                                log.debug('> hap ' + config.name + ' SmokeDetected ' + val);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.SmokeDetected, val);
                                break;

                            default:
                        }
                        break;
                    case 'MAINTENANCE':
                        switch (msg.datapoint) {
                            case 'UNREACH':
                                log.debug('> hap ' + config.name + ' StatusFault ' + msg.value);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.StatusFault, msg.value ? 1 : 0);
                                break;
                            case 'LOWBAT':
                                val = msg.value ? hap.Characteristic.StatusFault.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                                log.debug('> hap ' + config.name + ' StatusLowBattery ' + val);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.StatusLowBattery, val);
                                break;
                            default:
                        }
                        break;
                }
            }
        });

        bridge.addBridgedAccessory(acc);
    }
};
