/* Golden files for the per-type modules of 3.3.0 (ROADMAP task 7 step 3,
   D-4): every device type that has a module in homematic-devices/ is
   instantiated against its fixture and the resulting accessories,
   services and subtypes are compared with test/fixtures/modules.snapshot.json.
   A module may later be replaced by the generic mapping only if the
   snapshot stays identical (or the difference is a deliberate, documented
   change). Refresh with UPDATE_SNAPSHOT=1 after reviewing the diff. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('./helpers/fixtures');
const {createHarness, tick} = require('./helpers/harness');
const catalogue = require('../homematic-devices/lib/catalogue');

test('every device type with a module instantiates against its fixture; snapshot of the services', async () => {
    const snapshotFile = path.join(__dirname, 'fixtures', 'modules.snapshot.json');
    const snapshot = {};
    const errors = {};
    for (const type of fixtures.types()) {
        if (!catalogue.hasModule(type)) {
            continue;
        }

        const ccu = fixtures.ccuFor(type);
        const h = createHarness(ccu);
        try {
            await h.create();
            await tick();
            if (h.node.logged.error.length > 0) {
                errors[type] = h.node.logged.error.map((e) => String(e[0]).split('\n')[0]);
            }

            snapshot[type] = h.services();
        } catch (error) {
            errors[type] = [error.message];
        }

        h.cleanup();
    }

    assert.ok(Object.keys(snapshot).length > 150, 'only ' + Object.keys(snapshot).length + ' module types');
    if (process.env.UPDATE_SNAPSHOT || !fs.existsSync(snapshotFile)) {
        fs.writeFileSync(snapshotFile, JSON.stringify({errors, services: snapshot}, null, 1) + '\n');
    }

    const expected = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    assert.deepEqual(
        {errors, services: snapshot},
        expected,
        'module output changed — review and run with UPDATE_SNAPSHOT=1',
    );
});
