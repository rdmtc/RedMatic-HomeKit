const fs = require('fs');
const path = require('path');

module.exports = function (RED) {
    const knownDevices = {};

    RED.httpAdmin.get('/redmatic-homekit/zigbee-devices', RED.auth.needsPermission('redmatic.read'), (request, response) => {
        if (knownDevices[request.query.id]) {
            const devices = knownDevices[request.query.id].map(d => ({
                ieeeAddr: d.ieeeAddr,
                name: d.meta.name,
                manufacturerName: d.manufacturerName,
                modelID: d.modelID,
            }));
            response.status(200).send(JSON.stringify(devices));
        } else {
            response.status(500).send(`500 Internal Server Error: Unknown Herdsman ID ${request.query.id}`);
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

            for (const file of fs.readdirSync(path.join(__dirname, '..', 'zigbee-devices'))) {
                if (file.endsWith('.js')) {
                    this.zigbeeDevices.push(require(path.join(__dirname, '..', 'zigbee-devices', file)));
                }
            }

            this.proxy.on('ready', () => {
                this.devices = this.herdsman.getDevices();

                for (const device of this.devices) {
                    const Adapter = this.findAdapter(device);
                    if (Adapter) {
                        knownDevices[this.id].push(device);

                        if (this.deviceConfig[device.ieeeAddr] && this.deviceConfig[device.ieeeAddr].enabled) {
                            /* eslint-disable-next-line no-new */
                            new Adapter(this, device);
                        } else {
                            this.debug(`device disabled ${device.ieeeAddr} ${device.meta.name}`);
                        }
                    } else {
                        this.debug(`no adapter found for ${device.ieeeAddr} ${device.meta.name}`);
                    }
                }
            });
        }

        findAdapter(device) {
            if (device.modelID === 'lumi.router') {
                return;
            }

            let dev = this.zigbeeDevices.find(d => (!device.manufacturerName || d.manufacturerName.includes(device.manufacturerName)) && d.modelID.includes(device.modelID));
            if (!dev) {
                const epFirst = device.endpoints[0];
                this.debug('search adapter by deviceID ' + epFirst.deviceID);
                dev = this.zigbeeDevices.find(d => (d.deviceID && d.deviceID.includes(epFirst.deviceID)));
            }

            return dev;
        }
    }
    RED.nodes.registerType('redmatic-homekit-zigbee-devices', RedmaticHomekitZigbeeDevices);
};

