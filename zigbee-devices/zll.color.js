const Accessory = require('./lib/accessory');

module.exports = class ZllColor extends Accessory {
    static get manufacturerName() {
        return ['IKEA of Sweden'];
    }

    static get modelID() {
        return [
            'TRADFRI bulb E27 CWS opal 600lm',
            'TRADFRI bulb E26 CWS opal 600lm',
            'TRADFRI bulb E14 CWS opal 600lm'
        ];
    }

    static get deviceID() {
        return [0x200];
    }

    init(device) {
        this.node.debug(`init zll.color ${this.device.ieeeAddr} ${this.device.meta.name}`);
        const ep = device.endpoints[0].ID;
        let sat = 0;
        this.addService('Lightbulb', device.meta.name)
            .get('On', ep, 'genOnOff', 'onOff', data => Boolean(data))
            .set('On', ep, 'genOnOff', data => {
                return {command: data ? 'on' : 'off', payload: {}};
            })

            .get('Brightness', ep, 'genLevelCtrl', 'currentLevel', data => Math.round(data / 2.54))
            .set('Brightness', ep, 'genLevelCtrl', data => {
                return {command: 'moveToLevel', payload: {level: Math.round(data * 2.54), transtime: 0}};
            })


            .get('Hue', ep, 'lightingColorCtrl', 'enhancedCurrentHue', data => Math.round(data / 65535 * 360))
            .set('Hue', ep, 'lightingColorCtrl', data => {
                console.log('set Hue', data);
                return {command: 'enhancedMoveToHueAndSaturation', payload: {enhancehue: Math.round(data * 65535 / 360), saturation: sat, direction: 0, transtime: 0}};
            })

            .get('Saturation', ep, 'lightingColorCtrl', 'currentSaturation', data => Math.round(data / 2.54))
            .set('Saturation', ep, 'lightingColorCtrl', data => {
                console.log('set Saturation', data);
                sat = Math.round(data * 2.54);
                return false;
                //return {command: 'moveToSaturation', payload: {saturation: Math.round(data * 2.54), transtime: 0}};
            })
    }
};
