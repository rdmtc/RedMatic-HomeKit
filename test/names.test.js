/* HomeKit name per device and channel (#388): a name set in the editor
   (`devices[address].name`) replaces the CCU name for the accessory and its
   services; empty means the CCU name; identities stay. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/fixtures');
const {createHarness} = require('./helpers/harness');
const names = require('../homematic-devices/lib/names');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** publish like the node does after the CCU connected, then {displayName: {uuid, services}} */
async function publish(h) {
    await new Promise((resolve) => h.node.publishDevices(resolve));
    clearTimeout(h.bridgeConfig.waitForAccessoriesTimer);
    await wait(5);
    const {hap} = h;
    const result = [];
    for (const acc of h.bridgeConfig.bridge.bridgedAccessories) {
        result.push({
            name: acc.displayName,
            infoName: acc.getService(hap.Service.AccessoryInformation).getCharacteristic(hap.Characteristic.Name).value,
            uuid: acc.UUID,
            services: acc.services
                .filter((s) => s.UUID !== hap.Service.AccessoryInformation.UUID)
                .map((s) => ({subtype: s.subtype, name: s.getCharacteristic(hap.Characteristic.Name).value})),
        });
    }

    return result;
}

test('override: trimmed name, empty or missing means none', () => {
    const devices = {A: {name: '  Flur  '}, B: {name: '   '}, C: {disabled: true}, D: {name: 42}};
    assert.equal(names.override(devices, 'A'), 'Flur');
    assert.equal(names.override(devices, 'B'), undefined);
    assert.equal(names.override(devices, 'C'), undefined);
    assert.equal(names.override(devices, 'D'), undefined);
    assert.equal(names.override(devices, 'toString'), undefined, 'no prototype keys');
    assert.equal(names.override(undefined, 'A'), undefined);
});

test("isValidHomeKitName follows hap-nodejs' check", () => {
    assert.equal(names.isValidHomeKitName('Wandtaster Treppenlicht 1.OG (unten)'), false);
    assert.equal(names.isValidHomeKitName('Wandtaster Treppenlicht 1.OG unten'), true);
    assert.equal(names.isValidHomeKitName('Küche (Decke) Süd'), true, 'brackets and umlauts in the middle');
    assert.equal(names.isValidHomeKitName('(Flur'), false);
    assert.equal(names.isValidHomeKitName('Bad 2.'), false);
    assert.equal(names.isValidHomeKitName('A'), false, 'hap-nodejs wants two characters');
});

test('withNameOverrides: the override wins, the CCU name stays untouched, methods run on the ccu', () => {
    const devices = {ABC: {name: 'Licht Flur'}, 'ABC:1': {name: ''}};
    const ccu = {
        channelNames: {ABC: 'Licht (Flur)', 'ABC:1': 'Kanal (1)'},
        values: {},
        who() {
            return this;
        },
        nameOf(address) {
            return this.channelNames[address];
        },
    };
    const view = names.withNameOverrides(ccu, () => devices);

    assert.equal(view.channelNames.ABC, 'Licht Flur');
    assert.equal(view.channelNames['ABC:1'], 'Kanal (1)', 'empty override = CCU name');
    assert.equal(view.channelNames['HmIP-RF.ABC'], 'Licht Flur', 'iface-prefixed lookups find the override');
    assert.equal(view.channelNames['HmIP-RF.ABC:1'], undefined, '… and stay undefined without one');
    assert.deepEqual(Object.keys(view.channelNames), ['ABC', 'ABC:1']);
    assert.equal(ccu.channelNames.ABC, 'Licht (Flur)', 'the ccu-connection keeps the CCU name');
    assert.equal(view.who(), ccu, 'methods are bound to the ccu-connection');
    assert.equal(view.nameOf('ABC'), 'Licht (Flur)', '… which never sees the overrides');
    assert.equal(view.values, ccu.values);

    devices['ABC:1'] = {name: 'Taste'};
    assert.equal(view.channelNames['ABC:1'], 'Taste', 'edits are read live');
    ccu.channelNames = {ABC: 'neu', 'ABC:2': 'zwei'};
    assert.equal(view.channelNames['ABC:2'], 'zwei', 'a re-read name table is followed');
    assert.equal(view.channelNames.ABC, 'Licht Flur');
});

test('a module device: HomeKit names for the accessory and a channel service, identity unchanged', async () => {
    const plain = createHarness(fixtures.ccuFor('HmIP-PDT'));
    const before = await publish(plain);
    plain.cleanup();

    const ccu = fixtures.ccuFor('HmIP-PDT', {channelNames: {}});
    const address = ccu.address;
    ccu.channelNames[address] = 'Wandtaster Treppenlicht 1.OG (unten)';
    const h = createHarness(ccu);
    h.node.devices = {[address]: {name: 'Treppenlicht unten'}, [address + ':3']: {name: 'Treppe Licht'}};
    const after = await publish(h);
    h.cleanup();

    assert.equal(after.length, 1);
    assert.equal(after[0].name, 'Treppenlicht unten');
    assert.equal(after[0].infoName, 'Treppenlicht unten');
    assert.equal(after[0].uuid, before[0].uuid, 'UUID from the address, not the name');
    assert.deepEqual(
        after[0].services.map((s) => s.subtype),
        before[0].services.map((s) => s.subtype),
        'same services and subtypes',
    );
    assert.ok(
        after[0].services.some((s) => s.name === 'Treppe Licht'),
        'channel service named by its override: ' + JSON.stringify(after[0].services),
    );
    assert.equal(ccu.channelNames[address], 'Wandtaster Treppenlicht 1.OG (unten)', 'CCU name untouched');
});

test('a generic device: channel overrides name the services, empty ones keep the CCU name', async () => {
    const ccu = fixtures.ccuFor('HMIP-WRC2');
    const address = ccu.address;
    const h = createHarness(ccu);
    h.node.devices = {[address + ':1']: {name: 'Oben'}, [address + ':2']: {name: ''}};
    const [acc] = await publish(h);
    h.cleanup();

    assert.equal(acc.name, ccu.channelNames[address], 'no device override: the CCU name');
    const serviceNames = acc.services.map((s) => s.name);
    assert.ok(serviceNames.includes('Oben'), JSON.stringify(serviceNames));
    assert.ok(serviceNames.includes(ccu.channelNames[address + ':2']), JSON.stringify(serviceNames));
});

test('no hap-nodejs name warning once the override is valid', async () => {
    const ccu = fixtures.ccuFor('HmIP-PDT');
    const address = ccu.address;
    ccu.channelNames[address] = 'Wandtaster Treppenlicht 1.OG (unten)';
    const warnings = [];
    const warn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
        const h = createHarness(ccu);
        await publish(h);
        h.cleanup();
        const h2 = createHarness(ccu);
        h2.node.devices = {[address]: {name: 'Wandtaster Treppenlicht 1.OG unten'}};
        const count = warnings.length;
        await publish(h2);
        h2.cleanup();
        assert.ok(
            warnings.slice(0, count).some((w) => w.includes("invalid 'Name'") && w.includes('(unten)')),
            'the CCU name warns',
        );
        assert.deepEqual(
            warnings.slice(count).filter((w) => w.includes("invalid 'Name'")),
            [],
            'the override does not',
        );
    } finally {
        console.warn = warn;
    }
});
