const Accessory = require('./lib/accessory.js');

module.exports = class LumiMotion extends Accessory {
    static get manufacturerName() {
        return ['LUMI'];
    }

    static get modelID() {
        return ['lumi.sensor_motion', 'lumi.sensor_motion.aq2'];
    }

    init(device) {
        this.node.debug(`init lumi.sensor_motion ${this.device.ieeeAddr} ${this.device.meta.name}`);
        const motionTimeoutValue = 3 * 60 * 1000;
        let motionTimeout;

        const motionService = this.addService('MotionSensor', device.meta.name)
            .get('MotionDetected', 1, 'msOccupancySensing', 'occupancy', (data, cache) => {
                if (cache) {
                    return;
                }

                clearTimeout(motionTimeout);
                motionTimeout = setTimeout(() => {
                    motionService.update('MotionDetected', false);
                }, motionTimeoutValue);
                return true;
            });

        this.addService('Battery', device.meta.name)
            .get('StatusLowBattery', 1, 'genBasic', '65281', data => data['1'] < 2775 ? 1 : 0)
            .get('BatteryLevel', 1, 'genBasic', '65281', data => this.percent(data['1'], 2725, 3100))
            .update('ChargingState', 2);
    }
};
