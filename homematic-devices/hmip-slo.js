const Accessory = require('./lib/accessory');

module.exports = class HmipSlo extends Accessory {
    init(config) {
        this.addService('LightSensor', config.name)
            .get('CurrentAmbientLightLevel', config.deviceAddress + ':1.CURRENT_ILLUMINATION');

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', this.percent)
            .update('ChargingState', 2);
    }
};
