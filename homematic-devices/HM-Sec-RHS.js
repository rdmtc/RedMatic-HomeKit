module.exports = class HMSecSC {
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
            log.info('[homekit] hap identify ' + config.name + ' ' + config.description.TYPE + ' ' + config.description.ADDRESS);
            callback();
        });

        acc.addService(hap.Service.ContactSensor, config.name, '0');

        iface.on('event', msg => {
            if (msg.device === config.description.ADDRESS) {
                let val;
                switch (msg.channelType) {
                    case 'ROTARY_HANDLE_SENSOR':
                        switch (msg.datapoint) {
                            case 'STATE':
                                val = msg.value > 0 ? hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
                                log.trace('[homekit] > hap ' + config.name + ' ContactSensorState ' + val);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.ContactSensorState, val);
                                break;
                            case 'ERROR':
                                log.trace('[homekit] > hap ' + config.name + ' StatusTampered ' + msg.value);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.StatusTampered, msg.value ? 1 : 0);
                                break;
                            default:
                        }
                        break;
                    case 'MAINTENANCE':
                        switch (msg.datapoint) {
                            case 'UNREACH':
                                log.trace('[homekit] > hap ' + config.name + ' StatusFault ' + msg.value);
                                acc.getService('0').updateCharacteristic(hap.Characteristic.StatusFault, msg.value ? 1 : 0);
                                break;
                            case 'LOWBAT':
                                val = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                                log.trace('[homekit] > hap ' + config.name + ' StatusLowBattery ' + val);
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
