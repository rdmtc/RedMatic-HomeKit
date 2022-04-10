const Accessory = require('./lib/accessory.js');

module.exports = class HbUniSenAct extends Accessory {
    init(config, node) {
        const {ccu} = node;

        const channels = config.description.CHILDREN;

        for (let i = 1; i <= 4; i++) {
            if (!this.option(i)) {
                continue;
            }

            const name = ccu.channelNames[channels[i]];
            const dp = config.iface + '.' + channels[i] + '.STATE';

            this.addService('Switch', name)
                .get('On', dp)
                .set('On', dp);
        }

        for (let i = 5; i <= 8; i++) {
            if (!this.option(i)) {
                continue;
            }

            const name = ccu.channelNames[channels[i]];
            const dp = config.iface + '.' + channels[i] + '.STATE';

            this.addService('ContactSensor', name)
                .get('ContactSensorState', dp, (value, c) => value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED);
        }

        this.addService('Battery')
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('BatteryLevel', config.deviceAddress + ':0.LOWBAT', value => value ? 0 : 100)
            .update('ChargingState', 2);
    }
};
