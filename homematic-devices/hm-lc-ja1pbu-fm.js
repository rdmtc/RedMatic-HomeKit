const Accessory = require('./lib/accessory');

module.exports = class HmLcJa1 extends Accessory {
    init(config) {
        let timeout;
        let level = null;
        let levelSlats = null;

        const that = this;

        const service = this.addService('WindowCovering', config.name);

        service
            .get('CurrentPosition', config.deviceAddress + ':1.LEVEL', value => {
                return value * 100;
            })

            .get('TargetPosition', config.deviceAddress + ':1.LEVEL', value => {
                return value * 100;
            })
            .set('TargetPosition', (value, callback) => {
                level = value / 100;
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    setCombined();
                }, 250);
                callback();
            })

            .get('PositionState', config.deviceAddress + ':1.DIRECTION', (value, c) => {
                switch (value) {
                    case 1:
                        return c.INCREASING;
                    case 2:
                        return c.DECREASING;
                    default:
                        return c.STOPPED;
                }
            })

            .get('CurrentVerticalTiltAngle', config.deviceAddress + ':1.LEVEL_SLATS', value => {
                return (value * 180) - 90;
            })

            .get('TargetVerticalTiltAngle', config.deviceAddress + ':1.LEVEL_SLATS', value => {
                return (value * 180) - 90;
            })
            .set('TargetVerticalTiltAngle', (value, callback) => {
                levelSlats = (value + 90) / 180;
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    setCombined();
                }, 250);
                callback();
            });

        function setCombined() {
            let dp;
            let value;
            if (levelSlats !== null && level !== null) {
                const b1 = ('0' + ((level || 0) * 200).toString(16)).slice(-2);
                const b2 = ('0' + ((levelSlats || 0) * 200).toString(16)).slice(-2);
                value = '0x' + b1 + ',0x' + b2;
                dp = config.deviceAddress + ':1.LEVEL_COMBINED';

            } else if (level !== null) {
                value = level;
                dp = config.deviceAddress + ':1.LEVEL';
            } else if (levelSlats !== null) {
                value = levelSlats;
                dp = config.deviceAddress + ':1.LEVEL_SLATS';
            }
            that.ccuSetValue(dp, value, error => {
                if (error) {
                    service.updateCharacteristic('TargetPosition', error);
                }
            });
            level = null;
            levelSlats = null;
        }
    }
};
