module.exports = function (RED) {
    class RedMaticHomeKitHomematicIrrigation {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.bridgeConfig = RED.nodes.getNode(config.bridgeConfig);
            if (!this.bridgeConfig) {
                return;
            }

            this.ccu = RED.nodes.getNode(config.ccuConfig);
            if (!this.ccu) {
                return;
            }

            this.debug('irrigation constructor');

            this.iface = config.iface;

            this.onTime = this.context().get('onTime') || parseFloat(config.onTime) || 5;
            this.remaining = 0;

            const channel = config.channel.split(' ')[0];

            this.status({fill: 'grey', shape: 'ring', text: (this.onTime * 60) + 's'});
            this.send([{topic: config.topic, payload: false}, {topic: config.topic, payload: this.onTime}]);

            const stop = () => {
                clearInterval(this.interval);
                this.remaining = 0;
                this.debug('update Valve 0 RemainingDuration ' + this.remaining);
                service.updateCharacteristic(hap.Characteristic.RemainingDuration, this.remaining);

                return new Promise((resolve, reject) => {
                    this.ccu.setValue(config.iface, channel, 'STATE', false)
                        .then(() => {
                            this.status({fill: 'grey', shape: 'ring', text: (this.onTime * 60) + 's'});
                            this.send([{topic: config.topic, payload: false}, {topic: config.topic, payload: this.onTime}]);
                            resolve();
                        })
                        .catch(() => {
                            // try again
                            this.ccu.setValue(config.iface, channel, 'STATE', false)
                                .then(() => {
                                    this.send([{topic: config.topic, payload: false}, {topic: config.topic, payload: this.onTime}]);
                                    this.status({fill: 'grey', shape: 'ring', text: (this.onTime * 60) + 's'});
                                    resolve();
                                })
                                .catch(error => {
                                    this.status({fill: 'red', shape: 'dot', text: (this.onTime * 60) + 's'});
                                    reject(error);
                                });
                        });
                });
            };

            const startInterval = () => {
                clearInterval(this.interval);
                this.interval = setInterval(() => {
                    this.remaining -= 1;
                    if (this.remaining < 0) {
                        clearInterval(this.interval);
                        this.remaining = 0;
                        this.debug('update Valve 0 RemainingDuration ' + 0);
                        service.updateCharacteristic(hap.Characteristic.RemainingDuration, 0);
                        this.send([{topic: config.topic, payload: false}, {topic: config.topic, payload: 0}]);
                        this.status({fill: 'grey', shape: 'ring', text: (this.onTime * 60) + 's'});
                    } else {
                        this.send([null, {topic: config.topic, payload: this.remaining}]);
                        this.status({fill: 'green', shape: 'dot', text: this.remaining + 's'});
                    }
                }, 1000);
            };

            const start = () => {
                return new Promise((resolve, reject) => {
                    const dev = this.ccu.metadata.devices[config.iface] && this.ccu.metadata.devices[config.iface][channel];
                    if (dev) {
                        const ps = this.ccu.getParamsetDescription(config.iface, dev, 'VALUES');
                        if (ps && ps.STATE) {
                            if (ps.ON_TIME) {
                                this.debug('starting with ON_TIME');

                                this.ccu.methodCall(config.iface, 'putParamset', [channel, 'VALUES', {
                                    STATE: true,
                                    ON_TIME: this.onTime * 60
                                }]).then(() => {
                                    this.remaining = this.onTime * 60;
                                    this.debug('update Valve 0 RemainingDuration ' + this.remaining);
                                    service.updateCharacteristic(hap.Characteristic.RemainingDuration, this.remaining);

                                    this.debug('update Valve 0 Active 1');
                                    service.updateCharacteristic(hap.Characteristic.InUse, 1);
                                    this.debug('update Valve 0 InUse true');
                                    service.updateCharacteristic(hap.Characteristic.Active, true);

                                    this.log('start resolve!');
                                    resolve();
                                    startInterval();
                                }).catch(reject);
                            } else {
                                this.debug('starting with timeout');
                                this.ccu.setValue(config.iface, channel, 'STATE', true)
                                    .then(() => {
                                        this.remaining = this.onTime * 60;
                                        this.debug('update Valve 0 RemainingDuration ' + this.remaining);
                                        service.updateCharacteristic(hap.Characteristic.RemainingDuration, this.remaining);

                                        this.debug('update Valve 0 Active 1');
                                        service.updateCharacteristic(hap.Characteristic.InUse, 1);
                                        this.debug('update Valve 0 InUse true');
                                        service.updateCharacteristic(hap.Characteristic.Active, true);
                                        setTimeout(() => {
                                            stop();
                                        }, (this.onTime * 60 * 1000) + 1000);
                                        this.log('start resolve!');
                                        resolve();
                                        startInterval();
                                    })
                                    .catch(reject);
                            }
                        } else {
                            reject();
                        }
                    } else {
                        reject();
                    }
                });
            };

            const {hap, version} = this.bridgeConfig;

            this.name = config.name || ('Irrigation ' + this.id);

            const acc = this.bridgeConfig.accessory({id: this.id, name: this.name});

            const subtype = '0';
            let service;

            if (acc.isConfigured) {
                service = acc.getService(subtype);
            } else {
                acc.getService(hap.Service.AccessoryInformation)
                    .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                    .setCharacteristic(hap.Characteristic.Model, 'Homematic Irrigation')
                    .setCharacteristic(hap.Characteristic.SerialNumber, this.id)
                    .setCharacteristic(hap.Characteristic.FirmwareRevision, version);
                service = acc.addService(hap.Service.Valve, this.name, subtype);

                acc.isConfigured = true;
            }

            this.debug('update Valve 0 ValveType 1');
            service.updateCharacteristic(hap.Characteristic.ValveType, 1);
            this.debug('update Valve 0 RemainingDuration ' + this.onTime * 60);
            service.updateCharacteristic(hap.Characteristic.RemainingDuration, this.onTime * 60);
            this.debug('update Valve 0 SetDuration ' + this.onTime * 60);
            service.updateCharacteristic(hap.Characteristic.SetDuration, this.onTime * 60);

            let state = false;

            let changeTimer;
            let changeExpected;

            this.debug('ccu subscribe ' + config.iface + ' ' + channel);
            this.ccu.subscribe({
                iface: config.iface,
                channel,
                datapoint: 'STATE',
                cache: true,
                change: true,
                stable: true
            }, msg => {
                state = msg.value;
                if (!state) {
                    stop();
                }

                this.debug('update Valve 0 InUse ' + msg.value);
                service.updateCharacteristic(hap.Characteristic.InUse, msg.value);
                this.debug('update Valve 0 Active ' + msg.value ? 1 : 0);
                service.updateCharacteristic(hap.Characteristic.Active, msg.value ? 1 : 0);
                if (!changeExpected) {
                    this.status({fill: state ? 'green' : 'grey', shape: 'ring', text: '?'});
                    this.send([{topic: config.topic, payload: true}, {topic: config.topic, payload: 0}]);
                }
            });

            const setActive = (value, callback) => {
                this.debug('set Valve 0 Active ' + value);
                changeExpected = true;
                clearTimeout(changeExpected);
                changeTimer = setTimeout(() => {
                    changeExpected = false;
                }, 5000);
                if (value) {
                    start().then(() => {
                        this.debug('promise resolved!');
                        callback();
                    }).catch(() => {
                        this.debug('promise rejected!');
                        callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
                } else {
                    stop().then(() => {
                        this.debug('promise resolved!');
                        callback();
                    }).catch(() => {
                        this.debug('promise rejected!');
                        callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
                }
            };

            const getActive = callback => {
                this.debug('get Valve 0 Active ' + (state ? 1 : 0));
                callback(state ? 1 : 0);
            };

            const getInUse = callback => {
                this.debug('get Valve 0 InUse ' + state);
                callback(state);
            };

            const setSetDuration = (value, callback) => {
                this.debug('set Valve 0 SetDuration ' + value);
                this.onTime = value / 60;
                this.context().set('onTime', this.onTime);
                callback();
            };

            const getSetDuration = callback => {
                this.debug('get Valve 0 SetDuration ' + this.onTime * 60);
                callback(this.onTime * 60);
            };

            const getRemainingDuration = callback => {
                const res = this.remaining; // || (this.onTime * 60);
                this.debug('get Valve 0 RemainingDuration ' + res);
                callback(res);
            };

            const setRemainingDuration = (value, callback) => {
                this.debug('set Valve 0 RemainingDuration ' + value);
                callback();
            };

            this.on('input', msg => {
                if (typeof msg.payload === 'boolean') {
                    msg.payload ? start() : stop();
                } else {
                    const time = parseFloat(msg.payload) || 0;
                    if (time) {
                        this.onTime = time;
                        this.context().set('onTime', this.onTime);
                        if (this.remaining === 0 && !state) {
                            this.status({fill: 'grey', shape: 'ring', text: (this.onTime * 60) + 's'});
                        }

                        this.debug('update Valve 0 SetDuration ' + this.onTime * 60);
                        service.updateCharacteristic(hap.Characteristic.SetDuration, this.onTime * 60);
                    }
                }
            });

            service.getCharacteristic(hap.Characteristic.Active).on('get', getActive);
            service.getCharacteristic(hap.Characteristic.Active).on('set', setActive);
            service.getCharacteristic(hap.Characteristic.InUse).on('get', getInUse);
            service.getCharacteristic(hap.Characteristic.SetDuration).on('set', setSetDuration);
            service.getCharacteristic(hap.Characteristic.SetDuration).on('get', getSetDuration);
            service.getCharacteristic(hap.Characteristic.RemainingDuration).on('get', getRemainingDuration);
            service.getCharacteristic(hap.Characteristic.RemainingDuration).on('set', setRemainingDuration);

            this.on('close', () => {
                service.getCharacteristic(hap.Characteristic.Active).removeListener('get', getActive);
                service.getCharacteristic(hap.Characteristic.Active).removeListener('set', setActive);
                service.getCharacteristic(hap.Characteristic.InUse).removeListener('get', getInUse);
                service.getCharacteristic(hap.Characteristic.SetDuration).removeListener('set', setSetDuration);
                service.getCharacteristic(hap.Characteristic.SetDuration).removeListener('get', getSetDuration);
                service.getCharacteristic(hap.Characteristic.RemainingDuration).removeListener('get', getRemainingDuration);
                service.getCharacteristic(hap.Characteristic.RemainingDuration).removeListener('set', setRemainingDuration);
            });
        }
    }

    RED.nodes.registerType('redmatic-homekit-homematic-irrigation', RedMaticHomeKitHomematicIrrigation);
};
