const Accessory = require('./lib/accessory');

module.exports = class HmSenLi extends Accessory {
    init(config) {
        this.addService('LightSensor', config.name)
            .get('CurrentAmbientLightLevel', config.deviceAddress + ':1.LUX')
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            });
    }
};
