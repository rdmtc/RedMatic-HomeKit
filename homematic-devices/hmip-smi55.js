const Accessory = require('./lib/accessory');

module.exports = class HmipSmi55 extends Accessory {
    init(config) {
        this.addService('MotionSensor', config.name)
            .get('MotionDetected', config.deviceAddress + ':3.MOTION')
            .get('StatusTampered', config.deviceAddress + ':0.SABOTAGE');

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', this.percent)
            .update('ChargingState', 2);

        if (this.option('lightSensorOption')) {
            this.addService('LightSensor', config.name)
                .get('CurrentAmbientLightLevel', config.deviceAddress + ':3.ILLUMINATION');
        }
    }
};
