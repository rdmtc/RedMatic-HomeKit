module.exports = class HmipSwd {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        function batteryPercent(val) {
            let p = Math.round((val - 2) * 100);
            if (p < 0) {
                p = 0;
            } else if (p > 100) {
                p = 100;
            }
            return p;
        }

        const datapointMoistureDetected = config.iface + '.' + config.description.ADDRESS + ':1.MOISTURE_DETECTED';
        let moisture = (ccu.values && ccu.values[datapointMoistureDetected] && ccu.values[datapointMoistureDetected].value);

        const datapointWaterLevelDetected = config.iface + '.' + config.description.ADDRESS + ':1.MOISTURE_DETECTED';
        let water = (ccu.values && ccu.values[datapointWaterLevelDetected] && ccu.values[datapointWaterLevelDetected].value);

        function getLeak() {
            return moisture || water;
        }

        const datapointLowBat = config.iface + '.' + config.description.ADDRESS + ':0.LOW_BAT';
        let lowBat = (ccu.values && ccu.values[datapointLowBat] && ccu.values[datapointLowBat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointVoltage = config.iface + '.' + config.description.ADDRESS + ':0.OPERATING_VOLTAGE';
        let voltage = batteryPercent(ccu.values && ccu.values[datapointVoltage] && ccu.values[datapointVoltage].value) || 0;

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtype = '0';
        const subtypeBattery = '1';

        if (!acc.isConfigured) {
            acc.getService(hap.Service.AccessoryInformation)
                .setCharacteristic(hap.Characteristic.Manufacturer, 'eQ-3')
                .setCharacteristic(hap.Characteristic.Model, config.description.TYPE)
                .setCharacteristic(hap.Characteristic.SerialNumber, config.description.ADDRESS)
                .setCharacteristic(hap.Characteristic.FirmwareRevision, config.description.FIRMWARE);

            acc.on('identify', (paired, callback) => {
                homematic.log('identify ' + config.name + ' ' + config.description.TYPE + ' ' + config.description.ADDRESS);
                callback();
            });

            acc.addService(hap.Service.LeakSensor, config.name, subtype)
                .updateCharacteristic(hap.Characteristic.LeakDetected, getLeak())
                .updateCharacteristic(hap.Characteristic.StatusFault, unreach);

            acc.addService(hap.Service.LeakSensor, config.name, subtypeBattery)
                .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowBat)
                .updateCharacteristic(hap.Characteristic.BatteryLevel, voltage);

            acc.isConfigured = true;
        }

        const getListenerLeak = callback => {
            homematic.debug('get ' + config.name + ' 0 LeakDetected ' + getError() + ' ' + moisture);
            callback(null, moisture);
        };

        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' 1 StatusLowBattery ' + getError() + ' ' + lowBat);
            callback(null, lowBat);
        };

        const getListenerVoltage = callback => {
            homematic.debug('get ' + config.name + ' 1 BatteryLevel ' + getError() + ' ' + voltage);
            callback(null, voltage);
        };

        const getListenerFault = callback => {
            homematic.debug('get ' + config.name + ' 0 StatusFault ' + getError() + ' ' + unreach);
            callback(null, unreach);
        };

        acc.getService(subtype).getCharacteristic(hap.Characteristic.ContactSensorState).on('get', getListenerLeak);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).on('get', getListenerVoltage);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusFault).on('get', getListenerFault);

        const idSubscription = ccu.subscribe({
            iface: config.iface,
            device: config.description.ADDRESS,
            cache: true,
            change: true
        }, msg => {
            switch (msg.channelIndex + '.' + msg.datapoint) {
                case '0.UNREACH':
                    unreach = msg.value;
                    homematic.debug('update ' + config.name + ' 0 StatusFault ' + unreach);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.StatusFault, unreach);
                    break;
                case '0.LOW_BAT':
                    lowBat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' 0 StatusLowBattery ' + lowBat);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowBat);
                    break;
                case '0.OPERATING_VOLTAGE':
                    voltage = batteryPercent(msg.value);
                    homematic.debug('update ' + config.name + ' 2 BatteryLevel ' + voltage);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.BatteryLevel, voltage);
                    break;
                case '1.MOISTURE_DETECTED':
                    moisture = msg.value;
                    homematic.debug('update ' + config.name + ' 0 LeakDetected ' + getLeak());
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.LeakDetected, getLeak());
                    break;
                case '1.WATERLEVEL_DETECTED':
                    water = msg.value;
                    homematic.debug('update ' + config.name + ' 0 LeakDetected ' + getLeak());
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.LeakDetected, getLeak());
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.LeakDetected).removeListener('get', getListenerLeak);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.StatusFault).removeListener('get', getListenerFault);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).removeListener('get', getListenerVoltage);
        });
    }
};
