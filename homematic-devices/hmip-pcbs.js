const Accessory = require('./lib/accessory');

module.exports = class HmipPcbs extends Accessory {
    init(config) {

        // Todo configuration for Service Type

        this.addService('Switch', config.name)
            .get('On', config.deviceAddress + ':3.STATE')
            .set('On', config.deviceAddress + ':3.STATE');
    }
};
