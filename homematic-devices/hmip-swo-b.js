const Accessory = require('./lib/accessory.js');

module.exports = class HmipSwo extends Accessory {
    init(config) {
        this.addService('TemperatureSensor', config.name)
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', config.deviceAddress + ':1.ACTUAL_TEMPERATURE');

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('BatteryLevel', config.deviceAddress + ':0.LOW_BAT', value => value ? 0 : 100)
            .update('ChargingState', 2);

        if (this.option('HumiditySensor')) {
            this.addService('HumiditySensor', config.name, 'HumiditySensor')
                .get('CurrentRelativeHumidity', config.deviceAddress + ':1.HUMIDITY');
        }

        if (this.option('LightSensor')) {
            this.addService('LightSensor', config.name, 'LightSensor')
                .get('CurrentAmbientLightLevel', config.deviceAddress + ':1.ILLUMINATION');
        }
    }
};
