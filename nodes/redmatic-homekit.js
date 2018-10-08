const Hap = require('../hap');

module.exports = function (RED) {
    class RedMaticHomeKit {
        constructor(config) {
            RED.nodes.createNode(this, config);


            this.ccu = RED.nodes.getNode(config.ccuConfig);

            if (!this.ccu) {
                return;
            }

            this.ccu.register(this);

            RED.log.info('[homekit] starting HAP-Nodejs');

            this.hap = new Hap(RED.log, config);



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



            this.on('close', done => { this._destructor(done); });

            if (this.connected) {
                this.publish();
            }

        }

        publish() {

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

        _destructor(done) {
            RED.log.info('[homekit] exiting');
            this.hap.unpublish();
            this.ccu.deregister(this);
            this.ccu.unsubscribe(this.idSubscription);
            this.ccu.unsubscribeSysvar(this.idSysvarSubscription);
            this.ccu.unsubscribeProgram(this.idProgramSubscription);
            done();
        }
    }

    RED.nodes.registerType('redmatic-homekit', RedMaticHomeKit);
};
