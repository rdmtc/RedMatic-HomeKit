const Accessory = require('./lib/accessory');

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

                .set('On', dp, value => {
                    if (!valueBrightness || !value) {
                        return value ? 1 : 0;
                    }
                    return valueBrightness / 100;
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
