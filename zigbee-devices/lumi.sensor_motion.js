const Accessory = require('./lib/accessory');

module.exports = class LumiWeather extends Accessory {
    static get manufacturerName() {
        return ['LUMI'];
    }

    static get modelID() {
        return ['lumi.sensor_motion', 'lumi.sensor_motion.aq2'];
    }

    init(device) {
        const motionTimeoutVal = 3 * 60 * 1000;
        let motionTimeout;

        const motionService = this.addService('MotionSensor', device.meta.name)
            .get('MotionDetected', 1, 'msOccupancySensing', 'occupancy', (data, cache) => {
                if (cache) {
                    return false;
                }

                clearTimeout(motionTimeout);
                motionTimeout = setTimeout(() => {
                    motionService.update('MotionDetected', false);
                }, motionTimeoutVal);
                return true;
            });

        this.addService('BatteryService', device.meta.name)
            .get('StatusLowBattery', 1, 'genBasic', '65281', data => {
                return data['1'] < 2775 ? 1 : 0;
            })
            .get('BatteryLevel', 1, 'genBasic', '65281', data => this.percent(data['1'], 2725, 3100))
            .update('ChargingState', 2);
    }
};
