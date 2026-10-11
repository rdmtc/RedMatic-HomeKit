/* Value ranges of numeric sensor characteristics, taken from the device's
   own paramset description where it can report more than HAP's default
   range (#387). One helper per characteristic, all of the same shape: the
   default range, widened (never narrowed) to the datapoint's MIN/MAX, within
   sane outer limits. Values beyond the result are clamped by the accessory
   base class (clampToProps). A manual range per channel (task 15) would take
   precedence over these and slot in where they are applied. */

/** CurrentTemperature range when the device's paramset says nothing better (3.3.0 and 4.0.x: always this) */
const TEMPERATURE_RANGE = {minValue: -50, maxValue: 120};
/** sane outer bounds: below absolute zero or beyond 1000 °C is a placeholder (HB devices: ±3276.8), not a range */
const TEMPERATURE_LIMITS = {minValue: -270, maxValue: 1000};

/** HAP's CurrentAmbientLightLevel range (hap-nodejs 2.x: float 0.0001…100000 lux) */
const LIGHT_LEVEL_RANGE = {minValue: 0.0001, maxValue: 100000};
/** upper bound of a widened light level range; full sunlight is ~130000 lx, homebridge-shelly uses 500000 */
const LIGHT_LEVEL_CEILING = 500000;

function paramNumber(value) {
    if (typeof value === 'number') {
        return value;
    }

    return typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
}

/** MIN/MAX of a paramset description as numbers, or undefined when missing, garbage or MIN >= MAX */
function paramRange(description) {
    const min = paramNumber(description && description.MIN);
    const max = paramNumber(description && description.MAX);
    return Number.isFinite(min) && Number.isFinite(max) && min < max ? {min, max} : undefined;
}

/**
 * CurrentTemperature props for a temperature datapoint: the default range,
 * widened to the MIN/MAX of the datapoint's paramset description where the
 * device can report more (a fireplace or flue sensor at 165 °C, #387), within
 * TEMPERATURE_LIMITS. Never narrowed: a value outside even this range is
 * clamped by the accessory base class instead of tripping hap-nodejs.
 *
 * @param {object} [description]  paramset description of the datapoint (MIN, MAX)
 * @returns {{minValue: number, maxValue: number}}
 */
function temperatureRange(description) {
    const range = {...TEMPERATURE_RANGE};
    const p = paramRange(description);
    if (p) {
        range.minValue = Math.max(TEMPERATURE_LIMITS.minValue, Math.min(range.minValue, p.min));
        range.maxValue = Math.min(TEMPERATURE_LIMITS.maxValue, Math.max(range.maxValue, p.max));
    }

    return range;
}

/**
 * CurrentAmbientLightLevel props for a lux datapoint: HAP's 0.0001…100000,
 * the maximum widened to the datapoint's paramset MAX where the device can
 * report more (HmIP light sensors 163830, HM-Sen-LI-O and HB-UNI-Sen-WEA
 * 200000; #387), at most LIGHT_LEVEL_CEILING. Never narrowed; the minimum
 * stays 0.0001 (0 lx is clamped to it).
 *
 * @param {object} [description]  paramset description of the datapoint (MIN, MAX)
 * @returns {{minValue: number, maxValue: number}}
 */
function lightLevelRange(description) {
    const range = {...LIGHT_LEVEL_RANGE};
    const p = paramRange(description);
    if (p) {
        range.maxValue = Math.min(LIGHT_LEVEL_CEILING, Math.max(range.maxValue, p.max));
    }

    return range;
}

module.exports = {
    temperatureRange,
    lightLevelRange,
    TEMPERATURE_RANGE,
    LIGHT_LEVEL_RANGE,
};
