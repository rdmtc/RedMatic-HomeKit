/* Which Homematic device types this package knows and what the editor
   offers for each of them. Replaces the hard-coded case table that used to
   live in the editor html: the runtime is the single source of truth and
   the editor renders whatever `describeDevice()` returns.

   `options.json` is the per-type editor definition (extracted from the
   3.3.0 editor, key = module name), with entries:
     {kind: 'option',   name}                          device-level checkbox
     {kind: 'channels', first, last, step, dropdowns}  one row per channel
     {kind: 'virtual',  first, last, step, dropdowns}  HmIP channel + 2 virtual receivers
   `last` is a number or {channelCountMinus: n}.

   The config format stored in the flow is unchanged (ROADMAP task 7,
   compatibility notes): `<device>` {disabled}, `<device>:<ch>` {disabled,
   type}, virtual channels {enabled}, pseudo-options `<device>:<Name>`
   {disabled}. */

const fs = require('fs');
const path = require('path');

const devicesDir = path.join(__dirname, '..');
const options = require('../options.json');
const generic = require('./generic');

let moduleNames;

/** device TYPE as reported by the CCU → module/options key */
function moduleName(type) {
    return String(type).toLowerCase().replace(/ /g, '_');
}

/** all device types that have a module in homematic-devices/ */
function supportedTypes() {
    if (!moduleNames) {
        moduleNames = new Set(
            fs
                .readdirSync(devicesDir)
                .filter((file) => file.endsWith('.js'))
                .map((file) => file.slice(0, -3)),
        );
    }

    return moduleNames;
}

function hasModule(type) {
    return supportedTypes().has(moduleName(type));
}

function resolveLast(last, channelCount) {
    if (last && typeof last === 'object') {
        return channelCount - last.channelCountMinus;
    }

    return last;
}

/**
 * Editor description of one device.
 * @param {object} device  device description (TYPE, ADDRESS, CHILDREN)
 * @param {object} channelNames  address → name
 * @returns {{address, type, name, supported, options: string[], channels: object[]}}
 */
function describeDevice(device, channelNames = {}) {
    const type = moduleName(device.TYPE);
    const address = device.ADDRESS;
    const channelCount = (device.CHILDREN && device.CHILDREN.length) || 0;
    const result = {
        address,
        type: device.TYPE,
        name: channelNames[address] || address,
        supported: hasModule(device.TYPE),
        options: [],
        channels: [],
    };

    const channel = (index, extra) => ({
        address: address + ':' + index,
        name: channelNames[address + ':' + index] || address + ':' + index,
        ...extra,
    });

    for (const entry of options[type] || []) {
        switch (entry.kind) {
            case 'option':
                result.options.push(entry.name);
                break;
            case 'channels': {
                const last = resolveLast(entry.last, channelCount);
                for (let i = entry.first; i <= last; i += entry.step) {
                    result.channels.push(channel(i, {dropdowns: entry.dropdowns, fixed: entry.first === last}));
                }

                break;
            }

            case 'virtual': {
                const last = resolveLast(entry.last, channelCount);
                for (let i = entry.first; i <= last; i += entry.step) {
                    result.channels.push(channel(i, {dropdowns: entry.dropdowns, fixed: false}));
                    result.channels.push(channel(i + 1, {dropdowns: entry.dropdowns, virtual: true}));
                    result.channels.push(channel(i + 2, {dropdowns: entry.dropdowns, virtual: true}));
                }

                break;
            }

            default:
                throw new Error('unknown options entry kind ' + entry.kind);
        }
    }

    return result;
}

/**
 * Editor description of every supported device of a ccu-connection node.
 * @param {object} ccu  ccu-connection node (metadata.devices, channelNames, enabledIfaces)
 */
function describeDevices(ccu) {
    const devices = [];
    for (const [iface, ifaceDevices] of Object.entries((ccu.metadata && ccu.metadata.devices) || {})) {
        if (!ccu.enabledIfaces.includes(iface)) {
            continue;
        }

        for (const device of Object.values(ifaceDevices)) {
            if (device.PARENT || !device.TYPE) {
                continue;
            }

            if (hasModule(device.TYPE)) {
                devices.push({iface, ...describeDevice(device, ccu.channelNames)});
                continue;
            }

            // no per-type module: offer whatever the generic channel mapping finds
            const p = generic.plan(device, ccu, iface);
            if (!p.supported) {
                continue;
            }

            if (p.delegate && !p.delegate.startsWith('lib/')) {
                // an existing module handles this device; use its editor definition
                const described = describeDevice({...device, TYPE: p.delegate}, ccu.channelNames);
                devices.push({iface, ...described, type: device.TYPE, generic: true, delegate: p.delegate});
                continue;
            }

            const rows = generic.editorRows(p);
            devices.push({
                iface,
                address: device.ADDRESS,
                type: device.TYPE,
                name: p.name,
                supported: true,
                generic: true,
                // opt-in devices are stored as {enabled: true} and skipped otherwise
                optIn: generic.isOptIn(device),
                options: rows.options,
                channels: rows.channels,
            });
        }
    }

    return devices.sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {moduleName, supportedTypes, hasModule, describeDevice, describeDevices, isOptIn: generic.isOptIn};
