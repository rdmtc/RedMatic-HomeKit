const Accessory = require('./lib/accessory.js');

module.exports = class HbUniSenWea extends Accessory {
    init(config) {
        this.addService('TemperatureSensor', config.name)
            .setProps('CurrentTemperature', {minValue: -50, maxValue: 120})
            .get('CurrentTemperature', config.deviceAddress + ':1.TEMPERATURE');

        if (this.option('HumiditySensor')) {
            this.addService('HumiditySensor', config.name)
                .get('CurrentRelativeHumidity', config.deviceAddress + ':1.HUMIDITY');
        }

        if (this.option('LightSensor')) {
            this.addService('LightSensor', config.name)
                .get('CurrentAmbientLightLevel', config.deviceAddress + ':1.LUX');
        }
    }
};
