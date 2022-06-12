/* eslint-disable no-new */

const Accessory = require('./lib/accessory.js');

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
                .get('ContactSensorState', dp, (value, c) => value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED);
    }
}

class AccSingleService extends Accessory {
    init(config) {
        const dp = config.iface + '.' + config.accChannel + '.SENSOR';
        const {name} = config;
        const type = this.option('', 'type');
        addService.call(this, type, name, dp);
    }
}

class AccMultiService extends Accessory {
    init(config, node) {
        for (let i = 1; i <= 12; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (!this.option(i)) {
                continue;
            }

            const dp = config.deviceAddress + ':' + i + '.SENSOR';
            const name = node.ccu.channelNames[ch];
            const type = this.option(i, 'type');

            addService.call(this, type, name, dp);
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
