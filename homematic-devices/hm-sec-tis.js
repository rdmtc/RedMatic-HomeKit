const Accessory = require('./lib/accessory');

module.exports = class HmSecTis extends Accessory {
    init(config) {
        this.addService('ContactSensor', config.name)

            .get('ContactSensorState', config.deviceAddress + ':1.STATE', (value, c) => {
                return value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
            })

            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })

            .get('StatusFault', config.deviceAddress + ':0.UNREACH', value => {
                return value;
            });
    }
};
