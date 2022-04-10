const Accessory = require('./lib/accessory.js');

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
        this.serviceSecuritySystem.update('SecuritySystemCurrentState', isTriggered ? 4 : this.currentState);
    }

    init(config) {
        this.states = [false, false, false];
        this.currentState = 0;

        this.serviceSecuritySystem = this.addService('SecuritySystem', config.name)
            .setProps('SecuritySystemCurrentState', {validValues: [0, 1, 3, 4]})
            .setProps('SecuritySystemTargetState', {validValues: [0, 1, 3]})

            .get('SecuritySystemCurrentState', config.deviceAddress + ':4.ARMSTATE', value => {
                let result = 3;
                switch (value) {
                    case 1:
                        result = 0;
                        break;
                    case 2:
                        result = 1;
                        break;
                    default:
                }

                this.currentState = result;
                return result;
            })
            .get('SecuritySystemTargetState', config.deviceAddress + ':4.ARMSTATE', value => {
                let result = 3;
                switch (value) {
                    case 1:
                        result = 0;
                        break;
                    case 2:
                        result = 1;
                        break;
                    default:
                }

                this.currentState = result;
                return result;
            })
            .set('SecuritySystemTargetState', config.deviceAddress + ':4.ARMSTATE', value => {
                let result = 0;
                switch (value) {
                    case 0:
                        result = 1;
                        break;
                    case 1:
                        result = 2;
                        break;
                    default:
                }

                this.currentState = value; // Todo result instead of value?
                return result;
            })

            .get('StatusTampered', config.deviceAddress + ':4.ERROR_SABOTAGE', value => Boolean(value));

        this.subscribe(config.deviceAddress + ':1.STATE', value => {
            this.states[0] = value;
            this.checkAlarm();
        });
        this.subscribe(config.deviceAddress + ':2.STATE', value => {
            this.states[1] = value;
            this.checkAlarm();
        });
        this.subscribe(config.deviceAddress + ':3.STATE', value => {
            this.states[2] = value;
            this.checkAlarm();
        });

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('BatteryLevel', config.deviceAddress + ':0.LOWBAT', value => value ? 0 : 100)
            .update('ChargingState', 2);
    }
};
