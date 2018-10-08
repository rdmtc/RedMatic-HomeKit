module.exports = class HMIPSMI {
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

        acc.addService(hap.Service.MotionSensor, config.name, '0');
        acc.addService(hap.Service.LightSensor, config.name, '1');
        acc.addService(hap.Service.BatteryService, config.name, '2');

        let unreach;

        iface.on('event', msg => {
            if (msg.device === config.description.ADDRESS) {
                let val;
                switch (msg.channelType) {
                    case 'MOTIONDETECTOR_TRANSCEIVER':
                        switch (msg.datapoint) {
                            case 'MOTION':
                                log.debug('> hap ' + config.name + ' MotionDetected ' + msg.value);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.MotionDetected, msg.value);
                                break;
                            case 'ILLUMINATION':
                                log.debug('> hap ' + config.name + ' CurrentAmbientLightLevel ' + msg.value);
                                acc.getService('1').updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, msg.value);
                                break;
                            default:
                        }
                        break;
                    case 'MAINTENANCE':
                        switch (msg.datapoint) {
                            case 'ERROR':
                                log.debug('> hap ' + config.name + ' StatusFault ' + msg.value);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.StatusFault, unreach || (msg.value ? 1 : 0));
                                break;
                            case 'UNREACH':
                                unreach = msg.value;
                                log.debug('> hap ' + config.name + ' StatusFault ' + msg.value);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.StatusFault, msg.value ? 1 : 0);
                                break;
                            case 'SABOTAGE':
                                unreach = msg.value;
                                log.debug('> hap ' + config.name + ' StatusTampered ' + msg.value);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.StatusFault, msg.value);
                                break;
                            case 'OPERATING_VOLTAGE_STATUS':
                                log.debug('> hap ' + config.name + ' BatteryLevel ' + msg.value);
                                acc.getService('2').updateCharacteristic(hap.Characteristic.BatteryLevel, msg.value);
                                break;
                            case 'LOW_BAT':
                                val = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                                log.debug('> hap ' + config.name + ' StatusLowBattery ' + val);
                                acc.getService('2').updateCharacteristic(hap.Characteristic.StatusLowBattery, val);
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
