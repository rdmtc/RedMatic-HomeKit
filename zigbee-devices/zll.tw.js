const Accessory = require('./lib/accessory');

module.exports = class ZllTw extends Accessory {
    static get manufacturerName() {
        return [];
    }

    static get modelID() {
        return [];
    }

    static get deviceID() {
        return [0x0101, 0x0220];
    }

    init(device) {
        const ep = device.endpoints[0].ID;
        this.addService('Lightbulb', device.meta.name)
            .get('On', ep, 'genOnOff', 'onOff', data => Boolean(data))
            .set('On', ep, 'genOnOff', data => {
                return {command: data ? 'on' : 'off', payload: {}};
            })

            .get('Brightness', ep, 'genLevelCtrl', 'currentLevel', data => Math.round(data / 2.54))
            .set('Brightness', ep, 'genLevelCtrl', data => {
                return {command: 'moveToLevel', payload: {level: Math.round(data * 2.54), transtime: 0}};
            })

            .get('ColorTemperature', ep, 'lightingColorCtrl', 'colorTemperature', data => data)
            .set('ColorTemperature', ep, 'lightingColorCtrl', data => {
                return {command: 'moveToColorTemp', payload: {colortemp: data, transtime: 0}};
            });
    }
};
