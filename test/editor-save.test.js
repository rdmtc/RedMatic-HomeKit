/* The device editor's oneditsave (nodes/redmatic-homekit-homematic-devices.html).
   In 4.0.0 a device or channel unchecked once could never be re-enabled: the
   checkbox only ever wrote {disabled: true} and the "keep settings of unlisted
   devices" merge carried the old flag over (#384, regression from 3.3.0). The
   editor script is run with a minimal jQuery stand-in. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'nodes', 'redmatic-homekit-homematic-devices.html'), 'utf8');
const script = html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)[1];

/** jQuery stand-in for the selectors and element calls oneditsave uses */
function fakeJQuery(elements) {
    return (arg) => {
        if (typeof arg !== 'string') {
            const el = arg;
            return {
                data: (key) => el[key],
                is: (selector) => selector === ':checked' && Boolean(el.checked),
                val: () => el.value,
                hasClass: (cls) => el.classes.includes(cls),
            };
        }

        const [positive, negative = ''] = arg.split(':not(');
        const classes = (s) => (s.match(/\.[\w-]+/g) || []).map((c) => c.slice(1));
        const need = classes(positive);
        const deny = classes(negative);
        const list = elements.filter(
            (el) => need.every((c) => el.classes.includes(c)) && !deny.some((c) => el.classes.includes(c)),
        );
        return {
            each(fn) {
                for (const el of list) {
                    fn.call(el);
                }
            },
        };
    };
}

/** run oneditsave over the given rows, starting from the stored config */
function save(previous, rows) {
    let definition;
    vm.runInNewContext(script, {
        RED: {nodes: {registerType: (_, d) => (definition = d)}},
        $: fakeJQuery(rows),
    });
    const node = {devices: previous};
    definition.oneditsave.call(node);
    // objects created inside the vm context have a foreign Object.prototype
    return JSON.parse(JSON.stringify(node.devices));
}

const device = (addr, checked) => ({classes: ['device-enabled', 'option-hide'], addr, checked});
const optInDevice = (addr, checked) => ({
    classes: ['device-enabled', 'option-hide', 'vchannel-enabled'],
    addr,
    checked,
});
const channel = (addr, checked) => ({classes: ['device-enabled', 'channel-enabled'], addr, checked});
const vchannel = (addr, checked) => ({classes: ['device-enabled', 'vchannel-enabled'], addr, checked});
const option = (addr, name, value) => ({classes: ['channel-option'], addr, option: name, value});

const disabled = (devices, addr) => Boolean(devices[addr] && devices[addr].disabled);
const enabled = (devices, addr) => Boolean(devices[addr] && devices[addr].enabled);

test('a device disabled before can be re-enabled (#384)', () => {
    const previous = {ABC0000001: {disabled: true}, 'ABC0000001:1': {disabled: true}};
    const devices = save(previous, [device('ABC0000001', true), channel('ABC0000001:1', true)]);
    assert.equal(disabled(devices, 'ABC0000001'), false, 'device');
    assert.equal(disabled(devices, 'ABC0000001:1'), false, 'channel');
});

test('unchecking a device or channel stores disabled: true', () => {
    const devices = save({}, [
        device('ABC0000001', false),
        channel('ABC0000001:1', false),
        channel('ABC0000001:2', true),
    ]);
    assert.equal(disabled(devices, 'ABC0000001'), true);
    assert.equal(disabled(devices, 'ABC0000001:1'), true);
    assert.equal(disabled(devices, 'ABC0000001:2'), false);
});

test('opt-in rows are stored as enabled: true and can be switched off again', () => {
    let devices = save({}, [
        device('ABC0000001', true),
        vchannel('ABC0000001:5', true),
        optInDevice('HmIP-RCV-50', true),
    ]);
    assert.equal(enabled(devices, 'ABC0000001:5'), true);
    assert.equal(enabled(devices, 'HmIP-RCV-50'), true);

    devices = save(devices, [
        device('ABC0000001', true),
        vchannel('ABC0000001:5', false),
        optInDevice('HmIP-RCV-50', false),
    ]);
    assert.equal(enabled(devices, 'ABC0000001:5'), false);
    assert.equal(enabled(devices, 'HmIP-RCV-50'), false);
});

test('dropdown options are saved next to the enabled state', () => {
    const previous = {'ABC0000001:3': {type: 'Switch', disabled: true}};
    const devices = save(previous, [
        device('ABC0000001', true),
        channel('ABC0000001:3', true),
        option('ABC0000001:3', 'type', 'Outlet'),
    ]);
    assert.deepEqual(devices['ABC0000001:3'], {type: 'Outlet'});
});

test('settings of devices not listed this time are kept, empty entries are dropped', () => {
    const previous = {XYZ0000001: {disabled: true}, 'XYZ0000001:1': {type: 'Outlet'}, 'XYZ0000001:2': {}};
    const devices = save(previous, [device('ABC0000001', true)]);
    assert.deepEqual(devices, {XYZ0000001: {disabled: true}, 'XYZ0000001:1': {type: 'Outlet'}});
});
