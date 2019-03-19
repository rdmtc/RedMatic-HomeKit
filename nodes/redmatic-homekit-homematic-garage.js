module.exports = function (RED) {
    class RedMaticHomeKitHomematicGarage {
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

            this.iface = config.ifaceActuator;
            this.ccu.register(this);

            config.durationClose = config.durationClose || config.duration;

            this.closed = false;
            this.opened = false;

            const move = (direction, revert) => {
                let channel;
                switch (config.channelActuatorType) {
                    case '1':
                        channel = config.channelActuator;
                        break;
                    case '2':
                        channel = direction === 0 ? config.channelActuatorOpen : config.channelActuatorClose;
                        revert = false;
                        break;
                    default:
                }

                channel = channel.split(' ')[0];
                const dev = this.ccu.metadata.devices[config.ifaceActuator] && this.ccu.metadata.devices[config.ifaceActuator][channel];
                const ps = this.ccu.getParamsetDescription(config.ifaceActuator, dev, 'VALUES');

                return new Promise((resolve, reject) => {
                    if (ps && ps.ON_TIME) {
                        this.ccu.methodCall(config.ifaceActuator, 'putParamset', [channel, 'VALUES', {
                            STATE: true,
                            ON_TIME: parseFloat(config.onTime) || 0.4
                        }]).then(() => {
                            if (revert) {
                                this.valueCurrent = 4;
                                this.updateSensor();
                                setTimeout(() => {
                                    move(direction).then(resolve).catch(reject);
                                }, (parseFloat(config.revertTime) || 0.5) * 1000);
                            } else {
                                resolve();
                            }
                        }).catch(reject);
                    } else {
                        this.ccu.setValue(config.ifaceActuator, channel, 'STATE', true)
                            .then(() => {
                                setTimeout(() => {
                                    this.ccu.setValue(config.ifaceActuator, channel, 'STATE', false)
                                        .then(() => {
                                            if (revert) {
                                                this.valueCurrent = 4;
                                                this.updateSensor();
                                                setTimeout(() => {
                                                    move(direction).then(resolve).catch(reject);
                                                }, (parseFloat(config.revertTime) || 0.5) * 1000);
                                            } else {
                                                resolve();
                                            }
                                        }).catch(reject);
                                }, (parseFloat(config.onTime) || 0.4) * 1000);
                            })
                            .catch(reject);
                    }
                });
            };

            const {hap, version} = this.bridgeConfig;

            this.name = config.name || ('Garage ' + this.id);

            const acc = this.bridgeConfig.accessory({id: this.id, name: this.name});

            const subtype = '0';
            let service;

            if (acc.isConfigured) {
                service = acc.getService(subtype);
            } else {
                acc.getService(hap.Service.AccessoryInformation)
                    .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                    .setCharacteristic(hap.Characteristic.Model, 'Homematic Garage')
                    .setCharacteristic(hap.Characteristic.SerialNumber, this.id)
                    .setCharacteristic(hap.Characteristic.FirmwareRevision, version);
                service = acc.addService(hap.Service.GarageDoorOpener, this.name, subtype);
                acc.isConfigured = true;
            }

            /*
            Characteristic.CurrentDoorState.OPEN = 0;
            Characteristic.CurrentDoorState.CLOSED = 1;
            Characteristic.CurrentDoorState.OPENING = 2;
            Characteristic.CurrentDoorState.CLOSING = 3;
            Characteristic.CurrentDoorState.STOPPED = 4;
             */

            this.updateSensor = (timeout, source) => {
                let valueCurrent = 4;
                let obstruction = false;
                this.debug('input updateSensor timeout=' + timeout + ' moving=' + this.moving + ' current=' + this.valueCurrent + ' target=' + this.valueTarget);

                switch (config.channelSensorType) {
                    case 'o': {
                        this.debug('o updateSensor opened=' + this.opened + ' lastMove=' + this.lastMove);
                        if (this.moving) {
                            if (this.opened && this.lastMove === 2) {
                                valueCurrent = 0;
                                clearTimeout(this.timer);
                                this.moving = false;
                            } else {
                                valueCurrent = this.moving;
                            }
                        } else if (timeout && this.lastMove === 2) {
                            if (this.opened) {
                                valueCurrent = 0;
                            } else {
                                obstruction = true;
                            }
                        } else if (timeout && this.lastMove === 3) {
                            if (this.opened) {
                                obstruction = true;
                            } else {
                                valueCurrent = 1;
                            }
                        } else {
                            valueCurrent = this.opened ? 0 : 1;
                        }

                        break;
                    }

                    case 'c': {
                        this.debug('c updateSensor closed=' + this.closed + ' lastMove=' + this.lastMove);
                        if (this.moving) {
                            if (this.closed && this.lastMove === 3) {
                                valueCurrent = 1;
                                clearTimeout(this.timer);
                                this.moving = false;
                            } else {
                                valueCurrent = this.moving;
                            }
                        } else if (timeout && this.lastMove === 3) {
                            if (this.closed) {
                                valueCurrent = 1;
                            } else {
                                obstruction = true;
                            }
                        } else if (timeout && this.lastMove === 2) {
                            if (this.closed) {
                                obstruction = true;
                            } else {
                                valueCurrent = 0;
                            }
                        } else {
                            valueCurrent = this.closed ? 1 : 0;
                        }

                        break;
                    }

                    default: {
                        this.debug('co updateSensor moving=' + this.moving + ' opened=' + this.opened + ' closed=' + this.closed + ' lastMove=' + this.lastMove + ' source=' + source);
                        if (this.opened && !this.closed) {
                            if (this.lastMove === 2 || !this.moving) {
                                valueCurrent = 0;
                                clearTimeout(this.timer);
                                this.moving = false;
                            } else if (this.moving) {
                                valueCurrent = this.moving;
                            }
                        } else if (this.closed && !this.opened) {
                            if (this.lastMove === 3 || !this.moving) {
                                valueCurrent = 1;
                                clearTimeout(this.timer);
                                this.moving = false;
                            } else if (this.moving) {
                                valueCurrent = this.moving;
                            }
                        } else if (this.moving) {
                            valueCurrent = this.moving;
                        } else if (timeout) {
                            obstruction = true;
                        } else if (source === 'o' && !this.opened) {
                            this.moving = 3;
                            this.lastMove = 3;
                            valueCurrent = 3;
                            this.valueTarget = 1;
                            this.timer = setTimeout(() => {
                                this.moving = false;
                                this.updateSensor(true);
                            }, config.durationClose * 1000);
                        } else if (source === 'c' && !this.closed) {
                            this.moving = 2;
                            this.lastMove = 2;
                            valueCurrent = 2;
                            this.valueTarget = 0;
                            this.timer = setTimeout(() => {
                                this.moving = false;
                                this.updateSensor(true);
                            }, config.duration * 1000);
                        }
                    }
                }

                if (!this.moving && !timeout && (valueCurrent < 2)) {
                    this.debug('valueTarget=valueCurrent=' + valueCurrent);
                    this.valueTarget = valueCurrent;
                }

                this.valueCurrent = valueCurrent;
                if (typeof this.valueTarget === 'undefined' && this.valueCurrent < 2) {
                    this.valueTarget = valueCurrent;
                }

                this.debug('result updateSensor timeout=' + timeout + ' moving=' + this.moving + ' current=' + this.valueCurrent + ' target=' + this.valueTarget);

                let text = obstruction ? 'obstruction' : 'stopped';
                let fill = obstruction ? 'red' : 'yellow';
                let shape = 'ring';
                switch (this.valueCurrent) {
                    case 0:
                        text = 'open';
                        shape = 'dot';
                        fill = 'blue';
                        break;
                    case 1:
                        text = 'closed';
                        shape = 'dot';
                        fill = 'green';
                        break;
                    case 2:
                        text = 'opening';
                        fill = 'blue';
                        break;
                    case 3:
                        text = 'closing';
                        fill = 'green';
                        break;
                    default:
                }

                this.status({fill, shape, text});
                this.send({topic: this.name, payload: this.valueCurrent === 1, text, CurrentDoorState: this.valueCurrent, ObstructionDetected: obstruction, TargetDoorState: this.valueTarget});

                this.debug('update GarageDoorOpener 0 CurrentDoorState ' + this.valueCurrent);
                service.updateCharacteristic(hap.Characteristic.CurrentDoorState, this.valueCurrent);
                this.debug('update GarageDoorOpener 0 TargetDoorState ' + this.valueTarget);
                service.updateCharacteristic(hap.Characteristic.TargetDoorState, this.valueTarget);
                this.debug('update GarageDoorOpener 0 ObstructionDetected ' + obstruction);
                service.updateCharacteristic(hap.Characteristic.ObstructionDetected, obstruction);
            };

            if (config.channelSensorType.includes('c')) {
                this.debug('subscribe ' + config.channelSensorClosed);
                this.idSubSensorClosed = this.ccu.subscribe({
                    cache: true,
                    change: true,
                    iface: config.ifaceSensor,
                    channel: config.channelSensorClosed.split(' ')[0],
                    datapoint: /STATE|MOTION|SENSOR/
                }, msg => {
                    this.closed = config.directionClosed ? msg.value : !msg.value;
                    this.log(config.channelSensorClosed + ' ' + msg.value + ' closed=' + this.closed);
                    this.updateSensor(false, 'c');
                });
            }

            if (config.channelSensorType.includes('o')) {
                this.debug('subscribe ' + config.channelSensorOpened);
                this.idSubSensorOpened = this.ccu.subscribe({
                    cache: true,
                    change: true,
                    iface: config.ifaceSensor,
                    channel: config.channelSensorOpened.split(' ')[0],
                    datapoint: /STATE|MOTION|SENSOR/
                }, msg => {
                    this.opened = config.directionOpened ? msg.value : !msg.value;
                    this.log(config.channelSensorOpened + ' ' + msg.value + ' openend=' + this.opened);
                    this.updateSensor(false, 'o');
                });
            }

            const getCurrentDoorStateListener = callback => {
                this.debug('get GarageDoorOpener 0 CurrentDoorState ' + this.valueCurrent);
                callback(null, this.valueCurrent);
            };

            const getTargetDoorStateListener = callback => {
                this.debug('get GarageDoorOpener 0 TargetDoorState ' + this.valueTarget);

                callback(null, this.valueTarget);
            };

            const setTargetDoorStateListener = (value, callback) => {
                this.debug('set GarageDoorOpener 0 TargetDoorState ' + value);
                clearTimeout(this.timer);

                const revert = this.moving && ((this.moving - 2) !== value);
                this.debug('revert=' + revert + ' moving=' + this.moving + ' lastMove=' + this.lastMove + ' currentState=' + this.currentState + ' opened=' + this.opened + ' closed=' + this.closed);

                this.moving = value + 2;
                this.lastMove = this.moving;
                this.valueTarget = value;

                this.updateSensor();

                move(value, revert).then(() => {
                    this.timer = setTimeout(() => {
                        this.moving = false;
                        this.updateSensor(true);
                    }, (value ? config.duration : config.durationClose) * 1000);

                    callback(null);
                }).catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
            };

            this.on('input', msg => {
                let value;
                switch (msg.payload) {
                    case 'close':
                        value = 1;
                        break;
                    case 'open':
                        value = 0;
                        break;
                    default:
                        value = value ? 1 : 0;
                }

                if (!this.moving && this.valueCurrent === value) {
                    return;
                }

                const revert = this.moving && ((this.moving - 2) !== value);

                this.moving = value + 2;
                this.lastMove = this.moving;
                this.valueTarget = value;

                move(value, revert).then(() => {
                    this.timer = setTimeout(() => {
                        this.moving = false;
                        this.updateSensor(true);
                    }, (value ? config.duration : config.durationClose) * 1000);
                }).catch(error => {
                    this.error(error);
                });
            });

            service.getCharacteristic(hap.Characteristic.CurrentDoorState).on('get', getCurrentDoorStateListener);
            service.getCharacteristic(hap.Characteristic.TargetDoorState).on('get', getTargetDoorStateListener);
            service.getCharacteristic(hap.Characteristic.TargetDoorState).on('set', setTargetDoorStateListener);

            this.on('close', () => {
                service.getCharacteristic(hap.Characteristic.CurrentDoorState).removeListener('get', getCurrentDoorStateListener);
                service.getCharacteristic(hap.Characteristic.TargetDoorState).removeListener('get', getTargetDoorStateListener);
                service.getCharacteristic(hap.Characteristic.TargetDoorState).removeListener('set', setTargetDoorStateListener);
                if (this.idSubSensorClosed) {
                    this.ccu.unsubscribe(this.idSubSensorClosed);
                }

                if (this.idSubSensorOpened) {
                    this.ccu.unsubscribe(this.idSubSensorOpened);
                }
            });
        }
    }

    RED.nodes.registerType('redmatic-homekit-homematic-garage', RedMaticHomeKitHomematicGarage);
};
