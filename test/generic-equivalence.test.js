/* Which per-type modules the generic mapping can replace with no change for
   users (ROADMAP task 18, D-4/D-5). Every device type that has a module in
   homematic-devices/ and a fixture is built through its module and through
   the generic mapping, in every option combination a stored config may hold,
   and the two fingerprints (accessories, services, subtypes, characteristics
   and props, subscriptions, values, writes, editor rows) are compared — see
   test/helpers/equivalence.js. The verdict per type is recorded in
   test/fixtures/generic-equivalence.json:

     replaceable      identical in every scenario (a delegate means the generic
                      mapping hands the device to that module, so the module
                      file stays and only the alias is redundant)
     replaceable, editor additions
                      identical at runtime and for every stored config; the
                      editor offers more (an opt-in row, an option)
     not replaceable  `classes` lists what differs, `first` the first difference;
                      `residual` is what remains once the service subtype and
                      name scheme and the editor additions are set aside,
                      `firstResidual` the first of those
     not proven       no fixture for the type

   The record is a snapshot: a module that was replaceable must stay so, and
   any change to the record (a mapping change, a fixture change, a module
   fix) is reviewed and refreshed with UPDATE_SNAPSHOT=1. The modules without
   a fixture are listed in the record as well. EQUIVALENCE_REPORT=<file>
   writes every difference of every scenario for a review. */

const {test, mock} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const equivalence = require('./helpers/equivalence');

test('generic mapping vs per-type modules: equivalence record', async () => {
    const snapshotFile = path.join(__dirname, 'fixtures', 'generic-equivalence.json');
    const {withFixture, without} = equivalence.universe();
    const report = process.env.EQUIVALENCE_REPORT;
    const record = {};
    const details = {};

    mock.timers.enable({apis: ['setTimeout']});
    try {
        for (const type of withFixture) {
            const result = await equivalence.compareType(type, {allDiffs: Boolean(report)});
            const {diffs, ...rest} = result;
            record[type] = rest;
            if (report) {
                details[type] = diffs;
            }
        }
    } finally {
        mock.timers.reset();
    }

    for (const module of without) {
        record['module:' + module] = {
            module,
            target: equivalence.aliasTarget(module),
            verdict: 'not proven',
            reason: 'no fixture',
        };
    }

    // JSON round trip: the record is compared with its file (no undefined values)
    const sorted = JSON.parse(
        JSON.stringify(
            Object.fromEntries(
                Object.keys(record)
                    .sort()
                    .map((k) => [k, record[k]]),
            ),
        ),
    );
    if (report) {
        fs.writeFileSync(report, JSON.stringify({record: sorted, details}, null, 1) + '\n');
    }

    assert.ok(withFixture.length > 150, 'only ' + withFixture.length + ' module types with a fixture');
    if (process.env.UPDATE_SNAPSHOT || !fs.existsSync(snapshotFile)) {
        fs.writeFileSync(snapshotFile, JSON.stringify(sorted, null, 1) + '\n');
    }

    const expected = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    for (const [type, entry] of Object.entries(expected)) {
        if (entry.verdict.startsWith('replaceable')) {
            assert.ok(sorted[type], type + ' vanished from the comparison');
            assert.ok(
                sorted[type].verdict.startsWith('replaceable'),
                type +
                    ' was replaceable by the generic mapping and is not any more: ' +
                    JSON.stringify(sorted[type].first),
            );
        }
    }

    assert.deepEqual(sorted, expected, 'equivalence record changed — review and run with UPDATE_SNAPSHOT=1');
});
