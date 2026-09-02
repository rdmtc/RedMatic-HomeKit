const catalogue = require('../homematic-devices/lib/catalogue');
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
                        const options = {};
                        Object.keys(this.devices).forEach((addr) => {
                            if (addr === address || addr.startsWith(address + ':')) {
                                options[addr] = this.devices[addr];
                            }
                        });

                        queue.push(() => {
                            return new Promise((resolve) => {
                                this.createHomematicDevice({
                                    name: this.ccu.channelNames[address],
                                    iface,
                                    deviceAddress: iface + '.' + address,
                                    description: this.ccu.metadata.devices[iface][address],
                                    options,
                                });
                                setTimeout(() => {
                                    resolve();
                                }, 50);
                            });
                        });
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
                    this.publishDevices(() => {
                        this.log('publish done');
                        this.bridgeConfig.waitForHomematic = false;
                    });
                }
            } else {
                this.status({fill: 'yellow', shape: 'dot', text: 'partly connected'});
            }
        }

        _destructor(done) {
            this.ccu.deregister(this);
            this.ccu.unsubscribe(this.idSubscription);
            done();
        }
    }

    RED.nodes.registerType('redmatic-homekit-homematic-devices', RedMaticHomeKitHomematicDevices);
};
