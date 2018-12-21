const Accessory = require('./lib/accessory');

module.exports = class HmipBsl extends Accessory {
    init(config) {
        this.addService('Switch', config.name)
            .get('On', config.deviceAddress + ':4.STATE')
            .set('On', config.deviceAddress + ':4.STATE');
    }
};
