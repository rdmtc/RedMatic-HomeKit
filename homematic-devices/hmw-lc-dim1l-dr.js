const Accessory = require('./lib/accessory.js');

module.exports = class HmwDim extends Accessory {
    init(config) {
        let valueBrightness;

        this.addService('Lightbulb', config.name)

            .get('On', config.deviceAddress + ':3.LEVEL', value => {
                valueBrightness = value;
                return value > 0;
            })

            .set('On', config.deviceAddress + ':3.LEVEL', value => {
                if (!valueBrightness || !value) {
                    return value ? 1 : 0;
                }

                return valueBrightness / 100;
            })

            .get('Brightness', config.deviceAddress + ':3.LEVEL', value => {
                valueBrightness = value * 100;
                return value * 100;
            })

            .set('Brightness', config.deviceAddress + ':3.LEVEL', value => {
                valueBrightness = value;
                return value / 100;
            });
    }
};
