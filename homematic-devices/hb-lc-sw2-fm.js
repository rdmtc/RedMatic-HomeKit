const Accessory = require('./lib/accessory');

module.exports = class HmSw extends Accessory {
    init(config, node) {
        const {ccu} = node;

        const channels = config.description.CHILDREN;

        for (let i = 1; i <= 2; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (!this.option(ch)) {
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
