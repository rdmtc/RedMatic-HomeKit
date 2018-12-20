const Accessory = require('./lib/accessory');

module.exports = class HmipPs extends Accessory {
    init(config) {
        this.addService('Switch', config.name)
            .get('On', config.description.ADDRESS + ':3.STATE')
            .set('On', config.description.ADDRESS + ':3.STATE');
    }
};
