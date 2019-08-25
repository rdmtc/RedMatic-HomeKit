const Accessory = require('./lib/accessory');

module.exports = class HmipBbl extends Accessory {
    init(config, node) {
        const {ccu, bridgeConfig} = node;
        const {hap} = bridgeConfig;

        let intermediatePosition; // 0-100
        let LEVEL; // 0.0-1.0
        let LEVEL_2; // 0.0-1.0

        ccu.subscribe({
            datapointName: config.deviceAddress + ':4.LEVEL',
            cache: true,
            stable: false
        }, msg => {
            intermediatePosition = msg.value * 100;
        });

        const service = this.addService('WindowCovering', config.name);

        service
            .get('CurrentPosition', config.deviceAddress + ':4.LEVEL', value => {
                LEVEL = value;
                intermediatePosition = value * 100;
                return LEVEL * 100;
            })

            .get('TargetPosition', config.deviceAddress + ':4.LEVEL', value => {
                if (typeof LEVEL === 'undefined') {
                    LEVEL = value;
                }

                return LEVEL * 100;
            })

            .set('TargetPosition', (value, callback) => {
                LEVEL = value / 100;
                if (value === 0 && intermediatePosition === 0) {
                    intermediatePosition = 1;
                } else if (value === 100 && intermediatePosition === 100) {
                    intermediatePosition = 99;
                }

                node.debug(config.name + ' intermediatePosition ' + intermediatePosition);
                service.update('CurrentPosition', intermediatePosition);

                const params = {
                    LEVEL,
                    LEVEL_2
                };
                node.debug('set ' + config.name + ' (WindowCovering) TargetPosition ' + value + ' -> ' + config.description.ADDRESS + ':4 ' + JSON.stringify(params));
                ccu.methodCall(config.iface, 'putParamset', [config.description.ADDRESS + ':4', 'VALUES', params])
                    .then(() => {
                        callback();
                    })
                    .catch(() => {
                        callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
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
                LEVEL_2 = (value * 180) - 90;
                return LEVEL_2;
            })

            .get('TargetVerticalTiltAngle', config.deviceAddress + ':4.LEVEL_2', value => {
                LEVEL_2 = (value * 180) - 90;
                return LEVEL_2;
            })

            .set('TargetVerticalTiltAngle', (value, callback) => {
                LEVEL_2 = (value + 90) / 180;
                const params = {
                    LEVEL,
                    LEVEL_2
                };
                node.debug('set ' + config.name + ' (WindowCovering) TargetVerticalTiltAngle ' + value + ' -> ' + config.description.ADDRESS + ':4 ' + JSON.stringify(params));
                ccu.methodCall(config.iface, 'putParamset', [config.description.ADDRESS + ':4', 'VALUES', params])
                    .then(() => {
                        callback();
                    })
                    .catch(() => {
                        callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
            });
    }
};
