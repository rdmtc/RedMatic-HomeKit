const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {createFakeRED} = require('./helpers/fake-red');
const {FakeCcu} = require('./helpers/fake-ccu');

const root = path.resolve(__dirname, '..');

function load() {
    return createFakeRED()
        .load(path.join(root, 'nodes/redmatic-homekit-bridge.js'))
        .load(path.join(root, 'nodes/redmatic-homekit-homematic-devices.js'));
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('bridge node loads on hap-nodejs 2.x, uses <userDir>/homekit and stable UUIDs', () => {
    const RED = load();
    const bridge = RED.instantiate('redmatic-homekit-bridge', {
        id: 'b1',
        name: 'Test Bridge',
        username: 'CC:22:3D:AA:BB:01',
        pincode: '031-45-154',
        port: '51999',
    });
    clearTimeout(bridge.waitForAccessoriesTimer);

    assert.equal(bridge.logged.error.length, 0);
    assert.ok(bridge.hap.HAPStorage, 'hap handle exposed to other nodes');
    assert.equal(bridge.bridge.UUID, bridge.hap.uuid.generate('CC:22:3D:AA:BB:01'));

    // the storage path is process-wide and set once: <userDir>/homekit (D-4)
    const {HAPStorage} = bridge.hap;
    assert.equal(path.basename(HAPStorage.INSTANCE.customStoragePath), 'homekit');

    const acc = bridge.accessory({id: 'ABC0000001', name: 'Test Switch'});
    clearTimeout(bridge.waitForAccessoriesTimer);
    assert.equal(acc.UUID, bridge.hap.uuid.generate('ABC0000001'));
    assert.equal(bridge.accessory({id: 'ABC0000001', name: 'again'}), acc, 'same id -> same accessory');
    clearTimeout(bridge.waitForAccessoriesTimer);
    assert.equal(bridge.bridge.bridgedAccessories.length, 1);

    RED.cleanup();
});

test('a homematic device module wires services against hap-nodejs 2.x', async () => {
    const RED = load();
    const bridgeConfig = RED.instantiate('redmatic-homekit-bridge', {
        id: 'b2',
        username: 'CC:22:3D:AA:BB:02',
        pincode: '031-45-154',
        port: '51998',
    });
    clearTimeout(bridgeConfig.waitForAccessoriesTimer);

    const ccu = new FakeCcu({
        devices: {
            '000A1B2C3D4E5F': {ADDRESS: '000A1B2C3D4E5F', TYPE: 'HmIP-PSM', FIRMWARE: '2.6.2', CHILDREN: []},
        },
        channelNames: {'000A1B2C3D4E5F': 'Steckdose', '000A1B2C3D4E5F:3': 'Steckdose Kanal'},
        values: {
            'HmIP-RF.000A1B2C3D4E5F:3.STATE': {value: true, stable: true},
            'HmIP-RF.000A1B2C3D4E5F:6.POWER': {value: 12.5, stable: true},
        },
    });

    const node = RED.instantiate('redmatic-homekit-homematic-devices', {id: 'd1', bridgeConfig: 'b2', ccuConfig: 'c1'});
    // the device node returns early without a ccu config node; wire it by hand
    node.bridgeConfig = bridgeConfig;
    node.ccu = ccu;
    node.devices = {};

    const HmipPsm = require(path.join(root, 'homematic-devices/hmip-psm.js'));
    const device = new HmipPsm(
        {
            name: 'Steckdose',
            iface: 'HmIP-RF',
            deviceAddress: 'HmIP-RF.000A1B2C3D4E5F',
            description: ccu.metadata.devices['HmIP-RF']['000A1B2C3D4E5F'],
            options: {},
        },
        node,
    );
    clearTimeout(bridgeConfig.waitForAccessoriesTimer);
    await tick();
    await tick();

    const {hap} = bridgeConfig;
    const outlet = device.acc.getService(hap.Service.Outlet);
    assert.ok(outlet, 'Outlet service added');
    assert.equal(outlet.subtype, '0', 'subtype numbering unchanged (D-4)');
    assert.equal(outlet.getCharacteristic(hap.Characteristic.On).value, true, 'cached STATE applied');
    assert.equal(outlet.getCharacteristic(hap.Characteristic.OutletInUse).value, true, 'POWER > 0 -> in use');

    // HomeKit writes On=false -> STATE false on channel 3
    await new Promise((resolve, reject) => {
        outlet
            .getCharacteristic(hap.Characteristic.On)
            .emit('set', false, (error) => (error ? reject(error) : resolve()));
    });
    assert.deepEqual(ccu.setCalls.at(-1), {
        iface: 'HmIP-RF',
        channel: '000A1B2C3D4E5F:3',
        datapoint: 'STATE',
        value: false,
        burst: false,
        force: false,
    });

    // CCU event -> characteristic update
    ccu.emitValue('HmIP-RF.000A1B2C3D4E5F:3.STATE', false);
    assert.equal(outlet.getCharacteristic(hap.Characteristic.On).value, false);

    assert.equal(node.logged.error.length, 0, JSON.stringify(node.logged.error));
    RED.cleanup();
});

test('hap-nodejs loads through require() and the advertiser deep import still resolves', async () => {
    const hap = require('@homebridge/hap-nodejs');
    assert.equal(typeof hap.Bridge, 'function');
    assert.equal(typeof hap.Service.Lightbulb, 'function');
    assert.equal(typeof hap.Characteristic.On, 'function');
    // nodes/redmatic-homekit-bridge.js resolves the 'auto' advertiser through this path
    const {AvahiAdvertiser} = require('@homebridge/hap-nodejs/dist/lib/Advertiser');
    assert.equal(typeof AvahiAdvertiser.isAvailable, 'function');
});

test('persisted keys of an earlier hap-nodejs (tweetnacl: seed + public key) still sign', () => {
    const {ed25519Sign, ed25519Verify} = require('@homebridge/hap-nodejs/dist/lib/util/hapCrypto');
    // RFC 8032 test vector 1, in the 64-byte form AccessoryInfo.<username>.json holds as signSk
    const seed = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
    const pub = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
    const sk = Buffer.from(seed + pub, 'hex');
    const signature = ed25519Sign(Buffer.alloc(0), sk);
    assert.equal(
        signature.toString('hex'),
        'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
    );
    assert.ok(ed25519Verify(Buffer.alloc(0), signature, Buffer.from(pub, 'hex')));
});
