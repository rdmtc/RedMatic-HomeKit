const Accessory = require('./lib/accessory');

module.exports = class HmCcTc extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        let datapointValveState;
        let valveStateDevice;
        let valveState = 0;
        let valueSetpoint;

        function targetState() {
            // 0=off, 1=heat, 3=auto
            return valueSetpoint > 5.5 ? 1 : 0;
        }

        function currentState() {
            // 0=off, 1=heat
            return valveState > 0 ? 1 : 0;
        }

        const serviceThermostat = this.addService('Thermostat', config.name)
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', config.deviceAddress + ':1.TEMPERATURE')

            .setProps('TargetTemperature', {minValue: 5.5, maxValue: 30.5, minStep: 0.5})
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
                valueSetpoint = value ? 21 : 5.5;
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return valueSetpoint;
            });

        const subtypeThermostat = serviceThermostat.subtype;

        const that = this;

        function updateHeatingCoolingState() {
            const current = currentState();
            node.debug('update ' + config.name + ' (' + subtypeThermostat + ') CurrentHeatingCoolingState ' + current);
            that.acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.CurrentHeatingCoolingState, current);
            const target = targetState();
            node.debug('update ' + config.name + ' (' + subtypeThermostat + ') TargetHeatingCoolingState ' + target);
            that.acc.getService(subtypeThermostat).updateCharacteristic(hap.Characteristic.TargetHeatingCoolingState, target);
        }

        const links = ccu.getLinks(config.iface, config.description.ADDRESS + ':2');
        node.debug(config.name + ' ' + config.description.ADDRESS + ':2 linked to ' + JSON.stringify(links));

        if (links[0]) {
            valveStateDevice = links[0].split(':')[0];
            datapointValveState = config.iface + '.' + valveStateDevice + ':1.VALVE_STATE';

            valveState = (ccu.values && ccu.values[datapointValveState] && ccu.values[datapointValveState].value) || 0;

            this.subscriptions.push(ccu.subscribe({
                cache: true,
                change: true,
                datapointName: datapointValveState,
            }, msg => {
                valveState = msg.value;
                updateHeatingCoolingState();
            }));
        }

        this.addService('BatteryService', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            });

        const humiditySensorOption = config.description.ADDRESS + ':HumiditySensor';
        if (!(config.options[humiditySensorOption] && config.options[humiditySensorOption].disabled)) {
            this.addService('HumiditySensor', config.name)
                .get('CurrentRelativeHumidity', config.deviceAddress + ':1.HUMIDITY')

                .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                    return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                });
        }


    }
};
