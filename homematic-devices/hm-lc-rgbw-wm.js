const Accessory = require('./lib/accessory');

module.exports = class HmLcRgbw extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        const hueFactor = 360 / 199;

        let valueBrightness = 0;
        let valueColor = 200;
        let valueSaturation = 0;

        const service = this.addService('Lightbulb', config.name);

        service
            .get('On', config.deviceAddress + ':1.LEVEL', value => {
                valueBrightness = value;
                return value > 0;
            })
            .set('On', config.deviceAddress + ':1.LEVEL', value => {
                if (!valueBrightness || !value) {
                    return value ? 1 : 0;
                }
                return valueBrightness / 100;
            })

            .get('Brightness', config.deviceAddress + ':1.LEVEL', value => {
                valueBrightness = value * 100;
                return value * 100;
            })
            .set('Brightness', config.deviceAddress + ':1.LEVEL', value => {
                valueBrightness = value;
                return value / 100;
            })

            .get('Hue', config.deviceAddress + ':2.COLOR', value => {
                valueColor = value;
                valueSaturation = valueColor === 200 ? 0 : 100;
                service.update('Saturation', valueSaturation);
                return value * hueFactor;
            })
            .set('Hue', config.deviceAddress + ':2.COLOR', value => {
                valueColor = valueSaturation < 10 ? 200 : (value / hueFactor);
                return valueColor;
            })

            .get('Saturation', callback => {
                valueSaturation = valueColor === 200 ? 0 : 100;
                callback(null, valueSaturation);
            })
            .set('Saturation', (value, callback) => {
                valueColor = value < 10 ? 200 : valueColor;
                ccu.setValue(config.iface, config.description.ADDRESS + ':2', 'COLOR', valueColor)
                    .then(() => {
                        callback();
                    })
                    .catch(() => {
                        callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
            });
    }
};
