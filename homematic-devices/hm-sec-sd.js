const Accessory = require('./lib/accessory.js');

module.exports = class HmSecSd extends Accessory {
    init(config) {
        this.addService('SmokeSensor', config.name)
            .get('SmokeDetected', config.deviceAddress + ':1.STATE', (value, c) => value ? c.SMOKE_DETECTED : c.SMOKE_NOT_DETECTED)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)

            .fault([
                config.deviceAddress + ':0.UNREACH',
                config.deviceAddress + ':1.ERROR_ALARM_TEST',
                config.deviceAddress + ':1.ERROR_SMOKE_CHAMBER',
            ]);
    }
};
