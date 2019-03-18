const Accessory = require('./lib/accessory');

module.exports = class HmipBdt extends Accessory {
    init(config) {
        let valueBrightness = 0;

        this.addService('Lightbulb', config.name)

            .get('On', config.deviceAddress + ':4.LEVEL', value => {
                valueBrightness = value;
                return value > 0;
            })

            .set('On', (value, callback) => {
                if (value) {
                    setTimeout(() => {
                        if (valueBrightness === 0) {
                            value = 1;
                        } else {
                            value = valueBrightness / 100;
                        }

                        this.ccuSetValue(config.deviceAddress + ':4.LEVEL', value, callback);
                    }, 100);
                } else {
                    this.ccuSetValue(config.deviceAddress + ':4.LEVEL', 0, callback);
                }
            })

            .get('Brightness', config.deviceAddress + ':4.LEVEL', value => {
                valueBrightness = value * 100;
                return value * 100;
            })

            .set('Brightness', config.deviceAddress + ':4.LEVEL', value => {
                valueBrightness = value;
                return value / 100;
            });
    }
};
