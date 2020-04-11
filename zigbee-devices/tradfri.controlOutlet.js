const Accessory = require('./lib/accessory');

module.exports = class TradfriControlOutlet extends Accessory {
    static get manufacturerName() {
        return ['IKEA of Sweden'];
    }

    static get modelID() {
        return ['TRADFRI control outlet'];
    }

    static get deviceID() {
        return [];
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
