/* Test harness: fake Node-RED with the bridge and homematic-devices node
   sets loaded, a bridge config node and a homematic-devices node wired to
   a FakeCcu — everything a device module or the generic mapping needs. */

const path = require('node:path');
const {createFakeRED} = require('./fake-red');

const root = path.resolve(__dirname, '..', '..');
let counter = 0;

const tick = () => new Promise((resolve) => setImmediate(resolve));

function createHarness(ccu) {
    counter++;
    const RED = createFakeRED()
        .load(path.join(root, 'nodes/redmatic-homekit-bridge.js'))
        .load(path.join(root, 'nodes/redmatic-homekit-homematic-devices.js'));

    const bridgeConfig = RED.instantiate('redmatic-homekit-bridge', {
        id: 'bridge' + counter,
        name: 'Test Bridge',
        username: 'CC:22:3D:' + String(counter).padStart(2, '0') + ':00:01',
        pincode: '031-45-154',
        port: String(52000 + counter),
    });
    clearTimeout(bridgeConfig.waitForAccessoriesTimer);

    const node = RED.instantiate('redmatic-homekit-homematic-devices', {
        id: 'devices' + counter,
        bridgeConfig: bridgeConfig.id,
        ccuConfig: 'ccu' + counter,
    });
    node.bridgeConfig = bridgeConfig;
    node.ccu = ccu;
    node.devices = {};

    return {
        RED,
        bridgeConfig,
        node,
        hap: bridgeConfig.hap,
        /** create the device the way the node does, wait for init() */
        async create(options = {}) {
            const iface = ccu.enabledIfaces[0];
            const address = ccu.address;
            const created = node.createHomematicDevice({
                name: ccu.channelNames[address],
                iface,
                deviceAddress: iface + '.' + address,
                description: ccu.metadata.devices[iface][address],
                options,
            });
            clearTimeout(bridgeConfig.waitForAccessoriesTimer);
            await tick();
            await tick();
            clearTimeout(bridgeConfig.waitForAccessoriesTimer);
            return created;
        },
        /** {accessoryId: [service names]} of everything on the bridge */
        services() {
            const result = {};
            for (const acc of bridgeConfig.bridge.bridgedAccessories) {
                result[acc.displayName] = acc.services
                    .filter((s) => s.UUID !== bridgeConfig.hap.Service.AccessoryInformation.UUID)
                    .map((s) => s.constructor.name + (s.subtype ? '/' + s.subtype : ''));
            }

            return result;
        },
        cleanup() {
            clearTimeout(bridgeConfig.waitForAccessoriesTimer);
            RED.cleanup();
        },
    };
}

module.exports = {createHarness, tick};
