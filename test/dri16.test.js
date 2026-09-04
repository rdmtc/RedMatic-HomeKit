/* HmIP multi-mode inputs (HmIPW-DRI16 fixture from the lab CCU): what an
   input channel sends depends on its CHANNEL_OPERATION_MODE. KEY_BEHAVIOR,
   the factory default, sends PRESS_SHORT/PRESS_LONG and never STATE, so
   the 3.3.0 mapping (always a ContactSensor on STATE) stayed "closed"
   forever on the lab DRI16 (switch on input 1, button on input 5, both in
   key mode). The node reads the mode from the MASTER paramset and maps
   key-mode inputs as programmable switches. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/fixtures');
const {createHarness, tick} = require('./helpers/harness');
const roles = require('../homematic-devices/lib/roles');

/** FakeCcu.methodCall answering getParamset MASTER with the given modes (address → mode index) */
function withModes(ccu, modes) {
    ccu.methodCall = (iface, method, params) => {
        ccu.setCalls.push({iface, method, params});
        if (method === 'getParamset' && params[1] === 'MASTER') {
            const mode = modes[params[0]];
            return Promise.resolve(mode === undefined ? {} : {CHANNEL_OPERATION_MODE: mode});
        }

        return Promise.resolve(true);
    };
}

const publish = (h) =>
    new Promise((resolve) => {
        h.node.publishDevices(resolve);
    });

test('channelRole: multi-mode input follows its operating mode', () => {
    const ccu = fixtures.ccuFor('HmIPW-DRI16');
    const channel = ccu.metadata.devices['HmIP-RF'][ccu.address + ':1'];
    const values = ccu.getParamsetDescription('HmIP-RF', channel, 'VALUES');
    assert.equal(channel.TYPE, 'MULTI_MODE_INPUT_TRANSMITTER');
    assert.equal(roles.channelRole(channel, values), 'contact', 'no mode known: contact (3.3.0 behaviour)');
    assert.equal(roles.channelRole(channel, values, 'KEY_BEHAVIOR'), 'key');
    assert.equal(roles.channelRole(channel, values, 'SWITCH_BEHAVIOR'), 'contact');
    assert.equal(roles.channelRole(channel, values, 'BINARY_BEHAVIOR'), 'contact');
    assert.equal(roles.channelRole(channel, values, 'INACTIVE'), null);
});

test('HmIPW-DRI16 module: key-mode inputs become programmable switches, others stay contacts', async () => {
    const ccu = fixtures.ccuFor('HmIPW-DRI16');
    const a = ccu.address;
    // input 1 and 5 in key mode (the lab wiring), input 2 as switch, input 3 inactive, the rest unknown
    withModes(ccu, {[a + ':1']: 1, [a + ':5']: 1, [a + ':2']: 2, [a + ':3']: 0});
    const h = createHarness(ccu);
    await publish(h);
    await tick();
    await tick();

    const services = h.services()['HmIPW-DRI16'];
    assert.ok(services, 'one accessory (SingleAccessory default)');
    assert.equal(services.filter((s) => s.startsWith('StatelessProgrammableSwitch')).length, 2, 'two buttons');
    assert.ok(services.includes('ServiceLabel/label0'), 'service label for the buttons');
    // 16 inputs - 2 keys - 1 inactive = 13 contacts
    assert.equal(services.filter((s) => s.startsWith('ContactSensor')).length, 13);

    const reported = ccu.setCalls.filter((c) => c.method === 'reportValueUsage').map((c) => c.params.join(' '));
    assert.ok(reported.includes(`${a}:1 PRESS_SHORT 1`));
    assert.ok(reported.includes(`${a}:5 PRESS_LONG 1`));
    assert.ok(!reported.includes(`${a}:2 PRESS_SHORT 1`), 'no usage report for a switch-mode input');

    const sub = ccu.subscriptions.find((s) => s.filter.datapointName === `HmIP-RF.${a}:5.PRESS_SHORT`);
    assert.ok(sub && sub.filter.change === false, 'press events subscribed without change filter');
    const acc = h.bridgeConfig.bridge.bridgedAccessories[0];
    const button5 = acc.services.find(
        (s) => s.UUID === h.hap.Service.StatelessProgrammableSwitch.UUID && s.displayName === 'HmIPW-DRI16 5',
    );
    assert.ok(button5, 'button service named after input 5');
    sub.callback({datapointName: sub.filter.datapointName, value: true});
    assert.equal(button5.getCharacteristic(h.hap.Characteristic.ProgrammableSwitchEvent).value, 0, 'SINGLE_PRESS');
    h.cleanup();
});

test('HmIPW-DRI16 module without mode information keeps the 3.3.0 layout (16 contacts)', async () => {
    const ccu = fixtures.ccuFor('HmIPW-DRI16');
    const h = createHarness(ccu);
    await h.create();
    assert.equal(h.services()['HmIPW-DRI16'].filter((s) => s.startsWith('ContactSensor')).length, 16);
    h.cleanup();
});

test('generic mapping (HmIP-DSD-PCB): key-mode input is a programmable switch with usage report', async () => {
    const ccu = fixtures.ccuFor('HmIP-DSD-PCB');
    const a = ccu.address;
    withModes(ccu, {[a + ':1']: 1});
    const h = createHarness(ccu);
    await publish(h);
    await tick();
    await tick();
    const services = Object.values(h.services()).flat();
    assert.ok(
        services.some((s) => s.startsWith('StatelessProgrammableSwitch')),
        'button mapped: ' + services,
    );
    const reported = ccu.setCalls.filter((c) => c.method === 'reportValueUsage').map((c) => c.params.join(' '));
    assert.ok(reported.includes(`${a}:1 PRESS_SHORT 1`));
    h.cleanup();
});

test('node: channel modes are read once per channel and cached', async () => {
    const ccu = fixtures.ccuFor('HmIPW-DRI16');
    withModes(ccu, {[ccu.address + ':1']: 1});
    const h = createHarness(ccu);
    const modes = await h.node.channelModes('HmIP-RF', ccu.device);
    assert.equal(modes[ccu.address + ':1'], 'KEY_BEHAVIOR');
    assert.equal(modes[ccu.address + ':2'], undefined, 'unknown mode stays unknown');
    const calls = ccu.setCalls.filter((c) => c.method === 'getParamset').length;
    await h.node.channelModes('HmIP-RF', ccu.device);
    assert.equal(
        ccu.setCalls.filter((c) => c.method === 'getParamset').length,
        calls + 15,
        'cached answers are not asked again, unknown ones are',
    );
    h.cleanup();
});
