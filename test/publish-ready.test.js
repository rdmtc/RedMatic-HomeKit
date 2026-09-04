/* First deploy: ccu-connection reports its interfaces as connected before
   `listDevices` has answered, so a homematic-devices node created in the
   same deploy (or on a box without cached metadata) published "0 devices"
   and needed a restart (seen on both lab boxes, 2026-09-04). The node now
   waits for the device list of every RPC interface. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/fixtures');
const {createHarness} = require('./helpers/harness');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('homematic-devices node defers publishing until the ccu has fetched its device list', async () => {
    const ccu = fixtures.ccuFor('HmIP-BDT');
    const h = createHarness(ccu);
    const iface = ccu.enabledIfaces[0];
    const devices = ccu.metadata.devices[iface];
    ccu.metadata.devices = {}; // listDevices not answered yet
    h.node.readyInterval = 10;
    h.bridgeConfig.waitForHomematic = true; // what the node's constructor sets with a real ccu-connection

    h.node.setStatus({ifaceStatus: {[iface]: true}});
    await wait(40);
    assert.equal(h.bridgeConfig.bridge.bridgedAccessories.length, 0, 'nothing published while the list is missing');
    assert.equal(h.bridgeConfig.waitForHomematic, true, 'bridge keeps waiting');

    ccu.metadata.devices[iface] = devices;
    await wait(250); // 3 unchanged polls + publishDevices' 50 ms per device
    assert.equal(h.bridgeConfig.bridge.bridgedAccessories.length, 1, 'published once the list arrived');
    assert.equal(h.bridgeConfig.waitForHomematic, false);
    clearTimeout(h.node.readyTimer);
    h.cleanup();
});

test('homematic-devices node publishes immediately when the device list is already there', async () => {
    const ccu = fixtures.ccuFor('HmIP-BDT');
    const h = createHarness(ccu);
    const iface = ccu.enabledIfaces[0];
    h.node.readyInterval = 10;

    h.node.setStatus({ifaceStatus: {[iface]: true}});
    await wait(250);
    assert.equal(h.bridgeConfig.bridge.bridgedAccessories.length, 1);
    assert.equal(h.bridgeConfig.waitForHomematic, false);
    clearTimeout(h.node.readyTimer);
    h.cleanup();
});

test('homematic-devices node gives up waiting after the limit and publishes what it has', async () => {
    const ccu = fixtures.ccuFor('HmIP-BDT');
    const h = createHarness(ccu);
    const iface = ccu.enabledIfaces[0];
    ccu.metadata.devices = {};
    h.node.readyInterval = 5;
    h.node.readyAttempts = 3;

    h.node.setStatus({ifaceStatus: {[iface]: true}});
    await wait(100);
    assert.equal(h.bridgeConfig.waitForHomematic, false, 'bridge released after the limit');
    assert.equal(h.bridgeConfig.bridge.bridgedAccessories.length, 0);
    clearTimeout(h.node.readyTimer);
    h.cleanup();
});
