const path = require('path');
const net = require('net');
const hap = require('hap-nodejs');

const {uuid, Accessory, Service} = hap;
const {FFMPEG} = require('homebridge-camera-ffmpeg/ffmpeg');
const pkg = require('../package.json');

const accessories = {};

module.exports = function (RED) {
    hap.HAPStorage.setCustomStoragePath(path.join(RED.settings.userDir, 'homekit'));

    RED.httpAdmin.get('/redmatic-homekit-camera', (request, response) => {
        if (request.query.config) {
            const acc = accessories[request.query.config];
            if (acc) {
                response.status(200).send(JSON.stringify({setupURI: acc.setupURI()}));
            } else {
                response.status(500).send(JSON.stringify({}));
            }
        } else {
            response.status(404).send(JSON.stringify({}));
        }
    });

    class RedMaticHomeKitCamera {
        constructor(config) {
            RED.nodes.createNode(this, config);

            function logger(...args) {
                let string_ = args.join(' ');
                if (/^(error: )/i.test(string_)) {
                    string_ = string_.replace(/^error: (.*)/i, '$1');
                    this.error(string_);
                } else if (config.debug) {
                    this.debug(string_);
                }
            }

            if (accessories[this.id]) {
                this.debug('camera already configured ' + this.name + ' ' + this.id + ' ' + this.username);
                return;
            }

            const [firstLogger] = Object.keys(RED.settings.logging);
            config.debug = config.debug && (RED.settings.logging[firstLogger].level === 'debug' || RED.settings.logging[firstLogger].level === 'trace');

            this.name = config.name || ('Camera ' + this.id);

            const acc = new Accessory(this.name, uuid.generate(config.id), hap.Categories.CAMERA);
            accessories[this.id] = acc;

            this.debug('camera created' + this.name + ' ' + this.id + ' ' + config.username);

            acc.getService(Service.AccessoryInformation)
                .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                .setCharacteristic(hap.Characteristic.Model, 'Camera')
                .setCharacteristic(hap.Characteristic.SerialNumber, config.username)
                .setCharacteristic(hap.Characteristic.FirmwareRevision, pkg.version);

            acc.on('identify', (paired, callback) => {
                this.log('identify ' + this.id + ' ' + this.username + ' ' + paired);
                callback();
            });

            config.audio = Boolean(config.audio);

            if (config.doorbell) {
                this.debug('add doorbell service');
                const doorbellService = acc.addService(hap.Service.Doorbell, this.name);
                this.on('input', message => {
                    console.log(message);
                    this.debug('update ProgrammableSwitchEvent SINGLE_PRESS');
                    doorbellService.getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent).updateValue(0);
                });
            }

            const cameraSource = new FFMPEG(hap, {name: this.name, videoConfig: config}, logger, config.videoProcessor || 'ffmpeg');
            this.debug('add cameraSource');

            acc.configureCameraSource(cameraSource);

            this.log('publishing camera ' + this.name + ' ' + config.username);
            const testPort = net.createServer()
                .once('error', error => {
                    this.error(error);
                    this.status({fill: 'red', shape: 'dot', text: error.message});
                })
                .once('listening', () => {
                    testPort.once('close', () => {
                        acc.publish({
                            username: config.username,
                            port: config.port,
                            pincode: config.pincode,
                            category: hap.Categories.CAMERA,
                        });

                        acc._server.on('listening', () => {
                            this.log('camera ' + this.name + ' listening on port ' + config.port);
                            this.status({fill: 'green', shape: 'ring', text: ' '});
                        });

                        acc._server.on('pair', username => {
                            this.log('camera ' + this.name + ' paired', username);
                        });

                        acc._server.on('unpair', username => {
                            this.log('camera ' + this.name + ' unpaired', username);
                        });

                        acc._server.on('verify', () => {
                            this.log('camera ' + this.name + ' verify');
                        });
                    }).close();
                })
                .listen(config.port);

            this.on('close', () => {});
        }
    }

    RED.nodes.registerType('redmatic-homekit-camera', RedMaticHomeKitCamera);
};
