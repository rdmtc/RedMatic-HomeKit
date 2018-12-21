const Accessory = require('./lib/accessory');

module.exports = class HmipBbl extends Accessory {
    init(config) {
        this.addService('WindowCovering', config.name)
            .get('CurrentPosition', config.deviceAddress + ':4.LEVEL', value => {
                return value * 100;
            })

            .get('TargetPosition', config.deviceAddress + ':4.LEVEL', value => {
                return value * 100;
            })
            .set('TargetPosition', config.deviceAddress + ':4.LEVEL', value => {
                return value / 100;
            })

            .get('PositionState', config.deviceAddress + ':4.ACTIVITY_STATE', (value, c) => {
                switch (value) {
                    case 1:
                        return c.INCREASING;
                    case 2:
                        return c.DECREASING;
                    default:
                        return c.STOPPED;
                }
            })

            .get('CurrentVerticalTiltAngle', config.deviceAddress + ':4.LEVEL_2', value => {
                return (value * 180) - 90;
            })

            .get('TargetVerticalTiltAngle', config.deviceAddress + ':4.LEVEL_2', value => {
                return (value * 180) - 90;
            })
            .set('TargetVerticalTiltAngle', config.deviceAddress + ':4.LEVEL_2', value => {
                return (value + 90) / 180;
            });
    }
};
