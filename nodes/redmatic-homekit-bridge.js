const path = require('path');
const net = require('net');
const hap = require('hap-nodejs');
const pkg = require('../package.json');

const bridges = {};

module.exports = function (RED) {
    hap.init(path.join(RED.settings.userDir, 'homekit'));

    RED.httpAdmin.get('/redmatic-homekit', (req, res) => {
        if (req.query.config && req.query.config !== '_ADD_') {
            const config = RED.nodes.getNode(req.query.config);
            if (!config || !config.bridge.isPublished) {
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

            if (!config.pincode) {
                this.error('pincode missing');
                return;
            }

            if (!config.port) {
                this.error('port missing');
                return;
            }

            this.hap = hap;

            this.version = pkg.version;

            this.name = config.name || 'RedMatic';
            this.username = config.username;
            this.pincode = config.pincode;
            this.port = config.port;
            this.allowInsecureRequest = Boolean(config.allowInsecureRequest);

            if (bridges[this.username]) {
                this.bridge = bridges[this.username];
            } else {
                this.bridge = new hap.Bridge(this.name, hap.uuid.generate(this.username));
                bridges[this.username] = this.bridge;
            }

            this.waitForAccessories();

            this.on('close', (remove, done) => {
                if (remove && this.bridge.isPublished) {
                //    this.bridge.unpublish();
                //    this.log('unpublished bridge ' + this.name + ' ' + this.username + ' on port ' + this.port);
                }

                done();
            });
        }

        publishBridge() {
            this.debug('publishBridge');
            if (this.bridge.isPublished) {
                this.log('bridge already published (' + this.bridge.bridgedAccessories.length + ' Accessories) ' + this.name + ' ' + this.username + ' on port ' + this.port);
                return;
            }

            if (this.bridge.bridgedAccessories && this.bridge.bridgedAccessories.length === 0) {
                this.error('refusing to publish bridge with 0 accessories');
                return;
            }

            this.bridge.isPublished = true;

            this.bridge.on('identify', (paired, callback) => {
                this.log('hap bridge identify', paired ? '(paired)' : '(unpaired)');
                callback();
            });

            this.bridge.getService(hap.Service.AccessoryInformation)
                .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                .setCharacteristic(hap.Characteristic.Model, 'HAP-Nodejs Bridge')
                .setCharacteristic(hap.Characteristic.SerialNumber, this.username)
                .setCharacteristic(hap.Characteristic.FirmwareRevision, pkg.version);

            const testPort = net.createServer()
                .once('error', err => {
                    this.error(err);
                })
                .once('listening', () => {
                    testPort.once('close', () => {
                        this.bridge.publish({
                            username: this.username,
                            port: parseInt(this.port, 10),
                            pincode: this.pincode,
                            category: hap.Accessory.Categories.OTHER
                        }, this.allowInsecureRequest);
                        this.log('published bridge (' + this.bridge.bridgedAccessories.length + ' Accessories) ' + this.name + ' ' + this.username + ' on port ' + this.port);

                        this.emit('published');
                    }).close();
                })
                .listen(this.port);
        }

        waitForAccessories() {
            this.trace('publish waitForAccessories');
            clearTimeout(this.waitForAccessoriesTimer);
            this.waitForAccessoriesTimer = setTimeout(() => {
                this.trace('publish waitForAccessories timeout waitForHomematic=' + this.waitForHomematic);
                if (this.waitForHomematic) {
                    this.waitForAccessories();
                } else {
                    this.publishBridge();
                }
            }, 5000);
        }

        accessory(config) {
            const uuid = hap.uuid.generate(config.id + (config.uuidAddition ? config.uuidAddition : ''));
            let acc;

            this.bridge.bridgedAccessories.forEach(a => {
                if (a.UUID === uuid) {
                    acc = a;
                }
            });

            if (acc) {
                this.debug('already existing accessory ' + config.id + ' ' + config.name);
            } else if (this.bridge.bridgedAccessories.length >= 150) {
                this.error('maximum of 150 accessories per bridge exceeded, can\'t add ' + config.id + ' ' + config.name);
            } else {
                this.debug('addAccessory ' + config.id + ' ' + config.name);
                acc = new hap.Accessory(config.name, uuid, hap.Accessory.Categories.OTHER);
                this.bridge.addBridgedAccessory(acc);
            }

            this.waitForAccessories();

            return acc;
        }
    }

    RED.nodes.registerType('redmatic-homekit-bridge', RedMaticHomeKitBridge);
};
