const Accessory = require('./lib/accessory');

module.exports = class HmUniDmx extends Accessory {
    init(config, node) {
        const {ccu} = node;

        this.addService('Switch', ccu.channelNames[config.description.ADDRESS + ':1'])
            .get('On', this.deviceAddress + ':1.STATE')
            .set('On', this.deviceAddress + ':1.STATE');

        for (let i = 2; i <= 3; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            const service = this.addService('Switch', ccu.channelNames[ch]);

            service.get('On', () => {
                return false;
            });
            service.set('On', value => {
                if (value) {
                    ccu.setValue(config.iface, ch, 'PRESS_SHORT', true)
                        .then(() => {
                            callback();
                        }).catch(() => {
                        callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
                    setTimeout(() => {
                        service.update('On', false);
                    }, 250);
                }
            });
        }
    }
};
