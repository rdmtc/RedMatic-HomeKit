/* Single entry point for HAP-NodeJS. The storage path (pairings, accessory
   identifier cache) must be set before the first accessory is published and
   must stay `<userDir>/homekit` so that pairings from earlier versions
   survive upgrades (ROADMAP D-4). Every node module that needs HAP calls
   `init(RED)` and uses the returned library object; nodes that reach HAP
   through the bridge config node use `bridgeConfig.hap`. */

const path = require('path');
const hap = require('@homebridge/hap-nodejs');

let storagePath;

function init(RED) {
    if (!storagePath) {
        storagePath = path.join(RED.settings.userDir, 'homekit');
        hap.HAPStorage.setCustomStoragePath(storagePath);
    }

    return hap;
}

module.exports = {init, hap};
