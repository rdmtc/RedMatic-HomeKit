const path = require('path');
const net = require('net');
const hap = require('hap-nodejs');

const {uuid, Accessory, Service, Characteristic} = hap;
const pkg = require('../package.json');

const accessories = {};

module.exports = function (RED) {
    hap.init(path.join(RED.settings.userDir, 'homekit'));

    RED.httpAdmin.get('/redmatic-homekit-tv', (req, res) => {
        console.log('homekit-tv', req.query.config, Object.keys(accessories));
        if (req.query.config) {
            const acc = accessories[req.query.config];
            if (acc) {
                res.status(200).send(JSON.stringify({setupURI: acc.setupURI()}));
            } else {
                res.status(500).send(JSON.stringify({}));
            }
        } else {
            res.status(404).send(JSON.stringify({}));
        }
    });

    class RedMaticHomeKitTv {
        constructor(config) {
            RED.nodes.createNode(this, config);

            const that = this;

            function logger(...args) {
                let str = args.join(' ');
                if (str.match(/^(error: )/i)) {
                    str = str.replace(/^error: (.*)/i, '$1');
                    that.error(str);
                } else {
                    that.debug(str);
                }
            }

            if (accessories[this.id]) {
                this.debug('tv already configured ' + this.name + ' ' + this.id + ' ' + this.username);
                return;
            }

            const [firstLogger] = Object.keys(RED.settings.logging);
            config.debug = (RED.settings.logging[firstLogger].level === 'debug' || RED.settings.logging[firstLogger].level === 'trace');

            this.id = config.id;
            this.pincode = config.pincode;
            this.port = config.port;
            this.username = config.username;
            this.name = config.name || ('TV ' + this.id);

            const tv = new Accessory(this.name, uuid.generate(config.id), Accessory.Categories.TELEVISION);
            accessories[this.id] = tv;

            this.debug('tv created ' + this.name + ' ' + this.id + ' ' + config.username);

            tv.getService(Service.AccessoryInformation)
                .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                .setCharacteristic(hap.Characteristic.Model, 'TV')
                .setCharacteristic(hap.Characteristic.SerialNumber, config.username)
                .setCharacteristic(hap.Characteristic.FirmwareRevision, pkg.version);

            // Add the actual TV Service and listen for change events from iOS.
            // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
            const televisionService = tv.addService(Service.Television, 'Television', 'Television');

            televisionService
                .setCharacteristic(Characteristic.ConfiguredName, 'Television');

            televisionService
                .setCharacteristic(
                    Characteristic.SleepDiscoveryMode,
                    Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE
                );

            televisionService
                .getCharacteristic(Characteristic.Active)
                .on('set', (newValue, callback) => {
                    console.log('set Active => setNewValue: ' + newValue);
                    callback(null);
                });

            televisionService
                .setCharacteristic(Characteristic.ActiveIdentifier, 1);

            televisionService
                .getCharacteristic(Characteristic.ActiveIdentifier)
                .on('set', (newValue, callback) => {
                    console.log('set Active Identifier => setNewValue: ' + newValue);
                    callback(null);
                });

            televisionService
                .getCharacteristic(Characteristic.RemoteKey)
                .on('set', (newValue, callback) => {
                    console.log('set Remote Key => setNewValue: ' + newValue);
                    callback(null);
                });

            televisionService
                .getCharacteristic(Characteristic.PictureMode)
                .on('set', (newValue, callback) => {
                    console.log('set PictureMode => setNewValue: ' + newValue);
                    callback(null);
                });

            televisionService
                .getCharacteristic(Characteristic.PowerModeSelection)
                .on('set', (newValue, callback) => {
                    console.log('set PowerModeSelection => setNewValue: ' + newValue);
                    callback(null);
                });

            // Speaker

            const speakerService = tv.addService(Service.TelevisionSpeaker);

            speakerService
                .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
                .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);

            speakerService.getCharacteristic(Characteristic.VolumeSelector)
                .on('set', (newValue, callback) => {
                    console.log('set VolumeSelector => setNewValue: ' + newValue);
                    callback(null);
                });

            // HDMI 1

            const inputHDMI1 = tv.addService(Service.InputSource, 'hdmi1', 'HDMI 1');

            inputHDMI1
                .setCharacteristic(Characteristic.Identifier, 1)
                .setCharacteristic(Characteristic.ConfiguredName, 'HDMI 1')
                .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.HDMI);

            // HDMI 2

            const inputHDMI2 = tv.addService(Service.InputSource, 'hdmi2', 'HDMI 2');

            inputHDMI2
                .setCharacteristic(Characteristic.Identifier, 2)
                .setCharacteristic(Characteristic.ConfiguredName, 'HDMI 2')
                .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.HDMI);

            // Netflix

            const inputNetflix = tv.addService(Service.InputSource, 'netflix', 'Netflix');

            inputNetflix
                .setCharacteristic(Characteristic.Identifier, 3)
                .setCharacteristic(Characteristic.ConfiguredName, 'Netflix')
                .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APPLICATION);

            televisionService.addLinkedService(inputHDMI1);
            televisionService.addLinkedService(inputHDMI2);
            televisionService.addLinkedService(inputNetflix);

            tv.on('identify', (paired, callback) => {
                this.log('identify ' + this.id + ' ' + this.username + ' ' + paired);
                callback();
            });

            this.log('publishing tv ' + this.name + ' ' + config.username);
            const testPort = net.createServer()
                .once('error', err => {
                    this.error(err);
                    this.status({fill: 'red', shape: 'dot', text: err.message});
                })
                .once('listening', () => {
                    testPort.once('close', () => {
                        tv.publish({
                            username: config.username,
                            port: config.port,
                            pincode: config.pincode,
                            category: Accessory.Categories.TELEVISION
                        });

                        tv._server.on('listening', () => {
                            this.log('tv ' + this.name + ' listening on port ' + config.port);
                            this.status({fill: 'green', shape: 'ring', text: ' '});
                        });

                        tv._server.on('pair', username => {
                            this.log('tv ' + this.name + ' paired', username);
                        });

                        tv._server.on('unpair', username => {
                            this.log('tv ' + this.name + ' unpaired', username);
                        });

                        tv._server.on('verify', () => {
                            this.log('tv ' + this.name + ' verify');
                        });
                    }).close();
                })
                .listen(config.port);

            this.on('close', () => {
            });
        }
    }

    RED.nodes.registerType('redmatic-homekit-tv', RedMaticHomeKitTv);
};
