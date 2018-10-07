const Hap = require('../hap');

module.exports = function (RED) {
    class RedMaticHomeKit {
        constructor(config) {
            RED.nodes.createNode(this, config);


            this.ccu = RED.nodes.getNode(config.ccuConfig);

            if (!this.ccu) {
                return;
            }

            RED.log.info('starting HAP-Nodejs');

            this.hap = new Hap(RED.log, config);

            this.idSubscription = this.ccu.subscribe({}, msg => {
            });

            this.idSysvarSubscription = this.ccu.subscribeSysvar({}, msg => {
            });

            this.idProgramSubscription = this.ccu.subscribeProgram({}, msg => {
            });

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

            this.hap.publish();

            this.on('close', done => { this._destructor(done); });

        }

        _destructor(done) {
            RED.log.info('HomeKit exiting');
            this.hap.unpublish();
            this.ccu.unsubscribe(this.idSubscription);
            this.ccu.unsubscribeSysvar(this.idSysvarSubscription);
            this.ccu.unsubscribeProgram(this.idProgramSubscription);
            done();
        }
    }

    RED.nodes.registerType('redmatic-homekit', RedMaticHomeKit);
};
