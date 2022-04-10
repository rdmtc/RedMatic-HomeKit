const fs = require('fs');
const path = require('path');

module.exports = function (RED) {
    const homematicValidDevices = [];
    const devPath = path.join(__dirname, '..', 'homematic-devices');
    fs.readdir(devPath, (error, files) => {
        if (!error && files) {
            for (const file of files) {
                if (file.endsWith('.js')) {
                    homematicValidDevices.push(file.replace('.js', ''));
                }
            }
        }
    });

    RED.httpAdmin.get('/redmatic-homekit/homematic-devices', (_request, response) => {
        response.status(200).send(JSON.stringify(homematicValidDevices));
    });

    class RedMaticHomeKitHomematicDevices {
        constructor(config) {
            RED.nodes.createNode(this, config);

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

            this.homematicDevices = {};
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

            for (const address of Object.keys(this.ccu.channelNames)) {
                if (this.devices[address] && this.devices[address].disabled) {
                    continue;
                }

                if (!/:\d+$/.test(address)) {
                    const iface = this.ccu.findIface(address);
                    if (iface && this.ccu.enabledIfaces.includes(iface) && this.ccu.metadata.devices[iface]) {
                        const options = {};
                        for (const addr of Object.keys(this.devices)) {
                            // eslint-disable-next-line max-depth
                            if (addr === address || addr.startsWith(address + ':')) {
                                options[addr] = this.devices[addr];
                            }
                        }

                        queue.push(() => new Promise(resolve => {
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
                        }));
                    }
                }
            }

            this.log('publish ' + queue.length + ' devices');
            // eslint-disable-next-line unicorn/no-array-reduce
            queue.reduce((p, task) => p.then(task), Promise.resolve()).then(() => {
                callback();
            });
        }

        createHomematicDevice(dev) {
            let type = dev && dev.description && dev.description.TYPE;
            if (!type) {
                this.error('invalid homematic device type ' + type);
                return;
            }

            type = type.toLowerCase().replace(/ /g, '_');
            if (!homematicValidDevices.includes(type)) {
                return;
            }

            if (!this.homematicDevices[type]) {
                try {
                    this.homematicDevices[type] = require('../homematic-devices/' + type);
                    this.debug('loaded homematic-devices/' + type);
                } catch {
                    this.warn('missing homematic-devices/' + type);
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
            for (const s of Object.keys(data.ifaceStatus)) {
                if (data.ifaceStatus[s]) {
                    status += 1;
                }
            }

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
                        // this.bridgeConfig.emit('homematic-ready');
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
