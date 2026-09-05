/* Energy meters without any other role (HM-ES-TX-WM, HmIP-ESI) got an
   accessory with nothing but a Battery service in 4.0.0 — "Not Supported" in
   the Home app and impossible to remove from there, since bridged accessories
   only disappear when the bridge stops offering them (#385). HomeKit has no
   service for energy/power (Eve characteristics: #114), so such devices are
   neither offered in the editor nor published. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/fixtures');
const {createHarness, tick} = require('./helpers/harness');
const catalogue = require('../homematic-devices/lib/catalogue');

for (const type of ['HM-ES-TX-WM', 'HmIP-ESI']) {
    test(`${type} (energy only) is neither listed in the editor nor published (#385)`, async () => {
        const ccu = fixtures.ccuFor(type);
        assert.deepEqual(catalogue.describeDevices(ccu), []);
        const h = createHarness(ccu);
        const device = await h.create();
        await tick();
        assert.equal(device.plan.supported, false);
        assert.deepEqual(h.services(), {});
        assert.equal(h.node.logged.error.length, 0, JSON.stringify(h.node.logged.error));
        h.cleanup();
    });
}

test('no generic device type publishes a battery-only accessory, with or without SingleAccessory', async () => {
    let checked = 0;
    for (const type of fixtures.types()) {
        if (catalogue.hasModule(type)) {
            continue;
        }

        for (const single of [true, false]) {
            const ccu = fixtures.ccuFor(type);
            const h = createHarness(ccu);
            const device = await h.create(single ? {} : {[ccu.address + ':SingleAccessory']: {disabled: true}});
            await tick();
            if (device && device.plan.batteryEnabled) {
                checked++;
            }

            for (const [name, services] of Object.entries(h.services())) {
                assert.ok(
                    services.some((s) => !s.startsWith('Battery/')),
                    `${type} ${name} (SingleAccessory ${single}): ${services.join(', ')}`,
                );
            }

            h.cleanup();
        }
    }

    assert.ok(checked > 50, 'only ' + checked + ' battery devices checked');
});
