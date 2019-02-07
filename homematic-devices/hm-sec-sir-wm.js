const Accessory = require('./lib/accessory');

module.exports = class HmSecSir extends Accessory {
    /*
        HomeKit:
        Characteristic.SecuritySystemCurrentState.STAY_ARM = 0;
        Characteristic.SecuritySystemCurrentState.AWAY_ARM = 1;
        Characteristic.SecuritySystemCurrentState.NIGHT_ARM = 2;
        Characteristic.SecuritySystemCurrentState.DISARMED = 3;
        Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED = 4;

        Homematic:
        0 = DISARMED (Standard)
        1 = EXTSENS_ARMED
        2 = ALLSENS_ARMED
        3 = ALARM_BLOCKED
     */

    checkAlarm() {
        const isTriggered = this.states[0] || this.states[1] || this.states[2];
        this.update('SecuritySystemCurrentState', isTriggered ? 4 : this.currentState);
    }

    init(config) {
        this.states = [false, false, false];

        this.subscribe(config.deviceAddress + ':1.STATE', val => {
            this.states[0] = val;
            this.checkAlarm();
        });
        this.subscribe(config.deviceAddress + ':2.STATE', val => {
            this.states[1] = val;
            this.checkAlarm();
        });
        this.subscribe(config.deviceAddress + ':3.STATE', val => {
            this.states[2] = val;
            this.checkAlarm();
        });

        this.addService('SecuritySystem', config.name)
            .setProps('SecuritySystemCurrentState', {validValues: [0, 1, 3, 4]})
            .setProps('SecuritySystemTargetState', {validValues: [0, 1, 3]})

            .get('SecuritySystemCurrentState', config.deviceAddress + ':1.ARMSTATE', value => {
                let val = 3;
                switch (value) {
                    case 1:
                        val = 0;
                        break;
                    case 2:
                        val = 1;
                        break;
                    default:
                }
                this.currentState = val;
                return val;
            })
            .get('SecuritySystemTargetState', config.deviceAddress + ':1.ARMSTATE', value => {
                let val = 3;
                switch (value) {
                    case 1:
                        val = 0;
                        break;
                    case 2:
                        val = 1;
                        break;
                    default:
                }
                this.currentState = val;
                return val;
            })
            .set('SecuritySystemTargetState', config.deviceAddress + ':1.ARMSTATE', value => {
                let val = 0;
                switch (value) {
                    case 0:
                        val = 1;
                        break;
                    case 1:
                        val = 2;
                        break;
                    default:
                }
                this.currentState = value;
                return val;
            })

            .get('StatusTampered', config.deviceAddress + ':1.ERROR_SABOTAGE', value => {
                return Boolean(value);
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
