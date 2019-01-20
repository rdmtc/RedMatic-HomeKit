const Accessory = require('./lib/accessory');

module.exports = class HmSci3Fm extends Accessory {
    init(config, node) {
        for (let i = 1; i <= 3; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (config.options[ch] && config.options[ch].disabled) {
                continue;
            }

            const dp = config.deviceAddress + ':' + i + '.STATE';
            const name = node.ccu.channelNames[ch];
            const type = this.option(i, 'type');

            let service;
            let actualValue;

            switch (type) {
                case 'Door':
                case 'Window':
                    service = this.addService(type, name, type);

                    service.update('PositionState', 2);

                    service.get('CurrentPosition', dp, value => {
                        actualValue = value ? 100 : 0;
                        service.update('TargetPosition', actualValue);
                        return actualValue;
                    });

                    service.get('TargetPosition', dp, value => {
                        actualValue = value ? 100 : 0;
                        service.update('TargetPosition', actualValue);
                        return actualValue;
                    });

                    service.set('TargetPosition', (value, callback) => {
                        callback();
                        setTimeout(() => {
                            service.update('CurrentPosition', actualValue);
                            service.update('TargetPosition', actualValue);
                            service.update('PositionState', 2);
                        }, 20);
                    });

                    this.addService('BatteryService', name, 'Bat')
                        .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                            return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                        })
                        .get('BatteryLevel', config.deviceAddress + ':0.LOWBAT', value => {
                            return value ? 0 : 100;
                        });

                    break;

                default:
                    this.addService('ContactSensor', name)
                        .get('ContactSensorState', dp, (value, c) => {
                            return value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
                        })
                        .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                            return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                        });
            }
        }
    }
};
