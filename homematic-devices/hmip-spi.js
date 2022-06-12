const Accessory = require('./lib/accessory.js');

module.exports = class HmipSmi extends Accessory {
    init(config) {
        this.addService('OccupancySensor', config.name)
            .get('OccupancyDetected', config.deviceAddress + ':1.PRESENCE_DETECTION_STATE')
            .get('StatusTampered', config.deviceAddress + ':0.SABOTAGE');

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', this.percent)
            .update('ChargingState', 2);

        if (this.option('lightSensorOption')) {
            this.addService('LightSensor', config.name)
                .get('CurrentAmbientLightLevel', config.deviceAddress + ':1.ILLUMINATION');
        }
    }
};
