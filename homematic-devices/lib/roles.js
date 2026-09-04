/* Semantic role of a Homematic channel, derived from the paramset
   description the CCU reports for it (ROADMAP task 7, D-5):

     1. the CONTROL hint eQ-3 puts on the channel's primary VALUES parameter
        (e.g. `SWITCH.STATE`, `DIMMER.LEVEL`, `DOOR_SENSOR.STATE`) — stable
        across HM and HmIP generations and present on every actuator,
     2. the channel TYPE for the older BidCos channels without hints,
     3. datapoint names for channels that carry neither (homebrew sensors,
        CUxD wrappers).

   Pure functions and tables, no I/O. Derived from the pydevccu catalogue
   (399 device types, 166 channel types) — see test/roles.test.js. */

/** CONTROL hint → role, checked in this order (first match wins) */
const ROLE_BY_CONTROL = [
    ['DOOR_LOCK_STATE_TRANSMITTER.LOCK_STATE', 'lock_hmip'],
    ['DOOR_LOCK_TRANSCEIVER.LOCK_STATE', 'lock_hmip'],
    ['DOOR_LOCK_STATE_TRANSCEIVER.LOCK_STATE', 'lock_state'],
    ['LOCK.STATE', 'lock'],
    ['DOOR_RECEIVER.DOOR_STATE', 'garage'],
    ['HEATING_CONTROL_HMIP.SETPOINT', 'thermostat_hmip'],
    ['HEATING_CONTROL.SETPOINT', 'thermostat_hm'],
    ['TEMP.SETPOINT', 'thermostat_hm'],
    ['BLIND_VIRTUAL_RECEIVER.LEVEL', 'blind_hmip'],
    ['SHUTTER_VIRTUAL_RECEIVER.LEVEL', 'shutter_hmip'],
    ['JALOUSIE.LEVEL', 'jalousie'],
    ['BLIND.LEVEL', 'blind'],
    ['WINDOW.LEVEL', 'window'],
    ['WIN_SC.LEVEL', 'window'],
    ['UNIVERSAL_LIGHT_RECEIVER.LEVEL', 'light_color'],
    ['DUAL_WHITE_BRIGHTNESS.LEVEL', 'dimmer'],
    ['DIMMER.LEVEL', 'dimmer'],
    ['WATER_SWITCH.STATE', 'valve'],
    ['SWITCH.STATE', 'switch'],
    ['SIMPLE_SWITCH_RECEIVER.STATE', 'switch'],
    ['DOOROPENER.STATE', 'switch'],
    ['DANGER.STATE', 'smoke'],
    ['DOOR_SENSOR.STATE', 'contact'],
    ['RHS.STATE', 'rotary_handle'],
    ['MOTIONDETECTOR_TRANSCEIVER.MOTION_DETECTION_STATE', 'motion'],
    ['ACCELERATION_TRANSCEIVER.MOTION', 'motion'],
    ['WATER_DETECTION_TRANSMITTER.ALARMSTATE', 'water'],
    ['RAIN_DETECTION_TRANSMITTER.RAINING', 'rain'],
    ['CARBON_DIOXIDE_RECEIVER.CONCENTRATION', 'co2'],
    ['WEATHER_TRANSMIT.ACTUAL_TEMPERATURE', 'weather'],
    ['CLIMATE_TRANSCEIVER.ACTUAL_TEMPERATURE', 'weather'],
    ['COND_SWITCH_TRANSMITTER_TEMPERATURE.ACTUAL_TEMPERATURE', 'weather'],
    ['TEMP_HUM_PARTICLE_MATTER_TRANSMITTER.ACTUAL_TEMPERATURE', 'weather'],
    ['BRIGHTNESS_TRANSMITTER.CURRENT_ILLUMINATION', 'light_sensor'],
    ['LUXMETER.LUX', 'light_sensor'],
    ['POWERMETER.POWER', 'energy'],
    ['POWERMETER_PSM.POWER', 'energy'],
    ['POWERMETER_IGL.POWER', 'energy'],
    ['BUTTON.SHORT', 'key'],
    ['BUTTON_NO_FUNCTION.SHORT', 'key'],
    ['BTN_SHORT_ONLY.SHORT', 'key'],
    // HmIP transmitter channels mirror the state of their virtual receivers;
    // the receivers are the control channels, the transmitter is not exposed
    ['SWITCH_TRANSMITTER.STATE', 'state_only'],
    ['DIMMER_REAL.LEVEL', 'state_only'],
    ['BLIND_TRANSMITTER.LEVEL', 'state_only'],
    ['SHUTTER_TRANSMITTER.LEVEL', 'state_only'],
];

/** channel types whose CONTROL hints are borrowed from another type; the type wins */
const ROLE_BY_TYPE_FIRST = {
    PRESENCEDETECTOR_TRANSCEIVER: 'presence', // carries MOTIONDETECTOR_TRANSCEIVER.* hints
};

/** channel TYPE → role for channels whose parameters carry no CONTROL hint */
const ROLE_BY_TYPE = {
    MAINTENANCE: 'maintenance',
    MOTION_DETECTOR: 'motion',
    MOTIONDETECTOR_TRANSCEIVER: 'motion',
    PRESENCEDETECTOR_TRANSCEIVER: 'presence',
    WEATHER: 'weather',
    WS_TH: 'weather',
    WEATHER_TRANSMIT: 'weather',
    SHUTTER_CONTACT: 'contact',
    TILT_SENSOR: 'contact',
    SENSOR: 'contact',
    WATERDETECTIONSENSOR: 'water',
    RAINDETECTOR: 'rain',
    SMOKE_DETECTOR: 'smoke',
    KEY: 'key',
    KEY_TRANSCEIVER: 'key',
    LUXMETER: 'light_sensor',
    POWERMETER: 'energy',
    ENERGIE_METER_TRANSMITTER: 'energy',
    SWITCH: 'switch',
    DIMMER: 'dimmer',
    BLIND: 'blind',
    KEYMATIC: 'lock',
};

/**
 * Channel types that must never become accessories even though a rule
 * would match (infrastructure, team/virtual channels of the CCU itself).
 */
const IGNORED_TYPES = new Set([
    'VIRTUAL_KEY',
    'CENTRAL_KEY',
    'SMOKE_DETECTOR_TEAM',
    'SMOKE_DETECTOR_TEAM_V2',
    'HEATING_KEY_RECEIVER',
    'HEATING_SHUTTER_CONTACT_RECEIVER',
    'HEATING_CLIMATECONTROL_RECEIVER',
    'HEATING_CLIMATECONTROL_CL_RECEIVER',
    'HEATING_ROOM_TH_RECEIVER',
    'HEATING_ROOM_TH_TRANSCEIVER',
]);

/** datapoint names that identify a sensor role on hint-less channels */
const ROLE_BY_DATAPOINT = [
    [['MOTION_DETECTION_STATE'], 'motion'],
    [['PRESENCE_DETECTION_STATE'], 'presence'],
    [['MOTION'], 'motion'],
    [['ACTUAL_TEMPERATURE'], 'weather'],
    [['TEMPERATURE'], 'weather'],
    [['HUMIDITY'], 'humidity'],
    [['MY_HUMIDITY'], 'humidity'],
    [['LUX'], 'light_sensor'],
    [['ILLUMINATION'], 'light_sensor'],
    [['BRIGHTNESS'], 'light_sensor'],
    [['SMOKE_DETECTOR_ALARM_STATUS'], 'smoke'],
];

/** datapoints a role reads/writes, in order of preference */
const DATAPOINTS = {
    switch: {state: ['STATE']},
    valve: {state: ['STATE']},
    dimmer: {level: ['LEVEL']},
    light_color: {level: ['LEVEL'], hue: ['HUE'], saturation: ['SATURATION'], colorTemperature: ['COLOR_TEMPERATURE']},
    blind_hmip: {level: ['LEVEL'], tilt: ['LEVEL_2'], activity: ['ACTIVITY_STATE']},
    shutter_hmip: {level: ['LEVEL'], activity: ['ACTIVITY_STATE']},
    blind: {level: ['LEVEL'], direction: ['DIRECTION'], working: ['WORKING']},
    jalousie: {level: ['LEVEL'], tilt: ['LEVEL_SLATS'], direction: ['DIRECTION'], working: ['WORKING']},
    window: {level: ['LEVEL'], direction: ['DIRECTION'], working: ['WORKING']},
    contact: {state: ['STATE']},
    rotary_handle: {state: ['STATE']},
    motion: {state: ['MOTION_DETECTION_STATE', 'MOTION'], illumination: ['ILLUMINATION', 'BRIGHTNESS']},
    presence: {state: ['PRESENCE_DETECTION_STATE'], illumination: ['ILLUMINATION']},
    smoke: {state: ['SMOKE_DETECTOR_ALARM_STATUS', 'STATE']},
    water: {state: ['ALARMSTATE', 'STATE']},
    rain: {state: ['RAINING', 'STATE']},
    co2: {level: ['CONCENTRATION']},
    weather: {
        temperature: ['ACTUAL_TEMPERATURE', 'TEMPERATURE'],
        humidity: ['HUMIDITY', 'MY_HUMIDITY'],
        illumination: ['ILLUMINATION', 'LUX', 'BRIGHTNESS', 'CURRENT_ILLUMINATION'],
    },
    humidity: {humidity: ['HUMIDITY', 'MY_HUMIDITY']},
    light_sensor: {illumination: ['CURRENT_ILLUMINATION', 'LUX', 'ILLUMINATION', 'BRIGHTNESS']},
    energy: {power: ['POWER']},
    key: {short: ['PRESS_SHORT'], long: ['PRESS_LONG']},
    lock_hmip: {state: ['LOCK_STATE'], target: ['LOCK_TARGET_LEVEL']},
    lock_state: {state: ['LOCK_STATE']},
    lock: {state: ['STATE'], open: ['OPEN'], uncertain: ['STATE_UNCERTAIN'], error: ['ERROR']},
    garage: {state: ['DOOR_STATE'], command: ['DOOR_COMMAND']},
    thermostat_hmip: {
        temperature: ['ACTUAL_TEMPERATURE'],
        setpoint: ['SET_POINT_TEMPERATURE'],
        mode: ['SET_POINT_MODE'],
        boost: ['BOOST_MODE'],
        humidity: ['HUMIDITY'],
        level: ['LEVEL'],
    },
    thermostat_hm: {
        temperature: ['ACTUAL_TEMPERATURE', 'TEMPERATURE'],
        setpoint: ['SET_POINT_TEMPERATURE', 'SETPOINT'],
        mode: ['CONTROL_MODE'],
        boost: ['BOOST_MODE'],
        humidity: ['ACTUAL_HUMIDITY', 'HUMIDITY'],
        level: ['VALVE_STATE'],
    },
};

/** roles that control something (get their own accessory when a device has several) */
const ACTUATOR_ROLES = new Set([
    'switch',
    'valve',
    'dimmer',
    'light_color',
    'blind_hmip',
    'shutter_hmip',
    'blind',
    'jalousie',
    'window',
    'lock_hmip',
    'lock',
    'garage',
    'thermostat_hmip',
    'thermostat_hm',
]);

/** VALUE_LIST of CHANNEL_OPERATION_MODE on HmIP multi-mode inputs, for when no description is cached */
const INPUT_MODES = ['INACTIVE', 'KEY_BEHAVIOR', 'SWITCH_BEHAVIOR', 'BINARY_BEHAVIOR'];

/**
 * @param {object} channel  channel description (TYPE, INDEX, ADDRESS)
 * @param {object} [values]  VALUES paramset description of the channel ({ID: {CONTROL, TYPE, …}})
 * @param {string} [mode]  CHANNEL_OPERATION_MODE of a multi-mode input (KEY_BEHAVIOR, SWITCH_BEHAVIOR, …)
 * @returns {string|null} role or null when the channel has nothing for HomeKit
 */
function channelRole(channel, values, mode) {
    const type = channel.TYPE;
    if (!type || IGNORED_TYPES.has(type)) {
        return null;
    }

    if (ROLE_BY_TYPE_FIRST[type]) {
        return ROLE_BY_TYPE_FIRST[type];
    }

    // HmIP multi-mode inputs (HmIPW-DRI16/DRI32/FIO6, HmIP-FCI1/FCI6/DSD-PCB, …):
    // the channel's operating mode decides what it sends (verified on an
    // HmIPW-DRI16): KEY_BEHAVIOR ("Taster", factory default) sends
    // PRESS_SHORT/PRESS_LONG, SWITCH_BEHAVIOR ("Schalter") one PRESS_SHORT per
    // flip, both never a STATE — a contact sensor mapped on such a channel
    // stays closed forever. Only BINARY_BEHAVIOR ("Binärsensor") reports
    // STATE. INACTIVE sends nothing.
    if (/_INPUT_TRANSMITTER$/.test(type) && mode) {
        if (mode === 'KEY_BEHAVIOR' || mode === 'SWITCH_BEHAVIOR') {
            return values && !values.PRESS_SHORT ? null : 'key';
        }

        if (mode === 'INACTIVE') {
            return null;
        }
    }

    if (values) {
        const controls = new Set();
        for (const p of Object.values(values)) {
            if (p && p.CONTROL && p.CONTROL !== 'NONE') {
                controls.add(p.CONTROL);
            }
        }

        // a MULTI_MODE_INPUT_TRANSMITTER is a contact *or* a button depending
        // on the user's channel mode; prefer the contact reading
        for (const [control, role] of ROLE_BY_CONTROL) {
            if (controls.has(control)) {
                return role;
            }
        }
    }

    if (ROLE_BY_TYPE[type]) {
        return ROLE_BY_TYPE[type];
    }

    if (values) {
        const ids = new Set(Object.keys(values));
        for (const [datapoints, role] of ROLE_BY_DATAPOINT) {
            if (datapoints.some((dp) => ids.has(dp))) {
                return role;
            }
        }
    }

    return null;
}

/**
 * Datapoints of a role that exist on the channel.
 * @returns {object} slot → datapoint name (only present ones)
 */
function roleDatapoints(role, values) {
    const wanted = DATAPOINTS[role] || {};
    const present = {};
    const ids = values ? new Set(Object.keys(values)) : null;
    for (const [slot, candidates] of Object.entries(wanted)) {
        const found = ids ? candidates.find((dp) => ids.has(dp)) : candidates[0];
        if (found) {
            present[slot] = found;
        }
    }

    return present;
}

/**
 * Roles of every channel of a device.
 * @param {object} device  device description with CHILDREN
 * @param {(address: string) => object} getChannel  channel description by address
 * @param {(channel: object) => object|undefined} getValues  VALUES description of a channel
 * @param {(address: string) => string|undefined} [getMode]  CHANNEL_OPERATION_MODE of a multi-mode input
 * @returns {Array<{address, index, type, role, datapoints, actuator, virtual}>}
 */
function deviceRoles(device, getChannel, getValues, getMode = () => undefined) {
    const result = [];
    let lastTransmitter = null;
    for (const address of device.CHILDREN || []) {
        const channel = getChannel(address);
        if (!channel) {
            continue;
        }

        const values = getValues(channel);
        const mode = getMode(address);
        const role = channelRole(channel, values, mode);
        const entry = {
            address,
            index: channel.INDEX,
            type: channel.TYPE,
            mode,
            role,
            datapoints: role ? roleDatapoints(role, values) : {},
            actuator: ACTUATOR_ROLES.has(role),
            virtual: false,
        };

        // HmIP: <X>_TRANSMITTER followed by three <X>_VIRTUAL_RECEIVER channels;
        // the first receiver is the control channel, the others are opt-in
        if (/_TRANSMITTER$/.test(channel.TYPE)) {
            lastTransmitter = {base: channel.TYPE.replace(/_TRANSMITTER$/, ''), receivers: 0};
        } else if (lastTransmitter && channel.TYPE === lastTransmitter.base + '_VIRTUAL_RECEIVER') {
            lastTransmitter.receivers++;
            entry.virtual = lastTransmitter.receivers > 1;
        } else {
            lastTransmitter = null;
        }

        result.push(entry);
    }

    return result;
}

module.exports = {
    INPUT_MODES,
    ROLE_BY_CONTROL,
    ROLE_BY_TYPE_FIRST,
    ROLE_BY_TYPE,
    ROLE_BY_DATAPOINT,
    IGNORED_TYPES,
    DATAPOINTS,
    ACTUATOR_ROLES,
    channelRole,
    roleDatapoints,
    deviceRoles,
};
