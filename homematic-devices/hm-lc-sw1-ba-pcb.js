const Accessory = require('./lib/accessory');

module.exports = class HmLcSw1BaPcb extends Accessory {
    init(config) {
        this.addService('Switch', config.name)
            .get('On', config.deviceAddress + ':1.STATE')
            .set('On', config.deviceAddress + ':1.STATE');

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            });
    }
};
