const Accessory = require('./lib/accessory.js');

module.exports = class HmipSrh extends Accessory {
    init(config) {
        const type = this.option('1', 'type');

        let service;
        let actualValue;

        function convert(value) {
            switch (value) {
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

                service.get('ObstructionDetected', config.deviceAddress + ':0.SABOTAGE', value => Boolean(value));

                break;

            default:
                this.addService('ContactSensor', config.name)
                    .get('ContactSensorState', config.deviceAddress + ':1.STATE', (value, c) => value > 0 ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED)
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
