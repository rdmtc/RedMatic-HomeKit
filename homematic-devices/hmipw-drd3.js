const Accessory = require('./lib/accessory');

/* HmIPW-DRD3: three dimmer outputs, channels 2/6/10 (each followed by two
   virtual receivers). Default: one accessory with three Lightbulb services
   (the 3.3.0 layout, service subtypes 0/1/2). With `SingleAccessory`
   disabled every output becomes an accessory of its own (#353). */

function dimmerChannels(config) {
    const channels = [];
    for (let j = 0; j < 3; j++) {
        for (let c = 0; c < 3; c++) {
            const index = j * 4 + (c + 2);
            const address = config.description.ADDRESS + ':' + index;
            const options = (config.options && config.options[address]) || {};
            const enabled = c === 0 ? !options.disabled : Boolean(options.enabled);
            if (enabled) {
                channels.push({index, address});
            }
        }
    }

    return channels;
}

function addDimmer(acc, channel, name) {
    let valueBrightness = 0;

    acc.addService('Lightbulb', name)
        .get('On', channel + '.LEVEL', (value) => {
            valueBrightness = value;
            return value > 0;
        })

        .set('On', (value, callback) => {
            if (value) {
                setTimeout(() => {
                    if (valueBrightness === 0) {
                        value = 1;
                    } else {
                        value = valueBrightness / 100;
                    }

                    acc.ccuSetValue(channel + '.LEVEL', value, callback);
                }, 100);
            } else {
                acc.ccuSetValue(channel + '.LEVEL', 0, callback);
            }
        })

        .get('Brightness', channel + '.LEVEL', (value) => {
            valueBrightness = value * 100;
            return value * 100;
        })

        .set('Brightness', channel + '.LEVEL', (value) => {
            valueBrightness = value;
            return value / 100;
        });
}

class AccMultiService extends Accessory {
    init(config, node) {
        const {ccu} = node;
        for (const {address} of dimmerChannels(config)) {
            addDimmer(this, config.iface + '.' + address, ccu.channelNames[address]);
        }
    }
}

class AccSingleService extends Accessory {
    init(config) {
        addDimmer(this, config.iface + '.' + config.accChannel, config.name);
    }
}

module.exports = class HmipwDrd3 {
    constructor(config, node) {
        const {ccu} = node;
        const single = config.options && config.options[config.description.ADDRESS + ':SingleAccessory'];
        if (!single || !single.disabled) {
            this.accessory = new AccMultiService(config, node);
            return;
        }

        this.accessories = dimmerChannels(config).map(({address}) => {
            const chConfig = Object.assign({}, config, {accChannel: address, name: ccu.channelNames[address]});
            chConfig.description = Object.assign({}, config.description, {ADDRESS: address});
            return new AccSingleService(chConfig, node);
        });
    }
};
