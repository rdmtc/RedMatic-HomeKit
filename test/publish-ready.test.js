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

/* A deploy while the node still waits for the device list (forum report,
   2026-10-27): the node had no close handler, so the closed node published
   anyway. The bridge keeps its accessories across deploys, the closed node's
   get/set listeners stayed on them, the new node added its own, and the
   second set callback threw inside hap-nodejs' once() - uncaught, Node-RED
   exited. */

/** a homematic-devices node on the same bridge and ccu, the way a redeploy creates it */
function redeploy(h, ccu, id) {
    const node = h.RED.instantiate('redmatic-homekit-homematic-devices', {
        id,
        bridgeConfig: h.bridgeConfig.id,
        ccuConfig: 'ccu-' + id,
    });
    node.bridgeConfig = h.bridgeConfig;
    node.ccu = ccu;
    node.devices = {};
    node.readyInterval = 10;
    return node;
}

/** end a test even when it failed: no bridge timer left that keeps the process alive */
function stop(h) {
    h.bridgeConfig.waitForAccessories = () => {};
    h.bridgeConfig.publishBridge = () => {};
    h.cleanup();
}

function windowCovering(h) {
    const acc = h.bridgeConfig.bridge.bridgedAccessories[0];
    assert.ok(acc, 'accessory published');
    const service = acc.services.find((s) => s.UUID === h.hap.Service.WindowCovering.UUID);
    assert.ok(service, 'WindowCovering published');
    return {acc, targetPosition: service.getCharacteristic(h.hap.Characteristic.TargetPosition)};
}

function listenerCounts(h) {
    let count = 0;
    for (const acc of h.bridgeConfig.bridge.bridgedAccessories) {
        count += acc.listenerCount('identify');
        // AccessoryInformation's Identify carries hap-nodejs' own set listener
        for (const service of acc.services.filter((s) => s.UUID !== h.hap.Service.AccessoryInformation.UUID)) {
            for (const c of service.characteristics) {
                count += c.listenerCount('get') + c.listenerCount('set');
            }
        }
    }

    return count;
}

test('a deploy while the node waits for the device list: the closed node publishes nothing', async (t) => {
    const ccu = fixtures.ccuFor('HmIP-BROLL');
    const h = createHarness(ccu);
    t.after(() => stop(h));
    const iface = ccu.enabledIfaces[0];
    const devices = ccu.metadata.devices[iface];
    ccu.metadata.devices = {};
    h.node.readyInterval = 10;

    h.node.setStatus({ifaceStatus: {[iface]: true}});
    await wait(30);
    await h.RED.close(h.node);
    ccu.metadata.devices[iface] = devices;
    await wait(250);
    assert.equal(h.bridgeConfig.bridge.bridgedAccessories.length, 0, 'nothing published after close');
    assert.equal(ccu.subscriptions.length, 0, 'no ccu subscriptions after close');
    assert.equal(ccu.users[h.node.id], undefined, 'deregistered from the ccu-connection');
});

test('a deploy while devices are being published: nothing is wired up after close', async (t) => {
    const ccu = fixtures.ccuFor('HmIP-BROLL');
    const h = createHarness(ccu);
    t.after(() => stop(h));
    const iface = ccu.enabledIfaces[0];
    h.node.readyInterval = 10;

    // close right after the accessory was created, before its init() ran
    const create = h.node.createHomematicDevice.bind(h.node);
    let closing;
    h.node.createHomematicDevice = (dev) => {
        const created = create(dev);
        closing = h.RED.close(h.node);
        return created;
    };

    h.node.setStatus({ifaceStatus: {[iface]: true}});
    await wait(250);
    assert.ok(closing, 'the node got as far as creating the accessory');
    await closing;
    assert.equal(ccu.subscriptions.length, 0, 'no ccu subscriptions after close');
    assert.equal(listenerCounts(h), 0, 'no HAP listeners after close');
});

test('a redeploy does not double the HAP listeners, and a set the CCU refuses does not throw', async (t) => {
    const ccu = fixtures.ccuFor('HmIP-BROLL');
    const h = createHarness(ccu);
    t.after(() => stop(h));
    const iface = ccu.enabledIfaces[0];
    const devices = ccu.metadata.devices[iface];
    h.node.readyInterval = 10;

    // first deploy: published normally
    h.node.setStatus({ifaceStatus: {[iface]: true}});
    await wait(250);
    windowCovering(h);
    const listeners = listenerCounts(h);
    assert.ok(listeners > 0);

    // second deploy while the ccu-connection has not delivered its list yet
    await h.RED.close(h.node);
    ccu.metadata.devices = {};
    const second = redeploy(h, ccu, 'devices-second');
    second.setStatus({ifaceStatus: {[iface]: true}});
    await wait(30);

    // third deploy during that wait, then the list arrives
    await h.RED.close(second);
    const third = redeploy(h, ccu, 'devices-third');
    t.after(() => h.RED.close(third));
    third.setStatus({ifaceStatus: {[iface]: true}});
    ccu.metadata.devices[iface] = devices;
    await wait(300);

    // a set the CCU refuses answers HomeKit once and throws nothing
    const {targetPosition} = windowCovering(h);
    const thrown = [];
    const onError = (error) => thrown.push(error.message);
    process.on('unhandledRejection', onError);
    process.on('uncaughtException', onError);
    ccu.methodCall = () => Promise.reject(new Error('Generic error'));
    await assert.rejects(targetPosition.handleSetRequest(50, undefined));
    await wait(20);
    process.off('unhandledRejection', onError);
    process.off('uncaughtException', onError);
    assert.deepEqual(thrown, [], 'nothing thrown');
    assert.equal(listenerCounts(h), listeners, 'HAP listeners of one node, not of three');
});
