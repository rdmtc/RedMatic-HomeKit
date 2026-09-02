const net = require('net');
const {init} = require('./lib/hap');
const pkg = require('../package.json');

// hap-nodejs refuses to bridge more than this many accessories
const MAX_ACCESSORIES = 149;

const bridges = {};

/** 'auto' → 'avahi' when an avahi-daemon is reachable over D-Bus, else 'ciao' */
async function resolveAdvertiser(advertiser) {
    if (advertiser !== 'auto') {
        return advertiser;
    }

    try {
        const {AvahiAdvertiser} = require('@homebridge/hap-nodejs/dist/lib/Advertiser');
        if (await AvahiAdvertiser.isAvailable()) {
            return 'avahi';
        }
    } catch {
        // no D-Bus / no avahi: fall through
    }

    return 'ciao';
}

module.exports = function (RED) {
    const hap = init(RED);

    RED.httpAdmin.get('/redmatic-homekit', (req, res) => {
        if (req.query.config && req.query.config !== '_ADD_') {
            const config = RED.nodes.getNode(req.query.config);
            if (!config || !config.bridge || !config.bridge.isPublished) {
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
            // 'auto' (default): avahi-daemon over D-Bus when the host runs one (OpenCCU),
            // hap-nodejs' own ciao responder otherwise (official CCU firmware, RedMatic 9 without avahi)
            this.advertiser = config.advertiser || 'auto';
            this.allowInsecureRequest = Boolean(config.allowInsecureRequest);

            if (bridges[this.username]) {
                this.bridge = bridges[this.username];
            } else {
                // the UUID derived from the username is the bridge's identity in
                // HomeKit; changing it would unpair every controller (ROADMAP D-4)
                this.bridge = new hap.Bridge(this.name, hap.uuid.generate(this.username));
                bridges[this.username] = this.bridge;
            }

            this.waitForAccessories();

            this.on('close', (remove, done) => {
                // the bridge object is kept across redeploys on purpose: hap-nodejs
                // cannot re-publish an unpublished bridge on the same port
                done();
            });
        }

        publishBridge() {
            this.debug('publishBridge');
            const count = this.bridge.bridgedAccessories.length;
            const where = this.name + ' ' + this.username + ' on port ' + this.port;
            if (this.bridge.isPublished) {
                this.log('bridge already published (' + count + ' accessories) ' + where);
                return;
            }

            if (count === 0) {
                this.error('refusing to publish bridge with 0 accessories');
                return;
            }

            this.bridge.isPublished = true;

            this.bridge.on('identify', (paired, callback) => {
                this.log('hap bridge identify', paired ? '(paired)' : '(unpaired)');
                callback();
            });

            this.bridge
                .getService(hap.Service.AccessoryInformation)
                .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                .setCharacteristic(hap.Characteristic.Model, 'HAP-NodeJS Bridge')
                .setCharacteristic(hap.Characteristic.SerialNumber, this.username)
                .setCharacteristic(hap.Characteristic.FirmwareRevision, pkg.version);

            const testPort = net
                .createServer()
                .once('error', (err) => {
                    this.bridge.isPublished = false;
                    this.error('port ' + this.port + ' not available: ' + err.message);
                })
                .once('listening', () => {
                    testPort
                        .once('close', () => {
                            resolveAdvertiser(this.advertiser)
                                .then((advertiser) =>
                                    this.bridge
                                        .publish(
                                            {
                                                username: this.username,
                                                port: parseInt(this.port, 10),
                                                pincode: this.pincode,
                                                category: hap.Categories.BRIDGE,
                                                advertiser,
                                            },
                                            this.allowInsecureRequest,
                                        )
                                        .then(() => advertiser),
                                )
                                .then((advertiser) => {
                                    this.log(
                                        'published bridge (' + count + ' accessories) ' + where + ' via ' + advertiser,
                                    );
                                    this.published = true;
                                    this.emit('published');
                                })
                                .catch((error) => {
                                    this.bridge.isPublished = false;
                                    this.error('publish failed: ' + error.message);
                                });
                        })
                        .close();
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
            // accessory identity = uuid(id); ids are CCU addresses or node ids and
            // must stay stable across versions (ROADMAP D-4)
            const uuid = hap.uuid.generate(config.id + (config.uuidAddition ? config.uuidAddition : ''));
            let acc = this.bridge.bridgedAccessories.find((a) => a.UUID === uuid);

            if (acc) {
                this.debug('already existing accessory ' + config.id + ' ' + config.name);
            } else if (this.bridge.bridgedAccessories.length >= MAX_ACCESSORIES) {
                this.error(
                    'maximum of ' +
                        MAX_ACCESSORIES +
                        " accessories per bridge exceeded, can't add " +
                        config.id +
                        ' ' +
                        config.name +
                        ' - use a second bridge config node',
                );
            } else {
                this.debug('addAccessory ' + config.id + ' ' + config.name);
                acc = new hap.Accessory(config.name, uuid, hap.Categories.OTHER);
                this.bridge.addBridgedAccessory(acc);
            }

            this.waitForAccessories();

            return acc;
        }
    }

    RED.nodes.registerType('redmatic-homekit-bridge', RedMaticHomeKitBridge);
};
