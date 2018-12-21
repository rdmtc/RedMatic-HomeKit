const Accessory = require('./lib/accessory');

module.exports = class HmipStho extends Accessory {
    init(config) {
        this.addService('TemperatureSensor', config.name)
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', config.deviceAddress + ':1.ACTUAL_TEMPERATURE');

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', this.percent);

        if (this.option('HumiditySensor')) {
            this.addService('HumiditySensor', config.name)
                .get('CurrentRelativeHumidity', config.deviceAddress + ':1.HUMIDITY');
        }
    }
};
