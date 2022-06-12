const Accessory = require('./lib/accessory.js');

function addService(type, name, channel) {
    let service
    this.node.debug("HMIPW-DRD3: "+ name +" "+channel);
    switch (type) {
        case 'ValveIrrigation':
        // intentional fallthrough
        case 'Valve':
            // intentional fallthrough            
        case 'Lightbulb':
            service=this.addService(type,name);
            service.get('On', channel + '.LEVEL', value => {
                this.node.debug("HMIPW-DRD3 get : "+channel);
                valueBrightness = value;
                return value > 0;
            })

            service.set('On', (value, callback) => {
                this.node.debug("HMIPW-DRD3 set : "+channel);
                if (value) {
                    setTimeout(() => {
                        if (valueBrightness === 0) {
                            value = 1;
                        } else {
                            value = valueBrightness / 100;
                        }

                        this.ccuSetValue(channel + '.LEVEL', value, callback);
                    }, 100);
                } else {
                    this.ccuSetValue(channel + '.LEVEL', 0, callback);
                }
            })

            service.get('Brightness', channel + '.LEVEL', value => {
                valueBrightness = value * 100;
                return value * 100;
            })

            service.set('Brightness', channel + '.LEVEL', value => {
                valueBrightness = value;
                return value / 100;
            });
        case 'Fan':
        // intentional fallthrough
        case 'Outlet':
        // intentional fallthrough
        default:
            /*this.addService(type, name, type === 'Switch' ? '' : type)
                .get('On', dp)
                .set('On', dp);*/
    }
}

class AccSingleService extends Accessory {
    init(config, node) {
        const {ccu} = node;       
        node.debug(config.accChannel + ' ' + "Lightbulb" + ' ');
        addService.call(this, "Lightbulb", config.accChannelName, config.accChannel);
    }
}

class AccMultiService extends Accessory {
    init(config, node) {
        const {ccu} = node;
        
        for (let j = 0; j < 3; j++) {
            for (let c = 0; c < 3; c++) {
                const i = (j * 4) + (c + 2);
                if ((c === 0 && this.option(i)) || (c !== 0 && this.option(i, 'enabled'))) {
                    const channel = config.deviceAddress + ':' + i;
                    const name = ccu.channelNames[channel];
                    this.node.debug("HMIPW-DRD3 call MultiService Channel: "+name+" "+channel);
                    addService.call(this,"Lightbulb",name,channel)
                }
            }
        }
    }
}

module.exports = class HmipwDrd {
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
        if (this.option('SingleAccessory')) {
            new AccMultiService(config, node);
        } else {
            for (let j = 0; j < 3; j++) {
                for (let c = 0; c < 3; c++) {
                    const i = (j * 4) + (c + 2);
                    if ((c === 0 && this.option(i)) || (c !== 0 && this.option(i, 'enabled'))) {
                        const channel = config.deviceAddress + ':' + i;
                        const name = ccu.channelNames[channel];
                        this.node.debug("HMIPW-DRD3 call SingleService Channel: "+name+" "+channel);
                        
                        const chConfig = Object.assign({}, config, {accChannel: channel,accChannelName: name});
                        chConfig.description = Object.assign({}, config.description, {ADDRESS: channel});

                        new AccSingleService(chConfig, node);
                    }
                }
            }
        }
    }
}