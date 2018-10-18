const path = require('path');
const hap = require('hap-nodejs');
const pkg = require('../package.json');

hap.init(path.join(__dirname, '..', '..', '..', 'homekit'));

const bridges = {};

module.exports = function (RED) {
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

    RED.httpAdmin.get('/redmatic-homekit/services', (req, res) => {
        const invalidServices = [
            'TunneledBTLEAccessoryService',
            'TimeInformation',
            'ProtocolInformation',
            'Pairing',
            'BridgingState',
            'BridgeConfiguration',
            'Label',
            'StatefulProgrammableSwitch',
            'CameraControl',
            'ServiceLabel',
            'CameraRTPStreamManagement',
            'AccessoryInformation',
            'super_',
            'Relay'
        ];
        res.status(200).send(JSON.stringify(Object.keys(hap.Service).filter(v => !invalidServices.includes(v)).sort()));
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
            }
            this.waitForAccessories();

            this.on('close', (remove, done) => {
                if (remove && this.bridge.isPublished) {
                    this.bridge.unpublish();
                    this.log('unpublished bridge ' + this.name + ' ' + this.username + ' on port ' + this.port);
                }
                done();
            });
        }

        publishBridge() {

            if (this.waitForHomematic) {
                this.once('homematic-ready', () => {
                    this.publishBridge();
                });
                return;
            } else if (this.bridge.isPublished) {
                this.log('bridge already published (' + this.bridge.bridgedAccessories.length + ' Accessories) ' + this.name + ' ' + this.username + ' on port ' + this.port);
                return;
            }

            this.bridge.isPublished = true;

            this.bridge.on('identify', (paired, callback) => {
                this.log('hap bridge identify', paired ? '(paired)' : '(unpaired)');
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
            this.log('published bridge (' + this.bridge.bridgedAccessories.length + ' Accessories) ' + this.name + ' ' + this.username + ' on port ' + this.port);

            this.emit('published');
        }

        waitForAccessories() {
            clearTimeout(this.waitForAccessoriesTimer);
            this.waitForAccessoriesTimer = setTimeout(() => {
                if (!this.waitForHomematic) {
                    this.publishBridge();
                }
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
                this.debug('already existing accessory ' + config.id + ' ' + config.name);
            } else {
                if (this.bridge.bridgedAccessories.length >= 100) {
                    this.error('maximum of 100 accessories per bridge exceeded, can\'t add ' + config.id + ' ' + config.name);
                    return;
                }
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
