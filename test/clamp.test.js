/* #387: hap-nodejs 2.x logs "characteristic was supplied illegal value" for
   every value outside a characteristic's minValue/maxValue (and then clamps
   it). The accessory base class clamps first, so nothing is logged; the
   generic mapping widens CurrentTemperature to the device's own range. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {Characteristic} = require('@homebridge/hap-nodejs');
const {clampToProps} = require('../homematic-devices/lib/accessory');
const {temperatureRange} = require('../homematic-devices/lib/generic');
const fixtures = require('./helpers/fixtures');
const {createHarness, tick} = require('./helpers/harness');

/** collect every characteristic warning the bridge would log */
function warnings(h) {
    const list = [];
    h.bridgeConfig.bridge.on('characteristic-warning', (warning) => list.push(warning.message));
    return list;
}

function characteristicOf(h, accessoryName, serviceType, characteristic) {
    const acc = h.bridgeConfig.bridge.bridgedAccessories.find((a) => a.displayName === accessoryName);
    assert.ok(acc, 'accessory ' + accessoryName + ' missing: ' + JSON.stringify(h.services()));
    const service = acc.getService(h.hap.Service[serviceType]);
    assert.ok(service, serviceType + ' missing: ' + JSON.stringify(h.services()));
    return service.getCharacteristic(h.hap.Characteristic[characteristic]);
}

test('clampToProps: below the minimum, above the maximum, in range', () => {
    const light = new Characteristic.CurrentAmbientLightLevel();
    assert.equal(clampToProps(light, 0), 0.0001);
    assert.equal(clampToProps(light, -3), 0.0001);
    assert.equal(clampToProps(light, 200000), 100000);
    assert.equal(clampToProps(light, 523.5), 523.5);

    const temperature = new Characteristic.CurrentTemperature();
    temperature.setProps({minValue: -50, maxValue: 120});
    assert.equal(clampToProps(temperature, 165), 120);
    assert.equal(clampToProps(temperature, -60), -50);
    assert.equal(clampToProps(temperature, 21.4), 21.4);
});

test('clampToProps: non-numeric values and characteristics without bounds are left alone', () => {
    const light = new Characteristic.CurrentAmbientLightLevel();
    for (const value of [null, undefined, 'abc', true, Number.NaN, Infinity]) {
        assert.equal(clampToProps(light, value), value, String(value));
    }

    assert.equal(clampToProps({props: {format: 'float'}}, -1e9), -1e9, 'float without min/max');
    assert.equal(clampToProps({props: {format: 'string'}}, 5), 5, 'string format');
    assert.equal(clampToProps({props: {format: 'bool'}}, 7), 7, 'bool format');
    assert.equal(clampToProps(undefined, 5), 5, 'no characteristic');
    assert.equal(clampToProps({}, 5), 5, 'no props');
});

test('clampToProps: integer format bounds and maxValue on the minStep grid, as hap-nodejs computes them', () => {
    assert.equal(clampToProps({props: {format: 'uint8'}}, -5), 0);
    assert.equal(clampToProps({props: {format: 'uint8'}}, 300), 255);
    assert.equal(clampToProps({props: {format: 'uint8', minValue: 0, maxValue: 100}}, 101), 100);
    // max 10 is not on the grid 0.5 + n·2: hap-nodejs validates against 8.5
    assert.equal(clampToProps({props: {format: 'float', minValue: 0.5, maxValue: 10, minStep: 2}}, 9.7), 8.5);
});

test('temperatureRange: default, widened by the paramset, bounded, never narrowed', () => {
    assert.deepEqual(temperatureRange(undefined), {minValue: -50, maxValue: 120});
    assert.deepEqual(temperatureRange({}), {minValue: -50, maxValue: 120});
    assert.deepEqual(temperatureRange({MIN: -40, MAX: 80}), {minValue: -50, maxValue: 120}, 'not narrowed');
    assert.deepEqual(temperatureRange({MIN: -50, MAX: 500}), {minValue: -50, maxValue: 500});
    assert.deepEqual(temperatureRange({MIN: '-100', MAX: '300.5'}), {minValue: -100, maxValue: 300.5});
    assert.deepEqual(temperatureRange({MIN: -3276.8, MAX: 3276.7}), {minValue: -270, maxValue: 1000}, 'bounded');
    assert.deepEqual(temperatureRange({MIN: 500, MAX: 500}), {minValue: -50, maxValue: 120}, 'MIN >= MAX');
    assert.deepEqual(temperatureRange({MIN: 0, MAX: 'x'}), {minValue: -50, maxValue: 120}, 'garbage');
    assert.deepEqual(temperatureRange({MIN: null, MAX: 300}), {minValue: -50, maxValue: 120}, 'MIN missing');
});

test('HmIP-SLO at 0 lx: CurrentAmbientLightLevel 0.0001, no hap-nodejs warning (#387)', async () => {
    const ccu = fixtures.ccuFor('HmIP-SLO');
    const dp = `HmIP-RF.${ccu.address}:1.CURRENT_ILLUMINATION`;
    ccu.values[dp] = {value: 0, stable: true};
    const h = createHarness(ccu);
    const logged = warnings(h);
    await h.create();
    await tick();

    const level = characteristicOf(h, 'HmIP-SLO', 'LightSensor', 'CurrentAmbientLightLevel');
    assert.equal(level.value, 0.0001, 'cached value on subscribe');
    assert.equal(await level.handleGetRequest(), 0.0001, 'get handler');

    ccu.emitValue(dp, 1200);
    assert.equal(level.value, 1200);
    ccu.emitValue(dp, 0);
    assert.equal(level.value, 0.0001, 'event');

    assert.deepEqual(logged, []);
    assert.ok(
        h.node.logged.debug.some((line) => /clamp .*CurrentAmbientLightLevel 0 -> 0.0001/.test(line[0])),
        'one debug line per clamp',
    );
    h.cleanup();
});

test('generic weather channel at 165 °C, paramset MAX 80: clamped to 120, no hap-nodejs warning (#387)', async () => {
    const ccu = fixtures.ccuFor('ASH550');
    const dp = `BidCos-RF.${ccu.address}:1.TEMPERATURE`;
    ccu.values[dp] = {value: 165, stable: true};
    const h = createHarness(ccu);
    const logged = warnings(h);
    await h.create();
    await tick();

    const temperature = characteristicOf(h, 'ASH550', 'TemperatureSensor', 'CurrentTemperature');
    assert.equal(temperature.props.maxValue, 120);
    assert.equal(temperature.value, 120);
    assert.equal(await temperature.handleGetRequest(), 120);
    ccu.emitValue(dp, -80);
    assert.equal(temperature.value, -50);
    ccu.emitValue(dp, 21.5);
    assert.equal(temperature.value, 21.5);

    assert.deepEqual(logged, []);
    h.cleanup();
});

test('generic weather channel whose paramset says MAX 500: 165 °C shown as 165 °C (#387)', async () => {
    const ccu = fixtures.ccuFor('ASH550');
    ccu.paramsets[ccu.address + ':1'].TEMPERATURE = {...ccu.paramsets[ccu.address + ':1'].TEMPERATURE, MAX: 500};
    const dp = `BidCos-RF.${ccu.address}:1.TEMPERATURE`;
    ccu.values[dp] = {value: 165, stable: true};
    const h = createHarness(ccu);
    const logged = warnings(h);
    await h.create();
    await tick();

    const temperature = characteristicOf(h, 'ASH550', 'TemperatureSensor', 'CurrentTemperature');
    assert.equal(temperature.props.minValue, -50);
    assert.equal(temperature.props.maxValue, 500);
    assert.equal(temperature.value, 165);
    assert.equal(await temperature.handleGetRequest(), 165);
    ccu.emitValue(dp, 650);
    assert.equal(temperature.value, 500, 'beyond the device range: clamped');

    assert.deepEqual(logged, []);
    h.cleanup();
});
