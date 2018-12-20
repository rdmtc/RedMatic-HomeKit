const Accessory = require('./lib/accessory');

module.exports = class HmSci3Fm extends Accessory {
    init(config, node) {
        console.log(config);

        for (let i = 1; i <= 3; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (config.options[ch] && config.options[ch].disabled) {
                continue;
            }
            const name = node.ccu.channelNames[ch];
            this.addService('ContactSensor', name)
                .get('ContactSensorState', config.deviceAddress + ':' + i + '.STATE', (value, c) => {
                    return value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
                })
                .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                    return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                });
        }
    }
};
