const catalogue = require('../homematic-devices/lib/catalogue');
const roles = require('../homematic-devices/lib/roles');
const {GenericDevice} = require('../homematic-devices/lib/generic');

module.exports = function (RED) {
    RED.httpAdmin.get('/redmatic-homekit/homematic-devices', RED.auth.needsPermission('redmatic.read'), (req, res) => {
        if (req.query.config && req.query.config !== '_ADD_') {
            // editor: what to offer for every supported device of a ccu-connection node
            const ccu = RED.nodes.getNode(req.query.config);
            if (!ccu || !ccu.metadata) {
                res.status(500).send(JSON.stringify({error: 'ccu-connection node not found or not ready'}));
                return;
            }

            res.status(200).send(JSON.stringify(catalogue.describeDevices(ccu)));
            return;
        }

        // list of supported device types (module names), kept for compatibility
        res.status(200).send(JSON.stringify([...catalogue.supportedTypes()]));
    });

    class RedMaticHomeKitHomematicDevices {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.homematicDevices = {};
            this.bridgeConfig = RED.nodes.getNode(config.bridgeConfig);

            if (!this.bridgeConfig) {
                return;
            }

            this.ccu = RED.nodes.getNode(config.ccuConfig);
            this.devices = config.devices;

            if (!this.ccu) {
                return;
            }

            this.bridgeConfig.waitForHomematic = true;
            this.ccu.register(this);
        }

        publishDevices(callback) {
            if (!this.ccu.channelNames) {
                this.error('ccu.channelNames missing');
                return;
            }

            if (Object.keys(this.ccu.channelNames).length === 0) {
                this.error('ccu.channelNames empty');
                return;
            }

            if (!this.ccu.metadata.devices) {
                this.error('ccu.metadata.devices missing');
                return;
            }

            if (!this.devices) {
                this.devices = {};
            }

            const queue = [];

            Object.keys(this.ccu.channelNames).forEach((address) => {
                if (this.devices[address] && this.devices[address].disabled) {
                    return;
                }

                if (!address.match(/:\d+$/)) {
                    const iface = this.ccu.findIface(address);
                    if (iface && this.ccu.enabledIfaces.includes(iface) && this.ccu.metadata.devices[iface]) {
                        // the CCU's virtual remote and the like are opt-in (see generic.isOptIn)
                        if (
                            catalogue.isOptIn(this.ccu.metadata.devices[iface][address]) &&
                            !(this.devices[address] && this.devices[address].enabled)
                        ) {
                            return;
                        }

                        const options = {};
                        Object.keys(this.devices).forEach((addr) => {
                            if (addr === address || addr.startsWith(address + ':')) {
                                options[addr] = this.devices[addr];
                            }
                        });

                        const description = this.ccu.metadata.devices[iface][address];
                        queue.push(() =>
                            this.channelModes(iface, description).then(
                                (channelModes) =>
                                    new Promise((resolve) => {
                                        this.createHomematicDevice({
                                            name: this.ccu.channelNames[address],
                                            iface,
                                            deviceAddress: iface + '.' + address,
                                            description,
                                            options,
                                            channelModes,
                                        });
                                        setTimeout(() => {
                                            resolve();
                                        }, 50);
                                    }),
                            ),
                        );
                    }
                }
            });
            this.log('publish ' + queue.length + ' devices');
            queue
                .reduce((p, task) => p.then(task), Promise.resolve())
                .then(() => {
                    callback();
                });
        }

        /**
         * CHANNEL_OPERATION_MODE of every HmIP multi-mode input channel of a
         * device (HmIPW-DRI16/DRI32/FIO6, HmIP-FCI1/FCI6/DSD-PCB, …), read from
         * the channel's MASTER paramset: KEY_BEHAVIOR (factory default) sends
         * key presses only, SWITCH_/BINARY_BEHAVIOR a contact STATE. Resolves to
         * {} for devices without such channels or when the CCU does not answer;
         * answers are cached for the lifetime of the node.
         * @returns {Promise<Object<string, string>>} address → mode name
         */
        channelModes(iface, device) {
            const devices = (this.ccu.metadata && this.ccu.metadata.devices[iface]) || {};
            const inputs = (device.CHILDREN || [])
                .map((address) => devices[address])
                .filter((channel) => channel && /_INPUT_TRANSMITTER$/.test(channel.TYPE));
            if (inputs.length === 0 || typeof this.ccu.methodCall !== 'function') {
                return Promise.resolve({});
            }

            this.modeCache = this.modeCache || {};
            const modes = {};
            const lookups = inputs.map((channel) => {
                if (this.modeCache[channel.ADDRESS]) {
                    modes[channel.ADDRESS] = this.modeCache[channel.ADDRESS];
                    return Promise.resolve();
                }

                const timeout = new Promise((resolve) => setTimeout(resolve, 3000, null));
                return Promise.race([this.ccu.methodCall(iface, 'getParamset', [channel.ADDRESS, 'MASTER']), timeout])
                    .then((master) => {
                        const raw = master && master.CHANNEL_OPERATION_MODE;
                        if (raw === undefined || raw === null) {
                            return;
                        }

                        const description = this.ccu.getParamsetDescription(
                            iface,
                            channel,
                            'MASTER',
                            'CHANNEL_OPERATION_MODE',
                        );
                        const list = (description && description.VALUE_LIST) || roles.INPUT_MODES;
                        const mode = typeof raw === 'number' ? list[raw] : String(raw);
                        if (mode) {
                            modes[channel.ADDRESS] = mode;
                            this.modeCache[channel.ADDRESS] = mode;
                        }
                    })
                    .catch((error) => {
                        this.debug('getParamset MASTER ' + channel.ADDRESS + ' failed: ' + error.message);
                    });
            });

            return Promise.all(lookups).then(() => {
                if (Object.keys(modes).length > 0) {
                    this.debug('input modes ' + device.ADDRESS + ' ' + JSON.stringify(modes));
                }

                return modes;
            });
        }

        createHomematicDevice(dev) {
            const rawType = dev && dev.description && dev.description.TYPE;
            if (!rawType) {
                this.error('invalid homematic device type ' + rawType);
                return;
            }

            const type = catalogue.moduleName(rawType);
            if (!catalogue.hasModule(rawType)) {
                // no per-type module: map the device from its channel roles
                try {
                    const generic = new GenericDevice(dev, this);
                    if (generic.plan.supported) {
                        this.debug('generic mapping for ' + rawType + ' ' + dev.name);
                    }

                    return generic;
                } catch (error) {
                    this.error('generic mapping failed for ' + dev.name + ' ' + rawType);
                    this.error(error.stack);
                    return;
                }
            }

            if (!this.homematicDevices[type]) {
                try {
                    this.homematicDevices[type] = require('../homematic-devices/' + type);
                    this.debug('loaded homematic-devices/' + type);
                } catch (error) {
                    this.warn('missing homematic-devices/' + type + ': ' + error.message);
                    return;
                }
            }

            if (this.homematicDevices[type] && typeof this.homematicDevices[type] === 'function') {
                try {
                    return new this.homematicDevices[type](dev, this);
                } catch (error) {
                    this.error('createHomematicDevice Exception ' + dev.name + ' ' + type);
                    this.error(error.stack);
                    return;
                }
            }

            this.error('invalid homematic-devices/' + type);
        }

        setStatus(data) {
            this.ccuStatus = data;
            let status = 0;
            Object.keys(data.ifaceStatus).forEach((s) => {
                if (data.ifaceStatus[s]) {
                    status += 1;
                }
            });
            this.debug(JSON.stringify(data));
            if (status < 1) {
                this.status({fill: 'red', shape: 'dot', text: 'disconnected'});
            } else if (status === this.ccu.enabledIfaces.length) {
                this.status({fill: 'green', shape: 'dot', text: 'connected'});
                if (!this.ccuConnected) {
                    this.ccuConnected = true;
                    this.publishWhenReady();
                }
            } else {
                this.status({fill: 'yellow', shape: 'dot', text: 'partly connected'});
            }
        }

        /**
         * ccu-connection marks an interface as connected at the CCU's first
         * callback (`system.listMethods`); the device list follows a moment
         * later through `listDevices`/`newDevices`, and an interface without
         * devices (VirtualDevices without groups) pushes nothing at all. On a
         * first deploy (no cached metadata yet) publishing right away found 0
         * devices and needed a restart. Wait until devices and channel names
         * exist and have not changed for a few polls, then publish; give up
         * after the limit and publish whatever is there.
         */
        publishWhenReady(attempt = 0, seen = null, stableFor = 0) {
            const devices = (this.ccu.metadata && this.ccu.metadata.devices) || {};
            const count = this.ccu.enabledIfaces.reduce((n, iface) => n + Object.keys(devices[iface] || {}).length, 0);
            const names = Object.keys(this.ccu.channelNames || {}).length;
            const key = count + '/' + names;
            stableFor = count > 0 && names > 0 && key === seen ? stableFor + 1 : 0;
            if (stableFor < this.readyStable && attempt < this.readyAttempts) {
                if (attempt === 0) {
                    this.log('waiting for the ccu device list (' + key + ' devices/names)');
                    this.status({fill: 'yellow', shape: 'ring', text: 'waiting for devices'});
                }

                this.readyTimer = setTimeout(
                    () => this.publishWhenReady(attempt + 1, key, stableFor),
                    this.readyInterval,
                );
                return;
            }

            this.status({fill: 'green', shape: 'dot', text: 'connected'});
            this.publishDevices(() => {
                this.log('publish done');
                this.bridgeConfig.waitForHomematic = false;
            });
        }

        /** poll interval, number of unchanged polls required, and the give-up limit (tests shorten them) */
        get readyInterval() {
            return this._readyInterval || 1000;
        }

        set readyInterval(ms) {
            this._readyInterval = ms;
        }

        get readyStable() {
            return this._readyStable || 3;
        }

        set readyStable(n) {
            this._readyStable = n;
        }

        get readyAttempts() {
            return this._readyAttempts || 60;
        }

        set readyAttempts(n) {
            this._readyAttempts = n;
        }

        _destructor(done) {
            clearTimeout(this.readyTimer);
            this.ccu.deregister(this);
            this.ccu.unsubscribe(this.idSubscription);
            done();
        }
    }

    RED.nodes.registerType('redmatic-homekit-homematic-devices', RedMaticHomeKitHomematicDevices);
};
