const Accessory = require('./lib/accessory');

module.exports = class HmEsPmsw1 extends Accessory {
    init(config) {
        this.addService('Outlet', config.name)
            .get('On', config.deviceAddress + ':1.STATE')
            .set('On', config.deviceAddress + ':1.STATE')
            .get('OutletInUse', config.deviceAddress + ':2.POWER', value => value > 0);
    }
};
