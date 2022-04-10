module.exports = function (RED) {
    class RedMaticHomeKitSwitch {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.bridgeConfig = RED.nodes.getNode(config.bridgeConfig);

            if (!this.bridgeConfig) {
                return;
            }

            const {hap, version} = this.bridgeConfig;

            this.name = config.name || ('Switch ' + this.id);

            const acc = this.bridgeConfig.accessory({id: this.id, name: this.name});

            const subtype = '0';
            this.valueOn = false;
            this.failure = false;

            if (!acc.isConfigured) {
                acc.getService(hap.Service.AccessoryInformation)
                    .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                    .setCharacteristic(hap.Characteristic.Model, 'Switch')
                    .setCharacteristic(hap.Characteristic.SerialNumber, this.id)
                    .setCharacteristic(hap.Characteristic.FirmwareRevision, version);

                acc.addService(hap.Service.Switch, this.name, subtype);

                acc.isConfigured = true;
            }

            const setListener = (value, callback) => {
                this.log('set Switch 0 On ' + value);
                this.send({payload: value});
                callback();
            };

            const getListener = callback => {
                this.log('get Switch 0 On ' + this.valueOn);
                callback(null, this.valueOn);
            };

            const update = () => {
                acc.getService(subtype).updateCharacteristic(hap.Characteristic.On, this.valueOn);
            };

            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('set', setListener);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('get', getListener);

            this.on('input', message => {
                this.valueOn = Boolean(message.payload);
                update();
            });

            if (this.bridgeConfig.published) {
                update();
            } else {
                this.bridgeConfig.once('published', () => {
                    update();
                });
            }

            this.on('close', () => {
                acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener);
                acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener);
            });
        }
    }

    RED.nodes.registerType('redmatic-homekit-switch', RedMaticHomeKitSwitch);
};
