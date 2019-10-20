const fs = require('fs');
const path = require('path');

module.exports = function (RED) {
    class RedmaticHomekitZigbeeDevices {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.bridgeConfig = RED.nodes.getNode(config.bridgeConfig);

            if (!this.bridgeConfig) {
                return;
            }

            this.herdsmanNode = RED.nodes.getNode(config.herdsman);

            if (!this.herdsmanNode) {
                return;
            }

            this.herdsman = this.herdsmanNode.herdsman;

            this.proxy = this.herdsmanNode.proxy;

            this.zigbeeDevices = [];

            fs.readdirSync(path.join(__dirname, '..', 'zigbee-devices')).forEach(file => {
                if (file.endsWith('.js')) {
                    this.zigbeeDevices.push(require(path.join(__dirname, '..', 'zigbee-devices', file)));
                }
            });

            this.proxy.on('ready', () => {
                this.devices = this.herdsman.getDevices();

                this.devices.forEach(device => {
                    const Adapter = this.findAdapter(device);
                    if (Adapter) {
                        /* eslint-disable-next-line no-new */
                        new Adapter(this, device);
                    }
                });
            });
        }

        findAdapter(device) {
            if (device.modelID === 'lumi.router') {
                return;
            }

            let dev = this.zigbeeDevices.find(d => (!device.manufacturerName || d.manufacturerName.includes(device.manufacturerName)) && d.modelID.includes(device.modelID));
            if (!dev) {
                const epFirst = device.endpoints[0];
                dev = this.zigbeeDevices.find(d => (d.deviceID && d.deviceID.includes(epFirst.deviceID)));
            }

            return dev;
        }
    }
    RED.nodes.registerType('redmatic-homekit-zigbee-devices', RedmaticHomekitZigbeeDevices);
};

