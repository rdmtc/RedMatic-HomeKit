const Accessory = require('./lib/accessory');

module.exports = class LumiWeather extends Accessory {
    static get manufacturerName() {
        return ['LUMI'];
    }

    static get modelID() {
        return ['lumi.weather', 'lumi.sens', 'lumi.sensor_ht'];
    }

    init(device) {
        this.addService('TemperatureSensor', device.meta.name)
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', 1, 'msTemperatureMeasurement', 'measuredValue', data => data / 100);

        this.addService('HumiditySensor', device.meta.name)
            .get('CurrentRelativeHumidity', 1, 'msRelativeHumidity', 'measuredValue', data => data / 100);

        this.addService('BatteryService', device.meta.name)
            .get('StatusLowBattery', 1, 'genBasic', '65281', data => {
                return data['1'] < 2775 ? 1 : 0;
            })
            .get('BatteryLevel', 1, 'genBasic', '65281', data => this.percent(data['1'], 2725, 3100))
            .update('ChargingState', 2);
    }
};
