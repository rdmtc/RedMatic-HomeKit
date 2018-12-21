const Accessory = require('./lib/accessory');

module.exports = class HmSenMdir55 extends Accessory {
    init(config) {
        this.addService('MotionSensor', config.name)
            .get('MotionDetected', config.deviceAddress + ':3.MOTION')
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            });

        if (!this.option('LightSensor')) {
            this.addService('LightSensor', config.name)
                .get('CurrentAmbientLightLevel', config.deviceAddress + ':3.BRIGHTNESS', this.lux)
                .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                    return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                });
        }
    }
};
