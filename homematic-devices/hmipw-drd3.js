const Accessory = require('./lib/accessory.js');

module.exports = class HmipwDrd extends Accessory {
    init(config, node) {
        const {ccu} = node;

        let valueBrightness = 0;

        for (let j = 0; j < 3; j++) {
            for (let c = 0; c < 3; c++) {
                const i = (j * 4) + (c + 2);
                if ((c === 0 && this.option(i)) || (c !== 0 && this.option(i, 'enabled'))) {
                    const channel = config.deviceAddress + ':' + i;
                    const name = ccu.channelNames[channel];

                    this.addService('Lightbulb', name)

                        .get('On', channel + '.LEVEL', value => {
                            valueBrightness = value;
                            return value > 0;
                        })

                        .set('On', (value, callback) => {
                            if (value) {
                                setTimeout(() => {
                                    value = valueBrightness === 0 ? 1 : valueBrightness / 100;

                                    this.ccuSetValue(channel + '.LEVEL', value, callback);
                                }, 100);
                            } else {
                                this.ccuSetValue(channel + '.LEVEL', 0, callback);
                            }
                        })

                        .get('Brightness', channel + '.LEVEL', value => {
                            valueBrightness = value * 100;
                            return value * 100;
                        })

                        .set('Brightness', channel + '.LEVEL', value => {
                            valueBrightness = value;
                            return value / 100;
                        });
                }
            }
        }
    }
};
