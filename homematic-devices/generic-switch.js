/* eslint-disable no-new */

const Accessory = require('./lib/accessory');

class AccSingleService extends Accessory {
    init(config) {
        const dp = config.iface + '.' + config.accChannel + '.STATE';

        this.addService('Switch', config.name)
            .get('On', dp)
            .set('On', dp);
    }
}

class AccMultiService extends Accessory {
    init(config, node) {
        const {ccu} = node;

        const channels = config.description.CHILDREN;

        for (let i = 1; i < channels.length; i++) {
            const ch = channels[i];
            if (!this.option(ch) || !(ccu.metadata.devices[config.iface][ch] && ccu.metadata.devices[config.iface][ch].TYPE === 'SWITCH')) {
                continue;
            }

            const name = ccu.channelNames[ch];
            const dp = config.iface + '.' + ch + '.STATE';

            this.addService('Switch', name)
                .get('On', dp)
                .set('On', dp);
        }
    }
}

module.exports = class GenericSwitch {
    option(id) {
        return !(this.config.options[id] && this.config.options[id].disabled);
    }
    constructor(config, node) {
        const {ccu} = node;
        this.ccu = ccu;
        this.config = config;
        if (this.option(config.description.ADDRESS + ':SingleAccessory')) {
            new AccMultiService(config, node);
        } else {
            const channels = config.description.CHILDREN;
            for (let i = 1; i < channels.length; i++) {
                const ch = channels[i];
                if (!this.option(ch) || !(ccu.metadata.devices[config.iface][ch] && ccu.metadata.devices[config.iface][ch].TYPE === 'SWITCH')) {
                    continue;
                }
                const name = ccu.channelNames[ch];

                const chConfig = Object.assign({}, config, {accChannel: ch, name});
                chConfig.description = Object.assign({}, config.description, {ADDRESS: ch});

                new AccSingleService(chConfig, node);
            }
        }
    }
};
