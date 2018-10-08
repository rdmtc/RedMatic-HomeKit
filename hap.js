const pkg = require('./package.json');
const path = require('path');
const {EventEmitter} = require('events');

module.exports = class Hap extends EventEmitter {
    constructor(log, options) {
        super();
        this.setMaxListeners(1000);

        console.log(options.accessories);

        this.log = log || {
            debug: console.log,
            info: console.log,
            warn: console.log,
            error: console.log
        };

        this.username = options.username || 'CC:22:3D:E3:CE:C7';
        this.port = options.port || 51826;
        this.pincode = options.pincode || '031-45-154';
        this.bridgename = options.bridgename || 'Homematic';

        this.hap = require('hap-nodejs');
        this.storagePath = path.join(__dirname, '..', '..', 'homekit');

        this.homematicDevices = {};
        this.homematicInvalidDevices = [];

        this.hap.init(this.storagePath);

    }
    publish(accessories) {
        this.bridge = new this.hap.Bridge(this.bridgename, this.hap.uuid.generate(this.bridgename));

        this.bridge.on('identify', (paired, callback) => {
            this.log.info('hap bridge identify', paired ? '(paired)' : '(unpaired)');
            callback();
        });

        console.log(Object.keys(accessories));

        Object.keys(accessories).forEach(uid => {
            const acc = accessories[uid];
            if (acc) {
                switch (acc.type) {
                    case 'homematic-device':
                        this.createHomematicDevice(acc, this.bridge, this.hap);
                        break;
                    default:
                        log.warn('unknown accessory type ' + acc.type);
                }
            }
        });



        this.log.info('hap publishing bridge ' + this.bridgename + ' on port ' + this.port);

        this.bridge.getService(this.hap.Service.AccessoryInformation)
            .setCharacteristic(this.hap.Characteristic.Manufacturer, 'Hobbyquaker')
            .setCharacteristic(this.hap.Characteristic.Model, 'RedMatic')
            .setCharacteristic(this.hap.Characteristic.SerialNumber, this.username)
            .setCharacteristic(this.hap.Characteristic.FirmwareRevision, pkg.version);

        this.bridge.publish({
            username: this.username,
            port: this.port,
            pincode: this.pincode,
            category: this.hap.Accessory.Categories.OTHER
        });

    }

    unpublish() {
        this.log.info('hap unpublishing bridge ' + this.bridgename);
        this.bridge.unpublish();
    }

    createHomematicDevice(acc) {
        const type = acc.description.TYPE;
        if (this.homematicInvalidDevices.includes(type)) {
            return;
        }
        if (!this.homematicDevices[type]) {
            try {
                this.homematicDevices[type] = require('./homematic-devices/' + type + '.js');
            } catch (error) {
                this.log.warn('missing homematic-devices/' + type);
                this.homematicInvalidDevices.push(type);
                return;
            }
        }
        if (this.homematicDevices[type] && typeof this.homematicDevices[type] === 'function') {
            new this.homematicDevices[type](acc, this);
        } else {
            this.log.warn('invalid homematic-devices/' + type);
            this.homematicInvalidDevices.push(type);
        }

    }
};
