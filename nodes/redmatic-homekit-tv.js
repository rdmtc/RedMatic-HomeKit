const path = require('path');
const net = require('net');
const hap = require('hap-nodejs');

const {uuid, Accessory, Service, Characteristic} = hap;
const pkg = require('../package.json');

const accessories = {};

module.exports = function (RED) {
    hap.init(path.join(RED.settings.userDir, 'homekit'));

    RED.httpAdmin.get('/redmatic-homekit-tv', (req, res) => {
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

            this.name = config.name || ('TV ' + config.id);

            let acc;
            let tvService;
            let speakerService;

            if (accessories[config.id]) {
                this.debug('tv already existing ' + this.name + ' ' + config.id);
                acc = accessories[config.id];
                tvService = acc.getService('Television');
                speakerService = acc.getService('Speaker');
            } else {
                acc = new Accessory(this.name, uuid.generate(config.id));
                accessories[config.id] = acc;

                this.debug('tv created ' + this.name + ' ' + config.id + ' ' + config.username);

                acc.getService(Service.AccessoryInformation)
                    .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                    .setCharacteristic(hap.Characteristic.Model, 'TV')
                    .setCharacteristic(hap.Characteristic.SerialNumber, config.username)
                    .setCharacteristic(hap.Characteristic.FirmwareRevision, pkg.version);

                tvService = acc.addService(Service.Television, this.name, 'Television');

                tvService.setCharacteristic(Characteristic.ConfiguredName, this.name);

                tvService.setCharacteristic(
                    Characteristic.SleepDiscoveryMode,
                    Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE
                );

                tvService.setCharacteristic(Characteristic.ActiveIdentifier, 1);

                speakerService = acc.addService(Service.TelevisionSpeaker, this.name, 'Speaker');

                speakerService
                    .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
                    .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);

                this.debug('creating ' + config.inputsources.length + ' input sources');
                config.inputsources.forEach((src, i) => {
                    const id = i + 1;
                    const inputService = acc.addService(Service.InputSource, src.name, src.name);
                    inputService
                        .setCharacteristic(Characteristic.Identifier, id)
                        .setCharacteristic(Characteristic.ConfiguredName, src.name)
                        .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
                        .setCharacteristic(Characteristic.InputSourceType, src.type)
                        .setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN)
                        .setCharacteristic(Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN);

                    tvService.addLinkedService(inputService);
                });

                // tvService.addLinkedService(speakerService);

                this.log('publishing tv ' + this.name + ' ' + config.username);
                const testPort = net.createServer()
                    .once('error', err => {
                        this.error(err);
                        this.status({fill: 'red', shape: 'dot', text: err.message});
                    })
                    .once('listening', () => {
                        testPort.once('close', () => {
                            acc.publish({
                                username: config.username,
                                port: config.port,
                                pincode: config.pincode,
                                category: Accessory.Categories.TELEVISION
                            });

                            acc._server.on('listening', () => {
                                this.log('tv ' + this.name + ' listening on port ' + config.port);
                                this.status({shape: 'ring', fill: 'grey', text: ' '});
                            });

                            acc._server.on('pair', username => {
                                this.log('tv ' + this.name + ' paired', username);
                            });

                            acc._server.on('unpair', username => {
                                this.log('tv ' + this.name + ' unpaired', username);
                            });

                            acc._server.on('verify', () => {
                                this.log('tv ' + this.name + ' verify');
                            });
                        }).close();
                    })
                    .listen(config.port);
            }

            const setActive = (newValue, callback) => {
                this.send({topic: 'Active', payload: Boolean(newValue)});
                this.status({shape: newValue ? 'dot' : 'ring', fill: newValue ? 'blue' : 'grey'});
                callback(null);
            };

            const setActiveIdentifier = (newValue, callback) => {
                this.status({shape: 'dot', fill: 'blue', text: config.inputsources[newValue - 1].name});
                this.send({topic: 'InputSource', payload: config.inputsources[newValue - 1].name, identifier: newValue});
                callback(null);
            };

            const setPowerModeSelection = (newValue, callback) => {
                this.send({topic: 'PowerModeSelection', payload: newValue});
                callback(null);
            };

            const setRemoteKey = (newValue, callback) => {
                const msg = {topic: 'RemoteKey'};
                switch (newValue) {
                    case 0:
                        msg.payload = 'REWIND';
                        msg.lgtv = 'REWIND';
                        break;
                    case 1:
                        msg.payload = 'FAST_FORWARD';
                        msg.lgtv = 'FASTFORWARD';
                        break;
                    case 2:
                        msg.payload = 'NEXT_TRACK';
                        break;
                    case 3:
                        msg.payload = 'PREVIOUS_TRACK';
                        break;
                    case 4:
                        msg.payload = 'ARROW_UP';
                        msg.lgtv = 'UP';
                        break;
                    case 5:
                        msg.payload = 'ARROW_DOWN';
                        msg.lgtv = 'DOWN';
                        break;
                    case 6:
                        msg.payload = 'ARROW_LEFT';
                        msg.lgtv = 'LEFT';
                        break;
                    case 7:
                        msg.payload = 'ARROW_RIGHT';
                        msg.lgtv = 'RIGHT';
                        break;
                    case 8:
                        msg.payload = 'SELECT';
                        msg.lgtv = 'ENTER';
                        break;
                    case 9:
                        msg.payload = 'BACK';
                        msg.lgtv = 'BACK';
                        break;
                    case 10:
                        msg.payload = 'EXIT';
                        msg.lgtv = 'EXIT';
                        break;
                    case 11:
                        msg.payload = 'PLAY_PAUSE';
                        break;
                    case 15:
                        msg.payload = 'INFORMATION';
                        msg.lgtv = 'INFO';
                        break;
                    default:
                }

                msg.characteristicValue = newValue;
                this.send(msg);
                callback(null);
            };

            const setVolumeSelector = (newValue, callback) => {
                this.send({topic: 'VolumeSelector', payload: newValue ? 'VOLUMEDOWN' : 'VOLUMEUP'});
                callback(null);
            };

            this.debug('add event listeners');

            tvService.getCharacteristic(Characteristic.Active)
                .on('set', setActive);

            tvService.getCharacteristic(Characteristic.ActiveIdentifier)
                .on('set', setActiveIdentifier);

            tvService.getCharacteristic(Characteristic.RemoteKey)
                .on('set', setRemoteKey);

            tvService.getCharacteristic(Characteristic.PowerModeSelection)
                .on('set', setPowerModeSelection);

            speakerService.getCharacteristic(Characteristic.VolumeSelector)
                .on('set', setVolumeSelector);

            this.on('input', msg => {
                switch (msg.topic) {
                    case 'InputSource': {
                        let identifier = msg.payload;
                        if (typeof msg.payload === 'string') {
                            config.inputsources.forEach((src, i) => {
                                if (msg.payload === src.name) {
                                    identifier = i + 1;
                                }
                            });
                        }

                        if (config.inputsources[identifier - 1]) {
                            this.debug('set ActiveIdentifier ' + identifier + ' (payload was ' + msg.payload + ')');
                            this.status({shape: 'dot', fill: 'blue', text: config.inputsources[identifier - 1].name});
                            tvService.updateCharacteristic(Characteristic.ActiveIdentifier, identifier);
                        }

                        break;
                    }

                    default:
                        this.debug('set Active ' + msg.payload);
                        this.status({shape: msg.payload ? 'dot' : 'ring', fill: msg.payload ? 'blue' : 'grey'});
                        tvService.updateCharacteristic(Characteristic.Active, msg.payload ? 1 : 0);
                }
            });

            this.on('close', () => {
                this.debug('remove event listeners');

                tvService.getCharacteristic(Characteristic.Active)
                    .removeListener('set', setActive);

                tvService.getCharacteristic(Characteristic.ActiveIdentifier)
                    .removeListener('set', setActiveIdentifier);

                tvService.getCharacteristic(Characteristic.RemoteKey)
                    .removeListener('set', setRemoteKey);

                tvService.getCharacteristic(Characteristic.PowerModeSelection)
                    .removeListener('set', setPowerModeSelection);

                speakerService.getCharacteristic(Characteristic.VolumeSelector)
                    .removeListener('set', setVolumeSelector);
            });
        }
    }

    RED.nodes.registerType('redmatic-homekit-tv', RedMaticHomeKitTv);
};
