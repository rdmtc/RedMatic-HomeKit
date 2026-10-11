/* #387 (task 14): HAP's CurrentAmbientLightLevel ends at 100000 lx, while
   light sensors advertise more in their paramset (HmIP 163830, HM-Sen-LI-O
   and HB-UNI-Sen-WEA 200000). The accessory base class widens the range to
   the datapoint's paramset MAX wherever a module or the generic mapping binds
   the characteristic to a datapoint; the clamp stays the backstop. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {lightLevelRange} = require('../homematic-devices/lib/ranges');
const fixtures = require('./helpers/fixtures');
const {createHarness, tick} = require('./helpers/harness');

function warnings(h) {
    const list = [];
    h.bridgeConfig.bridge.on('characteristic-warning', (warning) => list.push(warning.message));
    return list;
}

function lightLevelOf(h, accessoryName) {
    const acc = h.bridgeConfig.bridge.bridgedAccessories.find((a) => a.displayName === accessoryName);
    assert.ok(acc, 'accessory ' + accessoryName + ' missing: ' + JSON.stringify(h.services()));
    const service = acc.getService(h.hap.Service.LightSensor);
    assert.ok(service, 'LightSensor missing: ' + JSON.stringify(h.services()));
    return service.getCharacteristic(h.hap.Characteristic.CurrentAmbientLightLevel);
}

/** create the device with the lux datapoint at `value`, return the characteristic */
async function setup(type, datapoint, value, prepare) {
    const ccu = fixtures.ccuFor(type);
    if (prepare) {
        prepare(ccu);
    }

    const iface = ccu.findIface(ccu.address);
    const dp = `${iface}.${ccu.address}:${datapoint}`;
    ccu.values[dp] = {value, stable: true};
    const h = createHarness(ccu);
    const logged = warnings(h);
    await h.create();
    await tick();
    return {ccu, h, dp, logged, level: lightLevelOf(h, type)};
}

test('lightLevelRange: HAP default, widened to the paramset MAX, bounded, never narrowed', () => {
    const def = {minValue: 0.0001, maxValue: 100000};
    assert.deepEqual(lightLevelRange(undefined), def);
    assert.deepEqual(lightLevelRange({}), def);
    assert.deepEqual(lightLevelRange({MIN: 0, MAX: 163830}), {minValue: 0.0001, maxValue: 163830});
    assert.deepEqual(lightLevelRange({MIN: 0, MAX: 200000}), {minValue: 0.0001, maxValue: 200000});
    assert.deepEqual(lightLevelRange({MIN: '0', MAX: '200000'}), {minValue: 0.0001, maxValue: 200000}, 'strings');
    assert.deepEqual(lightLevelRange({MIN: 0, MAX: 6553500}), {minValue: 0.0001, maxValue: 500000}, 'ceiling');
    assert.deepEqual(lightLevelRange({MIN: 0, MAX: 65535}), def, 'not narrowed');
    assert.deepEqual(lightLevelRange({MIN: 0, MAX: 255}), def, 'BRIGHTNESS 0…255 (lux() modules): not narrowed');
    assert.deepEqual(lightLevelRange({MIN: 200000, MAX: 200000}), def, 'MIN >= MAX');
    assert.deepEqual(lightLevelRange({MIN: 0, MAX: 'x'}), def, 'garbage');
    assert.deepEqual(lightLevelRange({MAX: 200000}), def, 'MIN missing');
});

test('HmIP-SLO (module) at 150000 lx: range 0.0001…163830, shown as 150000, no warning (#387)', async () => {
    const {ccu, h, dp, logged, level} = await setup('HmIP-SLO', '1.CURRENT_ILLUMINATION', 150000);
    assert.equal(level.props.minValue, 0.0001);
    assert.equal(level.props.maxValue, 163830);
    assert.equal(level.value, 150000, 'cached value on subscribe');
    assert.equal(await level.handleGetRequest(), 150000, 'get handler');
    ccu.emitValue(dp, 170000);
    assert.equal(level.value, 163830, 'beyond the device range: clamped');
    ccu.emitValue(dp, 0);
    assert.equal(level.value, 0.0001, 'night: clamped to the minimum');
    assert.deepEqual(logged, []);
    assert.ok(
        h.node.logged.debug.some((line) => /range .*CurrentAmbientLightLevel 0.0001…163830 from /.test(line[0])),
        'debug line for the widened range',
    );
    h.cleanup();
});

test('HM-Sen-LI-O (module, BidCos, paramset MAX 200000) at 150000 lx: shown as 150000 (#387)', async () => {
    const {ccu, h, dp, logged, level} = await setup('HM-Sen-LI-O', '1.LUX', 150000);
    assert.equal(level.props.maxValue, 200000);
    assert.equal(level.value, 150000);
    ccu.emitValue(dp, 199999.5);
    assert.equal(level.value, 199999.5);
    assert.deepEqual(logged, []);
    h.cleanup();
});

test('HmIP-SMO-2 (generic mapping) at 120000 lx: range from the paramset, shown as 120000 (#387)', async () => {
    const {h, logged, level} = await setup('HmIP-SMO-2', '1.ILLUMINATION', 120000);
    assert.equal(level.props.maxValue, 163830);
    assert.equal(level.value, 120000);
    assert.deepEqual(logged, []);
    h.cleanup();
});

test('a light sensor without a cached paramset description keeps HAP 100000 lx', async () => {
    const {ccu, h, dp, logged, level} = await setup('HmIP-SLO', '1.CURRENT_ILLUMINATION', 150000, (c) => {
        delete c.paramsets[c.address + ':1'];
    });
    assert.equal(level.props.maxValue, 100000);
    assert.equal(level.value, 100000, 'clamped as in 4.0.2');
    ccu.emitValue(dp, 500);
    assert.equal(level.value, 500);
    assert.deepEqual(logged, []);
    h.cleanup();
});
