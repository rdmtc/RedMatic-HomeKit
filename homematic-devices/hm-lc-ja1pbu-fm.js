const Accessory = require('./lib/accessory');

module.exports = class HmLcJa1 extends Accessory {
    init(config) {

        this.addService('WindowCovering', config.name)
            .get('CurrentPosition', config.deviceAddress + ':1.LEVEL', value => {
                return value * 100;
            })

            .get('TargetPosition', config.deviceAddress + ':1.LEVEL', value => {
                return value * 100;
            })
            .set('TargetPosition', config.deviceAddress + ':1.LEVEL', value => {
                return value / 100;
            })

            .get('PositionState', config.deviceAddress + ':1.DIRECTION', (value, c) => {
                switch (value) {
                    case 1:
                        return c.INCREASING;
                    case 2:
                        return c.DECREASING;
                    default:
                        return c.STOPPED;
                }
            })

            .get('CurrentVerticalTiltAngle', config.deviceAddress + ':1.LEVEL_SLATS', value => {
                return (value * 180) - 90;
            })

            .get('TargetVerticalTiltAngle', config.deviceAddress + ':1.LEVEL_SLATS', value => {
                return (value * 180) - 90;
            })
            .set('TargetVerticalTiltAngle', config.deviceAddress + ':1.LEVEL_SLATS', value => {
                return (value + 90) / 180;
            })
    }
};
