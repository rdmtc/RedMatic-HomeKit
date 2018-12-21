const Accessory = require('./lib/accessory');

module.exports = class HmSw2 extends Accessory {
    init(config, node) {
        const {ccu} = node;

        const channels = config.description.CHILDREN;

        for (let i = 3; i <= 4; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (config.options[ch] && config.options[ch].disabled) {
                continue;
            }

            const name = ccu.channelNames[channels[i]];
            const dp = config.iface + '.' + channels[i] + '.STATE';

            this.addService('Switch', name)
                .get('On', dp)
                .set('On', dp);
        }
    }
};
