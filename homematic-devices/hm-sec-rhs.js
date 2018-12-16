const Accessory = require('./lib/accessory');

module.exports = class HmSecRhs extends Accessory {
    init(config, node) {
        this.addService('ContactSensor', config.name)
            .get('ContactSensorState', config.deviceAddress + ':1.STATE', (value, c) => {
                return value > 0 ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
            })

            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })

            .get('StatusTampered', config.deviceAddress + ':1.ERROR', (value, c) => {
                return Boolean(value);
            });
    }
};
