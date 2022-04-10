const Accessory = require('./lib/accessory.js');

module.exports = class HmEsPmsw1 extends Accessory {
    init(config, node) {
        const {ccu} = node;
        const dp = config.deviceAddress + ':1.STATE';
        const name = ccu.channelNames[config.deviceAddress + ':1'];
        const type = this.option('1', 'type') || 'Outlet';

        switch (type) {
            case 'ValveIrrigation':
            // intentional fallthrough
            case 'Valve': {
                const service = this.addService('Valve', name, type);

                service.update('ValveType', type === 'ValveIrrigation' ? 1 : 0);

                service
                    .get('Active', dp, value => value ? 1 : 0)
                    .get('InUse', dp, value => value ? 1 : 0)
                    .set('Active', dp, value => {
                        service.update('InUse', value);
                        return Boolean(value);
                    });
                break;
            }

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
                    .set('On', dp)
                    .get('OutletInUse', config.deviceAddress + ':2.POWER', value => value > 0);
        }
    }
};
