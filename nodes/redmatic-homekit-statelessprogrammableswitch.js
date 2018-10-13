module.exports = function (RED) {
    class RedMaticHomeKitProgrammableSwitch {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.bridgeConfig = RED.nodes.getNode(config.bridgeConfig);

            if (!this.bridgeConfig) {
                return;
            }

            const {hap} = this.bridgeConfig;

            this.name = config.name || ('Switch ' + this.id);

            const acc = this.bridgeConfig.accessory({id: this.id, name: this.name});


            if (!acc.isConfigured) {
                this.debug('addAccessory Event ' + config.name);

                acc.getService(hap.Service.AccessoryInformation)
                    .setCharacteristic(hap.Characteristic.Manufacturer, 'RedMatic')
                    .setCharacteristic(hap.Characteristic.Model, 'ProgrammableSwitch')
                    .setCharacteristic(hap.Characteristic.SerialNumber, this.id)
                    .setCharacteristic(hap.Characteristic.FirmwareRevision, '0');

                acc.addService(hap.Service.ServiceLabel, 'Buttons', '0')
                    .setCharacteristic(hap.Characteristic.ServiceLabelNamespace, 1);

                ['1', '2', '3', '4', '5', '6', '7', '8'].forEach((subtype, index) => {
                    acc.addService(hap.Service.StatelessProgrammableSwitch, 'Button ' + subtype, subtype)
                        .setCharacteristic(hap.Characteristic.ServiceLabelIndex, index + 1)
                        .getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent)
                        .setProps({validValues: [0, 2]});
                });

                acc.isConfigured = true;
            }

            this.on('input', msg => {
                let [button, type] = String(msg.topic).split('/');
                button = parseInt(button, 10);
                if (button < 1 || button > 8) {
                    this.error('invalid topic ' + msg.topic);
                    return;
                }
                const subtype = String(button);

                let val;
                if (String(type).match(/long/i)) {
                    val = 2;
                } else {
                    val = 0;
                }

                this.debug('update ' + config.name + ' ' + subtype + ' ProgrammableSwitchEvent ' + (val === 2 ? 'LONG_PRESS' : 'SINGLE_PRESS'));
                acc.getService(subtype).getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent).updateValue(val);
            });
        }
    }

    RED.nodes.registerType('redmatic-homekit-programmableswitch', RedMaticHomeKitProgrammableSwitch);
};
