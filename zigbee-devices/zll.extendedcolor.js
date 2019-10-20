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
        const ep = device.endpoints[0].ID;
        let colormode;
        this.addService('Lightbulb', device.meta.name)
            .get('On', ep, 'genOnOff', 'onOff', data => Boolean(data))
            .set('On', ep, 'genOnOff', data => {
                return {command: data ? 'on' : 'off', payload: {}};
            })

            .get('Brightness', ep, 'genLevelCtrl', 'currentLevel', data => Math.round(data / 2.54))
            .set('Brightness', ep, 'genLevelCtrl', data => {
                return {command: 'moveToLevel', payload: {level: Math.round(data * 2.54), transtime: 0}};
            })

            .get('ColorTemperature', ep, 'lightingColorCtrl', 'colorTemperature', data => colormode !== 'hs' && data)
            .set('ColorTemperature', ep, 'lightingColorCtrl', data => {
                return {command: 'moveToColorTemp', payload: {colortemp: data, transtime: 0}};
            }, true)
            .setProps('ColorTemperature', {minValue: 153, maxValue: 370})

            .get('Hue', ep, 'lightingColorCtrl', 'enhancedCurrentHue', data => colormode !== 'ct' && Math.round(data / 65535 * 360))
            .set('Hue', ep, 'lightingColorCtrl', data => {
                return {command: 'enhancedMoveToHue', payload: {enhancehue: Math.round(data * 65535 / 360), direction: 0, transtime: 0}};
            }, true)

            .get('Saturation', ep, 'lightingColorCtrl', 'currentSaturation', data => colormode !== 'ct' && Math.round(data / 2.54))
            .set('Saturation', ep, 'lightingColorCtrl', data => {
                return {command: 'moveToSaturation', payload: {saturation: Math.round(data * 2.54), transtime: 0}};
            }, true);
    }
};
