'use strict';

/**
 * Tick label formatting module
 * Formats numeric values as tick labels
 * Based on Plotly's axes.tickText function
 */

/**
 * Count decimal places in a number string
 * Handles floating point precision issues by rounding to reasonable precision
 *
 * @param {number} value - The value to check
 * @returns {number} Number of decimal places
 */
function countDecimals(value) {
    if (Math.floor(value) === value) {
        return 0;
    }

    // Handle floating point precision by rounding to 10 significant digits
    // This prevents issues like 0.0001 * 3 = 0.00030000000000000004
    var absValue = Math.abs(value);
    if (absValue > 0 && absValue < 1e10) {
        var magnitude = Math.floor(Math.log10(absValue));
        var precision = 10 - magnitude;
        value = Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
    }

    var str = value.toString();
    var decimalIndex = str.indexOf('.');

    if (decimalIndex === -1) {
        return 0;
    }

    return str.length - decimalIndex - 1;
}

/**
 * Round a number to specified decimal places
 *
 * @param {number} value - The value to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} Rounded value
 */
function roundTo(value, decimals) {
    var factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

/**
 * Format a number using scientific notation
 *
 * @param {number} value - The value to format
 * @param {number} precision - Number of significant digits
 * @returns {string} Formatted string
 */
function formatScientific(value, precision) {
    if (precision === undefined) {
        precision = 3;
    }

    if (value === 0) {
        return '0';
    }

    var exponent = Math.floor(Math.log10(Math.abs(value)));
    var mantissa = value / Math.pow(10, exponent);

    // Round mantissa to precision
    mantissa = roundTo(mantissa, precision);

    return mantissa + 'e' + (exponent >= 0 ? '+' : '') + exponent;
}

/**
 * Format a number with fixed decimal places
 *
 * @param {number} value - The value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted string
 */
function formatFixed(value, decimals) {
    return value.toFixed(decimals);
}

/**
 * Determine the best format for a number
 * Based on the value's magnitude and precision
 *
 * @param {number} value - The value to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted string
 */
function formatTickLabel(value, options) {
    options = options || {};

    // Handle special values
    if (!isFinite(value)) {
        return String(value);
    }

    if (value === 0) {
        return '0';
    }

    var absValue = Math.abs(value);

    // Check for custom format
    if (options.format) {
        if (typeof options.format === 'function') {
            return options.format(value);
        }
        // Assume it's a format string (like "%.2f")
        // For now, just return the value as string
        return String(value);
    }

    // Determine format based on magnitude
    var useScientific = false;
    var precision = 2;

    // Use scientific notation for very small or very large numbers
    if (absValue < 0.001 && absValue > 0) {
        useScientific = true;
        precision = 2;
    } else if (absValue >= 10000) {
        useScientific = true;
        precision = 3;
    }

    // Determine decimal places based on value range
    var decimals;

    if (useScientific) {
        // Check if user disabled scientific notation
        if (options.exponentformat === 'none') {
            useScientific = false;
        }
    }

    if (useScientific) {
        return formatScientific(value, precision);
    }

    // Determine appropriate decimal places
    if (absValue < 0.01) {
        decimals = 4;
    } else if (absValue < 1) {
        decimals = 3;
    } else if (absValue < 100) {
        decimals = 2;
    } else if (absValue < 1000) {
        decimals = 1;
    } else {
        decimals = 0;
    }

    // Override with specified precision
    if (options.precision !== undefined) {
        decimals = options.precision;
    }

    // Remove trailing zeros after decimal point
    var formatted = formatFixed(value, decimals);

    // Remove trailing zeros
    if (decimals > 0) {
        formatted = formatted.replace(/\.?0+$/, '');
    }

    return formatted;
}

/**
 * Format an array of tick values
 *
 * @param {Array<number>} values - Array of tick values
 * @param {Object} options - Formatting options
 * @returns {Array<string>} Array of formatted strings
 */
function formatTickLabels(values, options) {
    var result = [];

    for (var i = 0; i < values.length; i++) {
        result.push(formatTickLabel(values[i], options));
    }

    return result;
}

/**
 * Calculate optimal decimal precision for a set of values
 * Ensures all labels have consistent formatting
 *
 * @param {Array<number>} values - Array of tick values
 * @param {number} dtick - Tick interval
 * @returns {number} Recommended decimal places
 */
function calculatePrecision(values, dtick) {
    var maxDecimals = 0;

    // Check decimals in tick interval
    var dtickDecimals = countDecimals(dtick);
    if (dtickDecimals > maxDecimals) {
        maxDecimals = dtickDecimals;
    }

    // Check decimals in values
    for (var i = 0; i < values.length; i++) {
        var decimals = countDecimals(values[i]);
        if (decimals > maxDecimals) {
            maxDecimals = decimals;
        }
    }

    // Limit to reasonable precision
    return Math.min(6, maxDecimals);
}

/**
 * Format tick values with consistent precision
 *
 * @param {Array<number>} values - Array of tick values
 * @param {number} dtick - Tick interval
 * @param {Object} options - Formatting options
 * @returns {Array<string>} Array of formatted strings
 */
function formatTickLabelsUniform(values, dtick, options) {
    options = options || {};

    var precision;
    if (options.precision !== undefined) {
        precision = options.precision;
    } else {
        precision = calculatePrecision(values, dtick);
    }

    var result = [];
    for (var i = 0; i < values.length; i++) {
        var formatted = formatFixed(values[i], precision);
        // Remove trailing zeros but keep at least one decimal place if precision > 0
        if (precision > 0) {
            formatted = formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
        }
        result.push(formatted);
    }

    return result;
}

module.exports = {
    countDecimals: countDecimals,
    roundTo: roundTo,
    formatScientific: formatScientific,
    formatFixed: formatFixed,
    formatTickLabel: formatTickLabel,
    formatTickLabels: formatTickLabels,
    formatTickLabelsUniform: formatTickLabelsUniform,
    calculatePrecision: calculatePrecision
};
