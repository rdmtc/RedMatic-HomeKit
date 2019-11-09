const fs = require('fs');
const path = require('path');

module.exports = function (RED) {
    const knownDevices = {};

    RED.httpAdmin.get('/redmatic-homekit/zigbee-devices', RED.auth.needsPermission('redmatic.read'), (req, res) => {
        if (knownDevices[req.query.id]) {
            const devices = knownDevices[req.query.id].map(d => {
                return {
                    ieeeAddr: d.ieeeAddr,
                    name: d.meta.name,
                    manufacturerName: d.manufacturerName,
                    modelID: d.modelID
                };
            });
            res.status(200).send(JSON.stringify(devices));
        } else {
            res.status(500).send(`500 Internal Server Error: Unknown Herdsman ID ${req.query.id}`);
        }
    });

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

            knownDevices[this.id] = [];
            this.deviceConfig = config.deviceConfig;

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

                console.log(this.deviceConfig);
                this.devices.forEach(device => {
                    const Adapter = this.findAdapter(device);
                    if (Adapter) {
                        knownDevices[this.id].push(device);

                        if (this.deviceConfig[device.ieeeAddr] && this.deviceConfig[device.ieeeAddr].enabled) {
                            /* eslint-disable-next-line no-new */
                            new Adapter(this, device);
                        } else {
                            this.debug(`device disabled ${device.ieeeAddr} ${device.meta.name}`);
                        }
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

