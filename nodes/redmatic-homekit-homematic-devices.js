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
            const type = dev && dev.description && dev.description.TYPE;
            if (!type || this.homematicInvalidDevices.includes(type)) {
                return;
            }
            if (!this.homematicDevices[type]) {
                try {
                    this.homematicDevices[type] = require('../homematic-devices/' + type);
                } catch (error) {
                    // This.warn('missing homematic-devices/' + type);
                    this.homematicInvalidDevices.push(type);
                    return;
                }
            }
            if (this.homematicDevices[type] && typeof this.homematicDevices[type] === 'function') {
                return new this.homematicDevices[type](dev, this);
            }
            // This.error('invalid homematic-devices/' + type);
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
        /*

            This.hap = new Hap(RED.log, config);

            this.hap.on('cmd', msg => {
                switch (msg.type) {
                    case 'hm':
                        switch (msg.method) {
                            case 'setValue':
                                this.ccu.setValue(msg.iface, msg.address, msg.datapoint, msg.value);
                                break;
                            case 'programExecute':
                                this.ccu.programExecute(msg.name);
                                break;
                            case 'setVariable':
                                this.ccu.setVariable(msg.name, msg.value);
                                break;
                            default:

                        }
                        break;
                    default:
                }
            });

            if (this.connected) {
                this.publish();
            }

            this.on('close', done => {
                this._destructor(done);
            });

            */
    }

    /*

        Publish() {

            const devices = {};
            Object.keys(this.ccu.channelNames).forEach(address => {
                if (!address.match(/:[0-9]+$/)) {
                    const iface = this.ccu.findIface(address);
                    if (iface && this.ccu.metadata.devices && this.ccu.metadata.devices[iface]) {
                        devices[address] = {
                            name: this.ccu.channelNames[address],
                            type: 'homematic-device',
                            description: this.ccu.metadata.devices[iface][address]
                        };
                    }
                }
            });
            this.hap.publish(devices);

            RED.log.info('[homekit] subscribe homematic events');
            this.idSubscription = this.ccu.subscribe({cache: false, change: true}, msg => {
                RED.log.trace('[homekit] hm  < ' + msg.datapointName + ' ' + msg.value);
                this.hap.emit('event', msg);
            });

            this.idSysvarSubscription = this.ccu.subscribeSysvar({cache: true}, msg => {
            });

            this.idProgramSubscription = this.ccu.subscribeProgram({cache: true}, msg => {
            });

            // Todo? Bug in node-red-contrib-ccu? filter cache:true doesnt work, so workaround this here:
            setTimeout(() => {
                if (this.ccu.values) {
                    Object.keys(this.ccu.values).forEach(address => {
                        this.hap.emit('event', this.ccu.values[address]);
                    });
                }
            }, 5000);

            this.hap.on('setValue', msg => {
                this.ccu.setValue(this.ccu.findIface(msg.address), msg.address, msg.datapoint, msg.value);
            });

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
                if (!this.connected) {
                    this.publish();
                }
                this.connected = true;
            } else {
                this.status({fill: 'yellow', shape: 'dot', text: 'partly connected'});
            }

        }

        addAccessory(acc) {
            console.log('addAccessory', acc);
        }

        _destructor(done) {
            RED.log.info('[homekit] exiting');
            this.hap.unpublish();
            this.ccu.deregister(this);
            this.ccu.unsubscribe(this.idSubscription);
            this.ccu.unsubscribeSysvar(this.idSysvarSubscription);
            this.ccu.unsubscribeProgram(this.idProgramSubscription);
            done();
        }

        */

    RED.nodes.registerType('redmatic-homekit-homematic-devices', RedMaticHomeKitHomematicDevices);
};
