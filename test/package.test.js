const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function registeredTypes(source) {
    return [...source.matchAll(/registerType\(\s*'([^']+)'/g)].map((m) => m[1]).sort();
}

test('every node set has a runtime and an editor file registering the same types', () => {
    for (const [set, file] of Object.entries(pkg['node-red'].nodes)) {
        const js = path.join(root, file);
        const html = js.replace(/\.js$/, '.html');
        assert.ok(fs.existsSync(js), `${set}: ${file} missing`);
        assert.ok(fs.existsSync(html), `${set}: ${path.relative(root, html)} missing`);
        const mod = require(js);
        assert.equal(typeof mod, 'function', `${set}: module must export function (RED)`);
        const jsTypes = registeredTypes(fs.readFileSync(js, 'utf8'));
        const htmlTypes = registeredTypes(fs.readFileSync(html, 'utf8'));
        assert.ok(jsTypes.length > 0, `${set}: no registerType in ${file}`);
        assert.deepEqual(jsTypes, htmlTypes, `${set}: runtime and editor register different types`);
    }
});

test('every homematic device module loads and is a class or alias', () => {
    const dir = path.join(root, 'homematic-devices');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
    assert.ok(files.length > 100);
    for (const file of files) {
        const mod = require(path.join(dir, file));
        assert.equal(typeof mod, 'function', `${file}: must export a class`);
    }
});
