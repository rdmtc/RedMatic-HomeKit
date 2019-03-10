/* eslint-disable no-new */

const Accessory = require('./accessory');

function addService(type, dp, name) {
    switch (type) {
        case 'ValveIrrigation':
        // intentional fallthrough
        case 'Valve': {
            const service = this.addService('Valve', name, type);

            service.update('ValveType', type === 'ValveIrrigation' ? 1 : 0);

            service
                .get('Active', dp, val => val ? 1 : 0)
                .get('InUse', dp, val => val ? 1 : 0)
                .set('Active', dp, val => {
                    service.update('InUse', val);
                    return Boolean(val);
                });
            break;
        }
        case 'Lightbulb':
        // intentional fallthrough
        case 'Fan':
        // intentional fallthrough
        case 'Outlet':
        // intentional fallthrough
        default:
            this.addService(type, name, type === 'Switch' ? '' : type)
                .get('On', dp)
                .set('On', dp);
    }
}

class AccSingleService extends Accessory {
    init(config, node) {
        const {ccu} = node;
        const dp = config.iface + '.' + config.accChannel + '.STATE';
        const name = ccu.channelNames[config.accChannel];
        const type = this.option('', 'type') || 'Switch';

        node.debug(config.accChannel + ' ' + type + ' ' + this.option('', 'type'));

        addService.call(this, type, dp, name);
    }
}

class AccMultiService extends Accessory {
    init(config, node) {
        const {ccu} = node;
        const channels = config.description.CHILDREN;

        for (let i = 1; i < channels.length; i++) {
            const ch = channels[i];
            if (!this.option(i) || !(ccu.metadata.devices[config.iface][ch] && ccu.metadata.devices[config.iface][ch].TYPE === 'SWITCH')) {
                continue;
            }
            const name = ccu.channelNames[ch];
            const dp = config.iface + '.' + ch + '.STATE';
            const type = this.option(i, 'type') || 'Switch';

            node.debug(i + ' ' + type + ' ' + this.option(i, 'type'));

            addService.call(this, type, dp, name);
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
