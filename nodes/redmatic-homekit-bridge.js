const path = require('path');
const hap = require('hap-nodejs');
const pkg = require('../package.json');

hap.init(path.join(__dirname, '..', '..', 'homekit'));

const bridges = {};

module.exports = function (RED) {
    RED.httpAdmin.get('/redmatic-homekit', (req, res) => {
        if (req.query.config && req.query.config !== '_ADD_') {
            const config = RED.nodes.getNode(req.query.config);
            if (!config || !config.published) {
                res.status(500).send(JSON.stringify({}));
            } else {
                res.status(200).send(JSON.stringify({setupURI: config.bridge.setupURI()}));
            }
        } else {
            res.status(404).send(JSON.stringify({}));
        }
    });

    class RedMaticHomeKitBridge {
        constructor(config) {
            RED.nodes.createNode(this, config);

            if (!config.username) {
                this.error('username missing');
                return;
            }
            if (!config.port) {
                // TODO check if port is available
                this.error('port missing');
                return;
            }
            if (!config.pincode) {
                this.error('pincode missing');
                return;
            }

            this.hap = hap;

            this.name = config.name || 'RedMatic';
            this.username = config.username;
            this.pincode = config.pincode;
            this.port = config.port;

            if (bridges[this.username]) {
                this.bridge = bridges[this.username];
            } else {
                this.bridge = new hap.Bridge(this.name, hap.uuid.generate(this.username));
                bridges[this.username] = this.bridge;
                this.waitForAccessories();
            }
        }

        publishBridge() {
            if (this.waitForHomematic) {
                this.once('homematic-ready', () => {
                    this.publishBridge();
                });
                return;
            }

            this.published = true;

            this.bridge.on('identify', (paired, callback) => {
                console.log('hap bridge identify', paired ? '(paired)' : '(unpaired)');
                callback();
            });

            this.bridge.getService(hap.Service.AccessoryInformation)
                .setCharacteristic(hap.Characteristic.Manufacturer, 'Hobbyquaker')
                .setCharacteristic(hap.Characteristic.Model, 'RedMatic')
                .setCharacteristic(hap.Characteristic.SerialNumber, this.username)
                .setCharacteristic(hap.Characteristic.FirmwareRevision, pkg.version);

            this.bridge.publish({
                username: this.username,
                port: this.port,
                pincode: this.pincode,
                category: hap.Accessory.Categories.OTHER
            });
            this.log('published bridge (' + this.bridge.bridgedAccessories.length + ') ' + this.name + ' ' + this.username + ' on port ' + this.port);

            this.emit('published');
        }

        waitForAccessories() {
            clearTimeout(this.waitForAccessoriesTimer);
            this.waitForAccessoriesTimer = setTimeout(() => {
                this.publishBridge();
            }, 3000);
        }

        accessory(config) {
            const uuid = hap.uuid.generate(config.id);
            let acc;

            this.bridge.bridgedAccessories.forEach(a => {
                if (a.UUID === uuid) {
                    acc = a;
                }
            });

            if (acc) {
                this.log('already existing accessory ' + config.id + ' ' + config.name);
            } else {
                this.log('addAccessory ' + config.id + ' ' + config.name);
                acc = new hap.Accessory(config.name, uuid, hap.Accessory.Categories.OTHER);
                this.bridge.addBridgedAccessory(acc);
                if (!this.published) {
                    this.waitForAccessories();
                }
            }

            return acc;
        }

        /*

    Const hap = require('hap-nodejs');
    hap.init(path.join(__dirname, '..', '..', 'homekit'));

    class RedMaticHomeKitBridge {
        constructor(config) {

            RED.nodes.createNode(this, config);
            this.log('constructor');

            if (!config.username) {
                this.error('username missing');
                return;
            }
            if (!config.port) {
                // TODO check if port is available
                this.error('port missing');
                return;
            }
            if (!config.pincode) {
                this.error('pincode missing');
                return;
            }

            this.hap = hap;
            this.version = pkg.version;
            this.name = config.name;
            this.username = config.username;
            this.port = config.port;
            this.pincode = config.pincode;

            /*
            this.accessories = {};

            this.bridge = new this.hap.Bridge(this.name, this.hap.uuid.generate(this.username));

            this.bridge.on('identify', (paired, callback) => {
                this.log('hap bridge identify', paired ? '(paired)' : '(unpaired)');
                callback();
            });

            this.log('created Bridge');

            this.on('close', (removed, done) => {
                this.log('_destructor ' + removed);
                //if (removed) {
                //    this.bridge.destroy();
                //} else {
                //    this.bridge._server.stop();
                //    this.bridge._server = undefined;
                //    this.bridge._advertiser.stopAdvertising();
                //    this.bridge._advertiser = undefined;
                //    this.bridge = null;
                //}

                done();
            });

            //this.publishBridge();

            this.waitForAccessories();
        }

        _destructor(done) {

            //this.bridge.destroy();
            //this.bridge.removeAllListeners();
            //delete this.bridge;
            setTimeout(() => done(), 1000);
        }

        /*

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

*/
    }

    RED.nodes.registerType('redmatic-homekit-bridge', RedMaticHomeKitBridge);
};
