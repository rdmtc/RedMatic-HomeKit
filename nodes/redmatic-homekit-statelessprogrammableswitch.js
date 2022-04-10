module.exports = function (RED) {
    class RedMaticHomeKitProgrammableSwitch {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.bridgeConfig = RED.nodes.getNode(config.bridgeConfig);

            if (!this.bridgeConfig) {
                return;
            }

            const {hap, version} = this.bridgeConfig;

            this.name = config.name || ('Switch ' + this.id);
            this.count = Number.parseInt(config.count, 10) || 1;

            const acc = this.bridgeConfig.accessory({id: this.id, name: this.name});

            if (!acc.isConfigured) {
                this.debug('addAccessory Event ' + config.name);

                acc.getService(hap.Service.AccessoryInformation)
                    .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                    .setCharacteristic(hap.Characteristic.Model, 'ProgrammableSwitch')
                    .setCharacteristic(hap.Characteristic.SerialNumber, this.id)
                    .setCharacteristic(hap.Characteristic.FirmwareRevision, version);

                acc.addService(hap.Service.ServiceLabel, 'Buttons', '0')
                    .setCharacteristic(hap.Characteristic.ServiceLabelNamespace, 1);

                for (let index = 1; index <= this.count; index++) {
                    const subtype = String(index);
                    acc.addService(hap.Service.StatelessProgrammableSwitch, 'Button ' + subtype, subtype)
                        .setCharacteristic(hap.Characteristic.ServiceLabelIndex, index)
                        .getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent)
                        .setProps({validValues: [0, 2]});
                }

                acc.isConfigured = true;
            }

            this.on('input', message => {
                let [button, type] = String(message.topic).split('/');
                button = Number.parseInt(button, 10);
                if (button < 1 || button > this.count) {
                    this.error('invalid topic ' + message.topic);
                    return;
                }

                const subtype = String(button);

                const value = /long/i.test(String(type)) ? 2 : 0;

                this.debug('update ' + config.name + ' ' + subtype + ' ProgrammableSwitchEvent ' + (value === 2 ? 'LONG_PRESS' : 'SINGLE_PRESS'));
                acc.getService(subtype).getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent).updateValue(value);
            });
        }
    }

    RED.nodes.registerType('redmatic-homekit-programmableswitch', RedMaticHomeKitProgrammableSwitch);
};
