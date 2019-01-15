const Accessory = require('./lib/accessory');

module.exports = class HmipSwdo extends Accessory {
    init(config) {
        const type = this.option('1', 'type');

        let service;
        let actualValue;

        switch (type) {
            case 'Door':
            case 'Window':
                service = this.addService(type, config.name, type);

                service.update('PositionState', 2);

                service.get('CurrentPosition', config.deviceAddress + ':1.STATE', value => {
                    actualValue = value;
                    value = value ? 100 : 0;
                    service.update('TargetPosition', value);
                    return value;
                });

                service.get('TargetPosition', config.deviceAddress + ':1.STATE', value => {
                    actualValue = value;
                    value = value ? 100 : 0;
                    service.update('TargetPosition', value);
                    return value;
                });

                service.set('TargetPosition', (value, callback) => {
                    value = actualValue ? 100 : 0;
                    callback();
                    setTimeout(() => {
                        service.update('CurrentPosition', value);
                        service.update('TargetPosition', value);
                        service.update('PositionState', 2);
                    }, 100);
                });

                this.addService('BatteryService', config.name)
                    .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                        return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                    });

                break;

            default:
                this.addService('ContactSensor', config.name)
                    .get('ContactSensorState', config.deviceAddress + ':1.STATE', (value, c) => {
                        return value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
                    })

                    .get('StatusTampered', config.deviceAddress + ':0.SABOTAGE', value => {
                        return Boolean(value);
                    })

                    .fault([
                        config.deviceAddress + ':0.ERROR_CODE'
                    ]);
        }

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', value => this.percent(value, null, 1, 1.5));
    }
};
