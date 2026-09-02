const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('./helpers/fixtures');
const {createHarness, tick} = require('./helpers/harness');
const catalogue = require('../homematic-devices/lib/catalogue');

function service(h, accessoryName, type) {
    const acc = h.bridgeConfig.bridge.bridgedAccessories.find((a) => a.displayName === accessoryName);
    assert.ok(acc, 'accessory ' + accessoryName + ' missing: ' + JSON.stringify(h.services()));
    const s = acc.getService(h.hap.Service[type]);
    assert.ok(s, type + ' missing on ' + accessoryName + ': ' + JSON.stringify(h.services()));
    return s;
}

function setCharacteristic(h, s, characteristic, value) {
    return new Promise((resolve, reject) => {
        s.getCharacteristic(h.hap.Characteristic[characteristic]).emit('set', value, (error) =>
            error ? reject(error) : resolve(),
        );
    });
}

test('HmIP-DLD becomes a LockMechanism with battery (#328)', async () => {
    const ccu = fixtures.ccuFor('HmIP-DLD', {channelNames: {[fixtures.load('HmIP-DLD').device[0].ADDRESS]: 'Haustür'}});
    const dp = (index, name) => `HmIP-RF.${ccu.address}:${index}.${name}`;
    ccu.values[dp(1, 'LOCK_STATE')] = {value: 1, stable: true}; // LOCKED
    ccu.values[dp(0, 'LOW_BAT')] = {value: false, stable: true};
    const h = createHarness(ccu);
    await h.create();

    const lock = service(h, 'Haustür', 'LockMechanism');
    assert.equal(lock.getCharacteristic(h.hap.Characteristic.LockCurrentState).value, 1, 'SECURED');
    service(h, 'Haustür', 'Battery');

    await setCharacteristic(h, lock, 'LockTargetState', 0); // UNSECURED
    assert.deepEqual(ccu.setCalls.at(-1), {
        iface: 'HmIP-RF',
        channel: ccu.address + ':1',
        datapoint: 'LOCK_TARGET_LEVEL',
        value: 2, // OPEN (OpenOnUnlock default)
        burst: false,
        force: false,
    });
    await setCharacteristic(h, lock, 'LockTargetState', 1);
    assert.equal(ccu.setCalls.at(-1).value, 0, 'LOCKED');

    ccu.emitValue(dp(1, 'LOCK_STATE'), 2); // UNLOCKED
    assert.equal(lock.getCharacteristic(h.hap.Characteristic.LockCurrentState).value, 0);
    assert.equal(h.node.logged.error.length, 0, JSON.stringify(h.node.logged.error));
    h.cleanup();
});

test('HmIP-DRDI3 without SingleAccessory: one Lightbulb accessory per dimmer channel, contacts on the device (#333)', async () => {
    const ccu = fixtures.ccuFor('HmIP-DRDI3');
    const h = createHarness(ccu);
    await h.create({[ccu.address + ':SingleAccessory']: {disabled: true}});
    const services = h.services();
    assert.deepEqual(services['HmIP-DRDI3 5'], ['Lightbulb/5']);
    assert.deepEqual(services['HmIP-DRDI3 9'], ['Lightbulb/9']);
    assert.deepEqual(services['HmIP-DRDI3 13'], ['Lightbulb/13']);
    assert.deepEqual(services['HmIP-DRDI3'], ['ContactSensor/1', 'ContactSensor/2', 'ContactSensor/3']);

    const bulb = service(h, 'HmIP-DRDI3 5', 'Lightbulb');
    await setCharacteristic(h, bulb, 'Brightness', 40);
    assert.equal(ccu.setCalls.at(-1).datapoint, 'LEVEL');
    assert.equal(ccu.setCalls.at(-1).value, 0.4);
    assert.equal(ccu.setCalls.at(-1).channel, ccu.address + ':5');
    h.cleanup();
});

test('HmIP-DRDI3 default (SingleAccessory on, as in 3.3.0): everything on one accessory', async () => {
    const ccu = fixtures.ccuFor('HmIP-DRDI3');
    const h = createHarness(ccu);
    await h.create();
    assert.deepEqual(h.services()['HmIP-DRDI3'], [
        'Lightbulb/5',
        'Lightbulb/9',
        'Lightbulb/13',
        'ContactSensor/1',
        'ContactSensor/2',
        'ContactSensor/3',
    ]);
    h.cleanup();
});

test('HmIP-WRC6: six programmable switches, press events (#361 WRCC2 class)', async () => {
    const ccu = fixtures.ccuFor('HmIP-WRC6');
    const h = createHarness(ccu);
    await h.create();
    const services = h.services()['HmIP-WRC6'];
    assert.equal(services.filter((s) => s.startsWith('StatelessProgrammableSwitch')).length, 6);
    assert.ok(services.includes('ServiceLabel/label'));
    assert.ok(services.includes('Battery/battery'));

    const button3 = service(h, 'HmIP-WRC6', 'StatelessProgrammableSwitch');
    const sub = ccu.subscriptions.find((s) => s.filter.datapointName === `HmIP-RF.${ccu.address}:1.PRESS_LONG`);
    assert.ok(sub, 'subscribed to PRESS_LONG');
    assert.equal(sub.filter.change, false, 'press events are not change-filtered');
    sub.callback({datapointName: sub.filter.datapointName, value: true});
    assert.equal(button3.getCharacteristic(h.hap.Characteristic.ProgrammableSwitchEvent).value, 2, 'LONG_PRESS');
    h.cleanup();
});

test('HmIP-SRD rain sensor and HmIP-SWSD smoke detector', async () => {
    const rain = fixtures.ccuFor('HmIP-SRD');
    let h = createHarness(rain);
    await h.create();
    assert.deepEqual(h.services()['HmIP-SRD'], ['LeakSensor/1']);
    h.cleanup();

    const smoke = fixtures.ccuFor('HmIP-SWSD');
    smoke.values[`HmIP-RF.${smoke.address}:1.SMOKE_DETECTOR_ALARM_STATUS`] = {value: 1, stable: true};
    h = createHarness(smoke);
    await h.create();
    const s = service(h, 'HmIP-SWSD', 'SmokeSensor');
    assert.equal(s.getCharacteristic(h.hap.Characteristic.SmokeDetected).value, 1, 'PRIMARY_ALARM = smoke');
    smoke.emitValue(`HmIP-RF.${smoke.address}:1.SMOKE_DETECTOR_ALARM_STATUS`, 0); // IDLE_OFF
    assert.equal(s.getCharacteristic(h.hap.Characteristic.SmokeDetected).value, 0);
    h.cleanup();
});

test('HmIP-RGBW: colour light with hue, saturation and colour temperature', async () => {
    const ccu = fixtures.ccuFor('HmIP-RGBW');
    const h = createHarness(ccu);
    await h.create();
    const bulb = service(h, 'HmIP-RGBW', 'Lightbulb');
    for (const c of ['Brightness', 'Hue', 'Saturation', 'ColorTemperature']) {
        assert.ok(bulb.testCharacteristic(h.hap.Characteristic[c]), c);
    }

    await setCharacteristic(h, bulb, 'ColorTemperature', 250); // mired -> 4000 K
    assert.equal(ccu.setCalls.at(-1).datapoint, 'COLOR_TEMPERATURE');
    assert.equal(ccu.setCalls.at(-1).value, 4000);
    await setCharacteristic(h, bulb, 'Saturation', 50);
    assert.equal(ccu.setCalls.at(-1).value, 0.5);
    h.cleanup();
});

test('HmIP thermostats without a module delegate to the existing thermostat module', async () => {
    for (const [type, expected] of [
        ['HmIP-eTRV-E', 'hmip-etrv'],
        ['HmIP-WTH-1', 'hmip-wth'],
        ['HmIPW-STHD', 'hmip-wth'],
    ]) {
        const ccu = fixtures.ccuFor(type);
        const h = createHarness(ccu);
        const device = await h.create();
        assert.equal(device.plan.delegate, expected, type);
        assert.ok(device.delegate, type + ' delegate instantiated');
        assert.ok(
            h.services()[type].some((s) => s.startsWith('Thermostat')),
            type + ': ' + JSON.stringify(h.services()),
        );
        assert.equal(h.node.logged.error.length, 0, JSON.stringify(h.node.logged.error));
        h.cleanup();
    }
});

test('HmIP-WGC: switch plus opt-in button', async () => {
    const ccu = fixtures.ccuFor('HmIP-WGC');
    let h = createHarness(ccu);
    await h.create();
    assert.deepEqual(h.services()['HmIP-WGC'], ['Switch/3', 'Battery/battery']);
    h.cleanup();

    h = createHarness(fixtures.ccuFor('HmIP-WGC'));
    await h.create({[ccu.address + ':1']: {enabled: true}, [ccu.address + ':3']: {type: 'Outlet'}});
    assert.deepEqual(h.services()['HmIP-WGC'], [
        'Outlet/3',
        'ServiceLabel/label',
        'StatelessProgrammableSwitch/1',
        'Battery/battery',
    ]);
    h.cleanup();
});

test('catalogue lists generic devices with their editor rows', () => {
    const ccu = fixtures.ccuFor('HmIP-DRDI3');
    const [d] = catalogue.describeDevices(ccu);
    assert.equal(d.generic, true);
    assert.deepEqual(d.options, ['SingleAccessory']);
    const rows = d.channels.map((c) => c.address.split(':')[1] + (c.virtual ? '*' : '') + (c.dropdowns ? '+' : ''));
    assert.deepEqual(rows, ['1+', '2+', '3+', '5', '6*', '7*', '9', '10*', '11*', '13', '14*', '15*']);
    assert.deepEqual(d.channels[0].dropdowns.type, ['ContactSensor', 'Door', 'Window', 'GarageDoorOpener']);

    const dld = catalogue.describeDevices(fixtures.ccuFor('HmIP-DLD'))[0];
    assert.deepEqual(dld.options, ['Battery', 'OpenOnUnlock']);
});

test('every fixture type without a module maps without errors; snapshot of the services', async () => {
    const snapshotFile = path.join(__dirname, 'fixtures', 'generic.snapshot.json');
    const snapshot = {};
    for (const type of fixtures.types()) {
        if (catalogue.hasModule(type)) {
            continue;
        }

        const ccu = fixtures.ccuFor(type);
        const h = createHarness(ccu);
        const device = await h.create();
        await tick();
        assert.equal(h.node.logged.error.length, 0, type + ': ' + JSON.stringify(h.node.logged.error));
        if (device && device.plan.supported) {
            snapshot[type] = device.plan.delegate
                ? {delegate: device.plan.delegate, services: h.services()}
                : h.services();
        }

        h.cleanup();
    }

    assert.ok(Object.keys(snapshot).length > 120, 'only ' + Object.keys(snapshot).length + ' generic types');
    if (process.env.UPDATE_SNAPSHOT || !fs.existsSync(snapshotFile)) {
        fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 1) + '\n');
    }

    const expected = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    assert.deepEqual(snapshot, expected, 'generic mapping changed — review and run with UPDATE_SNAPSHOT=1');
});
