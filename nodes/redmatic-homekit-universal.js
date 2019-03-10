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

                this.services.forEach(s => {
                    this.debug('addService ' + s.subtype + ' ' + s.service + ' ' + s.name);
                    acc.addService(hap.Service[s.service], s.name, s.subtype);
                });

                acc.isConfigured = true;
            }

            this.listeners = [];

            this.services.forEach(s => {
                let service = acc.getService(s.subtype);
                if (!service) {
                    this.debug('addService ' + s.subtype + ' ' + s.service + ' ' + s.name);
                    service = acc.addService(hap.Service[s.service], s.name, s.subtype);
                }
                service.characteristics.forEach(c => {
                    this.addListener(s.subtype, c);
                });
            });

            this.on('input', msg => {
                const [subtype, c] = msg.topic.split('/');
                const service = acc.getService(subtype);
                if (service) {
                    if (!this.hasListener(subtype, c)) {
                        this.addListener(subtype, service.getCharacteristic(hap.Characteristic[c]));
                    }
                    if (typeof msg.payload === 'object') {
                        this.debug('setProps ' + msg.topic + ' ' + JSON.stringify(msg.payload));
                        service.getCharacteristic(hap.Characteristic[c]).setProps(msg.payload);
                    } else {
                        this.debug('-> hap ' + msg.topic + ' ' + msg.payload);
                        service.updateCharacteristic(hap.Characteristic[c], msg.payload);
                    }
                } else {
                    this.error('unknown subtype ' + subtype);
                }
            });

            this.on('close', () => {
                this.listeners.forEach(l => {
                    this.debug('remove change listener ' + l.subtype + ' ' + l.cName);
                    l.characteristic.removeListener('change', l.listener);
                });
            });
        }

        addListener(subtype, c) {
            const cName = c.displayName.replace(/ /g, '');
            this.debug('create change listener ' + subtype + ' ' + cName);

            const changeListener = obj => {
                const topic = subtype + '/' + cName;
                this.debug('hap -> ' + topic + ' ' + obj.newValue);
                if (obj && obj.context && obj.context.request) {
                    this.send({
                        topic,
                        payload: obj.newValue
                    });
                }
            };

            this.listeners.push({subtype, characteristic: c, listener: changeListener, cName});

            c.on('change', changeListener);
        }

        hasListener(subtype, characteristicName) {
            let res = false;
            this.listeners.forEach(l => {
                if (subtype === l.subtype && characteristicName === l.cName) {
                    res = true;
                }
            });
            return res;
        }
    }

    RED.nodes.registerType('redmatic-homekit-universal', RedMaticHomeKitUniversal);
};
