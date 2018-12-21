/* eslint-disable no-new */

const Accessory = require('./lib/accessory');

class SwChan extends Accessory {
    init(config) {
        const dp = config.iface + '.' + config.accChannel + '.STATE';

        this.addService('Switch', config.name)
            .get('On', dp)
            .set('On', dp);
    }
}

class HmwSw2 extends Accessory {
    init(config, node) {
        const {ccu} = node;

        const channels = config.description.CHILDREN;

        for (let i = 3; i <= 4; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (config.options[ch] && config.options[ch].disabled) {
                continue;
            }

            const name = ccu.channelNames[channels[i]];
            const dp = config.iface + '.' + channels[i] + '.STATE';

            this.addService('Switch', name)
                .get('On', dp)
                .set('On', dp);
        }
    }
}

module.exports = class HmSw {
    constructor(config, node) {
        const {ccu} = node;
        const multiAcc = config.options && config.options[config.description.ADDRESS + ':SingleAccessory'] && config.options[config.description.ADDRESS + ':SingleAccessory'].disabled;

        if (multiAcc) {
            for (let i = 3; i <= 4; i++) {
                const accChannel = config.description.ADDRESS + ':' + i;
                if (config.options[accChannel] && config.options[accChannel].disabled) {
                    continue;
                }
                const name = ccu.channelNames[accChannel];

                const chConfig = Object.assign({}, config, {accChannel, name});
                chConfig.description = Object.assign({}, config.description, {ADDRESS: accChannel});

                new SwChan(chConfig, node);
            }
        } else {
            new HmwSw2(config, node);
        }
    }
};
