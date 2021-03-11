const Accessory = require('./lib/accessory');

module.exports = class ZllExtColor extends Accessory {
    static get manufacturerName() {
        return [];
    }

    static get modelID() {
        return [];
    }

    static get deviceID() {
        return [0x010D, 0x0210];
    }

    init(device) {
        let colormode;
        let sat = 0;
        this.node.debug(`init zll.extendedcolor ${this.device.ieeeAddr} ${this.device.meta.name}`);
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
                // return {command: 'moveToSaturation', payload: {saturation: Math.round(data * 2.54), transtime: 0}};
            })
            .sub(ep, 'lightingColorCtrl', 'colorMode', colorMode => {
                switch (colorMode) {
                    case 0:
                        colormode = 'hs';
                        break;
                    case 1:
                        colormode = 'xy';
                        break;
                    case 2:
                        colormode = 'ct';
                        break;
                    default:
                }

                console.log('colormode', colorMode, colormode);
            });
    }
};
