const Accessory = require('./lib/accessory.js');

module.exports = class HmLcSw1BaPcb extends Accessory {
    init(config) {
        this.addService('Switch', config.name)
            .get('On', config.deviceAddress + ':1.STATE')
            .set('On', config.deviceAddress + ':1.STATE');

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('BatteryLevel', config.deviceAddress + ':0.LOWBAT', value => value ? 0 : 100)
            .update('ChargingState', 2);
    }
};
