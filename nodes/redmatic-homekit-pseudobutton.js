module.exports = function (RED) {
    class RedMaticHomeKitPseudobutton {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.bridgeConfig = RED.nodes.getNode(config.bridgeConfig);

            if (!this.bridgeConfig) {
                return;
            }

            const {hap, version} = this.bridgeConfig;

            this.name = config.name || ('Pseudobutton ' + this.id);
            this.payload = config.payload;
            this.payloadType = config.payloadType;

            const acc = this.bridgeConfig.accessory({id: this.id, name: this.name});

            const subtype = '0';

            if (!acc.isConfigured) {
                acc.getService(hap.Service.AccessoryInformation)
                    .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                    .setCharacteristic(hap.Characteristic.Model, 'Pseudobutton')
                    .setCharacteristic(hap.Characteristic.SerialNumber, this.id)
                    .setCharacteristic(hap.Characteristic.FirmwareRevision, version);

                acc.addService(hap.Service.Switch, this.name, subtype);

                acc.isConfigured = true;
            }

            const setListener = (value, callback) => {
                this.log('set Switch 0 On ' + value);
                if (value) {
                    const msg = {};
                    msg.topic = config.topic;
                    if (this.payloadType !== 'flow' && this.payloadType !== 'global') {
                        try {
                            if ((!this.payloadType && !this.payload) || this.payloadType === 'date') {
                                msg.payload = Date.now();
                            } else if (!this.payloadType) {
                                msg.payload = this.payload;
                            } else if (this.payloadType === 'none') {
                                msg.payload = '';
                            } else {
                                msg.payload = RED.util.evaluateNodeProperty(this.payload, this.payloadType, this, msg);
                            }
                            this.send(msg);
                        } catch (error) {
                            this.error(error, msg);
                        }
                    } else {
                        RED.util.evaluateNodeProperty(this.payload, this.payloadType, this, msg, (err, res) => {
                            if (err) {
                                this.error(err, msg);
                            } else {
                                msg.payload = res;
                                this.send(msg);
                            }
                        });
                    }

                    setTimeout(() => {
                        this.log('update Switch 0 On false');
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.On, false);
                    }, 250);
                }
                callback();
            };

            const getListener = callback => {
                this.log('get Switch 0 On false');
                callback(null, false);
            };

            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('set', setListener);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('get', getListener);

            this.on('close', () => {
                acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener);
                acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener);
            });
        }
    }

    RED.nodes.registerType('redmatic-homekit-pseudobutton', RedMaticHomeKitPseudobutton);
};
