const Accessory = require('./lib/accessory');

module.exports = class HmipPs extends Accessory {
    init(config, node) {

        const {ccu} = node;
        const dp = config.deviceAddress + ':3.STATE';
        const name = ccu.channelNames[config.deviceAddress + ':3'];
        const type = this.option('3', 'type') || 'Outlet';

        switch (type) {
            case 'ValveIrrigation':
            // intentional fallthrough
            case 'Valve':
                const service = this.addService('Valve', name, type);

                service.update('ValveType', type === 'ValveIrrigation' ? 1 : 0);

                service
                    .get('Active', dp, val => val ? 1 : 0)
                    .get('InUse', dp, val => val ? 1 : 0)
                    .set('Active', dp, val => {
                        service.update('InUse', val);
                        return Boolean(val);
                    });
                break;
            case 'Lightbulb':
            // intentional fallthrough
            case 'Fan':
            // intentional fallthrough
            case 'Switch':
                this.addService(type, name, type)
                    .get('On', dp)
                    .set('On', dp);
                break;
            default:
                this.addService('Outlet', name)
                    .get('On', dp)
                    .set('On', dp);
        }

    }
};
