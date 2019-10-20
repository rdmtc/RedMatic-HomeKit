const Accessory = require('./lib/accessory');

module.exports = class LumiWeather extends Accessory {
    static get manufacturerName() {
        return ['LUMI'];
    }

    static get modelID() {
        return ['lumi.sensor_wleak.aq1'];
    }

    init(device) {
        this.addService('LeakSensor', device.meta.name)
            .get('LeakDetected', 1, 'ssIasZone', 'zonestatus', data => data ? 1 : 0);

        this.addService('BatteryService', device.meta.name)
            .get('StatusLowBattery', 1, 'genBasic', '65281', data => {
                return data['1'] < 2775 ? 1 : 0;
            })
            .get('BatteryLevel', 1, 'genBasic', '65281', data => this.percent(data['1'], 2725, 3100))
            .update('ChargingState', 2);
    }
};
