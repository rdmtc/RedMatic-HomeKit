const Accessory = require('./lib/accessory');

module.exports = class HmipSrh extends Accessory {
    init(config) {
        this.addService('ContactSensor', config.name)
            .get('ContactSensorState', config.deviceAddress + ':1.STATE', (value, c) => {
                return value > 0 ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
            })

            .get('StatusTampered', config.deviceAddress + ':0.SABOTAGE', value => {
                return Boolean(value);
            })

            .fault([
                config.deviceAddress + ':0.ERROR_CODE'
            ]);

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', value => this.percent(value, null, 1, 1.5));
    }
};
