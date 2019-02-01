const Accessory = require('./lib/accessory');

module.exports = class HmipSpdr extends Accessory {
    init(config, node) {
        const {bridgeConfig} = node;
        const {hap} = bridgeConfig;

        const service = this.addService('OccupancySensor', config.name);

        let p1 = null;
        let p2 = null;

        function update() {
            if (p1 !== null && p2 !== null) {
                service.update('OccupancyDetected', p1 === p2 ? hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED : hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED);
            }
        }

        this.subscribe(config.deviceAddress + ':2.PASSAGE_COUNTER_VALUE', value => {
            p1 = value;
            update();
        });

        this.subscribe(config.deviceAddress + ':3.PASSAGE_COUNTER_VALUE', value => {
            p2 = value;
            update();
        });

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', this.percent)
            .update('ChargingState', 2);
    }
};
