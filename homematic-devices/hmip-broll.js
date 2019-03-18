const Accessory = require('./lib/accessory');

module.exports = class HmipBroll extends Accessory {
    init(config, node) {
        const {ccu} = node;

        let intermediatePosition;
        let targetPosition;

        ccu.subscribe({
            datapointName: config.deviceAddress + ':4.LEVEL',
            cache: true,
            stable: false
        }, msg => {
            intermediatePosition = msg.value * 100;
        });

        const service = this.addService('WindowCovering', config.name);

        service.get('CurrentPosition', config.deviceAddress + ':4.LEVEL', value => {
            targetPosition = value;
            intermediatePosition = value * 100;
            return value * 100;
        })

            .get('TargetPosition', config.deviceAddress + ':4.LEVEL', value => {
                if (typeof targetPosition === 'undefined') {
                    targetPosition = value;
                }

                return targetPosition * 100;
            })

            .set('TargetPosition', config.deviceAddress + ':4.LEVEL', value => {
                targetPosition = value / 100;
                targetPosition = value / 100;
                if (value === 0 && intermediatePosition === 0) {
                    intermediatePosition = 1;
                } else if (value === 100 && intermediatePosition === 100) {
                    intermediatePosition = 99;
                }

                node.debug(config.name + ' intermediatePosition ' + intermediatePosition);
                service.update('CurrentPosition', intermediatePosition);
                return targetPosition;
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
