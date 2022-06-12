const Accessory = require('./lib/accessory.js');

module.exports = class LumiWleak extends Accessory {
    static get manufacturerName() {
        return ['LUMI'];
    }

    static get modelID() {
        return ['lumi.sensor_wleak.aq1'];
    }

    init(device) {
        this.node.debug(`init lumi.sensor_wleak ${this.device.ieeeAddr} ${this.device.meta.name}`);
        this.addService('LeakSensor', device.meta.name)
            .get('LeakDetected', 1, 'ssIasZone', 'zonestatus', data => data ? 1 : 0);

        this.addService('Battery', device.meta.name)
            .get('StatusLowBattery', 1, 'genBasic', '65281', data => data['1'] < 2775 ? 1 : 0)
            .get('BatteryLevel', 1, 'genBasic', '65281', data => this.percent(data['1'], 2725, 3100))
            .update('ChargingState', 2);
    }
};
