module.exports = class HmLcJa1 {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const datapointLevel = config.iface + '.' + config.description.ADDRESS + ':1.LEVEL';
        const datapointDirection = config.iface + '.' + config.description.ADDRESS + ':1.DIRECTION';

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        const datapointLevelSlats = config.iface + '.' + config.description.ADDRESS + ':1.LEVEL_SLATS';

        let workingSlats = false;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        function getCurrent() {
            return ((ccu.values && ccu.values[datapointLevel] && ccu.values[datapointLevel].value) * 100) || 0;
        }

        function getCurrentSlat() {
            return (((ccu.values && ccu.values[datapointLevelSlats] && ccu.values[datapointLevelSlats].value) * 180) - 90) || 0;
        }

        function getTarget() {
            return ((ccu.values && ccu.values[datapointLevel] && ccu.values[datapointLevel].value) * 100) || 0;
        }

        function getTargetSlat() {
            return (((ccu.values && ccu.values[datapointLevelSlats] && ccu.values[datapointLevelSlats].value) * 180) - 90) || 0;
        }

        function getState() {
            switch (ccu.values && ccu.values[datapointDirection] && ccu.values[datapointDirection].value) {
                case 1:
                    return hap.Characteristic.PositionState.INCREASING;
                case 2:
                    return hap.Characteristic.PositionState.DECREASING;
                default:
                    return hap.Characteristic.PositionState.STOPPED;
            }
        }

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});
        const subtype = '0';

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

            acc.addService(hap.Service.WindowCovering, config.name, subtype)
                .updateCharacteristic(hap.Characteristic.CurrentPosition, getCurrent())
                .updateCharacteristic(hap.Characteristic.CurrentVerticalTiltAngle, getCurrentSlat())
                .updateCharacteristic(hap.Characteristic.TargetPosition, getTarget())
                .updateCharacteristic(hap.Characteristic.TargetVerticalTiltAngle, getTargetSlat())
                .updateCharacteristic(hap.Characteristic.PositionState, getState());

            acc.isConfigured = true;
        }

        const setListenerTargetPosition = (value, callback) => {
            homematic.debug('set ' + config.name + ' 0 TargetPosition ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'LEVEL', value / 100)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const getListenerCurrentPosition = callback => {
            homematic.debug('get ' + config.name + ' 0 CurrentPosition ' + getError() + ' ' + getCurrent());
            callback(getError(), getCurrent());
        };
        const getListenerTargetPosition = callback => {
            homematic.debug('get ' + config.name + ' 0 TargetPosition ' + getError() + ' ' + getTarget());
            callback(getError(), getTarget());
        };

        const setListenerTargetVerticalTiltAngle = (value, callback) => {
            homematic.debug('set ' + config.name + ' 0 TargetVerticalTiltAngle ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':1', 'LEVEL_SLATS', (value + 90) / 180)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const getListenerCurrentVerticalTiltAngle = callback => {
            homematic.debug('get ' + config.name + ' 0 CurrentVerticalTiltAngle ' + getError() + ' ' + getCurrentSlat());
            callback(getError(), getCurrentSlat());
        };
        const getListenerTargetVerticalTiltAngle = callback => {
            homematic.debug('get ' + config.name + ' 0 TargetVerticalTiltAngle ' + getError() + ' ' + getTargetSlat());
            callback(getError(), getTargetSlat());
        };

        const getListenerPositionState = callback => {
            homematic.debug('get ' + config.name + ' 0 PositionState ' + getError() + ' ' + getState());
            callback(getError(), getState());
        };

        acc.getService(subtype).getCharacteristic(hap.Characteristic.CurrentPosition).on('get', getListenerCurrentPosition);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetPosition).on('get', getListenerTargetPosition);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetPosition).on('set', setListenerTargetPosition);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.CurrentPosition).on('get', getListenerCurrentVerticalTiltAngle);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetPosition).on('get', getListenerTargetVerticalTiltAngle);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetPosition).on('set', setListenerTargetVerticalTiltAngle);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.PositionState).on('get', getListenerPositionState);

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
                case '1.LEVEL':
                    if (!msg.working) {
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.CurrentPosition, getCurrent());
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.TargetPosition, getTarget());
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.PositionState, getState());
                    }
                    break;
                case '1.DIRECTION':
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.PositionState, getState());
                    break;
                case '1.LEVEL_SLATS':
                    if (!msg.working && !workingSlats) {
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.CurrentVerticalTiltAngle, getCurrentSlat());
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.TargetVerticalTiltAngle, getTargetSlat());
                    }
                    break;
                case '1.WORKING_SLATS':
                    workingSlats = msg.value;
                    break;
                default:
            }
        });

        homematic.on('close', () => {
            homematic.debug('removing listeners ' + config.name);
            ccu.unsubscribe(idSubscription);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.CurrentPosition).removeListener('get', getListenerCurrentPosition);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetPosition).removeListener('get', getListenerTargetPosition);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetPosition).removeListener('set', setListenerTargetPosition);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.CurrentPosition).removeListener('get', getListenerCurrentVerticalTiltAngle);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetPosition).removeListener('get', getListenerTargetVerticalTiltAngle);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetPosition).removeListener('set', setListenerTargetVerticalTiltAngle);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.PositionState).removeListener('get', getListenerPositionState);
        });
    }
};

