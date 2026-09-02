const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/fixtures');
const {createHarness, tick} = require('./helpers/harness');
const thermostat = require('../homematic-devices/lib/thermostat');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setChar(h, s, characteristic, value) {
    return new Promise((resolve, reject) => {
        s.getCharacteristic(h.hap.Characteristic[characteristic]).emit('set', value, (e) =>
            e ? reject(e) : resolve(),
        );
    });
}

test('targetState: the off temperature is OFF in every mode (#335)', () => {
    assert.equal(thermostat.targetState(true, 21), 1);
    assert.equal(thermostat.targetState(false, 21), 3);
    assert.equal(thermostat.targetState(true, 4.5), 0);
    assert.equal(thermostat.targetState(false, 4.5), 0);
    assert.equal(thermostat.targetState(false, undefined), 3);
});

test('HmIP-WTH-2: mode HEAT + temperature in one request keeps the temperature (#245, #225)', async () => {
    const ccu = fixtures.ccuFor('HmIP-WTH-2');
    const dp = (name) => `HmIP-RF.${ccu.address}:1.${name}`;
    ccu.values[dp('SET_POINT_TEMPERATURE')] = {value: 4.5, stable: true};
    ccu.values[dp('SET_POINT_MODE')] = {value: 1, stable: true}; // manual, off
    ccu.values[dp('ACTUAL_TEMPERATURE')] = {value: 20.5, stable: true};
    const h = createHarness(ccu);
    await h.create();
    await tick();
    const acc = h.bridgeConfig.bridge.bridgedAccessories[0];
    const s = acc.getService(h.hap.Service.Thermostat);
    assert.equal(s.getCharacteristic(h.hap.Characteristic.TargetHeatingCoolingState).value, 0, 'off at 4.5 °C');

    // the Home app sends both characteristics of one dial change
    const modeDone = setChar(h, s, 'TargetHeatingCoolingState', 1);
    await setChar(h, s, 'TargetTemperature', 23);
    await modeDone;

    const writes = ccu.setCalls.map((c) =>
        c.method ? c.method + ' ' + JSON.stringify(c.params[2]) : c.datapoint + '=' + c.value,
    );
    assert.deepEqual(
        writes,
        ['SET_POINT_TEMPERATURE=23'],
        'no putParamset with a stale setpoint: ' + JSON.stringify(writes),
    );
    h.cleanup();
});

test('HmIP-WTH-2: HEAT alone restores the last setpoint instead of 21 °C', async () => {
    const ccu = fixtures.ccuFor('HmIP-WTH-2');
    const dp = (name) => `HmIP-RF.${ccu.address}:1.${name}`;
    ccu.values[dp('SET_POINT_TEMPERATURE')] = {value: 22.5, stable: true};
    ccu.values[dp('SET_POINT_MODE')] = {value: 0, stable: true}; // auto
    const h = createHarness(ccu);
    await h.create();
    await tick();
    const s = h.bridgeConfig.bridge.bridgedAccessories[0].getService(h.hap.Service.Thermostat);
    assert.equal(s.getCharacteristic(h.hap.Characteristic.TargetHeatingCoolingState).value, 3, 'auto');

    await setChar(h, s, 'TargetHeatingCoolingState', 0);
    assert.deepEqual(ccu.setCalls.at(-1).params[2], {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: 4.5});
    ccu.emitValue(dp('SET_POINT_TEMPERATURE'), 4.5);
    ccu.emitValue(dp('SET_POINT_MODE'), 1);

    await setChar(h, s, 'TargetHeatingCoolingState', 1);
    assert.deepEqual(
        ccu.setCalls.at(-1).params[2],
        {CONTROL_MODE: 1, SET_POINT_TEMPERATURE: 22.5},
        'last known setpoint, not 21',
    );
    assert.equal(s.getCharacteristic(h.hap.Characteristic.TargetTemperature).value, 22.5);

    await setChar(h, s, 'TargetHeatingCoolingState', 3);
    assert.equal(ccu.setCalls.at(-1).datapoint, 'CONTROL_MODE');
    assert.equal(ccu.setCalls.at(-1).value, 0);
    h.cleanup();
});

test('HM-CC-RT-DN: MANU_MODE carries the temperature HomeKit just wrote', async () => {
    const ccu = fixtures.ccuFor('HM-CC-RT-DN');
    const dp = (name) => `BidCos-RF.${ccu.address}:4.${name}`;
    ccu.values[dp('SET_TEMPERATURE')] = {value: 19, stable: true};
    ccu.values[dp('CONTROL_MODE')] = {value: 0, stable: true};
    const h = createHarness(ccu);
    await h.create();
    await tick();
    const s = h.bridgeConfig.bridge.bridgedAccessories[0].getService(h.hap.Service.Thermostat);

    const modeDone = setChar(h, s, 'TargetHeatingCoolingState', 1);
    await setChar(h, s, 'TargetTemperature', 24);
    await modeDone;
    await wait(thermostat.MODE_WRITE_DELAY + 20);
    const manu = ccu.setCalls.filter((c) => c.datapoint === 'MANU_MODE');
    assert.deepEqual(
        manu.map((c) => c.value),
        [24],
        JSON.stringify(ccu.setCalls),
    );
    h.cleanup();
});
