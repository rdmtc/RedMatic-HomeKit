const Accessory = require('./lib/accessory.js');

module.exports = class HmLcDim2 extends Accessory {
    init(config, node) {
        const {ccu} = node;

        const channels = config.description.CHILDREN;

        for (let i = 1; i <= 2; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (config.options[ch] && config.options[ch].disabled) {
                continue;
            }

            const name = ccu.channelNames[channels[i]];
            const dp = config.iface + '.' + channels[i] + '.LEVEL';

            let valueBrightness;

            this.addService('Lightbulb', name)

                .get('On', dp, value => {
                    valueBrightness = value;
                    return value > 0;
                })

                .set('On', (value, callback) => {
                    if (value) {
                        setTimeout(() => {
                            value = valueBrightness === 0 ? 1 : valueBrightness / 100;

                            this.ccuSetValue(dp, value, callback);
                        }, 100);
                    } else {
                        this.ccuSetValue(dp, 0, callback);
                    }
                })

                .get('Brightness', dp, value => {
                    valueBrightness = value * 100;
                    return value * 100;
                })

                .set('Brightness', dp, value => {
                    valueBrightness = value;
                    return value / 100;
                });
        }
    }
};
