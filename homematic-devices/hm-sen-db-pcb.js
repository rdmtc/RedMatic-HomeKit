const Accessory = require('./lib/accessory');

module.exports = class HmSecSc extends Accessory {
    init(config) {
        const service = this.addService('Doorbell', config.name);

        this.subscribe(config.deviceAddress + ':1.PRESS_SHORT', () => {
            service.update('ProgrammableSwitchEvent', 0)
        });
    }
};
