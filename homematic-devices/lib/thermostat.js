/* Shared setpoint/mode logic of the thermostat modules (#245, #225, #335).

   Two problems the per-module copies had:
   - The setpoint HomeKit restores when switching to HEAT started as a
     hard-coded 21 °C and was only refreshed from CCU reads. When the Home
     app sends mode + temperature in one request, the mode write went out
     with the stale value and the thermostat showed 21 °C before the real
     temperature arrived (sometimes for good). Now a HomeKit write updates
     the remembered setpoint immediately, the mode write is deferred a
     moment so a temperature write from the same request lands first, and
     a setpoint that was just written is never overwritten by the restore.
   - A setpoint at the "off" temperature (4.5 °C) in AUTO mode was shown as
     heating; `targetState()` now reports OFF for it in every mode. */

const OFF_TEMPERATURE = 4.5;
const MODE_WRITE_DELAY = 150; // ms; a TargetTemperature write from the same request arrives within this window
const RECENT_WRITE_WINDOW = 2000; // ms

function createSetpoint({initial = 21, off = OFF_TEMPERATURE} = {}) {
    let value = initial;
    let lastWrite = 0;

    return {
        off,
        /** remember a setpoint read from the CCU (ignores the off temperature) */
        read(v) {
            if (typeof v === 'number' && v > off) {
                value = v;
            }

            return v;
        },
        /** remember a setpoint HomeKit just wrote */
        write(v) {
            if (typeof v === 'number' && v > off) {
                value = v;
            }

            lastWrite = Date.now();
            return v;
        },
        /** the setpoint to restore when switching to HEAT */
        get value() {
            return value;
        },
        /** true when HomeKit wrote a setpoint a moment ago (a mode write must not override it) */
        recentWrite() {
            return Date.now() - lastWrite < RECENT_WRITE_WINDOW;
        },
        isOff(v) {
            return typeof v === 'number' && v <= off;
        },
    };
}

/**
 * HomeKit TargetHeatingCoolingState (0 off, 1 heat, 3 auto) from the CCU
 * state. `manual` = the device is in manual mode; the off temperature is OFF
 * in every mode.
 */
function targetState(manual, setpoint, off = OFF_TEMPERATURE) {
    if (typeof setpoint === 'number' && setpoint <= off) {
        return 0;
    }

    return manual ? 1 : 3;
}

function fail(hap, callback) {
    callback(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
}

/**
 * TargetHeatingCoolingState setter for HmIP thermostats (CONTROL_MODE 0 auto /
 * 1 manual, SET_POINT_TEMPERATURE) via putParamset.
 * @param {object} o  {ccu, hap, node, config, channel, setpoint, service, getMode(), getSetpoint(), onMode(mode)}
 */
function hmipModeSetter(o) {
    const {ccu, hap, node, config, setpoint, service} = o;
    const address = config.description.ADDRESS + ':' + (o.channel || 1);
    const put = (params) => {
        node.debug('set ' + config.name + ' TargetHeatingCoolingState -> ' + address + ' ' + JSON.stringify(params));
        return ccu.methodCall(config.iface, 'putParamset', [address, 'VALUES', params]);
    };

    return (value, callback) => {
        if (value === 0) {
            put({CONTROL_MODE: 1, SET_POINT_TEMPERATURE: setpoint.off})
                .then(() => callback())
                .catch(() => fail(hap, callback));
            return;
        }

        if (value === 1) {
            setTimeout(() => {
                const manual = o.getMode() === 1;
                const current = o.getSetpoint();
                if (setpoint.recentWrite()) {
                    // the temperature is already on its way; only switch the mode if needed
                    if (manual) {
                        callback();
                    } else {
                        ccu.setValue(config.iface, address, 'CONTROL_MODE', 1)
                            .then(() => callback())
                            .catch(() => fail(hap, callback));
                    }

                    return;
                }

                if (manual && !setpoint.isOff(current)) {
                    callback();
                    return;
                }

                put({CONTROL_MODE: 1, SET_POINT_TEMPERATURE: setpoint.value})
                    .then(() => {
                        service.update('TargetTemperature', setpoint.value);
                        callback();
                    })
                    .catch(() => fail(hap, callback));
            }, MODE_WRITE_DELAY);
            return;
        }

        const mode = value === 3 ? 0 : 1;
        if (o.getMode() === mode) {
            callback();
            return;
        }

        node.debug('set ' + config.name + ' TargetHeatingCoolingState -> ' + address + '.CONTROL_MODE ' + mode);
        ccu.setValue(config.iface, address, 'CONTROL_MODE', mode)
            .then(() => callback())
            .catch(() => fail(hap, callback));
    };
}

/**
 * TargetHeatingCoolingState setter for BidCos thermostats (MANU_MODE with the
 * temperature, AUTO_MODE true).
 * @param {object} o  {ccu, hap, node, config, channel, setpoint, service, onMode(mode)}
 */
function hmModeSetter(o) {
    const {ccu, hap, node, config, setpoint, service} = o;
    const address = config.description.ADDRESS + ':' + o.channel;
    const set = (datapoint, v) => {
        node.debug('set ' + config.name + ' TargetHeatingCoolingState -> ' + address + '.' + datapoint + ' ' + v);
        return ccu.setValue(config.iface, address, datapoint, v);
    };

    const done = (mode, callback) => {
        if (o.onMode) {
            o.onMode(mode);
        }

        callback();
    };

    return (value, callback) => {
        if (value === 0) {
            set('MANU_MODE', setpoint.off)
                .then(() => done(1, callback))
                .catch(() => fail(hap, callback));
        } else if (value === 1) {
            setTimeout(() => {
                set('MANU_MODE', setpoint.value)
                    .then(() => {
                        service.update('TargetTemperature', setpoint.value);
                        done(1, callback);
                    })
                    .catch(() => fail(hap, callback));
            }, MODE_WRITE_DELAY);
        } else {
            set('AUTO_MODE', true)
                .then(() => done(0, callback))
                .catch(() => fail(hap, callback));
        }
    };
}

module.exports = {OFF_TEMPERATURE, MODE_WRITE_DELAY, createSetpoint, targetState, hmipModeSetter, hmModeSetter};
