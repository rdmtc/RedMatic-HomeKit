const Accessory = require('./lib/accessory');

module.exports = class HmSecMdir extends Accessory {
    init(config) {
        this.addService('MotionSensor', config.name)
            .get('MotionDetected', config.deviceAddress + ':1.MOTION')
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('StatusTampered', config.deviceAddress + ':1.ERROR', value => {
                return Boolean(value);
            });

        if (!this.option('LightSensor')) {
            this.addService('LightSensor', config.name)
                .get('CurrentAmbientLightLevel', config.deviceAddress + ':1.BRIGHTNESS', this.lux)
                .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                    return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                })
                .get('StatusTampered', config.deviceAddress + ':1.ERROR', value => {
                    return Boolean(value);
                });
        }
    }
};
