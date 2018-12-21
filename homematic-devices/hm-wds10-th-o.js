const Accessory = require('./lib/accessory');

module.exports = class HmWds extends Accessory {
    init(config) {
        this.addService('TemperatureSensor', config.name)
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', config.deviceAddress + ':1.TEMPERATURE')

            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            });

        if (this.option('HumiditySensor')) {
            this.addService('HumiditySensor', config.name)
                .get('CurrentRelativeHumidity', config.deviceAddress + ':1.HUMIDITY')

                .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                    return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                });
        }
    }
};
