const Accessory = require('./lib/accessory.js');

module.exports = class LumiMagnet extends Accessory {
    static get manufacturerName() {
        return ['LUMI'];
    }

    static get modelID() {
        return ['lumi.sensor_magnet', 'lumi.sensor_magnet.aq2'];
    }

    init(device) {
        this.node.debug(`init lumi.magnet ${this.device.ieeeAddr} ${this.device.meta.name}`);
        this.addService('ContactSensor', device.meta.name)
            .get('ContactSensorState', 1, 'genOnOff', 'onOff');

        this.addService('Battery', device.meta.name)
            .get('StatusLowBattery', 1, 'genBasic', '65281', data => data['1'] < 2775 ? 1 : 0)
            .get('BatteryLevel', 1, 'genBasic', '65281', data => this.percent(data['1'], 2725, 3100))
            .update('ChargingState', 2);
    }
};
