const Accessory = require('./lib/accessory.js');

module.exports = class HbUniSenAct extends Accessory {
    init(config, node) {
        const {ccu} = node;

        const channels = config.description.CHILDREN;

        for (let i = 1; i <= 8; i++) {
            if (!this.option(i)) {
                continue;
            }

            const name = ccu.channelNames[channels[i]];
            const dp = config.iface + '.' + channels[i] + '.STATE';

            this.addService('Switch', name)
                .get('On', dp)
                .set('On', dp);
        }

        for (let i = 9; i <= 16; i++) {
            if (!this.option(i)) {
                continue;
            }

            const name = ccu.channelNames[channels[i]];
            const dp = config.iface + '.' + channels[i] + '.STATE';

            this.addService('ContactSensor', name)
                .get('ContactSensorState', dp, (value, c) => value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED);
        }
    }
};
