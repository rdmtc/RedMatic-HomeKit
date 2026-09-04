/* Where an HmIP actuator's state is read from.

   HmIP actuators expose one <X>_TRANSMITTER channel followed by three
   <X>_VIRTUAL_RECEIVER channels (SWITCH, DIMMER, BLIND, SHUTTER, …). The
   receivers are the control inputs — HomeKit writes to the first one, direct
   links, CCU programs and the device's own button use any of them — and the
   transmitter reports the output the device actually produces. A receiver
   only ever reflects its own last command, so an accessory that reads its
   state from the receiver misses every change that came in through another
   path (found on hardware: HmIP-PDT switched by a program stayed at its old
   level in HomeKit; the "status not updated after local switching" issue
   class).

   `stateDatapoint()` maps a datapoint on a virtual receiver to the same
   datapoint on the transmitter that precedes its receiver group, when the
   transmitter carries it. Writes keep going to the receiver. Datapoints that
   only exist on the receiver (ON_TIME, RAMP_TIME, STOP, COMBINED_PARAMETER)
   and every non-HmIP address are returned unchanged. */

/** datapoints known to live on the transmitter when no paramset description is cached */
const TRANSMITTER_DATAPOINTS = new Set([
    'STATE',
    'LEVEL',
    'LEVEL_2',
    'ACTIVITY_STATE',
    'PROCESS',
    'SECTION',
    'SECTION_STATUS',
    'LEVEL_STATUS',
    'LEVEL_2_STATUS',
    'COLOR',
    'COLOR_BEHAVIOUR',
]);

/**
 * @param {object} ccu  ccu-connection node (metadata.devices, getParamsetDescription)
 * @param {string} datapointName  `<iface>.<address>:<ch>.<DP>`
 * @returns {string} the datapoint to read the state from
 */
function stateDatapoint(ccu, datapointName) {
    const [iface, channelAddress, datapoint] = String(datapointName).split('.');
    const devices = ccu && ccu.metadata && ccu.metadata.devices && ccu.metadata.devices[iface];
    const channel = devices && devices[channelAddress];
    if (!channel || !datapoint || !/_VIRTUAL_RECEIVER$/.test(channel.TYPE)) {
        return datapointName;
    }

    const device = devices[channel.PARENT];
    if (!device || !Array.isArray(device.CHILDREN)) {
        return datapointName;
    }

    // the transmitter is the last <base>_TRANSMITTER channel before this receiver
    const transmitterType = channel.TYPE.replace(/_VIRTUAL_RECEIVER$/, '_TRANSMITTER');
    let transmitter = null;
    for (const address of device.CHILDREN) {
        if (address === channelAddress) {
            break;
        }

        const c = devices[address];
        if (c && c.TYPE === transmitterType) {
            transmitter = c;
        }
    }

    if (!transmitter) {
        return datapointName;
    }

    const values =
        typeof ccu.getParamsetDescription === 'function'
            ? ccu.getParamsetDescription(iface, transmitter, 'VALUES')
            : null;
    const carried = values ? Boolean(values[datapoint]) : TRANSMITTER_DATAPOINTS.has(datapoint);
    return carried ? iface + '.' + transmitter.ADDRESS + '.' + datapoint : datapointName;
}

module.exports = {stateDatapoint, TRANSMITTER_DATAPOINTS};
