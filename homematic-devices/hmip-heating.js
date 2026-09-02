const Accessory = require('./lib/accessory');
const thermostat = require('./lib/thermostat');

module.exports = class HmipHeating extends Accessory {
    init(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;

        const levels = {};
        let level = 0;
        let currentSetpoint;
        const setpoint = thermostat.createSetpoint();
        let setpointMode;
        let target;

        function targetState() {
            // target: 0=off, 1=heat, 3=auto
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

        const valveDevices = [];
        let valueDevice;
        let humidityDp;

        const lowbatDps = {};

        const group = ccu.groups && ccu.groups[config.deviceAddress.replace(/VirtualDevices\.INT0*/, '')];

        if (!group) {
            node.error(config.deviceAddress + ' group configuration not found');
            return;
        }

        node.debug(
            config.deviceAddress +
                ' ' +
                group.groupProperties.NAME +
                ' ' +
                group.groupType.id +
                ' has ' +
                group.groupMembers.length +
                ' members',
        );
        group.groupMembers.forEach((member) => {
            if (member.memberType.id.startsWith('RADIATOR')) {
                valveDevices.push('HmIP-RF.' + member.id);
                valueDevice = valueDevice || 'HmIP-RF.' + member.id;
            } else if (member.memberType.id.startsWith('WALLMOUNTED')) {
                valueDevice = 'HmIP-RF.' + member.id;
                humidityDp = 'HmIP-RF.' + member.id + '.HUMIDITY';
            }

            lowbatDps['HmIP-RF.' + member.id.split(':')[0] + ':0.LOW_BAT'] = false;
            node.debug(config.deviceAddress + ' member ' + member.memberType.id + ' ' + member.id);
        });

        if (valueDevice) {
            node.debug(config.deviceAddress + ' valueDevice ' + valueDevice);
        } else {
            node.error(config.deviceAddress + ' group has neither thermostat nor valve device');
            return;
        }

        const serviceThermostat = this.addService('Thermostat', config.name);

        serviceThermostat
            .setProps('CurrentTemperature', {minValue: -40, maxValue: 80})
            .get('CurrentTemperature', valueDevice + '.ACTUAL_TEMPERATURE')

            .setProps('TargetTemperature', {minValue: 4.5, maxValue: 30.5, minStep: 0.5})
            .get('TargetTemperature', valueDevice + '.SET_POINT_TEMPERATURE', (value) => {
                currentSetpoint = value;
                setpoint.read(value);

                updateHeatingCoolingState();
                return value;
            })
            .set('TargetTemperature', config.deviceAddress + ':1.SET_POINT_TEMPERATURE', (value) =>
                setpoint.write(value),
            )

            .setProps('CurrentHeatingCoolingState', {validValues: [0, 1], maxValue: 1})

            .get('CurrentHeatingCoolingState', valueDevice + '.LEVEL', () => {
                setTimeout(() => {
                    updateHeatingCoolingState();
                }, 1000);
                return currentState();
            })

            .setProps('TargetHeatingCoolingState', {validValues: [0, 1, 3]})
            .get('TargetHeatingCoolingState', valueDevice + '.SET_POINT_TEMPERATURE', () => {
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

        valveDevices.forEach((valveStateDevice) => {
            const datapointLevel = valveStateDevice + '.LEVEL';
            this.subscribe(datapointLevel, (value) => {
                levels[datapointLevel] = value;
                let max = 0;
                Object.keys(levels).forEach((dp) => {
                    if (levels[dp] > max) {
                        max = levels[dp];
                    }
                });
                if (level !== max) {
                    level = max;
                    node.debug('update ' + config.name + ' level ' + level);
                    updateHeatingCoolingState();
                }
            });
        });

        this.subscribe(valueDevice + '.SET_POINT_MODE', (value) => {
            setpointMode = value;
            node.debug('update ' + config.name + ' setpointMode ' + setpointMode);
            updateHeatingCoolingState();
        });

        const batteryService = this.addService('Battery', config.name, 'Battery');
        Object.keys(lowbatDps).forEach((dp) => {
            this.subscribe(dp, (value) => {
                lowbatDps[dp] = value;
                let lowbat = false;
                Object.keys(lowbatDps).forEach((ldp) => {
                    lowbat = lowbat || lowbatDps[ldp];
                });
                batteryService.update(
                    'StatusLowBattery',
                    lowbat
                        ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
                        : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL,
                );
                batteryService.update('BatteryLevel', lowbat ? 0 : 100);
            });
        });

        if (this.option('HumiditySensor') && humidityDp) {
            this.addService('HumiditySensor', config.name).get('CurrentRelativeHumidity', humidityDp);
        }

        if (this.option('BoostSwitch')) {
            this.addService('Switch', 'Boost ' + config.name, 'Boost')
                .set('On', (value, callback) => {
                    this.ccuSetValue(config.deviceAddress + ':1.BOOST_MODE', value, callback);
                })
                .get('On', valueDevice + '.BOOST_MODE');
        }
    }
};
