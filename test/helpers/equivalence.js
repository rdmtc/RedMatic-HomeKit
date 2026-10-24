/* Equivalence harness: builds one device twice — through its per-type module
   in homematic-devices/ and through the generic channel mapping
   (lib/generic.js) — and records everything a HomeKit controller and the CCU
   would see of it (a "fingerprint"), so the two can be compared (ROADMAP
   task 18: which modules the generic mapping can replace with no change for
   users). D-4 makes the comparison strict: a different accessory UUID, a
   different service subtype (hap-nodejs keys its persisted IIDs by
   accessory UUID + service UUID + subtype) or a different characteristic
   set would change what a paired home sees after an update.

   A fingerprint of one build holds:
   - structure: the accessories (UUID, name, AccessoryInformation), their
     services (type, subtype, name) and characteristics (type, props, whether
     a get/set handler is bound);
   - subscriptions: the datapoints the build listens to, with their filters;
   - init: the calls made to the CCU while building (reportValueUsage, …);
   - gets: what every get handler answers before any value arrived;
   - values: for every subscribed datapoint and a set of test values derived
     from its paramset description, the characteristic values after the
     value arrived and the CCU calls it caused;
   - writes: for every characteristic with a set handler and a set of HomeKit
     test values, the CCU calls (setValueQueued, putParamset, …) and
     characteristic updates a HomeKit write produced — once with every
     datapoint at its lowest test value and once at its highest;
   - editor: the options and channel rows the editor offers for the device.

   Timers are mocked (node:test mock.timers, setTimeout only): the modules
   defer some writes and updates by 20…1000 ms, which the harness advances
   instantly. A run of `compareType()` covers every option combination a
   stored config may hold for the module (each device option disabled, each
   channel row disabled or enabled, each dropdown value), one at a time. */

const {mock} = require('node:test');
const catalogue = require('../../homematic-devices/lib/catalogue');
const generic = require('../../homematic-devices/lib/generic');
const fixtures = require('./fixtures');
const {createHarness, tick} = require('./harness');

/** characteristic props that reach the controller (hap-nodejs CharacteristicProps) */
const PROPS = [
    'format',
    'perms',
    'unit',
    'minValue',
    'maxValue',
    'minStep',
    'validValues',
    'validValueRanges',
    'maxLen',
];

/** HomeKit test values per writable characteristic; the fallback derives them from the props */
const SET_VALUES = {
    On: [true, false],
    Active: [1, 0],
    Brightness: [0, 40, 100],
    Hue: [0, 180, 360],
    Saturation: [0, 50, 100],
    ColorTemperature: [140, 250, 500],
    RotationSpeed: [0, 50, 100],
    TargetPosition: [0, 50, 100],
    TargetVerticalTiltAngle: [-90, 0, 90],
    TargetHorizontalTiltAngle: [-90, 0, 90],
    TargetDoorState: [0, 1],
    LockTargetState: [0, 1],
    TargetTemperature: [4.5, 18, 21.5, 30.5],
    TargetHeatingCoolingState: [0, 1, 3, 2],
    TargetHeaterCoolerState: [0, 1, 2],
    HoldPosition: [true],
    Mute: [true, false],
    Volume: [0, 50, 100],
};

/** how far the mocked clock is advanced after every step (the modules' longest deferral is 1000 ms) */
const SETTLE_MS = 1500;

/** diff classes, in the order the first difference is reported */
const CLASSES = [
    'error',
    'identity',
    'services',
    'subtype',
    'service-name',
    'characteristics',
    'props',
    'subscriptions',
    'init',
    'values',
    'writes',
    'editor',
    'editor-fixed',
    'editor-added',
];

/**
 * Differences that a compatibility layer in the generic mapping could absorb
 * without touching behaviour: the service subtype scheme (modules count
 * services, the generic mapping uses the channel index), the service name
 * (device name vs channel name) and the editor's locked single-channel row.
 * `residual` in a comparison result is the classes left after these.
 */
const SCHEME_CLASSES = new Set(['subtype', 'service-name', 'editor-fixed', 'editor-added']);

/** differences that only add to the editor (a row, an option, an unlocked checkbox): nothing a paired home sees */
const EDITOR_ADDITIONS = new Set(['editor-fixed', 'editor-added']);

function num(value, fallback) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Test values for a datapoint from its VALUES paramset description: both
 * ends of the range and the middle, every enum index, both booleans. A
 * datapoint the fixture does not describe (a module reading a datapoint the
 * device does not have) gets a generic set.
 */
function testValues(description) {
    if (!description) {
        return [false, true, 0, 1];
    }

    switch (description.TYPE) {
        case 'BOOL':
        case 'ALARM':
            return [false, true, false];
        case 'ACTION':
            return [true];
        case 'ENUM':
            return (description.VALUE_LIST || []).map((_, index) => index);
        case 'FLOAT': {
            const min = num(description.MIN, 0);
            const max = num(description.MAX, 1);
            return [min, Math.round(((min + max) / 2) * 100) / 100, max];
        }

        case 'INTEGER': {
            const min = num(description.MIN, 0);
            const max = num(description.MAX, 100);
            return [min, Math.round((min + max) / 2), max];
        }

        case 'STRING':
            return ['', 'x'];
        default:
            return [0, 1];
    }
}

function pickProps(props) {
    const result = {};
    for (const key of PROPS) {
        if (props && props[key] !== undefined) {
            result[key] = Array.isArray(props[key]) ? [...props[key]] : props[key];
        }
    }

    if (Array.isArray(result.perms)) {
        result.perms.sort();
    }

    return result;
}

/** the HomeKit values a set handler is exercised with */
function setValues(characteristic) {
    const name = characteristic.constructor.name;
    if (SET_VALUES[name]) {
        return SET_VALUES[name];
    }

    const {format, validValues, minValue, maxValue} = characteristic.props || {};
    if (format === 'bool') {
        return [true, false];
    }

    if (Array.isArray(validValues) && validValues.length > 0) {
        return [...validValues];
    }

    if (format === 'string') {
        return ['x'];
    }

    const min = num(minValue, 0);
    const max = num(maxValue, 100);
    return [min, Math.round((min + max) / 2), max];
}

/**
 * The accessories as a paired controller sees them (minus the IIDs, which
 * follow from UUID + subtype).
 */
function structure(h) {
    const {hap} = h;
    const infoUUID = hap.Service.AccessoryInformation.UUID;
    return h.bridgeConfig.bridge.bridgedAccessories.map((acc) => {
        const info = acc.getService(hap.Service.AccessoryInformation);
        const infoValue = (name) => info.getCharacteristic(hap.Characteristic[name]).value;
        return {
            uuid: acc.UUID,
            name: acc.displayName,
            manufacturer: infoValue('Manufacturer'),
            model: infoValue('Model'),
            serial: infoValue('SerialNumber'),
            firmware: infoValue('FirmwareRevision'),
            // sorted by type: the order services were added in is not part of
            // what a controller keeps (IIDs are cached by UUID + subtype)
            services: sortedServices(acc, infoUUID).map((s) => ({
                type: s.constructor.name,
                uuid: s.UUID,
                subtype: s.subtype,
                name: s.displayName,
                characteristics: Object.fromEntries(
                    s.characteristics
                        .map((c) => [
                            c.constructor.name,
                            {
                                props: pickProps(c.props),
                                get: c.listeners('get').length,
                                set: c.listeners('set').length,
                            },
                        ])
                        .sort((x, y) => x[0].localeCompare(y[0])),
                ),
            })),
        };
    });
}

function sortedServices(acc, infoUUID) {
    return acc.services
        .filter((s) => s.UUID !== infoUUID)
        .sort(
            (x, y) =>
                x.constructor.name.localeCompare(y.constructor.name) ||
                String(x.displayName).localeCompare(String(y.displayName)) ||
                String(x.subtype).localeCompare(String(y.subtype)),
        );
}

/**
 * Every characteristic with a key that compares across the two subtype
 * schemes: accessory index, service type (numbered when an accessory has
 * several of the type), characteristic name — `a0.Switch#1.On`.
 */
function characteristics(h) {
    const infoUUID = h.hap.Service.AccessoryInformation.UUID;
    const result = [];
    h.bridgeConfig.bridge.bridgedAccessories.forEach((acc, a) => {
        const seen = {};
        for (const s of sortedServices(acc, infoUUID)) {
            const type = s.constructor.name;
            seen[type] = (seen[type] || 0) + 1;
            for (const c of s.characteristics) {
                result.push({
                    key: 'a' + a + '.' + type + '#' + seen[type] + '.' + c.constructor.name,
                    characteristic: c,
                });
            }
        }
    });
    return result;
}

/** current value of every characteristic, keyed so that it compares across subtype schemes */
function values(h) {
    const result = {};
    for (const {key, characteristic} of characteristics(h)) {
        result[key] = characteristic.value;
    }

    return result;
}

function changed(before, after) {
    const result = {};
    for (const key of Object.keys(after)) {
        if (!Object.is(before[key], after[key])) {
            result[key] = after[key];
        }
    }

    return result;
}

function errorCode(error) {
    if (typeof error === 'number') {
        return 'hap:' + error;
    }

    if (error && typeof error.hapStatus === 'number') {
        return 'hap:' + error.hapStatus;
    }

    return String((error && error.message) || error);
}

async function settle(timersMocked) {
    for (let i = 0; i < 3; i++) {
        if (timersMocked) {
            mock.timers.tick(SETTLE_MS);
        }

        await tick();
    }
}

/**
 * Run a HAP get/set request and let it settle: the handlers of several
 * modules answer from a setTimeout (a dimmer's On waits 100 ms for the
 * Brightness that usually follows, a thermostat's mode write 150 ms for the
 * temperature), so the mocked clock is advanced while the request is
 * pending. Resolves to the value, {error} for a HAP status or exception, or
 * {error: 'unanswered'} when the handler never called back.
 */
async function request(start, timersMocked) {
    let settled = false;
    const pending = start().then(
        (value) => {
            settled = true;
            return value === undefined ? null : value;
        },
        (error) => {
            settled = true;
            return {error: errorCode(error)};
        },
    );
    await settle(timersMocked);
    if (!settled) {
        // one more round for a callback that needs the full clock
        if (timersMocked) {
            mock.timers.tick(SETTLE_MS * 4);
        }

        await tick();
        await tick();
    }

    return settled ? pending : {error: 'unanswered'};
}

/** the calls a build made to the CCU since `from`, in a comparable form */
function calls(ccu, from) {
    return ccu.setCalls.slice(from).map((c) => {
        if (c.method) {
            return {method: c.method, params: c.params};
        }

        return {channel: c.channel, datapoint: c.datapoint, value: c.value, burst: c.burst, force: c.force};
    });
}

function createDevice(h, ccu, options, path) {
    const iface = ccu.enabledIfaces[0];
    const address = ccu.address;
    const dev = {
        name: ccu.channelNames[address],
        iface,
        deviceAddress: iface + '.' + address,
        description: ccu.metadata.devices[iface][address],
        options,
    };
    if (path === 'module') {
        if (!catalogue.hasModule(dev.description.TYPE)) {
            throw new Error('no module for ' + dev.description.TYPE);
        }

        return h.node.createHomematicDevice(dev);
    }

    return new generic.GenericDevice(dev, h.node);
}

/**
 * What the editor offers for the device on the given path: the module's
 * options.json entry, or the generic rows (or the delegate module's entry).
 */
function editor(ccu, path) {
    const iface = ccu.enabledIfaces[0];
    const device = ccu.device;
    // options as a set and rows by address, so that an option or row only one
    // side offers shows up as such ('editor-added' when it is the generic side)
    const strip = (d) => ({
        supported: d.supported,
        options: Object.fromEntries(d.options.map((name) => [name, true])),
        rows: Object.fromEntries(
            d.channels.map((c) => [
                c.address,
                {dropdowns: c.dropdowns || null, virtual: Boolean(c.virtual), fixed: Boolean(c.fixed)},
            ]),
        ),
    });
    if (path === 'module') {
        return strip(catalogue.describeDevice(device, ccu.channelNames));
    }

    const p = generic.plan(device, ccu, iface);
    if (!p.supported) {
        return {supported: false, options: {}, rows: {}};
    }

    if (p.delegate && !p.delegate.startsWith('lib/')) {
        return strip(catalogue.describeDevice({...device, TYPE: p.delegate}, ccu.channelNames));
    }

    const rows = generic.editorRows(p);
    return strip({supported: true, options: rows.options, channels: rows.channels});
}

/**
 * Build the device on one path with the given options and record its
 * fingerprint. `timersMocked` says whether mock.timers is enabled (the
 * caller enables it once per run).
 */
async function fingerprint(type, options, path, {timersMocked = true, channelNames, values: initialValues} = {}) {
    const ccu = fixtures.ccuFor(type, {channelNames, values: initialValues});
    const h = createHarness(ccu);
    const result = {
        error: null,
        structure: null,
        subscriptions: null,
        init: null,
        gets: null,
        values: null,
        writes: null,
    };
    try {
        try {
            createDevice(h, ccu, options, path);
        } catch (error) {
            result.error = errorCode(error);
            return result;
        }

        // the bridge would publish itself (HAP server, mDNS) a moment after the
        // first accessory; the harness never publishes
        clearTimeout(h.bridgeConfig.waitForAccessoriesTimer);
        await tick();
        await tick();
        clearTimeout(h.bridgeConfig.waitForAccessoriesTimer);
        await settle(timersMocked);
        if (h.node.logged.error.length > 0) {
            result.error = h.node.logged.error.map((e) => String(e[0]).split('\n')[0]).join('; ');
        }

        result.structure = structure(h);
        result.subscriptions = ccu.subscriptions
            .map((s) => ({
                datapointName: s.filter.datapointName,
                cache: Boolean(s.filter.cache),
                change: Boolean(s.filter.change),
                stable: s.filter.stable === undefined ? null : Boolean(s.filter.stable),
            }))
            .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        result.init = calls(ccu, 0);
        let mark = ccu.setCalls.length;

        // what every get handler answers before any value arrived
        result.gets = {};
        for (const {key, characteristic} of characteristics(h)) {
            if (characteristic.listeners('get').length === 0) {
                continue;
            }

            result.gets[key] = await request(() => characteristic.handleGetRequest(), timersMocked);
        }

        // every subscribed datapoint, every test value
        const datapoints = [...new Set(ccu.subscriptions.map((s) => s.filter.datapointName))].sort();
        const describe = (datapointName) => {
            const [, channel, dp] = datapointName.split('.');
            return ccu.paramsets[channel] && ccu.paramsets[channel][dp];
        };

        result.values = [];
        let before = values(h);
        for (const datapointName of datapoints) {
            for (const value of testValues(describe(datapointName))) {
                mark = ccu.setCalls.length;
                ccu.emitValue(datapointName, value);
                await settle(timersMocked);
                const after = values(h);
                const step = {datapoint: datapointName, value, changed: changed(before, after)};
                const made = calls(ccu, mark);
                if (made.length > 0) {
                    step.calls = made;
                }

                result.values.push(step);
                before = after;
            }
        }

        // the get handlers once more, with every datapoint at its last test value
        result.getsAfter = {};
        for (const {key, characteristic} of characteristics(h)) {
            if (characteristic.listeners('get').length === 0) {
                continue;
            }

            result.getsAfter[key] = await request(() => characteristic.handleGetRequest(), timersMocked);
        }

        // HomeKit writes, with the device in its lowest and in its highest state
        result.writes = [];
        for (const state of ['low', 'high']) {
            for (const datapointName of datapoints) {
                const list = testValues(describe(datapointName));
                ccu.emitValue(datapointName, state === 'low' ? list[0] : list[list.length - 1]);
            }

            await settle(timersMocked);
            for (const {key, characteristic} of characteristics(h)) {
                if (characteristic.listeners('set').length === 0) {
                    continue;
                }

                for (const value of setValues(characteristic)) {
                    mark = ccu.setCalls.length;
                    before = values(h);
                    const step = {state, characteristic: key, value};
                    const answer = await request(() => characteristic.handleSetRequest(value), timersMocked);
                    if (answer && answer.error) {
                        step.error = answer.error;
                    }

                    step.calls = calls(ccu, mark);
                    step.changed = changed(before, values(h));
                    result.writes.push(step);
                }
            }
        }
    } finally {
        h.cleanup();
    }

    return result;
}

/**
 * Deep difference of two JSON-like values as a list of {path, a, b}, at most
 * `limit` entries.
 */
function diff(a, b, path = '', out = [], limit = 50) {
    if (out.length >= limit) {
        return out;
    }

    if (Object.is(a, b)) {
        return out;
    }

    const isObject = (v) => v !== null && typeof v === 'object';
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            out.push({path: path + '.length', a: a.length, b: b.length});
        }

        for (let i = 0; i < Math.min(a.length, b.length) && out.length < limit; i++) {
            diff(a[i], b[i], path + '[' + i + ']', out, limit);
        }

        return out;
    }

    if (isObject(a) && isObject(b) && !Array.isArray(a) && !Array.isArray(b)) {
        const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
        for (const key of keys) {
            if (out.length >= limit) {
                break;
            }

            if (!(key in a) || !(key in b)) {
                out.push({path: path + '.' + key, a: a[key], b: b[key]});
            } else {
                diff(a[key], b[key], path + '.' + key, out, limit);
            }
        }

        return out;
    }

    out.push({path, a, b});
    return out;
}

/** diff class of a fingerprint difference ({path, a, b}; a = module, b = generic) */
function classOf(entry) {
    const {path} = entry;
    if (path.startsWith('.error')) {
        return 'error';
    }

    if (path.startsWith('.structure')) {
        if (/\.characteristics\.\w+\.props/.test(path)) {
            return 'props';
        }

        if (/\.characteristics/.test(path)) {
            return 'characteristics';
        }

        if (/\.services\[\d+\]\.subtype$/.test(path)) {
            return 'subtype';
        }

        if (/\.services\[\d+\]\.name$/.test(path)) {
            return 'service-name';
        }

        if (/\.services/.test(path)) {
            return 'services';
        }

        return 'identity';
    }

    if (path.startsWith('.subscriptions')) {
        return 'subscriptions';
    }

    if (path.startsWith('.init')) {
        return 'init';
    }

    if (path.startsWith('.gets') || path.startsWith('.values')) {
        return 'values';
    }

    if (path.startsWith('.writes')) {
        return 'writes';
    }

    if (path.startsWith('.editor')) {
        if (/\.fixed$/.test(path)) {
            return 'editor-fixed';
        }

        // an option or a row only the generic side offers (opt-in button rows,
        // Battery, SingleAccessory): stored configs keep their meaning
        if (/^\.editor\.(options|rows)\.[^.]+$/.test(path) && entry.a === undefined) {
            return 'editor-added';
        }

        return 'editor';
    }

    return 'other';
}

/** the option combinations a stored config may hold for a module's device, from its editor rows */
function scenarios(ccu) {
    const described = catalogue.describeDevice(ccu.device, ccu.channelNames);
    const address = ccu.address;
    const list = [{name: 'default', options: {}}];
    for (const option of described.options) {
        list.push({name: option + ' off', options: {[address + ':' + option]: {disabled: true}}});
    }

    for (const row of described.channels) {
        if (row.virtual) {
            list.push({name: row.address + ' enabled', options: {[row.address]: {enabled: true}}});
        } else if (!row.fixed) {
            list.push({name: row.address + ' disabled', options: {[row.address]: {disabled: true}}});
        }

        for (const [option, choices] of Object.entries(row.dropdowns || {})) {
            for (const choice of choices) {
                const options = {[row.address]: {[option]: choice}};
                if (row.virtual) {
                    options[row.address].enabled = true;
                }

                list.push({name: row.address + ' ' + option + '=' + choice, options});
            }
        }
    }

    return list;
}

function short(value) {
    const text = JSON.stringify(value);
    return text && text.length > 160 ? text.slice(0, 157) + '…' : text;
}

/**
 * Compare the module and the generic mapping for one device type over every
 * scenario. Returns {type, module, target, verdict, delegate, classes,
 * residual, scenarios, first, firstResidual, diffs}; the verdict is
 * 'replaceable' (identical), 'replaceable, editor additions' (identical at
 * runtime, the editor offers more), 'not replaceable' or 'not proven'.
 */
async function compareType(type, {timersMocked = true, allDiffs = false} = {}) {
    const module = catalogue.moduleName(type);
    const result = {
        type,
        module,
        target: aliasTarget(module),
        verdict: null,
        delegate: null,
        classes: [],
        scenarios: 0,
    };
    let ccu;
    try {
        ccu = fixtures.ccuFor(type);
    } catch (_error) {
        result.verdict = 'not proven';
        result.reason = 'no fixture';
        return result;
    }

    const plan = generic.plan(ccu.device, ccu, ccu.enabledIfaces[0]);
    result.delegate = plan.delegate || null;
    if (!plan.supported) {
        result.verdict = 'not replaceable';
        result.reason = 'generic mapping finds nothing to publish';
        result.classes = ['unsupported'];
        return result;
    }

    const classes = new Set();
    const diffs = [];
    for (const scenario of scenarios(ccu)) {
        result.scenarios++;
        const a = await fingerprint(type, scenario.options, 'module', {timersMocked});
        const b = await fingerprint(type, scenario.options, 'generic', {timersMocked});
        a.editor = editor(ccu, 'module');
        b.editor = editor(ccu, 'generic');
        const found = diff(a, b);
        for (const d of found) {
            classes.add(classOf(d));
        }

        if (found.length > 0) {
            found.sort((x, y) => CLASSES.indexOf(classOf(x)) - CLASSES.indexOf(classOf(y)));
            const describe = (d) => ({
                scenario: scenario.name,
                class: classOf(d),
                path: d.path,
                module: short(d.a),
                generic: short(d.b),
            });
            if (!result.first) {
                result.first = describe(found[0]);
            }

            const residual = found.find((d) => !SCHEME_CLASSES.has(classOf(d)));
            if (residual && !result.firstResidual) {
                result.firstResidual = describe(residual);
            }

            if (allDiffs) {
                diffs.push({scenario: scenario.name, diffs: found});
            }
        }
    }

    result.classes = CLASSES.filter((c) => classes.has(c)).concat([...classes].filter((c) => !CLASSES.includes(c)));
    result.residual = result.classes.filter((c) => !SCHEME_CLASSES.has(c));
    if (classes.size === 0) {
        result.verdict = 'replaceable';
    } else if (result.classes.every((c) => EDITOR_ADDITIONS.has(c))) {
        // identical at runtime and for every stored config; the editor offers more
        result.verdict = 'replaceable, editor additions';
    } else {
        result.verdict = 'not replaceable';
    }

    if (allDiffs) {
        result.diffs = diffs;
    }

    return result;
}

/** the module a one-line alias re-exports (`module.exports = require('./x')`), or the module itself */
function aliasTarget(module) {
    const fs = require('node:fs');
    const path = require('node:path');
    const file = path.join(__dirname, '..', '..', 'homematic-devices', module + '.js');
    if (!fs.existsSync(file)) {
        return null;
    }

    const match = /^module\.exports = require\('\.\/([^']+)'\);\s*$/.exec(fs.readFileSync(file, 'utf8'));
    return match ? match[1] : module;
}

/** every fixture type that has a module (the comparison's universe), and the modules without a fixture */
function universe() {
    const withFixture = fixtures.types().filter((type) => catalogue.hasModule(type));
    const covered = new Set(withFixture.map((type) => catalogue.moduleName(type)));
    const without = [...catalogue.supportedTypes()].filter((module) => !covered.has(module)).sort();
    return {withFixture, without};
}

module.exports = {
    fingerprint,
    compareType,
    scenarios,
    editor,
    diff,
    classOf,
    testValues,
    setValues,
    aliasTarget,
    universe,
    CLASSES,
    SCHEME_CLASSES,
    SETTLE_MS,
};
