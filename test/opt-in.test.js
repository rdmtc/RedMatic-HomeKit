/* The CCU's own virtual remote (HmIP-RCV-50 / HM-RCV-50) maps to 50
   programmable switches and appeared on every bridge of the lab boxes —
   useful for triggering HomeKit automations from CCU programs, noise for
   everyone else. It is opt-in: published only with {enabled: true} under
   the device address (decided by the maintainer 2026-09-04). */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/fixtures');
const {createHarness, tick} = require('./helpers/harness');
const catalogue = require('../homematic-devices/lib/catalogue');

const publish = (h) =>
    new Promise((resolve) => {
        h.node.publishDevices(resolve);
    });

test('HmIP-RCV-50 is flagged opt-in in the catalogue', () => {
    const ccu = fixtures.ccuFor('HmIP-RCV-50');
    const [device] = catalogue.describeDevices(ccu);
    assert.equal(device.type, 'HmIP-RCV-50');
    assert.equal(device.optIn, true);
    assert.equal(catalogue.isOptIn({TYPE: 'HM-RCV-50'}), true);
    assert.equal(catalogue.isOptIn({TYPE: 'HmIP-WRC2'}), false);

    const other = fixtures.ccuFor('HmIP-WRC6');
    assert.equal(catalogue.describeDevices(other)[0].optIn, false);
});

test('HmIP-RCV-50 is not published unless enabled', async () => {
    const ccu = fixtures.ccuFor('HmIP-RCV-50');
    const h = createHarness(ccu);
    await publish(h);
    await tick();
    assert.equal(h.bridgeConfig.bridge.bridgedAccessories.length, 0, 'skipped by default');

    h.node.devices = {[ccu.address]: {enabled: true}};
    await publish(h);
    await tick();
    await tick();
    assert.equal(h.bridgeConfig.bridge.bridgedAccessories.length, 1, 'published when enabled');
    assert.equal(h.services()['HmIP-RCV-50'].filter((s) => s.startsWith('StatelessProgrammableSwitch')).length, 50);
    h.cleanup();
});

test('HmIP key channels are reported as in use so the CCU forwards their presses', async () => {
    const ccu = fixtures.ccuFor('HmIP-WRC6');
    const h = createHarness(ccu);
    await h.create();
    const reported = ccu.setCalls.filter((c) => c.method === 'reportValueUsage').map((c) => c.params.join(' '));
    assert.ok(reported.includes(`${ccu.address}:1 PRESS_SHORT 1`), 'PRESS_SHORT of key 1 reported');
    assert.ok(reported.includes(`${ccu.address}:6 PRESS_LONG 1`), 'PRESS_LONG of key 6 reported');
    h.cleanup();
});

test('a usage report the CCU rejects ("Transmission is pending") is retried', async () => {
    const ccu = fixtures.ccuFor('HmIP-WRC2');
    let failures = 2;
    const calls = [];
    ccu.methodCall = (iface, method, params) => {
        calls.push(params.join(' '));
        if (failures > 0) {
            failures--;
            return Promise.reject(new Error('XML-RPC fault: Transmission is pending.'));
        }

        return Promise.resolve(true);
    };

    const h = createHarness(ccu);
    h.node.reportValueUsageRetry = 10;
    await h.create();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const key1 = calls.filter((c) => c === `${ccu.address}:1 PRESS_SHORT 1`).length;
    assert.ok(key1 >= 2, 'the rejected report was retried (' + key1 + ' calls)');
    h.cleanup();
});
