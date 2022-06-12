/* eslint-disable no-new */

const Accessory = require('./accessory.js');

function createService(channel) {
    let intermediatePosition; // 0-100
    let LEVEL = 0; // 0.0-1.0
    let LEVEL_2 = 0; // 0.0-1.0

    const channelIndex = channel.channel.split(':')[1];

    this.ccu.subscribe({
        datapointName: this.config.deviceAddress + ':' + channelIndex + '.LEVEL',
        cache: true,
        stable: false,
    }, message => {
        intermediatePosition = message.value * 100;
    });

    const service = this.addService('WindowCovering', channel.name, channelIndex);

    service
        .get('CurrentPosition', this.config.deviceAddress + ':' + channelIndex + '.LEVEL', value => {
            LEVEL = value;
            intermediatePosition = value * 100;
            return LEVEL * 100;
        })

        .get('TargetPosition', this.config.deviceAddress + ':' + channelIndex + '.LEVEL', value => {
            if (typeof LEVEL === 'undefined') {
                LEVEL = value;
            }

            return LEVEL * 100;
        })

        .set('TargetPosition', (value, callback) => {
            LEVEL = value / 100;
            if (value === 0 && intermediatePosition === 0) {
                intermediatePosition = 1;
            } else if (value === 100 && intermediatePosition === 100) {
                intermediatePosition = 99;
            }

            this.node.debug(channel.name + ' intermediatePosition ' + intermediatePosition);
            service.update('CurrentPosition', intermediatePosition);

            const parameters = {
                LEVEL,
            };

            if (channel.tilt) {
                parameters.LEVEL_2 = LEVEL_2;
            }

            if (channel.tilt || this.config.type === 'BLIND_VIRTUAL_RECEIVER') {
                if (LEVEL === 0) {
                    parameters.LEVEL_2 = 0;
                }

                if (LEVEL === 1) {
                    parameters.LEVEL_2 = 1;
                }
            }

            this.node.debug('set ' + this.config.name + ' (WindowCovering) TargetPosition ' + value + ' -> ' + this.config.description.ADDRESS + ':' + channelIndex + ' ' + JSON.stringify(parameters));
            this.ccu.methodCall(this.config.iface, 'putParamset', [this.config.description.ADDRESS + ':' + channelIndex, 'VALUES', parameters])
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new Error(this.hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        })

        .get('PositionState', this.config.deviceAddress + ':' + channelIndex + '.ACTIVITY_STATE', (value, c) => {
            switch (value) {
                case 1:
                    return c.INCREASING;
                case 2:
                    return c.DECREASING;
                default:
                    return c.STOPPED;
            }
        });

    if (channel.tilt) {
        service
            .get('CurrentVerticalTiltAngle', this.config.deviceAddress + ':' + channelIndex + '.LEVEL_2', value => {
                LEVEL_2 = value;
                value = (value * 180) - 90;
                this.node.debug('get CurrentVerticalTiltAngle ' + this.config.name + ' LEVEL_2 ' + LEVEL_2 + ' ' + value);
                return value;
            })

            .get('TargetVerticalTiltAngle', this.config.deviceAddress + ':' + channelIndex + '.LEVEL_2', value => {
                LEVEL_2 = value;
                value = (value * 180) - 90;
                this.node.debug('get TargetVerticalTiltAngle ' + this.config.name + ' LEVEL_2 ' + LEVEL_2 + ' ' + value);
                return value;
            })

            .set('TargetVerticalTiltAngle', (value, callback) => {
                LEVEL_2 = (value + 90) / 180;
                this.node.debug('set TargetVerticalTiltAngle ' + this.config.name + ' LEVEL_2 ' + LEVEL_2 + ' ' + value);

                const parameters = {
                    LEVEL,
                    LEVEL_2,
                };
                this.node.debug('set ' + channel.name + ' (WindowCovering) TargetVerticalTiltAngle ' + value + ' -> ' + this.config.description.ADDRESS + ':' + channelIndex + ' ' + JSON.stringify(parameters));
                this.ccu.methodCall(this.config.iface, 'putParamset', [this.config.description.ADDRESS + ':' + channelIndex, 'VALUES', parameters])
                    .then(() => {
                        callback();
                    })
                    .catch(() => {
                        callback(new Error(this.hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                    });
            });
    }
}

class GenericHmipBlindAcc extends Accessory {
    constructor(config, node, channels) {
        super(config, node);
        this.channels = channels;
        node.debug('creating accessory for ' + channels.length + ' channels');
    }

    init() {
        for (const channel of this.channels) {
            createService.call(this, channel);
        }
    }
}

class GenericHmipBlind {
    constructor(config, node) {
        const {ccu} = node;
        this.ccu = ccu;

        this.config = config;

        let acc = 0;
        let pos = 0;
        const channels = [];
        for (const channel of this.config.description.CHILDREN) {
            const desc = this.ccu.metadata.devices['HmIP-RF'][channel];
            if (desc.TYPE === 'BLIND_VIRTUAL_RECEIVER' || desc.TYPE === 'SHUTTER_VIRTUAL_RECEIVER') {
                if (!channels[acc]) {
                    channels[acc] = [];
                }

                const name = this.ccu.channelNames[channel];
                const tilt = desc.TYPE === 'BLIND_VIRTUAL_RECEIVER'
                    && (!this.config.options[channel] || this.config.options[channel].type !== 'VerticalTilt Disabled');
                if (pos === 0) {
                    if (!this.config.options[channel] || !this.config.options[channel].disabled) {
                        channels[acc].push({channel, name, tilt});
                    }
                } else if (this.config.options[channel] && this.config.options[channel].enabled) {
                    channels[acc].push({channel, name, tilt, type: desc.TYPE});
                }

                if (++pos > 2) {
                    pos = 0;
                    acc += 1;
                }
            }
        }

        for (const accChannels of channels) {
            if (accChannels.length > 0) {
                const conf = Object.assign({}, config, {name: accChannels[0].name});
                conf.description = Object.assign({}, config.description, {ADDRESS: accChannels[0].channel});
                new GenericHmipBlindAcc(conf, node, accChannels);
            }
        }
    }
}

module.exports = GenericHmipBlind;
