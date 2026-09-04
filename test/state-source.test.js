/* HmIP actuators report their real output on the <X>_TRANSMITTER channel;
   the <X>_VIRTUAL_RECEIVER channels are control inputs that only reflect
   their own last command. Accessories must read state from the transmitter
   and write to the receiver — found on hardware with an HmIP-PDT that a
   CCU program had dimmed through the second receiver (ROADMAP task 9,
   "status not updated after local/direct-link switching"). */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/fixtures');
const {createHarness, tick} = require('./helpers/harness');
const {stateDatapoint} = require('../homematic-devices/lib/state-source');

const subscribed = (ccu, datapointName) => ccu.subscriptions.some((s) => s.filter.datapointName === datapointName);

test('stateDatapoint: virtual receiver → transmitter for state datapoints, unchanged otherwise', () => {
    // HmIP-BDT: :3 DIMMER_TRANSMITTER, :4-:6 DIMMER_VIRTUAL_RECEIVER (same layout as the PDT)
    const ccu = fixtures.ccuFor('HmIP-BDT');
    const a = ccu.address;
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:4.LEVEL`), `HmIP-RF.${a}:3.LEVEL`);
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:6.LEVEL`), `HmIP-RF.${a}:3.LEVEL`);
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:4.ACTIVITY_STATE`), `HmIP-RF.${a}:3.ACTIVITY_STATE`);
    // write-only parameters of the receiver stay where they are
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:4.RAMP_TIME`), `HmIP-RF.${a}:4.RAMP_TIME`);
    // transmitter, key, maintenance channels and unknown addresses are untouched
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:3.LEVEL`), `HmIP-RF.${a}:3.LEVEL`);
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:1.PRESS_SHORT`), `HmIP-RF.${a}:1.PRESS_SHORT`);
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:0.UNREACH`), `HmIP-RF.${a}:0.UNREACH`);
    assert.equal(stateDatapoint(ccu, 'HmIP-RF.NOPE:4.LEVEL'), 'HmIP-RF.NOPE:4.LEVEL');
    assert.equal(stateDatapoint(ccu, undefined), undefined);
});

test('stateDatapoint: each receiver group uses its own transmitter (HmIPW-DRS8, HmIP-BSL)', () => {
    let ccu = fixtures.ccuFor('HmIPW-DRS8');
    let a = ccu.address;
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:2.STATE`), `HmIP-RF.${a}:1.STATE`);
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:4.STATE`), `HmIP-RF.${a}:1.STATE`);
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:6.STATE`), `HmIP-RF.${a}:5.STATE`);
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:30.STATE`), `HmIP-RF.${a}:29.STATE`);

    ccu = fixtures.ccuFor('HmIP-BSL');
    a = ccu.address;
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:4.STATE`), `HmIP-RF.${a}:3.STATE`);
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:8.LEVEL`), `HmIP-RF.${a}:7.LEVEL`);
    assert.equal(stateDatapoint(ccu, `HmIP-RF.${a}:12.LEVEL`), `HmIP-RF.${a}:11.LEVEL`);
});

test('stateDatapoint: BidCos devices have no virtual receivers and are untouched', () => {
    const ccu = fixtures.ccuFor('HM-LC-Sw1-Pl-DN-R1');
    const a = ccu.address;
    assert.equal(stateDatapoint(ccu, `BidCos-RF.${a}:1.STATE`), `BidCos-RF.${a}:1.STATE`);
});

test('HmIP-BDT module (PDT layout): state follows the transmitter, writes go to the first receiver', async () => {
    const ccu = fixtures.ccuFor('HmIP-BDT');
    const a = ccu.address;
    const h = createHarness(ccu);
    await h.create();
    assert.ok(subscribed(ccu, `HmIP-RF.${a}:3.LEVEL`), 'subscribed to the transmitter');
    assert.ok(!subscribed(ccu, `HmIP-RF.${a}:4.LEVEL`), 'not subscribed to the receiver');

    const bulb = h.bridgeConfig.bridge.bridgedAccessories[0].getService(h.hap.Service.Lightbulb);
    // a program dims via another receiver: the transmitter reports 70 %
    ccu.emitValue(`HmIP-RF.${a}:3.LEVEL`, 0.7);
    await tick();
    assert.equal(bulb.getCharacteristic(h.hap.Characteristic.Brightness).value, 70);
    assert.equal(bulb.getCharacteristic(h.hap.Characteristic.On).value, true);

    await new Promise((resolve, reject) => {
        bulb.getCharacteristic(h.hap.Characteristic.Brightness).emit('set', 30, (e) => (e ? reject(e) : resolve()));
    });
    assert.equal(ccu.setCalls.at(-1).channel, `${a}:4`);
    assert.equal(ccu.setCalls.at(-1).value, 0.3);
    h.cleanup();
});

test('HmIP-PDT (fixture from the lab CCU): the hardware case — :4 set by the CCU, HomeKit follows :2', async () => {
    const ccu = fixtures.ccuFor('HmIP-PDT');
    const a = ccu.address;
    const h = createHarness(ccu);
    await h.create();
    assert.deepEqual(h.services(), {'HmIP-PDT': ['Lightbulb/0']});
    assert.ok(subscribed(ccu, `HmIP-RF.${a}:2.LEVEL`), 'subscribed to the transmitter');
    assert.ok(!subscribed(ccu, `HmIP-RF.${a}:3.LEVEL`), 'not subscribed to the receiver');

    const bulb = h.bridgeConfig.bridge.bridgedAccessories[0].getService(h.hap.Service.Lightbulb);
    ccu.emitValue(`HmIP-RF.${a}:2.LEVEL`, 0.7);
    await tick();
    assert.equal(bulb.getCharacteristic(h.hap.Characteristic.Brightness).value, 70);
    h.cleanup();
});

test('generic mapping (HmIP-DRDI3): state from the transmitter, writes to the receiver', async () => {
    // :1-:3 inputs, :4 DIMMER_TRANSMITTER, :5-:7 receivers, :8/:12 further transmitters
    const ccu = fixtures.ccuFor('HmIP-DRDI3');
    const a = ccu.address;
    const h = createHarness(ccu);
    await h.create();
    assert.ok(subscribed(ccu, `HmIP-RF.${a}:4.LEVEL`), 'subscribed to the transmitter of output 1');
    assert.ok(!subscribed(ccu, `HmIP-RF.${a}:5.LEVEL`), 'not subscribed to the receiver');

    const acc = h.bridgeConfig.bridge.bridgedAccessories[0];
    const bulb = acc.services.find((s) => s.UUID === h.hap.Service.Lightbulb.UUID && s.subtype === '5');
    assert.ok(bulb, 'Lightbulb service for receiver :5');
    ccu.emitValue(`HmIP-RF.${a}:4.LEVEL`, 0.4);
    await tick();
    assert.equal(bulb.getCharacteristic(h.hap.Characteristic.Brightness).value, 40);

    await new Promise((resolve, reject) => {
        bulb.getCharacteristic(h.hap.Characteristic.Brightness).emit('set', 55, (e) => (e ? reject(e) : resolve()));
    });
    assert.equal(ccu.setCalls.at(-1).channel, `${a}:5`);
    assert.equal(ccu.setCalls.at(-1).value, 0.55);
    h.cleanup();
});

test('HmIPW-DRS8 module: each output reads its own transmitter', async () => {
    const ccu = fixtures.ccuFor('HmIPW-DRS8');
    const a = ccu.address;
    const h = createHarness(ccu);
    await h.create();
    assert.ok(subscribed(ccu, `HmIP-RF.${a}:1.STATE`), 'output 1 transmitter');
    assert.ok(subscribed(ccu, `HmIP-RF.${a}:29.STATE`), 'output 8 transmitter');
    assert.ok(!subscribed(ccu, `HmIP-RF.${a}:2.STATE`), 'receiver of output 1 not subscribed');
    h.cleanup();
});
