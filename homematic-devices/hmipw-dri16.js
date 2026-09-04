/* HmIPW-DRI16 / DRI32 (and the other users of this module): one
   MULTI_MODE_INPUT_TRANSMITTER per input. What an input sends depends on its
   CHANNEL_OPERATION_MODE (MASTER paramset), which the node reads and hands
   over as `config.channelModes`:
   - KEY_BEHAVIOR (factory default): PRESS_SHORT/PRESS_LONG only, never
     STATE → StatelessProgrammableSwitch (found on hardware: as a contact
     sensor such an input stayed "closed" forever),
   - SWITCH_BEHAVIOR / BINARY_BEHAVIOR: STATE → ContactSensor, or Door /
     Window by the channel's `type` option (as in 3.3.0),
   - INACTIVE: nothing. */

const Accessory = require('./lib/accessory');

function addContact(type, name, dp) {
    let service;
    let actualValue;

    switch (type) {
        case 'Door':
        case 'Window':
            service = this.addService(type, name, type);

            service.update('PositionState', 2);

            service.get('CurrentPosition', dp, (value) => {
                actualValue = value ? 100 : 0;
                service.update('TargetPosition', actualValue);
                return actualValue;
            });

            service.get('TargetPosition', dp, (value) => {
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

            break;

        default:
            this.addService('ContactSensor', name).get('ContactSensorState', dp, (value, c) => {
                return value ? c.CONTACT_NOT_DETECTED : c.CONTACT_DETECTED;
            });
    }
}

function addKey(name, channel, index) {
    if (!this.keyLabel) {
        this.addService('ServiceLabel', 'Buttons', 'label').update('ServiceLabelNamespace', 1);
        this.keyLabel = true;
    }

    const service = this.addService('StatelessProgrammableSwitch', name, 'Button');
    service.update('ServiceLabelIndex', index);
    service.setProps('ProgrammableSwitchEvent', {validValues: [0, 2]});
    // the DRI16 sends PRESS_LONG_RELEASE although its description does not list it
    this.keyEvents(service, channel, {});
}

/** ContactSensor/Door/Window or StatelessProgrammableSwitch for one input, by its mode */
function addInput(channel, index, name, type) {
    const mode = (this.config.channelModes || {})[channel];
    if (mode === 'INACTIVE') {
        return;
    }

    if (mode === 'KEY_BEHAVIOR') {
        addKey.call(this, name, channel, index);
        return;
    }

    addContact.call(this, type, name, this.config.iface + '.' + channel + '.STATE');
}

class AccSingleService extends Accessory {
    init(config) {
        const index = Number(config.accChannel.split(':')[1]);
        addInput.call(this, config.accChannel, index, config.name, this.option('', 'type'));
    }
}

class AccMultiService extends Accessory {
    init(config, node) {
        const channels = config.description.CHILDREN;
        for (let i = 1; i < channels.length - 1; i++) {
            const ch = config.description.ADDRESS + ':' + i;
            if (!this.option(i)) {
                continue;
            }

            addInput.call(this, ch, i, node.ccu.channelNames[ch], this.option(i, 'type'));
        }
    }
}

module.exports = class GenericContactSensor {
    option(id, option) {
        let addr = this.config.description.ADDRESS;
        if (!addr.includes(':')) {
            addr = addr + ':' + id;
        }

        let res;

        if (option) {
            res = this.config.options[addr] && this.config.options[addr][option];
        } else {
            res = !(this.config.options[addr] && this.config.options[addr].disabled);
        }

        this.node.debug('option ' + addr + ' ' + id + ' ' + option + ' ' + res);
        return res;
    }

    constructor(config, node) {
        const {ccu} = node;
        this.node = node;
        this.ccu = ccu;
        this.config = config;
        const channels = config.description.CHILDREN;
        if (this.option('SingleAccessory')) {
            new AccMultiService(config, node);
        } else {
            for (let i = 1; i < channels.length - 1; i++) {
                const ch = config.description.ADDRESS + ':' + i;
                if (!this.option(i)) {
                    continue;
                }

                const name = ccu.channelNames[ch];

                const chConfig = Object.assign({}, config, {accChannel: ch, name});
                chConfig.description = Object.assign({}, config.description, {ADDRESS: ch});

                new AccSingleService(chConfig, node);
            }
        }
    }
};
