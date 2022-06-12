const Accessory = require('./lib/accessory.js');

module.exports = class HbUniSenPress extends Accessory {
    init(config) {
        this.addService('ContactSensor', config.name)
            .get('ContactSensorState', config.deviceAddress + ':2.STATE', (value, c) => value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED)

            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL);
    }
};
