module.exports = function (RED) {
    class RedMaticHomeKitUniversal {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.bridgeConfig = RED.nodes.getNode(config.bridgeConfig);

            if (!this.bridgeConfig) {
                return;
            }

            const {hap, version} = this.bridgeConfig;

            this.name = config.name || ('Universal ' + this.id);
            this.services = config.services || [];

            const acc = this.bridgeConfig.accessory({id: this.id, name: this.name});

            if (!acc.isConfigured) {
                acc.getService(hap.Service.AccessoryInformation)
                    .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                    .setCharacteristic(hap.Characteristic.Model, 'Universal')
                    .setCharacteristic(hap.Characteristic.SerialNumber, this.id)
                    .setCharacteristic(hap.Characteristic.FirmwareRevision, version);

                for (const s of this.services) {
                    this.debug('addService ' + s.subtype + ' ' + s.service + ' ' + s.name);
                    acc.addService(hap.Service[s.service], s.name, s.subtype);
                }

                acc.isConfigured = true;
            }

            this.listeners = [];

            for (const s of this.services) {
                let service = acc.getService(s.subtype);
                if (!service) {
                    this.debug('addService ' + s.subtype + ' ' + s.service + ' ' + s.name);
                    service = acc.addService(hap.Service[s.service], s.name, s.subtype);
                }

                for (const c of service.characteristics) {
                    this.addListener(s.subtype, c);
                }
            }

            this.on('input', message => {
                const [subtype, c] = message.topic.split('/');
                const service = acc.getService(subtype);
                if (service) {
                    if (!this.hasListener(subtype, c)) {
                        this.addListener(subtype, service.getCharacteristic(hap.Characteristic[c]));
                    }

                    if (typeof message.payload === 'object') {
                        this.debug('setProps ' + message.topic + ' ' + JSON.stringify(message.payload));
                        service.getCharacteristic(hap.Characteristic[c]).setProps(message.payload);
                    } else {
                        this.debug('-> hap ' + message.topic + ' ' + message.payload);
                        service.updateCharacteristic(hap.Characteristic[c], message.payload);
                    }
                } else {
                    this.error('unknown subtype ' + subtype);
                }
            });

            this.on('close', () => {
                for (const l of this.listeners) {
                    this.debug('remove change listener ' + l.subtype + ' ' + l.cName);
                    l.characteristic.removeListener('change', l.listener);
                }
            });
        }

        addListener(subtype, c) {
            const cName = c.displayName.replace(/ /g, '');
            this.debug('create change listener ' + subtype + ' ' + cName);

            const changeListener = object => {
                const topic = subtype + '/' + cName;
                this.debug('hap -> ' + topic + ' ' + object.newValue);
                if (object && object.context && object.context.request) {
                    this.send({
                        topic,
                        payload: object.newValue,
                    });
                }
            };

            this.listeners.push({subtype, characteristic: c, listener: changeListener, cName});

            c.on('change', changeListener);
        }

        hasListener(subtype, characteristicName) {
            let result = false;
            for (const l of this.listeners) {
                if (subtype === l.subtype && characteristicName === l.cName) {
                    result = true;
                }
            }

            return result;
        }
    }

    RED.nodes.registerType('redmatic-homekit-universal', RedMaticHomeKitUniversal);
};
