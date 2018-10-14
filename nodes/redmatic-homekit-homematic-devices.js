module.exports = function (RED) {
    class RedMaticHomeKitHomematicDevices {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.bridgeConfig = RED.nodes.getNode(config.bridgeConfig);

            if (!this.bridgeConfig) {
                return;
            }

            this.ccu = RED.nodes.getNode(config.ccuConfig);

            if (!this.ccu) {
                return;
            }

            this.bridgeConfig.waitForHomematic = true;
            this.ccu.register(this);

            this.homematicDevices = {};
            this.homematicInvalidDevices = [];
        }

        publishDevices() {
            Object.keys(this.ccu.channelNames).forEach(address => {
                if (!address.match(/:\d+$/)) {
                    const iface = this.ccu.findIface(address);
                    if (iface && this.ccu.metadata.devices && this.ccu.metadata.devices[iface]) {
                        this.createHomematicDevice({
                            name: this.ccu.channelNames[address],
                            iface: this.ccu.findIface(address),
                            description: this.ccu.metadata.devices[iface][address]
                        });
                    }
                }
            });
        }

        createHomematicDevice(dev) {
            let type = dev && dev.description && dev.description.TYPE;
            if (!type) {
                this.error('invalid homematic device type ' + type);
                return;
            }
            type = type.toLowerCase();
            if (this.homematicInvalidDevices.includes(type)) {
                return;
            }
            if (!this.homematicDevices[type]) {
                try {
                    this.homematicDevices[type] = require('../homematic-devices/' + type);
                    this.debug('loaded homematic-devices/' + type);
                } catch (error) {
                    this.warn('missing homematic-devices/' + type);
                    this.homematicInvalidDevices.push(type);
                    return;
                }
            }
            if (this.homematicDevices[type] && typeof this.homematicDevices[type] === 'function') {
                return new this.homematicDevices[type](dev, this);
            }
            this.error('invalid homematic-devices/' + type);
            this.homematicInvalidDevices.push(type);
        }

        setStatus(data) {
            this.ccuStatus = data;
            let status = 0;
            Object.keys(data.ifaceStatus).forEach(s => {
                if (data.ifaceStatus[s] || s === 'ReGaHSS') {
                    status += 1;
                }
            });
            if (status <= 1) {
                this.status({fill: 'red', shape: 'dot', text: 'disconnected'});
            } else if (status === Object.keys(data.ifaceStatus).length) {
                this.status({fill: 'green', shape: 'dot', text: 'connected'});
                if (!this.ccuConnected) {
                    this.publishDevices();
                    this.bridgeConfig.waitForHomematic = false;
                    this.bridgeConfig.emit('homematic-ready');
                }
                this.ccuConnected = true;
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
