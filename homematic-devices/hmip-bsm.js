const Accessory = require('./lib/accessory.js');

module.exports = class HmipBsm extends Accessory {
    init(config) {
        this.addService('Lightbulb', config.name)
            .get('On', config.deviceAddress + ':4.STATE')
            .set('On', config.deviceAddress + ':4.STATE');
    }
};
