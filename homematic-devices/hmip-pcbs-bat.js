const Accessory = require('./lib/accessory.js');

module.exports = class HmipPcbsBat extends Accessory {
    init(config) {
        // Todo configuration for Service Type

        this.addService('Switch', config.name)
            .get('On', config.deviceAddress + ':3.STATE')
            .set('On', config.deviceAddress + ':3.STATE');

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', this.percent)
            .update('ChargingState', 2);
    }
};
