const Accessory = require('./lib/accessory.js');

module.exports = class HmipSwd extends Accessory {
    init(config) {
        this.addService('LeakSensor', config.name)
            .get('LeakDetected', config.deviceAddress + ':1.ALARMSTATE', (value, c) => value ? c.LEAK_DETECTED : c.LEAK_NOT_DETECTED)
            .get('StatusTampered', config.deviceAddress + ':0.ERROR_NON_FLAT_POSITIONING')
            .fault([config.deviceAddress + ':0.ERROR_CODE']);

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', value => this.percent(value, 1, 1.5))
            .update('ChargingState', 2);
    }
};
