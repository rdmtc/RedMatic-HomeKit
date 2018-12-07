module.exports = class HmipBbl {
    constructor(config, homematic) {
        const {bridgeConfig, ccu} = homematic;
        const {hap} = bridgeConfig;

        homematic.debug('creating Homematic Device ' + config.description.TYPE + ' ' + config.name);

        const datapointLevel = config.iface + '.' + config.description.ADDRESS + ':4.LEVEL';
        const datapointLevel2 = config.iface + '.' + config.description.ADDRESS + ':4.LEVEL_2';
        const datapointDirection = config.iface + '.' + config.description.ADDRESS + ':4.ACTIVITY_STATE';

        const datapointUnreach = config.iface + '.' + config.description.ADDRESS + ':0.UNREACH';
        let unreach = ccu.values && ccu.values[datapointUnreach] && ccu.values[datapointUnreach].value;

        function getError() {
            return unreach ? new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE) : null;
        }

        function getCurrent() {
            return ((ccu.values && ccu.values[datapointLevel] && ccu.values[datapointLevel].value) * 100) || 0;
        }

        function getTarget() {
            return ((ccu.values && ccu.values[datapointLevel] && ccu.values[datapointLevel].value) * 100) || 0;
        }

        function getCurrent2() {
            return (((ccu.values && ccu.values[datapointLevel2] && ccu.values[datapointLevel2].value) * 180) - 90) || 0;
        }

        function getTarget2() {
            return (((ccu.values && ccu.values[datapointLevel2] && ccu.values[datapointLevel2].value) * 180) - 90) || 0;
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

        const acc = bridgeConfig.accessory({id: config.description.ADDRESS, uuidAddition: '-v2', name: config.name});
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
                .updateCharacteristic(hap.Characteristic.TargetPosition, getTarget())
                .updateCharacteristic(hap.Characteristic.PositionState, getState())
                .updateCharacteristic(hap.Characteristic.CurrentVerticalTiltAngle, getCurrent2())
                .updateCharacteristic(hap.Characteristic.TargetVerticalTiltAngle, getTarget2());

            acc.isConfigured = true;
        }

        const setListenerTargetPosition = (value, callback) => {
            homematic.debug('set ' + config.name + ' 0 TargetPosition ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'LEVEL', value / 100)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        };

        const setTargetVerticalTiltAngle = (value, callback) => {
            homematic.debug('set ' + config.name + ' 0 TargetVerticalTiltAngle ' + value);
            ccu.setValue(config.iface, config.description.ADDRESS + ':4', 'LEVEL_2', (value + 90) / 100)
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
        const getCurrentVerticalTiltAngle = callback => {
            homematic.debug('get ' + config.name + ' 0 CurrentVerticalTiltAngle ' + getError() + ' ' + getCurrent2());
            callback(getError(), getCurrent2());
        };
        const getTargetVerticalTiltAngle = callback => {
            homematic.debug('get ' + config.name + ' 0 TargetVerticalTiltAngle ' + getError() + ' ' + getTarget2());
            callback(getError(), getTarget2());
        };
        const getListenerPositionState = callback => {
            homematic.debug('get ' + config.name + ' 0 PositionState ' + getError() + ' ' + getState());
            callback(getError(), getState());
        };

        acc.getService(subtype).getCharacteristic(hap.Characteristic.CurrentPosition).on('get', getListenerCurrentPosition);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetPosition).on('get', getListenerTargetPosition);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetPosition).on('set', setListenerTargetPosition);

        acc.getService(subtype).getCharacteristic(hap.Characteristic.CurrentVerticalTiltAngle).on('get', getCurrentVerticalTiltAngle);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetVerticalTiltAngle).on('get', getTargetVerticalTiltAngle);
        acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetVerticalTiltAngle).on('set', setTargetVerticalTiltAngle);

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
                case '4.LEVEL':
                    if (!msg.working) {
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.CurrentPosition, getCurrent());
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.TargetPosition, getTarget());
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.PositionState, getState());
                    }
                    break;
                case '4.LEVEL_2':
                    if (!msg.working) {
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.CurrentVerticalTiltAngle, getCurrent2());
                        acc.getService(subtype).updateCharacteristic(hap.Characteristic.TargetVerticalTiltAngle, getTarget2());
                    }
                    break;
                case '4.ACTIVITY_STATE':
                    acc.getService(subtype).updateCharacteristic(hap.Characteristic.PositionState, getState());
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
            acc.getService(subtype).getCharacteristic(hap.Characteristic.PositionState).removeListener('get', getListenerPositionState);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.CurrentVerticalTiltAngle).removeListener('get', getCurrentVerticalTiltAngle);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetVerticalTiltAngle).removeListener('get', getTargetVerticalTiltAngle);
            acc.getService(subtype).getCharacteristic(hap.Characteristic.TargetVerticalTiltAngle).removeListener('set', setTargetVerticalTiltAngle);
        });
    }
};

