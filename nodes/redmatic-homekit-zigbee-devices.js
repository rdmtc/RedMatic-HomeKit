module.exports = function (RED) {
    class RedmaticHomekitZigbeeDevices {
        constructor(config) {
            RED.nodes.createNode(this, config);
        }
    }
    RED.nodes.registerType('redmatic-homekit-zigbee-devices', RedmaticHomekitZigbeeDevices);
};


