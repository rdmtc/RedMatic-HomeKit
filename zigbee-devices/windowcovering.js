const Accessory = require('./lib/accessory.js');

module.exports = class ZllOnOff extends Accessory {
    static get manufacturerName() {
        return ['IKEA of Sweden'];
    }

    static get modelID() {
        return ['FYRTUR block-out roller blind',
            'KADRILJ roller blind'];
    }

    init(device) {
        this.node.debug(`init windowcovering ${this.device.ieeeAddr} ${this.device.meta.name}`);
        const ep = device.endpoints[0].ID;
        const windowCoveringService = this.addService('WindowCovering', device.meta.name);

        windowCoveringService.get('CurrentPosition', ep, 'closuresWindowCovering', 'currentPositionLiftPercentage', (data, cache) => {
            if (cache) {
                windowCoveringService.update('TargetPosition', 100 - data);
            }

            return 100 - data;
        })
            .set('TargetPosition', ep, 'closuresWindowCovering', data => ({command: 'goToLiftPercentage', payload: {percentageliftvalue: 100 - data}}));

        this.addService('Battery', device.meta.name)
            .get('StatusLowBattery', 1, 'genPowerCfg', 'batteryPercentageRemaining', data => data < 10 ? 1 : 0)
            .get('BatteryLevel', 1, 'genPowerCfg', 'batteryPercentageRemaining', data => data)
            .update('ChargingState', 2);
    }
};
