/* Minimal stand-in for the Node-RED runtime object handed to node modules:
   enough to load node sets, create node instances and capture admin HTTP
   handlers, without booting Node-RED. */

const EventEmitter = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LEVELS = ['error', 'warn', 'log', 'debug', 'trace'];

function initNode(node, RED, config) {
    EventEmitter.call(node);
    node.RED = RED;
    node.id = config.id;
    node.type = config.type;
    node.logged = {};
    node.statuses = [];
    node.sent = [];
    for (const level of LEVELS) {
        node.logged[level] = [];
        node[level] = (...args) => {
            node.logged[level].push(args);
        };
    }

    node.status = (status) => node.statuses.push(status);
    node.send = (msg) => node.sent.push(msg);
}

function createFakeRED({userDir} = {}) {
    const types = {};
    const nodes = {};
    const routes = {get: {}};

    if (!userDir) {
        userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'redmatic-homekit-test-'));
    }

    const RED = {
        settings: {userDir, logging: {console: {level: 'info'}}},
        httpAdmin: {
            get(route, ...handlers) {
                routes.get[route] = handlers[handlers.length - 1];
            },
        },
        auth: {
            needsPermission() {
                return (req, res, next) => next();
            },
        },
        util: {
            evaluateNodeProperty(value) {
                return value;
            },
        },
        nodes: {
            registerType(type, Class) {
                // node classes in this package do not extend anything; give them
                // EventEmitter behaviour like Node-RED's Node base class
                if (!(Class.prototype instanceof EventEmitter)) {
                    Object.setPrototypeOf(Class.prototype, EventEmitter.prototype);
                }

                types[type] = Class;
            },
            createNode(node, config) {
                initNode(node, RED, config);
                nodes[config.id] = node;
            },
            getNode(id) {
                return nodes[id];
            },
        },
        // test helpers
        types,
        routes,
        load(file) {
            require(file)(RED);
            return RED;
        },
        instantiate(type, config) {
            const Class = types[type];
            if (!Class) {
                throw new Error('unknown node type ' + type);
            }

            config = {type, ...config};
            return new Class(config);
        },
        cleanup() {
            fs.rmSync(userDir, {recursive: true, force: true});
        },
    };

    return RED;
}

module.exports = {createFakeRED};
