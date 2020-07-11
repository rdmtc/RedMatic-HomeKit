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
        this.node.debug(`init zll.extendendcolor ${this.device.ieeeAddr} ${this.device.meta.name}`);
        const ep = device.endpoints[0].ID;
        let colormode;
        const service = this.addService('Lightbulb', device.meta.name)
            .get('On', ep, 'genOnOff', 'onOff', data => Boolean(data))
            .set('On', ep, 'genOnOff', data => {
                return {command: data ? 'on' : 'off', payload: {}};
            })

            .get('Brightness', ep, 'genLevelCtrl', 'currentLevel', data => Math.round(data / 2.54))
            .set('Brightness', ep, 'genLevelCtrl', data => {
                return {command: 'moveToLevel', payload: {level: Math.round(data * 2.54), transtime: 0}};
            })

            .get('ColorTemperature', ep, 'lightingColorCtrl', 'colorTemperature', data => colormode === 'ct' ? data : null)
            .set('ColorTemperature', ep, 'lightingColorCtrl', data => {
                const current = this.device.getEndpoint(ep) && this.device.getEndpoint(ep).clusters['lightingColorCtrl'] && this.device.getEndpoint(ep).clusters['lightingColorCtrl'].attributes && this.device.getEndpoint(ep).clusters['lightingColorCtrl'].attributes['colorTemperature']
                if (data !== current) {
                    colormode = 'ct';
                    return {command: 'moveToColorTemp', payload: {colortemp: data, transtime: 0}};
                }
            }, false)
            .setProps('ColorTemperature', {minValue: 153, maxValue: 370})

            .get('Hue', ep, 'lightingColorCtrl', 'enhancedCurrentHue', data => colormode === 'ct' ? null : Math.round(data / 65535 * 360))
            .set('Hue', ep, 'lightingColorCtrl', data => {
                colormode = 'hs';
                return {
                    command: 'enhancedMoveToHue',
                    payload: {enhancehue: Math.round(data * 65535 / 360), direction: 0, transtime: 0}
                };
            }, false)

            .get('Saturation', ep, 'lightingColorCtrl', 'currentSaturation', data => colormode === 'ct' ? null : Math.round(data / 2.54))
            .set('Saturation', ep, 'lightingColorCtrl', data => {
                const saturation = Math.round(data * 2.54);
                const currentSaturation = this.device.getEndpoint(ep).clusters['lightingColorCtrl'] && this.device.getEndpoint(ep).clusters['lightingColorCtrl'].attributes && this.device.getEndpoint(ep).clusters['lightingColorCtrl'].attributes['currentSaturation'];
                if (saturation !== currentSaturation) {
                    //colormode = 'hs';
                    return {command: 'moveToSaturation', payload: {saturation: saturation, transtime: 0}};
                }


            }, false)

            .sub(ep, 'lightingColorCtrl', 'colorMode', colorMode => {
                console.log('colorMode', colorMode);
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
                }
            });
    }
};
