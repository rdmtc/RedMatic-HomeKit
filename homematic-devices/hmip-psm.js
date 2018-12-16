const Accessory = require('./lib/accessory');

module.exports = class HmipPsm extends Accessory {
    init(config, node) {
        this.addService('Outlet', config.name)
            .get('On', config.deviceAddress + ':3.STATE')
            .set('On', config.deviceAddress + ':3.STATE')
            .get('OutletInUse', config.deviceAddress + ':6.POWER', value => value > 0);
    }
};
