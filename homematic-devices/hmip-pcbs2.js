const Accessory = require('./lib/accessory');

module.exports = class HmipPcbs2 extends Accessory {
    init(config, node) {
        const {ccu} = node;

        // Todo configuration for disabling channels

        this.addService('Switch', ccu.channelNames[config.description.ADDRESS + ':4'])
            .get('On', config.deviceAddress + ':4.STATE')
            .set('On', config.deviceAddress + ':4.STATE');

        this.addService('Switch', ccu.channelNames[config.description.ADDRESS + ':8'])
            .get('On', config.deviceAddress + ':8.STATE')
            .set('On', config.deviceAddress + ':8.STATE');
    }
};
