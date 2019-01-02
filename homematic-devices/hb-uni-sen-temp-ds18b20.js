module.exports = require('./hm-wds30-ot2-sm');
const Accessory = require('./lib/accessory');

module.exports = class HbUniSenTemp extends Accessory {
    init(config, node) {
        const {ccu} = node;

        const channels = config.description.CHILDREN;

        for (let i = 1; i < channels.length; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (!this.option(i)) {
                continue;
            }

            const name = ccu.channelNames[channels[i]];
            const dp = config.iface + '.' + channels[i] + '.TEMPERATURE';

            this.addService('TEMPERATURE', name)
                .setProps('CurrentTemperature', {minValue: -150, maxValue: 150})
                .get('CurrentTemperature', dp)
                .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                    return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                });
        }
    }
};
