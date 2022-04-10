const Accessory = require('./lib/accessory.js');

module.exports = class HmLcDim extends Accessory {
    init(config) {
        let valueBrightness = 0;

        this.addService('Lightbulb', config.name)

            .get('On', config.deviceAddress + ':1.LEVEL', value => {
                valueBrightness = value;
                return value > 0;
            })

            .set('On', (value, callback) => {
                if (value) {
                    setTimeout(() => {
                        value = valueBrightness === 0 ? 1 : valueBrightness / 100;

                        this.ccuSetValue(config.deviceAddress + ':1.LEVEL', value, callback);
                    }, 100);
                } else {
                    this.ccuSetValue(config.deviceAddress + ':1.LEVEL', 0, callback);
                }
            })

            .get('Brightness', config.deviceAddress + ':1.LEVEL', value => {
                valueBrightness = value * 100;
                return value * 100;
            })

            .set('Brightness', config.deviceAddress + ':1.LEVEL', value => {
                valueBrightness = value;
                return value / 100;
            });
    }
};
