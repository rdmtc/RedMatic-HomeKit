const {stateDatapoint} = require('./state-source');

class Service {
    constructor(acc, subtype) {
        this.acc = acc;
        this.subtype = subtype;
        return this;
    }

    get(characteristic, datapointNameOrCallback, transform) {
        if (typeof datapointNameOrCallback === 'function') {
            this.acc.addListener('get', this.subtype, characteristic, datapointNameOrCallback);
        } else {
            this.acc.datapointGet(this.subtype, characteristic, datapointNameOrCallback, transform);
        }

        return this;
    }

    set(characteristic, datapointNameOrCallback, transform) {
        if (typeof datapointNameOrCallback === 'function') {
            this.acc.addListener('set', this.subtype, characteristic, datapointNameOrCallback);
        } else {
            this.acc.datapointSet(this.subtype, characteristic, datapointNameOrCallback, transform);
        }

        return this;
    }

    update(characteristic, value) {
        this.acc.updateCharacteristic(this.subtype, characteristic, value);
        return this;
    }

    setProps(characteristic, props) {
        this.acc.setProps(this.subtype, characteristic, props);
        return this;
    }

    fault(datapointNameArr, transformArr) {
        this.acc.datapointsFault(this.subtype, datapointNameArr, transformArr);
        return this;
    }
}

module.exports = class Accessory {
    constructor(config, node) {
        const {bridgeConfig, ccu} = node;
        const {hap} = bridgeConfig;
        this.ccu = ccu;
        this.hap = hap;
        this.node = node;
        this.config = config;

        node.debug('create accessory ' + config.description.ADDRESS + ' ' + config.name);
        this.acc = bridgeConfig.accessory({id: config.description.ADDRESS, name: config.name});

        if (!this.acc) {
            return;
        }

        this.acc
            .getService(hap.Service.AccessoryInformation)
            .setCharacteristic(hap.Characteristic.Manufacturer, 'eQ-3')
            .setCharacteristic(hap.Characteristic.Model, config.description.TYPE)
            .setCharacteristic(hap.Characteristic.SerialNumber, config.description.ADDRESS)
            .setCharacteristic(hap.Characteristic.FirmwareRevision, config.description.FIRMWARE);

        this.acc.on('identify', (paired, callback) => {
            this.identify(paired, callback);
        });

        this.listeners = [];
        this.subscriptions = [];
        this.subtypeCounter = 0;

        node.on('close', () => {
            node.debug('removing listeners ' + config.description.TYPE + ' ' + config.name);
            this.acc.removeListener('identify', () => this.identify());
            this.removeListeners();
            this.removeSubscriptions();
        });

        if (typeof this.init === 'function') {
            node.debug(
                'init accessory ' + config.description.ADDRESS + ' ' + config.description.TYPE + ' ' + config.name,
            );
            setImmediate(() => {
                this.init(config, node);
            });
        }
    }

    ccuSetValue(address, value, callback) {
        const force = Boolean(this.ccu.values[address] && this.ccu.values[address].stable === false);
        const [iface, channel, dp] = address.split('.');
        this.ccu
            .setValueQueued(iface, channel, dp, value, false, force)
            .then(() => {
                if (typeof callback === 'function') {
                    callback();
                }
            })
            .catch(() => {
                if (typeof callback === 'function') {
                    callback(new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
                }
            });
    }

    addService(type, name, subtypeIdentifier = '') {
        const subtype = subtypeIdentifier + String(this.subtypeCounter++);
        if (this.acc.getService(subtype)) {
            this.node.debug(
                'service (' + subtype + ') already existing ' + this.config.description.TYPE + ' ' + this.config.name,
            );
        } else {
            this.node.debug(
                'add service ' +
                    type +
                    ' (' +
                    subtype +
                    ') to ' +
                    this.config.description.TYPE +
                    ' ' +
                    this.config.name,
            );
            this.acc.addService(this.hap.Service[type], name, subtype);
        }

        this.datapointUnreach(this.config.deviceAddress + ':0.UNREACH');
        return new Service(this, subtype);
    }

    addListener(event, subtype, characteristic, callback) {
        if (this.acc.getService(subtype)) {
            this.acc.getService(subtype).getCharacteristic(this.hap.Characteristic[characteristic]).on(event, callback);
            this.node.debug(
                'add ' +
                    event +
                    ' listener ' +
                    characteristic +
                    ' (' +
                    subtype +
                    ') to ' +
                    this.config.description.TYPE +
                    ' ' +
                    this.config.name,
            );
            this.listeners.push({event, subtype, characteristic, callback});
        } else {
            this.node.error(
                'service (' + subtype + ') does not exist on ' + this.config.description.TYPE + ' ' + this.config.name,
            );
        }
    }

    removeListeners() {
        if (this.listeners.length > 0) {
            const {event, subtype, characteristic, callback} = this.listeners.shift();
            this.node.debug(
                'remove ' +
                    event +
                    ' listener ' +
                    characteristic +
                    ' (' +
                    subtype +
                    ') from ' +
                    this.config.description.TYPE +
                    ' ' +
                    this.config.name,
            );
            this.acc
                .getService(subtype)
                .getCharacteristic(this.hap.Characteristic[characteristic])
                .removeListener(event, callback);
            this.removeListeners();
        }
    }

    removeSubscriptions() {
        if (this.subscriptions.length > 0) {
            this.ccu.unsubscribe(this.subscriptions.shift());
            this.removeSubscriptions();
        }
    }

    getError() {
        return this.unreach && !['HM-CC-VG-1', 'HmIP-HEATING'].includes(this.config.description.TYPE)
            ? new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)
            : null;
    }

    /**
     * Wire a key channel to a StatelessProgrammableSwitch service.
     *
     * A short press is one PRESS_SHORT. A held key is a *stream*: PRESS_LONG
     * repeats every few hundred ms for as long as the key is down (HmIP and
     * BidCos alike), framed by PRESS_LONG_START/PRESS_LONG_RELEASE where the
     * device has them. HomeKit wants exactly one LONG_PRESS per hold, so only
     * the first PRESS_LONG of a stream is forwarded; the stream ends with
     * PRESS_LONG_RELEASE or after `longPressGap` ms without a repeat (found
     * with a toggle switch on a key-mode HmIPW-DRI16 input: one flip produced
     * eight long presses in the Home app).
     *
     * @param {object} service  the Service wrapper returned by addService()
     * @param {string} channelAddress
     * @param {{short?: string, long?: string, release?: string}} datapoints  names on the channel
     */
    keyEvents(service, channelAddress, {short = 'PRESS_SHORT', long = 'PRESS_LONG', release = 'PRESS_LONG_RELEASE'}) {
        const {hap} = this;
        const iface = this.config.iface || String(this.config.deviceAddress).split('.')[0];
        const gap = this.node.longPressGap || 1500;
        let lastLong = 0;

        const on = (datapoint, callback) => {
            this.subscriptions.push(
                this.ccu.subscribe(
                    {cache: false, change: false, datapointName: iface + '.' + channelAddress + '.' + datapoint},
                    callback,
                ),
            );
        };

        if (short) {
            on(short, () =>
                service.update('ProgrammableSwitchEvent', hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS),
            );
            this.reportValueUsage(channelAddress, short);
        }

        if (long) {
            on(long, () => {
                const now = Date.now();
                if (now - lastLong > gap) {
                    service.update('ProgrammableSwitchEvent', hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
                }

                lastLong = now;
            });
            this.reportValueUsage(channelAddress, long);
            if (release) {
                on(release, () => {
                    lastLong = 0;
                });
            }
        }
    }

    /**
     * HmIP key channels only send their presses to the CCU once something has
     * declared the datapoint "in use" (a program, a link, or this call); until
     * then PRESS_SHORT/PRESS_LONG never reach an XML-RPC client. Found with an
     * HmIP-WRC2 whose second button stayed silent. BidCos reports presses
     * regardless, so only HmIP interfaces are told.
     *
     * Battery devices take the change on their next wake-up; while one is
     * queued the CCU answers further reports with "Transmission is pending",
     * so a failed report is retried (the next key press flushes the queue).
     */
    reportValueUsage(channelAddress, datapoint, attempt = 0) {
        const iface = this.config.iface || String(this.config.deviceAddress).split('.')[0];
        if (!/^HmIP/i.test(iface) || typeof this.ccu.methodCall !== 'function') {
            return;
        }

        const retryAfter = this.node.reportValueUsageRetry || 30000;
        this.ccu
            .methodCall(iface, 'reportValueUsage', [channelAddress, datapoint, 1])
            .then(() => this.node.debug('reportValueUsage ' + channelAddress + ' ' + datapoint))
            .catch((error) => {
                this.node.debug(
                    'reportValueUsage ' +
                        channelAddress +
                        ' ' +
                        datapoint +
                        ' failed: ' +
                        error.message +
                        ' (attempt ' +
                        (attempt + 1) +
                        ')',
                );
                if (attempt < 20) {
                    const timer = setTimeout(
                        () => this.reportValueUsage(channelAddress, datapoint, attempt + 1),
                        retryAfter,
                    );
                    timer.unref();
                    this.node.on('close', () => clearTimeout(timer));
                }
            });
    }

    subscribe(datapointName, callback) {
        this.subscriptions.push(
            this.ccu.subscribe(
                {
                    cache: true,
                    change: true,
                    stable: true,
                    // HmIP: state comes from the transmitter, not the virtual receiver
                    datapointName: stateDatapoint(this.ccu, datapointName),
                },
                (msg) => {
                    callback(msg.value);
                },
            ),
        );
    }

    datapointUnreach(datapointName) {
        this.subscriptions.push(
            this.ccu.subscribe(
                {
                    cache: true,
                    change: true,
                    datapointName,
                },
                (msg) => {
                    this.unreach = msg.value;
                },
            ),
        );
    }

    datapointsFault(subtype, datapointNameArr, transformArr) {
        if (!transformArr) {
            transformArr = [];
        }

        const values = {};
        datapointNameArr.forEach((dp, i) => {
            this.subscriptions.push(
                this.ccu.subscribe(
                    {
                        cache: true,
                        change: true,
                        datapointName: dp,
                    },
                    (msg) => {
                        values[msg.datapointName] = msg.value;
                        let value = this.hap.Characteristic.StatusFault.NO_FAULT;
                        if (typeof transformArr[i] === 'function') {
                            value = transformArr[i](value);
                        }

                        Object.keys(values).forEach((key) => {
                            if (values[key]) {
                                value = this.hap.Characteristic.StatusFault.GENERAL_FAULT;
                            }
                        });
                        this.node.debug('update ' + this.config.name + ' (' + subtype + ') StatusFault ' + value);
                        this.acc.getService(subtype).updateCharacteristic(this.hap.Characteristic.StatusFault, value);
                    },
                ),
            );
        });
    }

    datapointGet(subtype, characteristic, datapointName, transform) {
        // HmIP actuators: read the state from the transmitter channel, which reports
        // the real output whatever set it; the virtual receiver only knows its own writes
        datapointName = stateDatapoint(this.ccu, datapointName);
        this.addListener('get', subtype, characteristic, (callback) => {
            const valueOrig = this.ccu.values && this.ccu.values[datapointName] && this.ccu.values[datapointName].value;
            let value = valueOrig;
            if (typeof transform === 'function') {
                value = transform(value, this.hap.Characteristic[characteristic]);
            }

            this.node.debug(
                'get ' +
                    this.config.name +
                    ' (' +
                    subtype +
                    ') ' +
                    characteristic +
                    ' ' +
                    valueOrig +
                    ' -> ' +
                    this.getError() +
                    ' ' +
                    value,
            );
            callback(this.getError(), value);
        });

        this.node.debug('subscribe ' + datapointName);
        this.subscriptions.push(
            this.ccu.subscribe(
                {
                    cache: true,
                    change: true,
                    stable: !datapointName.endsWith('.DIRECTION') && !datapointName.endsWith('.ACTIVITY_STATE'),
                    datapointName,
                },
                (msg) => {
                    const valueOrig = msg.value;
                    let value = valueOrig;
                    if (typeof transform === 'function') {
                        value = transform(value, this.hap.Characteristic[characteristic]);
                    }

                    this.node.debug(
                        'update ' +
                            this.config.name +
                            ' (' +
                            subtype +
                            ') ' +
                            characteristic +
                            ' ' +
                            valueOrig +
                            ' -> ' +
                            this.getError() +
                            ' ' +
                            value,
                    );
                    this.acc.getService(subtype).updateCharacteristic(this.hap.Characteristic[characteristic], value);
                },
            ),
        );
    }

    datapointSet(subtype, characteristic, datapointName, transform) {
        this.addListener('set', subtype, characteristic, (value, callback) => {
            const valueOrig = value;
            if (typeof transform === 'function') {
                value = transform(value, this.hap.Characteristic[characteristic]);
            }

            const force = Boolean(this.ccu.values[datapointName] && this.ccu.values[datapointName].stable === false);
            const [iface, channel, dp] = datapointName.split('.');
            this.node.debug(
                'set ' +
                    this.config.name +
                    ' (' +
                    subtype +
                    ') ' +
                    characteristic +
                    ' ' +
                    valueOrig +
                    ' -> ' +
                    datapointName +
                    ' ' +
                    value,
            );
            this.ccu
                .setValueQueued(iface, channel, dp, value, false, force)
                .then(() => {
                    callback();
                })
                .catch(() => {
                    callback(new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
                });
        });
    }

    updateCharacteristic(subtype, characteristic, value) {
        this.node.debug('update ' + this.config.name + ' (' + subtype + ') ' + characteristic + ' ' + value);
        this.acc.getService(subtype).updateCharacteristic(this.hap.Characteristic[characteristic], value);
    }

    setProps(subtype, characteristic, props) {
        this.acc.getService(subtype).getCharacteristic(this.hap.Characteristic[characteristic]).setProps(props);
    }

    identify(paired, callback) {
        this.node.log(
            'identify ' +
                (paired ? '(paired)' : '(unpaired)') +
                ' ' +
                this.config.name +
                ' ' +
                this.config.description.TYPE +
                ' ' +
                this.config.description.ADDRESS,
        );
        try {
            callback();
        } catch (error) {
            this.node.error(error);
        }
    }

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

    percent(value, _, lower = 2, upper = 3) {
        let p = Math.round((value - lower) * (100 / (upper - lower)));
        if (!p || p < 0) {
            p = 0;
        } else if (p > 100) {
            p = 100;
        }

        return p;
    }

    lux(value) {
        return Math.round(10 ** (value / 50)) || 1;
    }
};

module.exports.Service = Service;
