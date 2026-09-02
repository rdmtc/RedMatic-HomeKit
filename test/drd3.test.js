const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/fixtures');
const {createHarness} = require('./helpers/harness');

test('HmIPW-DRD3 default keeps the 3.3.0 layout (one accessory, subtypes 0/1/2)', async () => {
    const ccu = fixtures.ccuFor('HmIPW-DRD3');
    const h = createHarness(ccu);
    await h.create();
    assert.deepEqual(h.services(), {'HmIPW-DRD3': ['Lightbulb/0', 'Lightbulb/1', 'Lightbulb/2']});
    h.cleanup();
});

test('HmIPW-DRD3 with SingleAccessory disabled: one accessory per output, named by channel (#353)', async () => {
    const ccu = fixtures.ccuFor('HmIPW-DRD3');
    const h = createHarness(ccu);
    await h.create({[ccu.address + ':SingleAccessory']: {disabled: true}, [ccu.address + ':6']: {disabled: true}});
    assert.deepEqual(h.services(), {'HmIPW-DRD3 2': ['Lightbulb/0'], 'HmIPW-DRD3 10': ['Lightbulb/0']});

    const bulb = h.bridgeConfig.bridge.bridgedAccessories[1].getService(h.hap.Service.Lightbulb);
    await new Promise((resolve, reject) => {
        bulb.getCharacteristic(h.hap.Characteristic.Brightness).emit('set', 30, (e) => (e ? reject(e) : resolve()));
    });
    assert.equal(ccu.setCalls.at(-1).channel, ccu.address + ':10');
    assert.equal(ccu.setCalls.at(-1).value, 0.3);
    h.cleanup();
});
