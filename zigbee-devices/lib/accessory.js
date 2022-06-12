class Service {
    constructor(acc, subtype) {
        this.acc = acc;
        this.subtype = subtype;
        // eslint-disable-next-line no-constructor-return
        return this;
    }

    sub(endpoint, cluster, attribute, callback) {
        this.acc.proxy.on('message', message => {
            if (message.device.ieeeAddr === this.acc.device.ieeeAddr && message.endpoint.ID === endpoint && message.cluster === cluster && typeof message.data[attribute] !== 'undefined') {
                this.acc.node.debug(`sub msg ${this.acc.device.meta.name} ${message.cluster} ${JSON.stringify(message.data)}`);
                callback(message.data[attribute]);
            }
        });

        if (this.acc.device.getEndpoint(endpoint) && this.acc.device.getEndpoint(endpoint).clusters[cluster]) {
            const value = this.acc.device.getEndpoint(endpoint).clusters[cluster].attributes[attribute];
            this.acc.node.debug(`sub initial ${this.acc.device.meta.name} ${cluster} ${value}`);
            callback(value);
        }
    }

    // eslint-disable-next-line max-params
    get(characteristic, endpoint, cluster, attribute, transform) {
        if (!transform) {
            transform = function (data) {
                return data;
            };
        }

        this.acc.proxy.on('message', message => {
            if (message.device.ieeeAddr === this.acc.device.ieeeAddr && message.endpoint.ID === endpoint && message.cluster === cluster && typeof message.data[attribute] !== 'undefined') {
                this.acc.node.debug(`msg ${this.acc.device.meta.name} ${message.cluster} ${characteristic} ${JSON.stringify(message.data)}`);

                const value = transform(message.data[attribute]);
                if (typeof value !== 'undefined' && value !== null && !this.suppressUpdate) {
                    this.acc.updateCharacteristic(this.subtype, characteristic, value);
                }
            }
        });

        if (this.acc.device.getEndpoint(endpoint) && this.acc.device.getEndpoint(endpoint).clusters[cluster]) {
            let value = transform(this.acc.device.getEndpoint(endpoint).clusters[cluster].attributes[attribute]);
            if (Number.isNaN(value)) {
                value = 0;
            }

            if (value !== null) {
                this.acc.updateCharacteristic(this.subtype, characteristic, value, true);
            }
        }

        return this;
    }

    // eslint-disable-next-line max-params
    set(characteristic, endpoint, cluster, transform, suppressUpdate) {
        this.acc.addListener('set', this.subtype, characteristic, (value, callback) => {
            this.acc.node.debug(`set ${this.acc.device.meta.name} ${characteristic} ${value}`);
            const transformedValue = transform(value);

            if (!transformedValue) {
                callback();
                return;
            }

            const {command, payload} = transformedValue;

            this.acc.node.debug(`command ${this.acc.device.meta.name} ${cluster} ${command} ${payload ? JSON.stringify(payload) : ''}`);
            clearTimeout(this.suppressUpdateTimer);
            this.suppressUpdate = this.suppressUpdate || suppressUpdate;
            this.suppressUpdateTimer = setTimeout(() => {
                this.suppressUpdate = false;
            }, 15000);
            this.acc.device.getEndpoint(endpoint).command(cluster, command, payload)
                .then(() => {
                    callback();
                })
                .catch(error => {
                    this.suppressUpdate = false;
                    this.acc.node.debug(`command error ${this.acc.device.meta.name} ${cluster} ${command} ${payload ? JSON.stringify(payload) : ''} ${error.message}`);
                    callback(new Error(this.acc.hap.HAPServer.Status.SERVICE_COMMUNICATION_FAILURE));
                });
        });

        return this;
    }

    update(characteristic, value) {
        this.acc.updateCharacteristic(this.subtype, characteristic, value);
    }

    setProps(characteristic, props) {
        this.acc.setProps(this.subtype, characteristic, props);
        return this;
    }

    fault(datapointNameArray, transformArray) {
        this.acc.datapointsFault(this.subtype, datapointNameArray, transformArray);
        return this;
    }
}

module.exports = class Accessory {
    constructor(node, device) {
        this.device = device;

        this.node = node;

        const {bridgeConfig, herdsman, proxy} = node;
        const {hap} = bridgeConfig;

        this.bridgeConfig = bridgeConfig;
        this.herdsman = herdsman;
        this.proxy = proxy;
        this.hap = hap;

        this.acc = bridgeConfig.accessory({id: this.device.ieeeAddr, name: this.device.meta.name});

        if (!this.acc) {
            return;
        }

        this.acc.getService(hap.Service.AccessoryInformation)
            .setCharacteristic(hap.Characteristic.Manufacturer, this.device.manufacturerName)
            .setCharacteristic(hap.Characteristic.Model, this.device.modelID)
            .setCharacteristic(hap.Characteristic.SerialNumber, this.device.ieeeAddr)
            .setCharacteristic(hap.Characteristic.FirmwareRevision, this.device.softwareBuildID);

        this.acc.on('identify', (paired, callback) => {
            this.identify(paired, callback);
        });

        this.listeners = [];
        this.subscriptions = [];
        this.subtypeCounter = 0;

        node.on('close', () => {
            node.debug('removing listeners ' + this.device.ieeeAddr + ' ' + this.device.meta.name);
            this.acc.removeListener('identify', () => this.identify());
            this.removeListeners();
        });

        if (typeof this.init === 'function') {
            node.debug('init accessory ' + this.device.ieeeAddr + ' ' + this.device.meta.name);
            this.init(device, node);
        }
    }

    addService(type, name, subtypeIdentifier = '') {
        const subtype = subtypeIdentifier + String(this.subtypeCounter++);
        this.node.debug(`addService ${type} ${name} ${subtype}`);
        if (this.acc.getService(subtype)) {
            this.node.debug('service (' + subtype + ') already existing ');
        } else {
            this.node.debug('add service ' + type + ' (' + subtype + ') to ' + this.device.ieeeAddr + ' ' + this.device.meta.name);
            this.acc.addService(this.hap.Service[type], this.device.meta.name, subtype);
        }

        return new Service(this, subtype);
    }

    setProps(subtype, characteristic, props) {
        this.node.debug(`setProps ${subtype} ${characteristic} ${props}`);

        this.acc.getService(subtype)
            .getCharacteristic(this.hap.Characteristic[characteristic])
            .setProps(props);
    }

    updateCharacteristic(subtype, characteristic, value) {
        this.node.debug('update ' + this.device.meta.name + ' (' + subtype + ') ' + characteristic + ' ' + value);
        this.acc.getService(subtype)
            .updateCharacteristic(this.hap.Characteristic[characteristic], value);
    }

    addListener(event, subtype, characteristic, callback) {
        if (this.acc.getService(subtype)) {
            this.acc.getService(subtype).getCharacteristic(this.hap.Characteristic[characteristic]).on(event, callback);
            this.node.debug('add ' + event + ' listener ' + characteristic + ' (' + subtype + ') to ' + this.device.meta.name);
            this.listeners.push({event, subtype, characteristic, callback});
        } else {
            this.node.error('service (' + subtype + ') does not exist on ' + this.device.meta.name);
        }
    }

    removeListeners() {
        if (this.listeners.length > 0) {
            const {event, subtype, characteristic, callback} = this.listeners.shift();
            this.node.debug('remove ' + event + ' listener ' + characteristic + ' (' + subtype + ') from ' + this.device.meta.name);
            this.acc.getService(subtype).getCharacteristic(this.hap.Characteristic[characteristic]).removeListener(event, callback);
            this.removeListeners();
        }
    }

    identify(paired, callback) {
        this.node.log('identify ' + (paired ? '(paired)' : '(unpaired)') + ' ' + this.device.manufacturerName + ' ' + this.device.meta.name + ' ' + this.device.modelID + ' ' + this.device.ieeeAddr);
        try {
            callback();
        } catch (error) {
            this.node.error(error);
        }
    }

    percent(value, lower = 2, upper = 3) {
        let p = Math.round((value - lower) * (100 / (upper - lower)));
        if (!p || p < 0) {
            p = 0;
        } else if (p > 100) {
            p = 100;
        }

        return p;
    }
};
