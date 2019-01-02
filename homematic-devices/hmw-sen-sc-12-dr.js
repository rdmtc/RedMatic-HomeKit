/* eslint-disable no-new */

const Accessory = require('./lib/accessory');

class AccSingleService extends Accessory {
    init(config) {
        const dp = config.iface + '.' + config.accChannel + '.SENSOR';

        this.addService('ContactSensor', config.name)
            .get('ContactSensorState', dp, (value, c) => {
                return value ? c.CONTACT_DETECTED : c.CONTACT_NOT_DETECTED;
            })
    }
}

class AccMultiService extends Accessory {
    init(config, node) {
        for (let i = 1; i <= 12; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (!this.option(i)) {
                continue;
            }
            const name = node.ccu.channelNames[ch];
            this.addService('ContactSensor', name)
                .get('ContactSensorState', config.deviceAddress + ':' + i + '.SENSOR', (value, c) => {
                    return value ? c.CONTACT_DETECTED : c.CONTACT_NOT_DETECTED;
                })
        }
    }
}

module.exports = class GenericContactSensor {
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
            for (let i = 1; i <= 12; i++) {
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
