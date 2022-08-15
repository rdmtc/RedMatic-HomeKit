const Accessory = require('./lib/accessory.js');

module.exports = class HmipSwdo extends Accessory {
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

                service.get('ObstructionDetected', config.deviceAddress + ':0.SABOTAGE', value => Boolean(value));

                break;

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

                service.get('ObstructionDetected', config.deviceAddress + ':0.SABOTAGE', value => Boolean(value));

                break;

            default:
                this.addService('ContactSensor', config.name)
                    .get('ContactSensorState', config.deviceAddress + ':1.STATE', (value, c) => value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED)
                    .get('StatusTampered', config.deviceAddress + ':0.SABOTAGE', value => Boolean(value))

                    .fault([
                        config.deviceAddress + ':0.ERROR_CODE',
                    ]);
        }

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', value => this.percent(value, null, 1, 1.5))
            .update('ChargingState', 2);
    }
};
