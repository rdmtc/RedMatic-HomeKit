/* Stand-in for the node-red-contrib-ccu `ccu-connection` config node,
   limited to the surface redmatic-homekit uses (see AGENTS.md). Records
   subscriptions and set calls so tests can assert what a device mapping
   wired up. */

class FakeCcu {
    constructor({iface = 'HmIP-RF', devices = {}, channelNames = {}, values = {}, paramsets = {}} = {}) {
        this.enabledIfaces = [iface];
        this.ifaceStatus = {[iface]: true};
        this.metadata = {devices: {[iface]: devices}};
        this.channelNames = channelNames;
        this.values = values;
        // VALUES paramset descriptions keyed by channel address (fixtures)
        this.paramsets = paramsets;
        this.paramsetDescriptions = {};
        this.subscriptions = [];
        this.setCalls = [];
        this.users = {};
        this.nextId = 1;
    }

    register(node) {
        this.users[node.id] = node;
    }

    deregister(node) {
        delete this.users[node.id];
    }

    findIface(address) {
        for (const [iface, devices] of Object.entries(this.metadata.devices)) {
            if (devices[address]) {
                return iface;
            }
        }

        return null;
    }

    subscribe(filter, callback) {
        const id = this.nextId++;
        this.subscriptions.push({id, filter, callback});
        // deliver the cached value like ccu-connection does with cache: true
        const cached = filter.datapointName && this.values[filter.datapointName];
        if (filter.cache && cached !== undefined) {
            const msg = {datapointName: filter.datapointName, ...cached};
            setImmediate(() => callback(msg));
        }

        return id;
    }

    unsubscribe(id) {
        this.subscriptions = this.subscriptions.filter((s) => s.id !== id);
    }

    /** simulate an event from the CCU */
    emitValue(datapointName, value) {
        this.values[datapointName] = {value, stable: true};
        for (const s of this.subscriptions) {
            if (s.filter.datapointName === datapointName) {
                s.callback({datapointName, value, stable: true});
            }
        }
    }

    setValueQueued(iface, channel, datapoint, value, burst, force) {
        this.setCalls.push({iface, channel, datapoint, value, burst, force});
        return Promise.resolve();
    }

    setValue(iface, channel, datapoint, value) {
        return this.setValueQueued(iface, channel, datapoint, value);
    }

    /** ccu-connection's cache key format: <iface>/<TYPE>/<FIRMWARE>/<VERSION>/<channelTYPE>/<paramset> */
    paramsetName(iface, device, paramset) {
        let cType = '';
        let d = device;
        if (device.PARENT) {
            cType = device.TYPE;
            d = this.metadata.devices[iface][device.PARENT];
        }

        return [iface, d.TYPE, d.FIRMWARE, d.VERSION, cType, paramset].join('/');
    }

    /** like ccu-connection: returns the cached description or undefined */
    getParamsetDescription(iface, device, paramset, parameter) {
        const description = paramset === 'VALUES' ? this.paramsets[device.ADDRESS] : undefined;
        if (!description) {
            return undefined;
        }

        return parameter ? description[parameter] : description;
    }

    /** direct links of a channel (sync in ccu-connection) */
    getLinks(iface, address, _receiver) {
        return (this.links && this.links[address]) || [];
    }

    methodCall(iface, method, params) {
        this.setCalls.push({iface, method, params});
        return Promise.resolve();
    }

    /** the handles ccu-connection keeps for the admin device list */
    get devices() {
        return this.metadata.devices;
    }
}

module.exports = {FakeCcu};
