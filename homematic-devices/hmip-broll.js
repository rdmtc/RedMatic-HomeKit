const Accessory = require('./lib/accessory');

module.exports = class HmipBroll extends Accessory {
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
            });
    }
};
