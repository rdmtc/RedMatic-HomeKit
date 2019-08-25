/* eslint-disable no-new */

const Accessory = require('./lib/accessory');

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

        for (let i = 10; i < (channels.length - 1); i += 4) {
            for (let vi = 0; vi < 3; vi ++) {
                const channelNumber = i + vi;
                const ch = channels[channelNumber];
                if (vi === 0 && !this.option(channelNumber)) {
                    continue;
                } else if (vi !== 0 && !this.option(channelNumber, 'enabled')) {
                    continue;
                }


                const name = ccu.channelNames[ch];
                const dp = config.iface + '.' + ch + '.STATE';
                const type = this.option(channelNumber, 'type') || 'Switch';

                node.debug(channelNumber + ' ' + type + ' ' + this.option(channelNumber, 'type'));

                addService.call(this, type, dp, name);
            }

        }
    }
}

module.exports = class HmipModOc8 {
    option(id, option) {
        let addr = this.config.description.ADDRESS;
        if (!addr.includes(':')) {
            addr = addr + ':' + id;
        }

        let res;

        if (option) {
            res = this.config.options[addr] && this.config.options[addr][option];
        } else {
            res = !(this.config.options[addr] && this.config.options[addr].disabled);
        }

        this.node.debug('option ' + addr + ' ' + id + ' ' + option + ' ' + res);
        return res;
    }

    constructor(config, node) {
        const {ccu} = node;
        this.node = node;
        this.ccu = ccu;
        this.config = config;
        if (this.option(config.description.ADDRESS + ':SingleAccessory')) {
            new AccMultiService(config, node);
        } else {
            const channels = config.description.CHILDREN;
            for (let i = 10; i < (channels.length - 1); i += 4) {
                for (let vi = 0; vi < 3; vi ++) {
                    const channelNumber = i + vi;
                    const ch = channels[channelNumber];
                    if (vi === 0 && !this.option(channelNumber)) {
                        continue;
                    } else if (vi !== 0 && !this.option(channelNumber, 'enabled')) {
                        continue;
                    }

                    const name = ccu.channelNames[ch];

                    const chConfig = Object.assign({}, config, {accChannel: ch, name});
                    chConfig.description = Object.assign({}, config.description, {ADDRESS: ch});

                    new AccSingleService(chConfig, node);
                }


            }
        }
    }
};
