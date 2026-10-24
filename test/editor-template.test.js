/* The device editor's template and script (nodes/redmatic-homekit-homematic-devices.html)
   against the Node-RED edit form. Node-RED renders the template inside
   <form id="dialog-form">, where a <button> without a type is a submit button and
   Enter in a text field "clicks" the form's first one: in 4.1.0 that was
   "disable all", so typing a HomeKit name and pressing Enter unchecked every
   device (#388). These checks are static - the editor runs in a browser - and
   guard what the real-browser check of 4.1.1 verified. */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'nodes', 'redmatic-homekit-homematic-devices.html'), 'utf8');
const script = html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)[1];
const template = html.match(
    /<script type="text\/x-red" data-template-name="redmatic-homekit-homematic-devices">([\s\S]*?)<\/script>/,
)[1];

test('no button in the edit template is a submit button (#388)', () => {
    const buttons = template.match(/<button\b[^>]*>/g) || [];
    assert.ok(buttons.length >= 2, 'the disable all / enable all buttons are there');
    for (const button of buttons) {
        assert.match(button, /\stype="button"/, button);
    }
});

test('Enter in a HomeKit name field is swallowed (#388)', () => {
    const handler = script.match(/\$\('\.homekit-name'\)\.on\('keydown'[\s\S]*?\}\);/);
    assert.ok(handler, 'a keydown handler on the name fields');
    assert.match(handler[0], /event\.key === 'Enter'/);
    assert.match(handler[0], /preventDefault\(\)/);
});

test('only the checkbox of a channel row takes the checked and disabled state, not the name field', () => {
    assert.equal(
        (script.match(/\$row\.find\('input'\)/g) || []).length,
        0,
        "find('input') would hit the name input too",
    );
    assert.ok((script.match(/\$row\.find\('input\[type="checkbox"\]'\)/g) || []).length >= 2);
});

test('attribute values are escaped including quotes (a CCU name may carry them)', () => {
    const escape = script.match(/function escape\(text\) \{([\s\S]*?)\n\s*\}/)[1];
    assert.match(escape, /&quot;/);
});
