const Accessory = require('./lib/accessory.js');

module.exports = class HmCcScd extends Accessory {
    init(config) {
        this.addService('CarbonDioxideSensor', config.name)
            .get('CarbonDioxideDetected', config.deviceAddress + ':1.STATE', (value, c) => value > 0 ? c.CO2_LEVELS_ABNORMAL : c.CO2_LEVELS_NORMAL);
    }
};
