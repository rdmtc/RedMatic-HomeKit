const Accessory = require('./lib/accessory');

module.exports = class HmSecKey extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        let jammed;
        let unknown;
        let state;

        function getState() {
            if (jammed) {
                return hap.Characteristic.LockCurrentState.JAMMED;
            }

            if (unknown) {
                return hap.Characteristic.LockCurrentState.UNKNOWN;
            }

            return state;
        }

        const service = this.addService('LockMechanism', config.name)
            .get('LockCurrentState', config.deviceAddress + ':1.STATE', (value, c) => {
                state = value ? c.UNSECURED : c.SECURED;
                return getState();
            })

            .get('LockTargetState', config.deviceAddress + ':1.STATE', (value, c) => {
                state = value ? c.UNSECURED : c.SECURED;
                return state;
            })
            .set('LockTargetState', (value, callback) => {
                value = value === hap.Characteristic.LockTargetState.UNSECURED;
                const dp = (this.option('OpenOnUnlock') && value) ? 'OPEN' : 'STATE';
                ccu.setValue(config.iface, config.description.ADDRESS + ':1', dp, value)
                    .then(() => {
                        callback();
                    })
                    .catch(() => {
                        callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
            });

        this.subscribe(config.deviceAddress + ':1.STATE_UNCERTAIN', value => {
            unknown = value;
            service.update('LockCurrentState', getState());
        });

        this.subscribe(config.deviceAddress + ':1.ERROR', value => {
            jammed = value;
            service.update('LockCurrentState', getState());
        });

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':0.LOWBAT', value => {
                return value ? 0 : 100;
            })
            .update('ChargingState', 2);
    }
};
