const Accessory = require('./lib/accessory');

module.exports = class ZllOnOff extends Accessory {
    static get manufacturerName() {
        return [];
    }

    static get modelID() {
        return [];
    }

    static get deviceID() {
        return [0x0000, 0x0010];
    }

    init(device) {
        const ep = device.endpoints[0].ID;
        this.addService('Switch', device.meta.name)
            .get('On', ep, 'genOnOff', 'onOff', data => Boolean(data))
            .set('On', ep, 'genOnOff', data => {
                return {command: data ? 'on' : 'off', payload: {}};
            });
    }
};
