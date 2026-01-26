'use strict';

/**
 * Check if a value is valid (not null, undefined, or NaN)
 *
 * @param {*} val - Value to check
 * @returns {Boolean} True if value is valid
 */
function isValidValue(val) {
    return val !== null &&
           val !== undefined &&
           (typeof val === 'number') &&
           !isNaN(val) &&
           isFinite(val);
}

module.exports = isValidValue;
