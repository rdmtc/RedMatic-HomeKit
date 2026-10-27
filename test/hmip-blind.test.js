/* HmIP blinds and shutters (generic-hmip-blind): the accessory's ADDRESS is
   already the first virtual receiver's channel address, so appending the
   channel index again sent putParamset to e.g. `0011170995ECEE:4:4` (forum
   report, 2026-10-27). The CCU's HmIP server ignores the extra index, which
   also sent a second or third enabled receiver's command to the first. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/fixtures');
const {createHarness, tick} = require('./helpers/harness');

function setChar(h, s, characteristic, value) {
    return new Promise((resolve, reject) => {
        s.getCharacteristic(h.hap.Characteristic[characteristic]).emit('set', value, (e) =>
            e ? reject(e) : resolve(),
        );
    });
}

for (const type of ['HmIP-BROLL', 'HmIP-FBL']) {
    test(type + ': putParamset goes to the receiver channel, its index once', async () => {
        const ccu = fixtures.ccuFor(type);
        const first = ccu.address + ':4';
        const second = ccu.address + ':5';
        const h = createHarness(ccu);
        await h.create({[second]: {enabled: true}});
        await tick();

        const acc = h.bridgeConfig.bridge.bridgedAccessories.find(
            (a) =>
                a.getService(h.hap.Service.AccessoryInformation).getCharacteristic(h.hap.Characteristic.SerialNumber)
                    .value === first,
        );
        assert.ok(acc, 'accessory of the first receiver ' + first);
        const coverings = acc.services.filter((s) => s.UUID === h.hap.Service.WindowCovering.UUID);
        assert.equal(coverings.length, 2, 'first and enabled second receiver');

        await setChar(h, coverings[0], 'TargetPosition', 100);
        await setChar(h, coverings[1], 'TargetPosition', 0);
        const puts = ccu.setCalls.filter((c) => c.method === 'putParamset').map((c) => c.params[0]);
        assert.deepEqual(puts, [first, second]);

        if (type === 'HmIP-FBL') {
            await setChar(h, coverings[0], 'TargetVerticalTiltAngle', 90);
            const last = ccu.setCalls.filter((c) => c.method === 'putParamset').at(-1);
            assert.equal(last.params[0], first, 'tilt goes to the receiver as well');
        }

        h.cleanup();
    });
}
