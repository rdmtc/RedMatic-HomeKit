const Accessory = require('./lib/accessory');
const thermostat = require('./lib/thermostat');

module.exports = class HmipEtrv extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        let level = 0;
        let currentSetpoint;
        const setpoint = thermostat.createSetpoint();
        let setpointMode;
        let target;

        function targetState() {
            // 0=off, 1=heat, 3=auto
            switch (setpointMode) {
                case 1:
                    // Manu
                    target = thermostat.targetState(true, currentSetpoint);
                    break;
                default:
                    // Auto / Party
                    target = thermostat.targetState(false, currentSetpoint);
            }

            return target;
        }

        function currentState() {
            // 0=off, 1=heat
            return level > 0 ? 1 : 0;
        }

        const serviceThermostat = this.addService('Thermostat', config.name);

        serviceThermostat
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', config.deviceAddress + ':1.ACTUAL_TEMPERATURE')

            .setProps('TargetTemperature', {minValue: 4.5, maxValue: 30.5, minStep: 0.5})
            .get('TargetTemperature', config.deviceAddress + ':1.SET_POINT_TEMPERATURE', (value) => {
                currentSetpoint = value;
                setpoint.read(value);

                updateHeatingCoolingState();
                return value;
            })
            .set('TargetTemperature', config.deviceAddress + ':1.SET_POINT_TEMPERATURE', (value) =>
                setpoint.write(value),
            )

            .setProps('CurrentHeatingCoolingState', {validValues: [0, 1], maxValue: 1})
            .get('CurrentHeatingCoolingState', config.deviceAddress + ':1.LEVEL', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return currentState();
            })

            .setProps('TargetHeatingCoolingState', {validValues: [0, 1, 3]})
            .get('TargetHeatingCoolingState', config.deviceAddress + ':1.SET_POINT_TEMPERATURE', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return targetState();
            })
            .set(
                'TargetHeatingCoolingState',
                thermostat.hmipModeSetter({
                    ccu,
                    hap,
                    node,
                    config,
                    channel: 1,
                    setpoint,
                    service: serviceThermostat,
                    getMode: () => setpointMode,
                    getSetpoint: () => currentSetpoint,
                }),
            );

        function updateHeatingCoolingState() {
            serviceThermostat.update('CurrentHeatingCoolingState', currentState());
            serviceThermostat.update('TargetHeatingCoolingState', targetState());
        }

        this.subscribe(config.deviceAddress + ':1.LEVEL', (value) => {
            level = value;
            node.debug('update ' + config.name + ' level ' + level);
            updateHeatingCoolingState();
        });

        this.subscribe(config.deviceAddress + ':1.SET_POINT_MODE', (value) => {
            setpointMode = value;
            node.debug('update ' + config.name + ' setpointMode ' + setpointMode);
            updateHeatingCoolingState();
        });

        this.addService('Battery', config.name)
            .get('StatusLowBattery', config.deviceAddress + ':0.LOW_BAT', (value, c) => {
                return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
            })
            .get('BatteryLevel', config.deviceAddress + ':0.OPERATING_VOLTAGE', this.percent)
            .update('ChargingState', 2);

        if (this.option('BoostSwitch')) {
            this.addService('Switch', 'Boost ' + config.name, 'Boost')
                .set('On', config.deviceAddress + ':1.BOOST_MODE')
                .get('On', config.deviceAddress + ':1.BOOST_MODE');
        }
    }
};
