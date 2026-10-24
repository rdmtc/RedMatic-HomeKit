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

/* The HomeKit name field's width and height (#388, the follow-up): the field takes the width
   its column gets from the tray and the height of the dropdowns next to it. Node-RED styles
   .red-ui-editor input[type=text] (34px high, 70% wide), which outranks a bare class selector,
   so the list's rules carry the #devices id; the columns come from a <colgroup> with
   table-layout: fixed, so the name column gets the leftover width and never the row's overflow. */

const style = template.match(/<style>([\s\S]*?)<\/style>/)[1];

function rule(selector) {
    const match = style.match(new RegExp(selector.replace(/[.#]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
    assert.ok(match, 'a rule for ' + selector);
    return match[1];
}

test("the name field is styled with the #devices id, above Node-RED's input[type=text] rule", () => {
    assert.equal(
        style.match(/^\s*input\.homekit-name\s*\{/m),
        null,
        'a bare input.homekit-name rule loses to Node-RED',
    );
    const input = rule('#devices input.homekit-name');
    assert.match(input, /width:\s*100%/);
    assert.match(input, /box-sizing:\s*border-box/);
    assert.match(input, /height:\s*18px/);
    assert.equal(rule('#devices select.small').match(/height:\s*(\d+px)/)[1], '18px', 'as high as the dropdowns');
});

test('the device table has a fixed layout with a column per cell, the HomeKit name column taking the rest', () => {
    assert.match(rule('#devices'), /table-layout:\s*fixed/);
    const cols = template.match(/<col class="([^"]+)">/g).map((col) => col.match(/class="([^"]+)"/)[1]);
    assert.deepEqual(cols, ['col-enabled', 'col-ccu-name', 'col-homekit-name', 'col-address', 'col-type']);
    for (const col of cols.filter((name) => name !== 'col-homekit-name')) {
        assert.match(rule('#devices col.' + col), /width:/, col + ' has a width');
    }
    assert.equal(style.includes('col-homekit-name'), false, 'the name column has no width: it takes the rest');
    // the device row and the channel row have five cells each, the "not ready" message row one
    assert.equal((script.match(/<td/g) || []).length, 11, 'cells in the rows the script renders');
});
