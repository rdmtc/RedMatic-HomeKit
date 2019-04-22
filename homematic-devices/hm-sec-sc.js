const Accessory = require('./lib/accessory');

module.exports = class HmSecSc extends Accessory {
    init(config) {
        const type = this.option('1', 'type');

        let service;
        let actualValue;

        switch (type) {
            case 'GarageDoorOpener':
                service = this.addService(type, config.name, type);

                service.get('CurrentDoorState', config.deviceAddress + ':1.STATE', value => {
                    actualValue = value;
                    value = value ? 0 : 1;
                    service.update('TargetDoorState', value);
                    return value;
                });

                service.get('TargetDoorState', config.deviceAddress + ':1.STATE', value => {
                    actualValue = value;
                    value = value ? 0 : 1;
                    service.update('TargetDoorState', value);
                    return value;
                });

                service.set('TargetDoorState', (value, callback) => {
                    value = actualValue ? 0 : 1;
                    callback();
                    setTimeout(() => {
                        service.update('CurrentDoorState', value);
                        service.update('TargetDoorState', value);
                    }, 100);
                });

                service.get('ObstructionDetected', config.deviceAddress + ':1.ERROR', value => {
                    return Boolean(value);
                });

                break;

            case 'Door':
            case 'Window':

                service = this.addService(type, config.name, type);

                service.update('PositionState', 2);

                service.get('CurrentPosition', config.deviceAddress + ':1.STATE', value => {
                    actualValue = value ? 100 : 0;
                    service.update('TargetPosition', actualValue);
                    return actualValue;
                });

                service.get('TargetPosition', config.deviceAddress + ':1.STATE', value => {
                    actualValue = value ? 100 : 0;
                    service.update('TargetPosition', actualValue);
                    return actualValue;
                });

                service.set('TargetPosition', (value, callback) => {
                    callback();
                    setTimeout(() => {
                        service.update('CurrentPosition', actualValue);
                        service.update('TargetPosition', actualValue);
                        service.update('PositionState', 2);
                    }, 20);
                });

                service.get('ObstructionDetected', config.deviceAddress + ':1.ERROR', value => {
                    return Boolean(value);
                });

                this.addService('BatteryService', config.name)
                    .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                        return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                    })
                    .get('BatteryLevel', config.deviceAddress + ':0.LOWBAT', value => {
                        return value ? 0 : 100;
                    })
                    .update('ChargingState', 2);

                break;

            default:

                this.acc.log = {debug: console.log};
                this.acc.loggingService = new this.node.bridgeConfig.FakeGatoHistoryService('door', this.acc);

                const eve = this.node.bridgeConfig.EveHomeKitTypes;

                this.acc.loggingService.addOptionalCharacteristic(eve.Characteristic.ResetTotal);

                const serviceContactSensor = this.addService('ContactSensor', config.name)
                    .get('ContactSensorState', config.deviceAddress + ':1.STATE', (value, c) => {
                        const status = value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
                        this.acc.loggingService.addEntry({time: Math.floor((new Date()).getTime() / 1000), status});
                        return status;
                    })

                    .get('StatusLowBattery', config.deviceAddress + ':0.LOWBAT', (value, c) => {
                        return value ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL;
                    })

                    .get('StatusTampered', config.deviceAddress + ':1.ERROR', value => {
                        return Boolean(value);
                    });

                serviceContactSensor.addOptionalCharacteristic(eve.Characteristic.TimesOpened);

                serviceContactSensor.addOptionalCharacteristic(eve.Characteristic.OpenDuration);
                serviceContactSensor.addOptionalCharacteristic(eve.Characteristic.ClosedDuration);
                serviceContactSensor.addOptionalCharacteristic(eve.Characteristic.LastActivation);

        }
    }
};
