const Accessory = require('./lib/accessory');

module.exports = class HmLcBl1 extends Accessory {
    init(config, node) {
        const {ccu} = node;

        let intermediatePosition;
        let targetPosition;

        ccu.subscribe({
            datapointName: config.deviceAddress + ':1.LEVEL',
            cache: true,
            stable: false
        }, msg => {
            intermediatePosition = msg.value * 100;
            node.debug(config.name + ' intermediatePosition ' + intermediatePosition);
        });

        const service = this.addService('WindowCovering', config.name);

        service.get('CurrentPosition', config.deviceAddress + ':1.LEVEL', value => {
            targetPosition = value;
            intermediatePosition = value * 100;
            return value * 100;
        })

            .get('TargetPosition', config.deviceAddress + ':1.LEVEL', value => {
                if (typeof targetPosition === 'undefined') {
                    targetPosition = value;
                }
                return targetPosition * 100;
            })
            .set('TargetPosition', config.deviceAddress + ':1.LEVEL', value => {
                targetPosition = value / 100;
                service.update('CurrentPosition', intermediatePosition);
                return targetPosition;
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
            });
    }
};
