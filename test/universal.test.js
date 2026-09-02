const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {createFakeRED} = require('./helpers/fake-red');

const root = path.resolve(__dirname, '..');
const tick = () => new Promise((resolve) => setImmediate(resolve));

function load() {
    return createFakeRED()
        .load(path.join(root, 'nodes/redmatic-homekit-bridge.js'))
        .load(path.join(root, 'nodes/redmatic-homekit-universal.js'))
        .load(path.join(root, 'nodes/redmatic-homekit-switch.js'));
}

test('universal node: HomeKit writes come out as messages, msg input only updates HomeKit', async () => {
    const RED = load();
    const bridge = RED.instantiate('redmatic-homekit-bridge', {
        id: 'b-uni',
        username: 'CC:22:3D:AA:CC:01',
        pincode: '031-45-154',
        port: '51997',
    });
    clearTimeout(bridge.waitForAccessoriesTimer);
    const node = RED.instantiate('redmatic-homekit-universal', {
        id: 'uni1',
        name: 'Lamp',
        bridgeConfig: 'b-uni',
        services: [{service: 'Lightbulb', subtype: '0', name: 'Lamp'}],
    });
    clearTimeout(bridge.waitForAccessoriesTimer);
    const {hap} = bridge;
    const acc = bridge.bridge.bridgedAccessories.find((a) => a.displayName === 'Lamp');
    const on = acc.getService(hap.Service.Lightbulb).getCharacteristic(hap.Characteristic.On);

    // a controller writes On=true (what a paired iPhone does)
    await on.handleSetRequest(true, undefined);
    await tick();
    assert.deepEqual(node.sent, [{topic: '0/On', payload: true}]);

    // a message from the flow updates HomeKit but must not echo back as output
    node.emit('input', {topic: '0/On', payload: false});
    await tick();
    assert.equal(on.value, false);
    assert.equal(node.sent.length, 1, 'no echo for msg input');

    // props via object payload
    const brightness = acc.getService(hap.Service.Lightbulb).getCharacteristic(hap.Characteristic.Brightness);
    node.emit('input', {topic: '0/Brightness', payload: {minValue: 10, maxValue: 90}});
    assert.equal(brightness.props.minValue, 10);
    assert.equal(brightness.props.maxValue, 90);
    RED.cleanup();
});
