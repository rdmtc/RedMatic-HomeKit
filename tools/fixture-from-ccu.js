#!/usr/bin/env node
/* Generates test/fixtures/devices/<TYPE>.json from the cache files a
   node-red-contrib-ccu `ccu-connection` node writes into the Node-RED user
   directory — i.e. from a real CCU, for device types the pydevccu catalogue
   does not have or has in an older firmware version.

   usage: node tools/fixture-from-ccu.js <ccu_<host>.json> <paramsets.json> <TYPE|ADDRESS>... [--force]

   On a RedMatic box the files are /usr/local/addons/redmatic/var/ccu_127.0.0.1.json
   and /usr/local/addons/redmatic/var/paramsets.json. Existing fixtures are
   kept unless --force is given. Same output shape as fixtures-from-pydevccu.js. */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const force = args.includes('--force');
const [metaFile, paramsetsFile, ...wanted] = args.filter((a) => a !== '--force');
if (!metaFile || !paramsetsFile || wanted.length === 0) {
    console.error('usage: fixture-from-ccu.js <ccu_<host>.json> <paramsets.json> <TYPE|ADDRESS>... [--force]');
    process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
const paramsets = JSON.parse(fs.readFileSync(paramsetsFile, 'utf8'));
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

/** ccu-connection's cache key: <iface>/<TYPE>/<FIRMWARE>/<VERSION>/<channelTYPE>/<paramset> */
function paramsetKey(iface, device, channel, paramset) {
    return [iface, device.TYPE, device.FIRMWARE, device.VERSION, channel ? channel.TYPE : '', paramset].join('/');
}

let count = 0;
for (const [iface, devices] of Object.entries(meta.devices || {})) {
    for (const device of Object.values(devices)) {
        if (device.PARENT) {
            continue;
        }

        const match = wanted.some((w) => w === device.ADDRESS || w.toLowerCase() === String(device.TYPE).toLowerCase());
        if (!match) {
            continue;
        }

        const file = path.join(out, device.TYPE.replace(/[^\w.-]/g, '_') + '.json');
        if (fs.existsSync(file) && !force) {
            console.log('skip', device.TYPE, '(fixture exists, use --force)');
            continue;
        }

        const fixture = {source: 'ccu/' + iface + '/' + device.TYPE + '/' + device.FIRMWARE, device: [], values: {}};
        const all = [device, ...(device.CHILDREN || []).map((a) => devices[a]).filter(Boolean)];
        for (const d of all) {
            const desc = {};
            for (const key of KEEP) {
                if (d[key] !== undefined) {
                    desc[key] = d[key];
                }
            }

            fixture.device.push(desc);
            const values = paramsets[paramsetKey(iface, device, d.PARENT ? d : null, 'VALUES')];
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

        fs.writeFileSync(file, JSON.stringify(fixture) + '\n');
        console.log('wrote', path.relative(process.cwd(), file), '(' + fixture.device.length + ' descriptions)');
        count++;
    }
}

if (count === 0) {
    console.error('no matching device in', metaFile);
    process.exit(1);
}
