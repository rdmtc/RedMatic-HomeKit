const Accessory = require('./lib/accessory');

module.exports = class HmipSCTH230 extends Accessory {
    init(config) {
        this.addService('Switch', config.name)
            .get('On', config.deviceAddress + ':8.STATE')
            .set('On', config.deviceAddress + ':8.STATE');
    }
};
