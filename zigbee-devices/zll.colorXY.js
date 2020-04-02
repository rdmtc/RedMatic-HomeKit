// Just as a reminder some references for Clusters both in HEX as well as in DEC
// HEX    DEC       Cluster
// 0x0000 0         Basic
// 0x0003 3         Identify
// 0x0004 4         Groups
// 0x0005 5         Scenes
// 0x0006 6         OnOff
// 0x0008 8         Level Control
// 0x0019 25        OTA
// 0x0020 32        
// 0x0300 768       Colour Control
// 0x0B05 2821      Diagnostics
// 0x1000 4096      Touchlink ZLL Commissioning
// 0xFC0F 64527     OSRAM: Safe State for ON?


const Accessory = require('./lib/accessory');

module.exports = class ZllColorXY extends Accessory {
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
        return [];
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
                if (saturation !== this.device.getEndpoint(ep).clusters['lightingColorCtrl'].attributes['currentSaturation']) {
                    //colormode = 'hs';
                    return {command: 'moveToSaturation', payload: {saturation: saturation, transtime: 0}};
                }


            }, false)

            .sub(ep, 'lightingColorCtrl', 'colorMode', colorMode => {
                console.log('colorMode', colorMode);
                switch (colorMode) {
                    case 0:
                        colormode = 'hs';
                        console.log('colorMode', colormode);
                        break;
                    case 1:
                        colormode = 'xy';
                        console.log('colorMode', colormode);
                        break;
                    case 2:
                        colormode = 'ct';
                        console.log('colorMode', colormode);
                        break;
                }
            });
    }
};
