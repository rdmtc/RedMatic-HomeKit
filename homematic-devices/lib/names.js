/* HomeKit name per device and channel (#388).

   The homematic-devices node stores an optional `name` next to the other
   per-address settings (`devices[address].name`). It replaces the CCU's
   device or channel name wherever the accessory and service names are
   read — the node's own lookup, every device module and the generic
   mapping all read `node.ccu.channelNames[address]` — so the node hands
   them a view of its ccu-connection whose `channelNames` answer the
   override first. Empty (or only blanks) means the CCU name. The CCU name
   itself is never changed, and neither is any identity: accessory UUIDs
   and service subtypes come from addresses and channel indexes (D-4). */

/** hap-nodejs' check (lib/util/checkName.js): first and last character a letter or digit */
const HOMEKIT_NAME = /^[\p{L}\p{N}][\p{L}\p{N}\p{Zs}’'&!._:;()/,-]*[\p{L}\p{N}]$/u;

/**
 * The HomeKit name stored for an address, or undefined.
 * @param {object} devices  the node's per-address config
 * @param {string} address
 */
function override(devices, address) {
    const entry = devices && Object.prototype.hasOwnProperty.call(devices, address) && devices[address];
    const name = entry && typeof entry.name === 'string' ? entry.name.trim() : '';
    return name || undefined;
}

/** whether hap-nodejs accepts a name without its "invalid 'Name' characteristic" warning */
function isValidHomeKitName(name) {
    return typeof name === 'string' && HOMEKIT_NAME.test(name);
}

/**
 * A view of a ccu-connection node whose `channelNames` answer the HomeKit
 * name override first. Everything else is the ccu-connection itself: its
 * methods run bound to the real node, so it never sees the overrides, and
 * its `channelNames` object (replaced when the CCU's names are re-read) is
 * looked up on every access.
 * @param {object} ccu  ccu-connection node
 * @param {function(): object} getDevices  returns the node's per-address config
 */
function withNameOverrides(ccu, getDevices) {
    let names;
    let view;
    const bound = new Map();

    const namesView = (target) => {
        if (target !== names) {
            names = target;
            view = new Proxy(target, {
                get(object, key) {
                    if (typeof key === 'string') {
                        // some modules look a channel up as `<iface>.<address>` (no CCU name
                        // there); the override is found either way
                        const name = override(getDevices(), key.slice(key.indexOf('.') + 1));
                        if (name) {
                            return name;
                        }
                    }

                    return object[key];
                },
            });
        }

        return view;
    };

    return new Proxy(ccu, {
        get(target, key) {
            if (key === 'channelNames') {
                return target.channelNames ? namesView(target.channelNames) : target.channelNames;
            }

            const value = target[key];
            if (typeof value !== 'function') {
                return value;
            }

            let fn = bound.get(key);
            if (!fn || fn.original !== value) {
                fn = value.bind(target);
                fn.original = value;
                bound.set(key, fn);
            }

            return fn;
        },
    });
}

module.exports = {override, isValidHomeKitName, withNameOverrides, HOMEKIT_NAME};
