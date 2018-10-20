module.exports = function (RED) {
    class RedMaticHomeKitUniversal {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.bridgeConfig = RED.nodes.getNode(config.bridgeConfig);

            if (!this.bridgeConfig) {
                return;
            }

            const {hap} = this.bridgeConfig;

            this.name = config.name || ('Universal ' + this.id);
            this.services = config.services || [];

            const acc = this.bridgeConfig.accessory({id: this.id, name: this.name});

            if (!acc.isConfigured) {
                acc.getService(hap.Service.AccessoryInformation)
                    .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                    .setCharacteristic(hap.Characteristic.Model, 'Universal')
                    .setCharacteristic(hap.Characteristic.SerialNumber, this.id)
                    .setCharacteristic(hap.Characteristic.FirmwareRevision, '0');

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
                    const cName = c.displayName.replace(/ /g, '');

                    this.debug('create change listener', s.subtype, cName);

                    const changeListener = obj => {
                        const topic = s.subtype + '/' + cName;
                        this.debug('hap ->', topic, obj.newValue);
                        if (obj && obj.context && obj.context.request) {
                            this.send({
                                topic,
                                payload: obj.newValue
                            });
                        }
                    };

                    this.listeners.push({subtype: s.subtype, characteristic: c, listener: changeListener, cName});

                    c.on('change', changeListener);
                });
            });

            this.on('input', msg => {
                const [subtype, c] = msg.topic.split('/');
                const service = acc.getService(subtype);
                if (service) {
                    if (service.testCharacteristic(hap.Characteristic[c])) {
                        if (typeof msg.payload === 'object') {
                            this.debug('setProps ' + msg.topic + ' ' + JSON.stringify(msg.payload));
                            service.getCharacteristic(hap.Characteristic[c]).setProps(msg.payload);
                        } else {
                            this.debug('-> hap ' + msg.topic + ' ' + msg.payload);
                            service.updateCharacteristic(hap.Characteristic[c], msg.payload);
                        }
                    } else {
                        this.error('unknown characteristic ' + c + ' on subtype ' + subtype);
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
    }

    RED.nodes.registerType('redmatic-homekit-universal', RedMaticHomeKitUniversal);
};
