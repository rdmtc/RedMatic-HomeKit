const {test} = require('node:test');
const assert = require('node:assert/strict');
const catalogue = require('../homematic-devices/lib/catalogue');
const {FakeCcu} = require('./helpers/fake-ccu');

function device(type, address, channelCount) {
    const children = [];
    for (let i = 0; i <= channelCount; i++) {
        children.push(address + ':' + i);
    }

    return {TYPE: type, ADDRESS: address, CHILDREN: children};
}

test('module names normalize the CCU TYPE (case, spaces)', () => {
    assert.equal(catalogue.moduleName('HmIP-PSM'), 'hmip-psm');
    assert.equal(catalogue.moduleName('ZEL STG RM FEP 230V'), 'zel_stg_rm_fep_230v');
    assert.ok(catalogue.hasModule('ZEL STG RM FEP 230V'), 'ZEL devices were invisible in the 3.3.0 editor');
    assert.ok(!catalogue.hasModule('HmIP-DLD'));
});

test('single-channel actuator: one fixed channel row with the type dropdown', () => {
    const d = catalogue.describeDevice(device('HmIP-PSM', 'ABC', 8), {ABC: 'Steckdose', 'ABC:3': 'Kanal 3'});
    assert.equal(d.supported, true);
    assert.deepEqual(d.options, []);
    assert.equal(d.channels.length, 1);
    assert.equal(d.channels[0].address, 'ABC:3');
    assert.equal(d.channels[0].name, 'Kanal 3');
    assert.equal(d.channels[0].fixed, true);
    assert.deepEqual(d.channels[0].dropdowns.type, [
        'Outlet',
        'Switch',
        'Lightbulb',
        'Fan',
        'Valve',
        'ValveIrrigation',
    ]);
});

test('multi-channel HmIP actuator: SingleAccessory + virtual receiver rows, channelCount-relative', () => {
    // HmIP-DRSI4: channels 0..21, switch channels 6,10,14,18 each with two virtual receivers
    const d = catalogue.describeDevice(device('HmIP-DRSI4', 'DRS', 21));
    assert.deepEqual(d.options, ['SingleAccessory']);
    const real = d.channels.filter((c) => !c.virtual).map((c) => c.address);
    const virtual = d.channels.filter((c) => c.virtual).map((c) => c.address);
    assert.deepEqual(real, ['DRS:6', 'DRS:10', 'DRS:14', 'DRS:18']);
    assert.deepEqual(virtual, ['DRS:7', 'DRS:8', 'DRS:11', 'DRS:12', 'DRS:15', 'DRS:16', 'DRS:19', 'DRS:20']);
    assert.equal(d.channels.find((c) => c.address === 'DRS:6').fixed, false);
});

test('unknown type: listed as unsupported without rows', () => {
    const d = catalogue.describeDevice(device('HmIP-DLD', 'DLD', 1));
    assert.equal(d.supported, false);
    assert.deepEqual(d.channels, []);
});

test('describeDevices lists supported devices of enabled interfaces, sorted by name', () => {
    const ccu = new FakeCcu({
        devices: {
            AAA: device('HmIP-SWDO', 'AAA', 1),
            BBB: device('HmIP-DLD', 'BBB', 1),
            CCC: device('HmIP-PSM', 'CCC', 8),
            'CCC:3': {TYPE: 'SWITCH_VIRTUAL_RECEIVER', ADDRESS: 'CCC:3', PARENT: 'CCC'},
        },
        channelNames: {AAA: 'Zimmer Fenster', CCC: 'Aquarium'},
    });
    const list = catalogue.describeDevices(ccu);
    assert.deepEqual(
        list.map((d) => d.address),
        ['CCC', 'AAA'],
    );
    assert.equal(list[0].iface, 'HmIP-RF');
});
