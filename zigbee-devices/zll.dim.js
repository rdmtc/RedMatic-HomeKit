const Accessory = require('./lib/accessory');

module.exports = class ZllDim extends Accessory {
    static get manufacturerName() {
        return ['IKEA of Sweden'];
    }

    static get modelID() {
        return [
            'TRADFRI bulb E14 W op/ch 400lm',
            'TRADFRI bulb E12 W op/ch 400lm',
            'TRADFRI bulb E17 W op/ch 400lm',
            'TRADFRI bulb E27 WW 806lm',
            'TRADFRI bulb E26 opal 1000lm',
            'TRADFRI bulb E26 W opal 1000lm',
            'TRADFRI bulb E27 WW clear 250lm',
            'TRADFRI bulb GU10 WW 400lm',
            'TRADFRI bulb GU10 W 400lm',
            'TRADFRI bulb E27 opal 1000lm',
            'TRADFRI bulb E27 W opal 1000lm'
        ];
    }


    static get deviceID() {
        return [0x0100, 0x0110];
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
            });
    }
};
