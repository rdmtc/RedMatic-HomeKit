const Accessory = require('./lib/accessory');

module.exports = class ZllTw extends Accessory {
    static get manufacturerName() {
        return ['IKEA of Sweden'];
    }

    static get modelID() {
        return [
            'TRADFRI bulb E27 WS opal 980lm',
            'TRADFRI bulb E26 WS opal 980lm',
            'TRADFRI bulb E27 WS\uFFFDopal 980lm',
            'TRADFRI bulb E27 WS clear 950lm',
            'TRADFRI bulb E26 WS clear 950lm',
            'TRADFRI bulb GU10 WS 400lm',
            'TRADFRI bulb E14 WS opal 400lm',
            'TRADFRI bulb E12 WS opal 400lm',
            'TRADFRI bulb E14 WS opal 600lm',
            'TRADFRI bulb E27 WS opal 1000lm',
            'TRADFRI bulb E26 WS opal 1000lm',
            'TRADFRI bulb E27 WS clear 806lm',
            'LEPTITER Recessed spot light, dimmable, white spectrum'
        ];
    }

    static get deviceID() {
        return [0x0101, 0x0220];
    }

    init(device) {
        this.node.debug(`init zll.tw ${this.device.ieeeAddr} ${this.device.meta.name}`);
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
