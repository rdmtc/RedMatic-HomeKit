const Accessory = require('./lib/accessory.js');

module.exports = class HmipSecSwsd extends Accessory {
    init(config) {
        this.addService('SmokeSensor', config.name)
            .get('SmokeDetected', config.deviceAddress + ':1.SMOKE_DETECTOR_ALARM_STATUS', (value, c) => value ? c.SMOKE_DETECTED : c.SMOKE_NOT_DETECTED)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('StatusFault', config.deviceAddress + ':1.SMOKE_DETECTOR_TEST_RESULT', value => value === 2);
    }
};
