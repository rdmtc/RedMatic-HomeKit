module.exports = class HmipPcbs {
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

        const datapointLowbat = config.iface + '.' + config.description.ADDRESS + ':0.LOW_BAT';
        let lowbat = (ccu.values && ccu.values[datapointLowbat] && ccu.values[datapointLowbat].value) ?
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
            hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const datapointVoltage = config.iface + '.' + config.description.ADDRESS + ':0.OPERATING_VOLTAGE';
        let voltage = batteryPercent(ccu.values && ccu.values[datapointVoltage] && ccu.values[datapointVoltage].value) || 0;

        const datapointOn = config.iface + '.' + config.description.ADDRESS + ':3.STATE';
        let valueOn = ccu.values && ccu.values[datapointOn] && ccu.values[datapointOn].value;

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

            acc.addService(hap.Service.Switch, config.name, subtype)
                .updateCharacteristic(hap.Characteristic.On, valueOn);

            acc.addService(hap.Service.BatteryService, config.name, subtypeBattery);

            acc.isConfigured = true;
        }

        const setListener = (value, callback) => {
            homematic.debug('set ' + config.name + ' 0 On ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':3', 'STATE', value)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const getListener = callback => {
            homematic.debug('get ' + config.name + ' 0 On ' + getError() + ' ' + valueOn);
            callback(getError(), valueOn);
        };

        const getListenerLowbat = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + getError() + ' ' + lowbat);
            callback(null, lowbat);
        };

        const getListenerVoltage = callback => {
            homematic.debug('get ' + config.name + ' ' + subtypeBattery + ' BatteryLevel ' + getError() + ' ' + voltage);
            callback(null, voltage);
        };

        acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('get', getListener);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.On).on('set', setListener);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).on('get', getListenerLowbat);
        acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).on('get', getListenerVoltage);

        const idSubscription = ccu.subscribe({
            iface: config.iface,
            device: config.description.ADDRESS,
            cache: true,
            change: true
        }, msg => {
            switch (msg.channelIndex + '.' + msg.datapoint) {
                case '0.UNREACH':
                    unreach = msg.value;
                    break;
                case '0.LOW_BAT':
                    lowbat = msg.value ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' StatusLowBattery ' + lowbat);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.StatusLowBattery, lowbat);
                    break;
                case '0.OPERATING_VOLTAGE':
                    voltage = batteryPercent(msg.value);
                    homematic.debug('update ' + config.name + ' ' + subtypeBattery + ' BatteryLevel ' + voltage);
                    acc.getService(subtypeBattery).updateCharacteristic(hap.Characteristic.BatteryLevel, voltage);
                    break;
                case '3.STATE':
                    valueOn = msg.value;
                    homematic.debug('update ' + config.name + ' ' + subtype + ' On ' + valueOn);
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.On, valueOn);
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('get', getListener);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.On).removeListener('set', setListener);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.StatusLowBattery).removeListener('get', getListenerLowbat);
            acc.getService(subtypeBattery).getCharacteristic(hap.Characteristic.BatteryLevel).removeListener('get', getListenerVoltage);
        });
    }
};
