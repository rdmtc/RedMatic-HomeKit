const Accessory = require('./lib/accessory.js');

module.exports = class HmipBdt extends Accessory {
    init(config, node) {
        const {ccu} = node;

        let valueBrightness = 0;

        for (let i = 4; i <= 6; i++) {
            if ((i === 4 && this.option(i)) || (i !== 4 && this.option(i, 'enabled'))) {
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
};
