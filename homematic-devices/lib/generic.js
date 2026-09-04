/* Generic Homematic → HomeKit mapping for device types without a module
   in homematic-devices/ (ROADMAP task 7, D-5). Channel roles come from
   lib/roles.js; this file turns them into accessories and services through
   the same Accessory DSL the per-type modules use, and tells the editor
   which options to offer.

   Accessory layout (same rules the 3.3.0 modules followed):
   - sensors, buttons and the battery live on the device accessory
     (identity = device address),
   - a device with exactly one actuator channel keeps that on the device
     accessory too; with several actuator channels every channel becomes an
     accessory of its own (identity = channel address) unless the user
     enabled `SingleAccessory`,
   - HmIP virtual receiver channels (2nd/3rd receiver) and buttons on
     actuators are opt-in (`enabled: true` in the config). */

const Accessory = require('./accessory');
const {Service} = require('./accessory');
const roles = require('./roles');

const SWITCH_TYPES = ['Switch', 'Outlet', 'Lightbulb', 'Fan', 'Valve', 'ValveIrrigation'];

/**
 * Devices that map fine but are noise for most homes and are therefore
 * opt-in (`{enabled: true}` under the device address): the CCU's own virtual
 * remote (50 programmable switches). Enabling it lets CCU programs trigger
 * HomeKit automations by "pressing" a virtual key.
 */
const OPT_IN_TYPES = /^(HmIP|HM)-RCV-50$/i;

function isOptIn(device) {
    return Boolean(device && OPT_IN_TYPES.test(String(device.TYPE)));
}
const CONTACT_TYPES = ['ContactSensor', 'Door', 'Window', 'GarageDoorOpener'];
const BLIND_TYPES = ['VerticalTilt Enabled', 'VerticalTilt Disabled'];

/** modules that already implement a role for a whole device better than the generic code */
const DELEGATES = {
    lock: 'hm-sec-key',
    garage: 'hmip-mod-ho',
};

function opt(options, address) {
    return (options && options[address]) || {};
}

/** index of an ENUM value name, or the fallback when the description is unknown */
function enumIndex(description, name, fallback) {
    const list = description && description.VALUE_LIST;
    if (Array.isArray(list)) {
        const index = list.indexOf(name);
        if (index !== -1) {
            return index;
        }
    }

    return fallback;
}

function kelvinToMired(kelvin) {
    return Math.max(140, Math.min(500, Math.round(1000000 / Math.max(1, kelvin))));
}

function miredToKelvin(mired) {
    return Math.round(1000000 / Math.max(1, mired));
}

/**
 * Everything the runtime and the editor need to know about a device.
 * @param {object} device  device description (TYPE, ADDRESS, CHILDREN)
 * @param {object} ccu  ccu-connection node (metadata, channelNames, getParamsetDescription)
 * @param {string} iface
 * @param {object} [options]  the per-address config of the homematic-devices node
 */
function plan(device, ccu, iface, options = {}, channelModes = {}) {
    const devices = ccu.metadata.devices[iface] || {};
    const getChannel = (address) => devices[address];
    const getValues = (channel) => ccu.getParamsetDescription(iface, channel, 'VALUES');
    const getMode = (address) => channelModes[address];
    const channels = roles.deviceRoles(device, getChannel, getValues, getMode).map((c) => ({
        ...c,
        name: ccu.channelNames[c.address] || c.address,
        values: getValues(getChannel(c.address)) || {},
        config: opt(options, c.address),
    }));

    const usable = channels.filter((c) => c.role && c.role !== 'maintenance' && c.role !== 'state_only');
    const actuators = usable.filter((c) => c.actuator && !c.virtual);
    const maintenance = channels.find((c) => c.role === 'maintenance');
    const maintenanceValues = maintenance ? maintenance.values : {};
    const lowbat = ['LOW_BAT', 'LOWBAT'].find((dp) => maintenanceValues[dp]);
    const voltage = maintenanceValues.OPERATING_VOLTAGE ? 'OPERATING_VOLTAGE' : null;
    const sabotage = maintenanceValues.SABOTAGE ? 'SABOTAGE' : null;
    const deviceOptions = opt(options, device.ADDRESS);

    const result = {
        address: device.ADDRESS,
        type: device.TYPE,
        iface,
        name: ccu.channelNames[device.ADDRESS] || device.ADDRESS,
        channels: usable,
        actuators,
        maintenanceAddress: maintenance ? maintenance.address : device.ADDRESS + ':0',
        lowbat,
        voltage,
        sabotage,
        singleAccessory: actuators.length > 1 && !opt(options, device.ADDRESS + ':SingleAccessory').disabled,
        // BidCos reports LOWBAT on every device, mains actuators included; HmIP only on battery devices
        batteryEnabled:
            Boolean(lowbat) &&
            (iface !== 'BidCos-RF' || actuators.length === 0) &&
            !opt(options, device.ADDRESS + ':Battery').disabled,
        deviceOptions,
        supported: usable.length > 0,
        delegate: null,
    };

    // whole-device delegation to an existing module when its role is the only actuator role
    const actuatorRoles = new Set(actuators.map((c) => c.role));
    if (actuatorRoles.size === 1) {
        const [role] = actuatorRoles;
        if (DELEGATES[role]) {
            result.delegate = DELEGATES[role];
        } else if (role === 'thermostat_hmip' && actuators[0].index === 1) {
            result.delegate = actuators[0].datapoints.humidity ? 'hmip-wth' : 'hmip-etrv';
        } else if ((role === 'blind_hmip' || role === 'shutter_hmip') && iface === 'HmIP-RF') {
            result.delegate = 'lib/generic-hmip-blind';
        }
    }

    return result;
}

/**
 * Editor rows for a device (same shape as catalogue.describeDevice):
 * device-level options and one row per selectable channel.
 */
function editorRows(p) {
    const options = [];
    if (p.actuators.length > 1) {
        options.push('SingleAccessory');
    }

    if (p.lowbat && (p.iface !== 'BidCos-RF' || p.actuators.length === 0)) {
        options.push('Battery');
    }

    const hasHumidity = p.channels.some((c) => c.datapoints.humidity);
    const hasIllumination = p.channels.some((c) => c.datapoints.illumination);
    if (hasHumidity) {
        options.push('HumiditySensor');
    }

    if (hasIllumination) {
        options.push('LightSensor');
    }

    if (p.channels.some((c) => c.role === 'lock_hmip')) {
        options.push('OpenOnUnlock');
    }

    if (p.delegate === 'hmip-wth' || p.delegate === 'hmip-etrv') {
        options.push('BoostSwitch');
    }

    const channels = [];
    for (const c of p.channels) {
        let dropdowns = null;
        switch (c.role) {
            case 'switch':
                dropdowns = {type: SWITCH_TYPES};
                break;
            case 'contact':
                dropdowns = {type: CONTACT_TYPES};
                break;
            case 'blind_hmip':
                if (c.datapoints.tilt) {
                    dropdowns = {type: BLIND_TYPES};
                }

                break;
            default:
        }

        // buttons on an actuator are opt-in like virtual receivers
        const optIn = c.virtual || (c.role === 'key' && p.actuators.length > 0);
        channels.push({address: c.address, name: c.name, dropdowns, virtual: optIn, fixed: false});
    }

    return {options, channels};
}

class GenericAccessory extends Accessory {
    constructor(config, node, p, channels, extras) {
        super(config, node);
        this.plan = p;
        this.channels = channels;
        this.extras = extras;
    }

    dp(address, datapoint) {
        return this.plan.iface + '.' + address + '.' + datapoint;
    }

    /** services are identified by channel index (+ suffix), not by a running counter */
    addService(type, name, subtype) {
        if (!this.acc.getService(subtype)) {
            this.node.debug(
                'add service ' + type + ' (' + subtype + ') to ' + this.config.description.TYPE + ' ' + name,
            );
            this.acc.addService(this.hap.Service[type], name, subtype);
        }

        this.datapointUnreach(this.config.deviceAddress + ':0.UNREACH');
        return new Service(this, subtype);
    }

    init() {
        const {hap} = this;
        let keyIndex = 0;
        let keyLabel = false;

        for (const c of this.channels) {
            const name = c.name;
            const sub = String(c.index);
            const d = c.datapoints;
            const type = c.config.type;

            switch (c.role) {
                case 'switch':
                    this.switchService(c, type || 'Switch');
                    break;

                case 'valve':
                    this.switchService(c, 'Valve');
                    break;

                case 'dimmer':
                case 'light_color':
                    this.dimmerService(c);
                    break;

                case 'blind_hmip':
                case 'shutter_hmip':
                case 'blind':
                case 'jalousie':
                case 'window':
                    this.coveringService(c);
                    break;

                case 'contact':
                    this.contactService(c, type || 'ContactSensor');
                    break;

                case 'rotary_handle': {
                    const closed = enumIndex(c.values.STATE, 'CLOSED', 0);
                    this.addService('ContactSensor', name, sub).get(
                        'ContactSensorState',
                        this.dp(c.address, d.state),
                        (value, ch) => (value === closed ? ch.CONTACT_DETECTED : ch.CONTACT_NOT_DETECTED),
                    );
                    break;
                }

                case 'motion':
                    this.addService('MotionSensor', name, sub).get(
                        'MotionDetected',
                        this.dp(c.address, d.state),
                        Boolean,
                    );
                    this.illuminationService(c);
                    break;

                case 'presence':
                    this.addService('OccupancySensor', name, sub).get(
                        'OccupancyDetected',
                        this.dp(c.address, d.state),
                        (value) => (value ? 1 : 0),
                    );
                    this.illuminationService(c);
                    break;

                case 'smoke': {
                    const alarm = enumIndex(c.values[d.state], 'PRIMARY_ALARM', 1);
                    this.addService('SmokeSensor', name, sub).get(
                        'SmokeDetected',
                        this.dp(c.address, d.state),
                        (value) => (typeof value === 'boolean' ? (value ? 1 : 0) : value === alarm ? 1 : 0),
                    );
                    break;
                }

                case 'water':
                case 'rain':
                    this.addService('LeakSensor', name, sub).get(
                        'LeakDetected',
                        this.dp(c.address, d.state),
                        (value) => (value ? 1 : 0),
                    );
                    break;

                case 'co2':
                    this.addService('CarbonDioxideSensor', name, sub)
                        .get('CarbonDioxideLevel', this.dp(c.address, d.level))
                        .get('CarbonDioxideDetected', this.dp(c.address, d.level), (value) => (value > 1500 ? 1 : 0));
                    break;

                case 'weather':
                    if (d.temperature) {
                        this.addService('TemperatureSensor', name, sub)
                            .setProps('CurrentTemperature', {minValue: -50, maxValue: 120})
                            .get('CurrentTemperature', this.dp(c.address, d.temperature));
                    }

                    this.humidityService(c);
                    this.illuminationService(c);
                    break;

                case 'humidity':
                    this.humidityService(c, true);
                    break;

                case 'light_sensor':
                    this.illuminationService(c, true);
                    break;

                case 'key': {
                    if (!keyLabel) {
                        this.addService('ServiceLabel', 'Buttons', 'label').update('ServiceLabelNamespace', 1);
                        keyLabel = true;
                    }

                    keyIndex++;
                    const service = this.addService('StatelessProgrammableSwitch', name, sub);
                    service.update('ServiceLabelIndex', keyIndex);
                    const validValues = d.long ? [0, 2] : [0];
                    service.setProps('ProgrammableSwitchEvent', {validValues});
                    const press = (datapoint, event) => {
                        this.subscriptions.push(
                            this.ccu.subscribe(
                                {cache: false, change: false, datapointName: this.dp(c.address, datapoint)},
                                () => {
                                    service.update('ProgrammableSwitchEvent', event);
                                },
                            ),
                        );
                        this.reportValueUsage(c.address, datapoint);
                    };

                    if (d.short) {
                        press(d.short, hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
                    }

                    if (d.long) {
                        press(d.long, hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
                    }

                    break;
                }

                case 'lock_hmip':
                    this.lockService(c);
                    break;

                case 'lock_state': {
                    const locked = enumIndex(c.values[d.state], 'LOCKED', 1);
                    const unlocked = enumIndex(c.values[d.state], 'UNLOCKED', 2);
                    const toState = (value, ch) =>
                        value === locked ? ch.SECURED : value === unlocked ? ch.UNSECURED : ch.UNKNOWN;
                    const service = this.addService('LockMechanism', name, sub)
                        .get('LockCurrentState', this.dp(c.address, d.state), toState)
                        .get('LockTargetState', this.dp(c.address, d.state), (value, ch) =>
                            value === locked ? ch.SECURED : ch.UNSECURED,
                        );
                    service.set('LockTargetState', (value, callback) => {
                        // sensor only: reflect the real state back
                        callback();
                        setTimeout(() => {
                            const current = this.ccu.values[this.dp(c.address, d.state)];
                            if (current) {
                                service.update(
                                    'LockTargetState',
                                    current.value === locked
                                        ? hap.Characteristic.LockTargetState.SECURED
                                        : hap.Characteristic.LockTargetState.UNSECURED,
                                );
                            }
                        }, 100);
                    });
                    break;
                }

                case 'thermostat_hmip':
                case 'thermostat_hm':
                    this.thermostatService(c);
                    break;

                case 'energy':
                    // consumed by the switch service (OutletInUse); no service of its own
                    break;

                default:
                    this.node.warn('generic mapping: no HomeKit service for role ' + c.role + ' (' + c.address + ')');
            }
        }

        if (this.extras.battery) {
            this.batteryService();
        }
    }

    switchService(c, type) {
        const stateDp = this.dp(c.address, c.datapoints.state);
        const power = this.extras.power;
        switch (type) {
            case 'ValveIrrigation':
            case 'Valve': {
                const service = this.addService('Valve', c.name, String(c.index));
                service.update('ValveType', type === 'ValveIrrigation' ? 1 : 0);
                service
                    .get('Active', stateDp, (value) => (value ? 1 : 0))
                    .get('InUse', stateDp, (value) => (value ? 1 : 0))
                    .set('Active', stateDp, (value) => {
                        service.update('InUse', value);
                        return Boolean(value);
                    });
                break;
            }

            case 'Outlet': {
                const service = this.addService('Outlet', c.name, String(c.index))
                    .get('On', stateDp)
                    .set('On', stateDp);
                if (power) {
                    service.get('OutletInUse', power, (value) => value > 0);
                } else {
                    service.get('OutletInUse', stateDp, Boolean);
                }

                break;
            }

            default:
                this.addService(type, c.name, String(c.index)).get('On', stateDp).set('On', stateDp);
        }
    }

    dimmerService(c) {
        const d = c.datapoints;
        const levelDp = this.dp(c.address, d.level);
        let lastLevel = 0; // 0..1, remembered for "on" (#195)
        const service = this.addService('Lightbulb', c.name, String(c.index))
            .get('On', levelDp, (value) => {
                if (value > 0) {
                    lastLevel = value;
                }

                return value > 0;
            })
            .set('On', (value, callback) => {
                if (!value) {
                    this.ccuSetValue(levelDp, 0, callback);
                    return;
                }

                // a Brightness write usually follows within a few ms; give it precedence
                setTimeout(() => {
                    const current = this.ccu.values[levelDp];
                    if (current && current.value > 0) {
                        callback();
                        return;
                    }

                    this.ccuSetValue(levelDp, lastLevel > 0 ? lastLevel : 1, callback);
                }, 100);
            })
            .get('Brightness', levelDp, (value) => Math.round(value * 100))
            .set('Brightness', levelDp, (value) => {
                lastLevel = value / 100;
                return value / 100;
            });

        if (c.role === 'light_color') {
            if (d.hue) {
                const hueDp = this.dp(c.address, d.hue);
                service
                    .get('Hue', hueDp, (value) => Math.min(360, Math.max(0, value)))
                    .set('Hue', hueDp, (value) => value);
            }

            if (d.saturation) {
                const satDp = this.dp(c.address, d.saturation);
                service
                    .get('Saturation', satDp, (value) => Math.round(Math.min(1, value) * 100))
                    .set('Saturation', satDp, (value) => value / 100);
            }

            if (d.colorTemperature) {
                const ctDp = this.dp(c.address, d.colorTemperature);
                service.get('ColorTemperature', ctDp, kelvinToMired).set('ColorTemperature', ctDp, miredToKelvin);
            }
        }
    }

    coveringService(c) {
        const d = c.datapoints;
        const levelDp = this.dp(c.address, d.level);
        const serviceType = c.role === 'window' ? 'Window' : 'WindowCovering';
        const tilt = d.tilt && c.config.type !== 'VerticalTilt Disabled';
        let target;
        const service = this.addService(serviceType, c.name, String(c.index))
            .get('CurrentPosition', levelDp, (value) => Math.round(value * 100))
            .get('TargetPosition', levelDp, (value) => {
                if (target === undefined) {
                    target = Math.round(value * 100);
                }

                return Math.round(value * 100);
            })
            .set('TargetPosition', levelDp, (value) => {
                target = value;
                return value / 100;
            });

        if (d.activity) {
            // HmIP ACTIVITY_STATE: UNKNOWN, UP, DOWN, STABLE
            const up = enumIndex(c.values[d.activity], 'UP', 1);
            const down = enumIndex(c.values[d.activity], 'DOWN', 2);
            service.get('PositionState', this.dp(c.address, d.activity), (value, ch) =>
                value === up ? ch.INCREASING : value === down ? ch.DECREASING : ch.STOPPED,
            );
        } else if (d.direction) {
            // BidCos DIRECTION: NONE, UP, DOWN, UNDEFINED
            service.get('PositionState', this.dp(c.address, d.direction), (value, ch) =>
                value === 1 ? ch.INCREASING : value === 2 ? ch.DECREASING : ch.STOPPED,
            );
        } else {
            service.update('PositionState', 2);
        }

        if (tilt) {
            const tiltDp = this.dp(c.address, d.tilt);
            service
                .get('CurrentVerticalTiltAngle', tiltDp, (value) => Math.round(value * 180 - 90))
                .get('TargetVerticalTiltAngle', tiltDp, (value) => Math.round(value * 180 - 90))
                .set('TargetVerticalTiltAngle', tiltDp, (value) => (value + 90) / 180);
        }
    }

    contactService(c, type) {
        const d = c.datapoints;
        const stateDp = this.dp(c.address, d.state);
        const closed =
            c.values[d.state] && c.values[d.state].TYPE === 'ENUM' ? enumIndex(c.values[d.state], 'CLOSED', 0) : false;
        const isOpen = (value) => value !== closed && Boolean(value);
        const sub = String(c.index);
        let actualOpen;

        switch (type) {
            case 'GarageDoorOpener': {
                const service = this.addService(type, c.name, sub);
                const doorState = (value) => {
                    actualOpen = isOpen(value);
                    const state = actualOpen ? 0 : 1;
                    service.update('TargetDoorState', state);
                    return state;
                };

                service.get('CurrentDoorState', stateDp, doorState).get('TargetDoorState', stateDp, doorState);
                service.set('TargetDoorState', (value, callback) => {
                    callback();
                    setTimeout(() => {
                        const state = actualOpen ? 0 : 1;
                        service.update('CurrentDoorState', state);
                        service.update('TargetDoorState', state);
                    }, 100);
                });
                service.update('ObstructionDetected', false);
                break;
            }

            case 'Door':
            case 'Window': {
                const service = this.addService(type, c.name, sub);
                service.update('PositionState', 2);
                const position = (value) => {
                    actualOpen = isOpen(value);
                    const pos = actualOpen ? 100 : 0;
                    service.update('TargetPosition', pos);
                    return pos;
                };

                service.get('CurrentPosition', stateDp, position).get('TargetPosition', stateDp, position);
                service.set('TargetPosition', (value, callback) => {
                    callback();
                    setTimeout(() => {
                        const pos = actualOpen ? 100 : 0;
                        service.update('CurrentPosition', pos);
                        service.update('TargetPosition', pos);
                        service.update('PositionState', 2);
                    }, 100);
                });
                break;
            }

            default: {
                const service = this.addService('ContactSensor', c.name, sub).get(
                    'ContactSensorState',
                    stateDp,
                    (value, ch) => (isOpen(value) ? ch.CONTACT_NOT_DETECTED : ch.CONTACT_DETECTED),
                );
                if (this.plan.sabotage) {
                    service.get('StatusTampered', this.dp(this.plan.maintenanceAddress, this.plan.sabotage), Boolean);
                }
            }
        }
    }

    lockService(c) {
        const d = c.datapoints;
        const stateDp = this.dp(c.address, d.state);
        const targetDp = this.dp(c.address, d.target);
        const locked = enumIndex(c.values[d.state], 'LOCKED', 1);
        const unlocked = enumIndex(c.values[d.state], 'UNLOCKED', 2);
        const targetLocked = enumIndex(c.values[d.target], 'LOCKED', 0);
        const targetUnlocked = enumIndex(c.values[d.target], 'UNLOCKED', 1);
        const targetOpen = enumIndex(c.values[d.target], 'OPEN', 2);
        const openOnUnlock = !opt(this.config.options, this.plan.address + ':OpenOnUnlock').disabled;
        const {hap} = this;

        const service = this.addService('LockMechanism', c.name, String(c.index))
            .get('LockCurrentState', stateDp, (value, ch) =>
                value === locked ? ch.SECURED : value === unlocked ? ch.UNSECURED : ch.UNKNOWN,
            )
            .get('LockTargetState', stateDp, (value, ch) => (value === locked ? ch.SECURED : ch.UNSECURED));

        service.set('LockTargetState', (value, callback) => {
            const secure = value === hap.Characteristic.LockTargetState.SECURED;
            const command = secure ? targetLocked : openOnUnlock ? targetOpen : targetUnlocked;
            this.ccuSetValue(targetDp, command, callback);
        });
    }

    thermostatService(c) {
        const d = c.datapoints;
        const {hap} = this;
        const setpointDp = this.dp(c.address, d.setpoint);
        const sub = String(c.index);
        const OFF_TEMPERATURE = 4.5;
        let lastSetpoint = 21;

        const service = this.addService('Thermostat', c.name, sub)
            .setProps('CurrentTemperature', {minValue: -50, maxValue: 120})
            .setProps('TargetTemperature', {minValue: 4.5, maxValue: 30.5, minStep: 0.5})
            .get('TemperatureDisplayUnits', setpointDp, () => 0);

        if (d.temperature) {
            service.get('CurrentTemperature', this.dp(c.address, d.temperature));
        }

        service
            .get('TargetTemperature', setpointDp, (value) => {
                if (value > OFF_TEMPERATURE) {
                    lastSetpoint = value;
                }

                return value;
            })
            .set('TargetTemperature', setpointDp, (value) => {
                lastSetpoint = value;
                return value;
            })
            .get('CurrentHeatingCoolingState', setpointDp, (value, ch) => (value > OFF_TEMPERATURE ? ch.HEAT : ch.OFF))
            .get('TargetHeatingCoolingState', setpointDp, (value, ch) => (value > OFF_TEMPERATURE ? ch.HEAT : ch.OFF))
            .setProps('TargetHeatingCoolingState', {validValues: [0, 1]})
            .set('TargetHeatingCoolingState', (value, callback) => {
                const off = value === hap.Characteristic.TargetHeatingCoolingState.OFF;
                this.ccuSetValue(setpointDp, off ? OFF_TEMPERATURE : lastSetpoint, callback);
            });

        if (d.humidity) {
            service.get('CurrentRelativeHumidity', this.dp(c.address, d.humidity));
        }
    }

    humidityService(c, always = false) {
        const d = c.datapoints;
        if (!d.humidity || (!always && opt(this.config.options, this.plan.address + ':HumiditySensor').disabled)) {
            return;
        }

        this.addService('HumiditySensor', c.name, c.index + 'h').get(
            'CurrentRelativeHumidity',
            this.dp(c.address, d.humidity),
        );
    }

    illuminationService(c, always = false) {
        const d = c.datapoints;
        if (!d.illumination || (!always && opt(this.config.options, this.plan.address + ':LightSensor').disabled)) {
            return;
        }

        this.addService('LightSensor', c.name, c.index + 'l').get(
            'CurrentAmbientLightLevel',
            this.dp(c.address, d.illumination),
            (value) => Math.max(0.0001, value),
        );
    }

    batteryService() {
        const p = this.plan;
        const service = this.addService('Battery', this.config.name, 'battery')
            .get('StatusLowBattery', this.dp(p.maintenanceAddress, p.lowbat), (value, ch) =>
                value ? ch.BATTERY_LEVEL_LOW : ch.BATTERY_LEVEL_NORMAL,
            )
            .update('ChargingState', 2);
        if (p.voltage) {
            service.get('BatteryLevel', this.dp(p.maintenanceAddress, p.voltage), (value) =>
                this.percent(value, null, 1, 1.5),
            );
        } else {
            service.get('BatteryLevel', this.dp(p.maintenanceAddress, p.lowbat), (value) => (value ? 0 : 100));
        }
    }
}

/**
 * Device entry point, same signature as the per-type modules:
 * `new GenericDevice(config, node)` where config = {name, iface,
 * deviceAddress, description, options}.
 */
class GenericDevice {
    constructor(config, node) {
        const {ccu} = node;
        const p = plan(config.description, ccu, config.iface, config.options, config.channelModes);
        this.plan = p;

        if (p.delegate) {
            const Delegate = require('../' + p.delegate);
            node.debug('generic mapping: ' + p.type + ' delegated to ' + p.delegate);
            this.delegate = new Delegate(config, node);
            return;
        }

        const enabled = (c) => {
            const optIn = c.virtual || (c.role === 'key' && p.actuators.length > 0);
            return optIn ? Boolean(c.config.enabled) : !c.config.disabled;
        };

        const selected = p.channels.filter(enabled);
        const actuators = selected.filter((c) => c.actuator);
        const others = selected.filter((c) => !c.actuator);
        const power = (() => {
            const energy = p.channels.find((c) => c.role === 'energy' && c.datapoints.power);
            return energy ? config.iface + '.' + energy.address + '.' + energy.datapoints.power : null;
        })();

        const accessories = [];
        if (actuators.length <= 1 || p.singleAccessory) {
            accessories.push({description: config.description, name: config.name, channels: [...actuators, ...others]});
        } else {
            for (const c of actuators) {
                accessories.push({
                    description: {...config.description, ADDRESS: c.address},
                    name: c.name,
                    channels: [c],
                });
            }

            if (others.length > 0 || p.batteryEnabled) {
                accessories.push({description: config.description, name: config.name, channels: others});
            }
        }

        this.accessories = [];
        for (const acc of accessories) {
            if (acc.channels.length === 0 && !p.batteryEnabled) {
                continue;
            }

            const accConfig = {...config, name: acc.name, description: acc.description};
            const extras = {
                power,
                battery: p.batteryEnabled && acc.description.ADDRESS === config.description.ADDRESS,
            };
            this.accessories.push(new GenericAccessory(accConfig, node, p, acc.channels, extras));
        }
    }
}

module.exports = {
    GenericDevice,
    GenericAccessory,
    plan,
    editorRows,
    isOptIn,
    SWITCH_TYPES,
    CONTACT_TYPES,
    BLIND_TYPES,
};
