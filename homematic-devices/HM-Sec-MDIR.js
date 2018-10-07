module.exports = class HMSecMDIR {
    constructor(config, iface) {
        const {hap, log} = iface;
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

        acc.addService(hap.Service.MotionSensor, config.name, '0');
        acc.addService(hap.Service.LightSensor, config.name, '1');

        iface.on('event', msg => {
            if (msg.device === config.description.ADDRESS) {
                let val;
                switch (msg.channelType) {
                    case 'MOTION_DETECTOR':
                        switch (msg.datapoint) {
                            case 'MOTION':
                                log.debug('> hap ' + config.name + ' MotionDetected ' + msg.value);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.MotionDetected, msg.value);
                                break;

                            case 'BRIGHTNESS':
                                log.debug('> hap ' + config.name + ' CurrentAmbientLightLevel ' + msg.value);
                                acc.getService('1').updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, msg.value);
                                break;

                            case 'ERROR':
                                log.debug('> hap ' + config.name + ' StatusTampered ' + msg.value);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.StatusFault, msg.value ? 1 : 0);
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
                                val = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                                log.debug('> hap ' + config.name + ' StatusLowBattery ' + val);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.StatusLowBattery, val);
                                break;
                            default:
                        }
                        break;
                }
            }
        });

        return acc;
    }
};
