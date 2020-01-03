/* eslint-disable no-new */

const Accessory = require('./lib/accessory');

function addService(type, name, dp) {
    let service;
    let actualValue;

    switch (type) {
        case 'Door':
        case 'Window':
            service = this.addService(type, name, type);

            service.update('PositionState', 2);

            service.get('CurrentPosition', dp, value => {
                actualValue = value ? 100 : 0;
                service.update('TargetPosition', actualValue);
                return actualValue;
            });

            service.get('TargetPosition', dp, value => {
                actualValue = value ? 100 : 0;
                service.update('TargetPosition', actualValue);
                return actualValue;
            });

            service.set('TargetPosition', (value, callback) => {
                callback();
                setTimeout(() => {
                    service.update('CurrentPosition', actualValue);
                    service.update('TargetPosition', actualValue);
                    service.update('PositionState', 2);
                }, 20);
            });

            break;

        default:
            this.addService('ContactSensor', name)
                .get('ContactSensorState', dp, (value, c) => {
                    return value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
                });
    }
}

class AccSingleService extends Accessory {
    init(config) {
        const dp = config.iface + '.' + config.accChannel + '.STATE';
        const {name} = config;
        const type = this.option('', 'type');
        addService.call(this, type, name, dp);
    }
}

class AccMultiService extends Accessory {
    init(config, node) {
        const channels = config.description.CHILDREN;
        for (let i = 1; i < (channels.length - 1); i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (!this.option(i)) {
                continue;
            }

            const dp = config.deviceAddress + ':' + i + '.STATE';
            const name = node.ccu.channelNames[ch];
            const type = this.option(i, 'type');

            addService.call(this, type, name, dp);
        }
    }
}

module.exports = class GenericContactSensor {
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
        const channels = config.description.CHILDREN;
        if (this.option('SingleAccessory')) {
            new AccMultiService(config, node);
        } else {
            for (let i = 1; i < (channels.length - 1); i++) {
                const ch = config.description.ADDRESS + ':' + i;
                if (!this.option(ch)) {
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
