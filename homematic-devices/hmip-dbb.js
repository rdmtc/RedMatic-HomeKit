const Accessory = require('./lib/accessory');

module.exports = class HmipDbb extends Accessory {
    init(config) {
        const service = this.addService('Doorbell', config.name);

        this.subscribe(config.deviceAddress + ':1.PRESS_SHORT', () => {
            service.update('ProgrammableSwitchEvent', 0);
        });
        this.subscribe(config.deviceAddress + ':1.PRESS_LONG', () => {
            service.update('ProgrammableSwitchEvent', 0);
        });

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', this.percent)
            .update('ChargingState', 2);
    }
};
