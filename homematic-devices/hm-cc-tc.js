const Accessory = require('./lib/accessory.js');

module.exports = class HmCcTc extends Accessory {
    init(config, node) {
        const {ccu} = node;

        let valveStateDevice;
        let valveState = 0;
        let valueSetpoint;

        function targetState() {
            // 0=off, 1=heat, 3=auto
            return valueSetpoint > 0 ? 1 : 0;
        }

        function currentState() {
            // 0=off, 1=heat
            return valveState > 0 ? 1 : 0;
        }

        const serviceThermostat = this.addService('Thermostat', config.name)
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', config.deviceAddress + ':1.TEMPERATURE')

            .setProps('TargetTemperature', {minValue: 6, maxValue: 30, minStep: 0.5})
            .get('TargetTemperature', config.deviceAddress + ':2.SETPOINT', value => {
                valueSetpoint = value;
                return value;
            })
            .set('TargetTemperature', config.deviceAddress + ':2.SETPOINT', value => {
                valueSetpoint = value;
                return value;
            })

            .setProps('CurrentHeatingCoolingState', {validValues: [0, 1], maxValue: 1})
            .get('CurrentHeatingCoolingState', config.deviceAddress + ':2.SETPOINT', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return currentState();
            })

            .setProps('TargetHeatingCoolingState', {validValues: [0, 1]})
            .get('TargetHeatingCoolingState', config.deviceAddress + ':2.SETPOINT', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return targetState();
            })
            .set('TargetHeatingCoolingState', config.deviceAddress + ':2.SETPOINT', value => {
                valueSetpoint = value ? 21 : 0;
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return valueSetpoint;
            });

        function updateHeatingCoolingState() {
            serviceThermostat.update('CurrentHeatingCoolingState', currentState());
            serviceThermostat.update('TargetHeatingCoolingState', targetState());
        }

        const links = ccu.getLinks(config.iface, config.description.ADDRESS + ':2');
        node.debug(config.name + ' ' + config.description.ADDRESS + ':2 linked to ' + JSON.stringify(links));

        if (links[0]) {
            valveStateDevice = links[0].split(':')[0];
            this.subscribe(config.iface + '.' + valveStateDevice + ':1.VALVE_STATE', value => {
                valveState = value;
                updateHeatingCoolingState();
            });
        }

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL)
            .get('BatteryLevel', config.deviceAddress + ':0.LOWBAT', value => value ? 0 : 100)
            .update('ChargingState', 2);

        if (this.option('HumiditySensor')) {
            this.addService('HumiditySensor', config.name)
                .get('CurrentRelativeHumidity', config.deviceAddress + ':1.HUMIDITY')

                .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL);
        }
    }
};
