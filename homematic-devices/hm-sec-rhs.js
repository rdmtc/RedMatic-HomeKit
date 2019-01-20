const Accessory = require('./lib/accessory');

module.exports = class HmSecRhs extends Accessory {
    init(config) {
        const type = this.option('1', 'type');

        let service;
        let actualValue;

        function convert(val) {
            switch (val) {
                case 1:
                    return 25;
                case 2:
                    return 100;
                default:
                    return 0;
            }
        }

        switch (type) {
            case 'Door':
            case 'Window':
                service = this.addService(type, config.name, type);

                service.update('PositionState', 2);

                service.get('CurrentPosition', config.deviceAddress + ':1.STATE', value => {
                    actualValue = convert(value);
                    service.update('TargetPosition', actualValue);
                    return actualValue;
                });

                service.get('TargetPosition', config.deviceAddress + ':1.STATE', value => {
                    actualValue = convert(value);
                    service.update('TargetPosition', actualValue);
                    return actualValue;
                });

                service.set('TargetPosition', (value, callback) => {
                    callback();
                    setTimeout(() => {
                        service.update('CurrentPosition', actualValue);
                        service.update('TargetPosition', actualValue);
                        service.update('PositionState', 2);
                    }, 20);
                });

                service.get('ObstructionDetected', config.deviceAddress + ':1.ERROR', value => {
                    return Boolean(value);
                });

                this.addService('BatteryService', config.name)
                    .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                        return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                    })
                    .get('BatteryLevel', config.deviceAddress + ':0.LOWBAT', value => {
                        return value ? 0 : 100;
                    });

                break;

            default:
                this.addService('ContactSensor', config.name)
                    .get('ContactSensorState', config.deviceAddress + ':1.STATE', (value, c) => {
                        return value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
                    })

                    .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                        return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                    })

                    .get('StatusTampered', config.deviceAddress + ':1.ERROR', value => {
                        return Boolean(value);
                    });
        }
    }
};
