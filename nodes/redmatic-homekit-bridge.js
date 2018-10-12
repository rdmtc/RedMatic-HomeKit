const path = require('path');
const hap = require('hap-nodejs');
const pkg = require('../package.json');

hap.init(path.join(__dirname, '..', '..', '..', 'homekit'));

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
            if (this.published) {
                return;
            }
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
                this.waitForAccessories();
            }

            return acc;
        }
    }

    RED.nodes.registerType('redmatic-homekit-bridge', RedMaticHomeKitBridge);
};
