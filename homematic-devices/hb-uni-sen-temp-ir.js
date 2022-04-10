const Accessory = require('./lib/accessory.js');

// eslint-disable-next-line unicorn/prevent-abbreviations
module.exports = class HbUniSenTemp extends Accessory {
    init(config, node) {
        const {ccu} = node;

        const channels = config.description.CHILDREN;

        for (let i = 1; i < channels.length; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (config.options[ch] && config.options[ch].disabled) {
                continue;
            }

            const name = ccu.channelNames[channels[i]];
            const dp = config.iface + '.' + channels[i] + '.TEMPERATURE';

            this.addService('TemperatureSensor', name)
                .setProps('CurrentTemperature', {minValue: -450, maxValue: 450})
                .get('CurrentTemperature', dp)
                .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL);
        }
    }
};
