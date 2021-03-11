const Accessory = require('./lib/accessory');

module.exports = class HmipSte2Pcb extends Accessory {
    init(config, node) {
        const {ccu} = node;

        const channels = config.description.CHILDREN;

        for (let i = 1; i < channels.length; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (config.options[ch] && config.options[ch].disabled) {
                continue;
            }

            const name = ccu.channelNames[channels[i]];
            const dp = config.iface + '.' + channels[i] + '.ACTUAL_TEMPERATURE';

            this.addService('TemperatureSensor', name)
                .setProps('CurrentTemperature', {minValue: -150, maxValue: 150})
                .get('CurrentTemperature', dp)
                .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => {
                    return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                });
        }
    }
};
