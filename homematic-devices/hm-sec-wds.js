const Accessory = require('./lib/accessory');

module.exports = class HmipSwd extends Accessory {
    init(config) {
        this.addService('LeakSensor', config.name)
            .get('LeakDetected', config.deviceAddress + ':1.STATE', (value, c) => {
                return value ? c.LEAK_DETECTED : c.LEAK_NOT_DETECTED;
            })
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            });
    }
};
