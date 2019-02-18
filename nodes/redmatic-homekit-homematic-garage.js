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

            this.closed = false;
            this.opened = false;

            const move = direction => {
                let channel;
                switch (config.channelActuatorType) {
                    case '1':
                        channel = config.channelActuator;
                        break;
                    case '2':
                        channel = direction === 0 ? config.channelActuatorOpen : config.channelActuatorClose;
                        break;
                    default:
                }
                channel = channel.split(' ')[0];
                const dev = this.ccu.metadata.devices[config.ifaceActuator] && this.ccu.metadata.devices[config.ifaceActuator][channel];
                const ps = this.ccu.getParamsetDescription(config.ifaceActuator, dev, 'VALUES');
                if (ps && ps.STATE) {
                    if (ps.ON_TIME) {
                        return this.ccu.methodCall(config.ifaceActuator, 'putParamset', [channel, 'VALUES', {
                            STATE: true,
                            ON_TIME: parseFloat(config.onTime) || 0.4
                        }]);
                    }
                    return new Promise((resolve, reject) => {
                        this.ccu.setValue(config.ifaceActuator, channel, 'STATE', true)
                            .then(() => {
                                setTimeout(() => {
                                    this.ccu.setValue(config.ifaceActuator, channel, 'STATE', false)
                                        .then(() => {
                                            resolve();
                                        })
                                        .catch(reject);
                                }, (config.onTime || 0.4) * 1000);
                            })
                            .catch(reject);
                    });
                }
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
            this.valueCurrent = 4;

            this.updateSensor = () => {
                if (!this.moving) {
                    let valueCurrent;
                    switch (config.channelSensorType) {
                        case 'o': {
                            valueCurrent = this.opened ? 0 : 1;
                            break;
                        }
                        case 'c': {
                            valueCurrent = this.closed ? 1 : 0;
                            break;
                        }
                        default: {
                            if (this.opened && !this.closed) {
                                valueCurrent = 0;
                            } else if (this.closed && !this.opened) {
                                valueCurrent = 1;
                            } else {
                                valueCurrent = 4;
                            }
                        }
                    }
                    this.valueCurrent = valueCurrent;
                    this.valueTarget = valueCurrent;
                }

                let text = 'stopped';
                let fill = 'yellow';
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
                this.debug('set GarageDoorOpener 0 CurrentDoorState ' + this.valueCurrent);
                service.updateCharacteristic(hap.Characteristic.CurrentDoorState, this.valueCurrent);
                this.debug('set GarageDoorOpener 0 TargetDoorState ' + this.valueTarget);
                service.updateCharacteristic(hap.Characteristic.TargetDoorState, this.valueTarget);
            };

            if (config.channelSensorType.includes('c')) {
                this.debug('subscribe ' + config.channelSensorClosed);
                this.idSubSensorClosed = this.ccu.subscribe({
                    iface: config.ifaceSensor,
                    channel: config.channelSensorClosed.split(' ')[0],
                    datapoint: /STATE|MOTION|SENSOR/
                }, msg => {
                    this.closed = config.directionClosed ? msg.value : !msg.value;
                    this.log(config.channelSensorClosed + ' ' + msg.value + ' ' + this.closed);
                    this.updateSensor();
                });
            }

            if (config.channelSensorType.includes('o')) {
                this.debug('subscribe ' + config.channelSensorOpened);
                this.idSubSensorOpened = this.ccu.subscribe({
                    iface: config.ifaceSensor,
                    channel: config.channelSensorOpened.split(' ')[0],
                    datapoint: /STATE|MOTION|SENSOR/
                }, msg => {
                    this.opened = config.directionOpened ? msg.value : !msg.value;
                    this.log(config.channelSensorOpened + ' ' + msg.value + ' ' + this.opened);
                    this.updateSensor();
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
                this.moving = true;
                this.valueTarget = value;
                switch (value) {
                    case 0:
                        this.valueCurrent = 2;
                        break;
                    case 1:
                        this.valueCurrent = 3;
                        break;
                    default:
                }
                this.updateSensor();
                this.timer = setTimeout(() => {
                    this.moving = false;
                    this.updateSensor();
                }, config.duration * 1000);
                move(value).then(() => {
                    callback(null);
                }).catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
            };

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
