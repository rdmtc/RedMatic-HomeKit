const path = require('path');
const {EventEmitter} = require('events');

module.exports = class Hap extends EventEmitter {
    constructor(log, options) {
        super();
        console.log(options.accessories);

        this.log = log || {
            debug: console.log,
            info: console.log,
            error: console.log
        };

        this.username = options.username || 'CC:22:3D:E3:CE:C8';
        this.port = options.port || 51826;
        this.pincode = options.pincode || '031-45-154';
        this.bridgename = options.bridgename || 'Homematic';

        this.hap = require('hap-nodejs');
        this.storagePath = path.join(__dirname, '..', '..', 'homekit');

        this.hap.init(this.storagePath);

    }
    publish(accessories) {
        this.bridge = new this.hap.Bridge(this.bridgename, this.hap.uuid.generate(this.bridgename));

        this.bridge.on('identify', (paired, callback) => {
            this.log.info('hap bridge identify', paired ? '(paired)' : '(unpaired)');
            callback();
        });

        this.log.info('hap publishing bridge ' + this.bridgename + ' on port ' + this.port);
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
};
