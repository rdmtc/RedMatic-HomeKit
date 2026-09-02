const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const roles = require('../homematic-devices/lib/roles');
const fixtures = require('./helpers/fixtures');

/** roles of a fixture type as "<index>:<role>" strings (virtual receivers marked with *) */
function rolesOf(type) {
    const ccu = fixtures.ccuFor(type);
    const iface = ccu.enabledIfaces[0];
    return roles
        .deviceRoles(
            ccu.device,
            (address) => ccu.metadata.devices[iface][address],
            (channel) => ccu.getParamsetDescription(iface, channel, 'VALUES'),
        )
        .filter((c) => c.role && c.role !== 'maintenance')
        .map((c) => `${c.index}:${c.role}${c.virtual ? '*' : ''}`);
}

test('roles of well-known devices', () => {
    assert.deepEqual(rolesOf('HmIP-PSM'), ['1:key', '2:state_only', '3:switch', '4:switch*', '5:switch*', '6:energy']);
    assert.deepEqual(rolesOf('HmIP-BSM'), [
        '1:key',
        '2:key',
        '3:state_only',
        '4:switch',
        '5:switch*',
        '6:switch*',
        '7:energy',
    ]);
    assert.deepEqual(rolesOf('HmIP-BROLL'), [
        '1:key',
        '2:key',
        '3:state_only',
        '4:shutter_hmip',
        '5:shutter_hmip*',
        '6:shutter_hmip*',
    ]);
    assert.deepEqual(
        rolesOf('HmIP-DRBLI4')
            .filter((r) => r.includes('blind_hmip'))
            .slice(0, 3),
        ['10:blind_hmip', '11:blind_hmip*', '12:blind_hmip*'],
    );
    assert.deepEqual(rolesOf('HmIP-SWDO'), ['1:contact']);
    assert.deepEqual(rolesOf('HmIP-SRH'), ['1:rotary_handle']);
    assert.deepEqual(rolesOf('HmIP-SMI'), ['1:motion']);
    assert.deepEqual(rolesOf('HmIP-SPI'), ['1:presence']);
    assert.deepEqual(rolesOf('HmIP-SWD'), ['1:water']);
    assert.deepEqual(rolesOf('HmIP-SWSD'), ['1:smoke']);
    assert.deepEqual(rolesOf('HmIP-STHO'), ['1:weather']);
    assert.deepEqual(rolesOf('HmIP-eTRV-2'), ['1:thermostat_hmip']);
    assert.deepEqual(rolesOf('HmIP-WTH-2'), ['1:thermostat_hmip']);
    assert.deepEqual(rolesOf('HM-CC-RT-DN'), ['4:thermostat_hm']);
    assert.deepEqual(rolesOf('HM-Sec-Key'), ['1:lock']);
    assert.deepEqual(rolesOf('HM-Sec-SC'), ['1:contact']);
    assert.deepEqual(rolesOf('HM-LC-Sw4-DR'), ['1:switch', '2:switch', '3:switch', '4:switch']);
    assert.deepEqual(rolesOf('HM-LC-Dim1T-FM'), ['1:dimmer']);
    assert.deepEqual(rolesOf('HM-LC-Dim1TPBU-FM'), ['1:dimmer', '2:dimmer', '3:dimmer']);
    assert.deepEqual(rolesOf('HM-LC-Bl1-FM'), ['1:blind']);
});

test('roles of devices requested in the tracker (no module in 3.3.0)', () => {
    assert.deepEqual(rolesOf('HmIP-DLD'), ['1:lock_hmip']);
    assert.deepEqual(rolesOf('HmIP-DLS'), ['1:lock_state']);
    assert.deepEqual(
        rolesOf('HmIP-DRDI3').filter((r) => !r.includes('state_only')),
        [
            '1:contact',
            '2:contact',
            '3:contact',
            '5:dimmer',
            '6:dimmer*',
            '7:dimmer*',
            '9:dimmer',
            '10:dimmer*',
            '11:dimmer*',
            '13:dimmer',
            '14:dimmer*',
            '15:dimmer*',
        ],
    );
    assert.deepEqual(rolesOf('HmIP-eTRV-E'), ['1:thermostat_hmip']);
    assert.deepEqual(rolesOf('HmIP-eTRV-C-2'), ['1:thermostat_hmip']);
    assert.deepEqual(rolesOf('HmIP-WTH-1'), ['1:thermostat_hmip']);
    assert.deepEqual(rolesOf('HmIPW-STHD'), ['1:thermostat_hmip']);
    assert.deepEqual(rolesOf('HmIP-SRD'), ['1:rain']);
    assert.deepEqual(rolesOf('HmIP-WRC6'), ['1:key', '2:key', '3:key', '4:key', '5:key', '6:key']);
    assert.deepEqual(rolesOf('HmIP-RGBW'), ['1:light_color', '2:light_color', '3:light_color', '4:light_color']);
    assert.deepEqual(rolesOf('HmIP-SCTH230').slice(0, 1), ['1:co2']);
    assert.deepEqual(rolesOf('HM-LC-Ja1PBU-FM'), ['1:jalousie']);
    assert.deepEqual(rolesOf('HM-Sen-RD-O'), ['1:rain', '2:switch']);
    assert.deepEqual(rolesOf('HmIP-STV'), ['1:motion']);
    assert.deepEqual(rolesOf('HmIP-FCI1'), ['1:contact']);
    assert.deepEqual(
        rolesOf('HmIP-WGC').filter((r) => !r.includes('state_only')),
        ['1:key', '3:switch', '4:switch*', '5:switch*'],
    );
});

test('homebrew sensors map through datapoint names', () => {
    assert.deepEqual(rolesOf('HB-UNI-Sensor1'), ['1:weather']);
    assert.deepEqual(rolesOf('HB-LC-Sw1PBU-FM'), ['1:switch', '2:key', '3:key']);
});

test('every fixture type: no exceptions, snapshot of the role coverage', () => {
    const snapshotFile = path.join(__dirname, 'fixtures', 'roles.snapshot.json');
    const snapshot = {};
    for (const type of fixtures.types()) {
        snapshot[type] = rolesOf(type);
    }

    const covered = Object.values(snapshot).filter((r) => r.length > 0).length;
    assert.ok(covered > 300, `only ${covered} of ${Object.keys(snapshot).length} types have a role`);

    if (process.env.UPDATE_SNAPSHOT || !fs.existsSync(snapshotFile)) {
        fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 1) + '\n');
    }

    const expected = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    assert.deepEqual(snapshot, expected, 'role mapping changed — review and run with UPDATE_SNAPSHOT=1');
});
