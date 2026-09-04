/* A held Homematic key is a stream of PRESS_LONG repeats (every few hundred
   ms) ending with PRESS_LONG_RELEASE; HomeKit must see exactly one
   LONG_PRESS per hold. Found with a toggle switch on a key-mode HmIPW-DRI16
   input: one flip produced eight long presses in the Home app. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/fixtures');
const {createHarness} = require('./helpers/harness');

function events(h, service) {
    const seen = [];
    service.getCharacteristic(h.hap.Characteristic.ProgrammableSwitchEvent).on('change', (c) => seen.push(c.newValue));
    return seen;
}

const fire = (ccu, datapointName) => {
    for (const s of ccu.subscriptions.filter((s) => s.filter.datapointName === datapointName)) {
        s.callback({datapointName, value: true});
    }
};

test('a PRESS_LONG stream is one LONG_PRESS; the next hold after PRESS_LONG_RELEASE is another', async () => {
    const ccu = fixtures.ccuFor('HmIP-WRC2');
    const a = ccu.address;
    const h = createHarness(ccu);
    await h.create();
    const acc = h.bridgeConfig.bridge.bridgedAccessories[0];
    const button = acc.services.find((s) => s.UUID === h.hap.Service.StatelessProgrammableSwitch.UUID);
    const seen = events(h, button);

    fire(ccu, `HmIP-RF.${a}:1.PRESS_SHORT`);
    for (let i = 0; i < 8; i++) {
        fire(ccu, `HmIP-RF.${a}:1.PRESS_LONG`);
    }

    fire(ccu, `HmIP-RF.${a}:1.PRESS_LONG_RELEASE`);
    fire(ccu, `HmIP-RF.${a}:1.PRESS_LONG`);
    fire(ccu, `HmIP-RF.${a}:1.PRESS_LONG`);
    assert.deepEqual(seen, [0, 2, 2], 'single press, one long press per hold');
    h.cleanup();
});

test('without a release event a new hold counts after the gap', async () => {
    const ccu = fixtures.ccuFor('HmIPW-DRI16');
    const a = ccu.address;
    ccu.methodCall = (_iface, method) => Promise.resolve(method === 'getParamset' ? {CHANNEL_OPERATION_MODE: 1} : true);
    const h = createHarness(ccu);
    h.node.longPressGap = 30;
    await new Promise((resolve) => h.node.publishDevices(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    const acc = h.bridgeConfig.bridge.bridgedAccessories[0];
    const button = acc.services.find(
        (s) => s.UUID === h.hap.Service.StatelessProgrammableSwitch.UUID && s.displayName === 'HmIPW-DRI16 1',
    );
    const seen = events(h, button);
    fire(ccu, `HmIP-RF.${a}:1.PRESS_LONG`);
    fire(ccu, `HmIP-RF.${a}:1.PRESS_LONG`);
    await new Promise((resolve) => setTimeout(resolve, 60));
    fire(ccu, `HmIP-RF.${a}:1.PRESS_LONG`);
    assert.deepEqual(seen, [2, 2]);
    h.cleanup();
});
