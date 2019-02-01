const Accessory = require('./lib/accessory');

module.exports = class HmSecTis extends Accessory {
    init(config) {
        const type = this.option('1', 'type');

        let service;
        let actualValue;

        switch (type) {
            case 'GarageDoorOpener':
                service = this.addService(type, config.name, type);

                service.get('CurrentDoorState', config.deviceAddress + ':1.STATE', value => {
                    actualValue = value;
                    value = value ? 0 : 1;
                    service.update('TargetDoorState', value);
                    return value;
                });

                service.get('TargetDoorState', config.deviceAddress + ':1.STATE', value => {
                    actualValue = value;
                    value = value ? 0 : 1;
                    service.update('TargetDoorState', value);
                    return value;
                });

                service.set('TargetDoorState', (value, callback) => {
                    value = actualValue ? 0 : 1;
                    callback();
                    setTimeout(() => {
                        service.update('CurrentDoorState', value);
                        service.update('TargetDoorState', value);
                    }, 100);
                });

                break;

            case 'Door':
            case 'Window':
                service = this.addService(type, config.name, type);

                service.update('PositionState', 2);

                service.get('CurrentPosition', config.deviceAddress + ':1.STATE', value => {
                    actualValue = value ? 100 : 0;
                    service.update('TargetPosition', actualValue);
                    return actualValue;
                });

                service.get('TargetPosition', config.deviceAddress + ':1.STATE', value => {
                    actualValue = value ? 100 : 0;
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

                this.addService('BatteryService', config.name)
                    .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                        return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                    })
                    .get('BatteryLevel', config.deviceAddress + ':0.LOWBAT', value => {
                        return value ? 0 : 100;
                    })
                    .update('ChargingState', 2);

                break;

            default:
                this.addService('ContactSensor', config.name)
                    .get('ContactSensorState', config.deviceAddress + ':1.STATE', (value, c) => {
                        return value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
                    })

                    .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                        return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                    });
        }
    }
};
