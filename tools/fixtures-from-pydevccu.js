#!/usr/bin/env node
/* Generates test/fixtures/devices/<TYPE>.json from a pydevccu checkout
   (https://github.com/danielperna84/pydevccu, MIT): one compact file per
   device type with the device/channel descriptions (the fields the mapping
   uses) and the VALUES paramset description of every channel.

   usage: node tools/fixtures-from-pydevccu.js <path-to-pydevccu/pydevccu> */

const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) {
    console.error('usage: fixtures-from-pydevccu.js <pydevccu/pydevccu dir>');
    process.exit(1);
}

const out = path.join(__dirname, '..', 'test', 'fixtures', 'devices');
fs.mkdirSync(out, {recursive: true});

const KEEP = [
    'TYPE',
    'SUBTYPE',
    'ADDRESS',
    'CHILDREN',
    'PARENT',
    'PARENT_TYPE',
    'INDEX',
    'PARAMSETS',
    'FIRMWARE',
    'VERSION',
    'DIRECTION',
];
const KEEP_PARAM = ['TYPE', 'OPERATIONS', 'FLAGS', 'MIN', 'MAX', 'DEFAULT', 'UNIT', 'CONTROL', 'VALUE_LIST', 'ID'];

let count = 0;
for (const file of fs.readdirSync(path.join(src, 'device_descriptions'))) {
    if (!file.endsWith('.json') || /^\d/.test(file)) {
        continue; // numeric files are the pydevccu simulator's own fakes
    }

    const devices = JSON.parse(fs.readFileSync(path.join(src, 'device_descriptions', file), 'utf8'));
    let paramsets = {};
    try {
        paramsets = JSON.parse(fs.readFileSync(path.join(src, 'paramset_descriptions', file), 'utf8'));
    } catch {
        // some types have no paramset dump
    }

    const fixture = {source: 'pydevccu/' + file, device: [], values: {}};
    for (const d of devices) {
        const desc = {};
        for (const key of KEEP) {
            if (d[key] !== undefined) {
                desc[key] = d[key];
            }
        }

        fixture.device.push(desc);
        const values = paramsets[d.ADDRESS] && paramsets[d.ADDRESS].VALUES;
        if (values && Object.keys(values).length > 0) {
            fixture.values[d.ADDRESS] = {};
            for (const [id, p] of Object.entries(values)) {
                const param = {};
                for (const key of KEEP_PARAM) {
                    if (p[key] !== undefined) {
                        param[key] = p[key];
                    }
                }

                fixture.values[d.ADDRESS][id] = param;
            }
        }
    }

    const type = devices[0].TYPE;
    fs.writeFileSync(path.join(out, type.replace(/[^\w.-]/g, '_') + '.json'), JSON.stringify(fixture) + '\n');
    count++;
}

console.log('wrote', count, 'fixtures to', path.relative(process.cwd(), out));
