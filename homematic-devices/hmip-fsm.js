const Accessory = require('./lib/accessory');

module.exports = class HmipFsm extends Accessory {
    init(config, node) {
        const {ccu} = node;
        const dp = config.deviceAddress + ':2.STATE';
        const name = ccu.channelNames[config.deviceAddress + ':2'];
        const type = this.option('2', 'type') || 'Outlet';

        switch (type) {
            case 'ValveIrrigation':
            // intentional fallthrough
            case 'Valve': {
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
            }

            case 'Lightbulb':
            // intentional fallthrough
            case 'Fan':
            // intentional fallthrough
            case 'Outlet':
                this.addService(type, name, type)
                    .get('On', dp)
                    .set('On', dp);
                break;
            default:
                this.addService('Switch', name)
                    .get('On', dp)
                    .set('On', dp);
        }
    }
};
