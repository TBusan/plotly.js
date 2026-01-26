'use strict';

/**
 * Compute tick positions and labels for colorbar
 * Enhanced version with smart formatting based on Plotly's algorithm
 */

/**
 * Format a tick value using various format specifiers
 * Supports D3-style format strings like '.2f', '.1%', '.2e'
 *
 * @param {number} value - Value to format
 * @param {string} format - Format string (e.g., '.2f', '.1%', '.2e', '.1s')
 * @returns {string} Formatted value
 */
function formatTickValue(value, format) {
    if (!format) {
        return autoFormatValue(value);
    }

    // Parse format string
    const precisionMatch = format.match(/^\.(\d+)([fse%])?$/i);
    if (precisionMatch) {
        const precision = parseInt(precisionMatch[1], 10);
        const type = (precisionMatch[2] || 'f').toLowerCase();

        switch (type) {
            case 'f':
            case 'F':
                return formatFixed(value, precision);

            case 'e':
            case 'E':
                return formatExponential(value, precision, type === 'E');

            case '%':
                return formatPercent(value, precision);

            default:
                return formatFixed(value, precision);
        }
    }

    // Try to handle other formats
    return autoFormatValue(value);
}

/**
 * Format value with fixed-point notation
 */
function formatFixed(value, precision) {
    // Handle special cases
    if (!isFinite(value)) return String(value);
    if (Math.abs(value) < Math.pow(10, -precision)) {
        return '0';
    }

    return value.toFixed(precision);
}

/**
 * Format value with exponential notation
 */
function formatExponential(value, precision, uppercase) {
    if (!isFinite(value)) return String(value);
    if (value === 0) return '0e+0';

    let str = value.toExponential(precision);
    if (uppercase) {
        str = str.replace('e', 'E');
    }
    return str;
}

/**
 * Format value as percentage
 */
function formatPercent(value, precision) {
    if (!isFinite(value)) return String(value);

    return (value * 100).toFixed(precision) + '%';
}

/**
 * Auto-format value based on its magnitude
 * Intelligently chooses the best format
 *
 * @param {number} value - Value to format
 * @returns {string} Formatted value
 */
function autoFormatValue(value) {
    // Handle special cases
    if (!isFinite(value)) return String(value);
    if (value === 0) return '0';

    const absValue = Math.abs(value);

    // Very small values - use scientific notation
    if (absValue < 0.01) {
        return value.toExponential(2);
    }

    // Very large values - use scientific notation
    if (absValue >= 10000) {
        return value.toExponential(2);
    }

    // Small fractional values - use more precision
    if (absValue < 1) {
        return value.toFixed(4);
    }

    // Fractional values - use medium precision
    if (absValue < 100) {
        // Remove trailing zeros
        return parseFloat(value.toFixed(2)).toString();
    }

    // Large integers - remove decimal places
    if (absValue >= 100 && absValue < 10000) {
        return value.toFixed(1).replace(/\.0$/, '');
    }

    // Default
    return value.toString();
}

/**
 * Compute tick marks for colorbar
 * Enhanced with smart tick positioning
 *
 * @param {Object} colorbar - Colorbar data from computeColorbar
 * @param {Object} options - Options
 * @param {number} options.nticks - Number of ticks (default: 5)
 * @param {string} options.tickmode - Tick mode ('linear' or 'array')
 * @param {Array} options.tickvals - Explicit tick values (for tickmode='array')
 * @param {Array} options.ticktext - Explicit tick labels (for tickmode='array')
 * @param {string} options.tickformat - Format string for tick labels
 * @param {boolean} options.exponentialformat - Use exponential notation
 * @returns {Array} Array of tick objects {position, value, label}
 */
function computeTicks(colorbar, options) {
    options = options || {};

    const levels = colorbar.levels || [];
    const tickCount = options.nticks || 5;
    const tickMode = options.tickmode || 'linear';

    const ticks = [];

    if (tickMode === 'linear' && levels.length > 0) {
        // Use smart ticks from levels if available
        const smartTicks = computeSmartTicks(levels[0], levels[levels.length - 1], tickCount);

        for (let i = 0; i < smartTicks.values.length; i++) {
            const value = smartTicks.values[i];
            const position = smartTicks.positions[i];

            ticks.push({
                position: position,
                value: value,
                label: formatTickValue(value, options.tickformat)
            });
        }
    } else if (tickMode === 'array') {
        // Use explicit tick values
        const tickValues = options.tickvals || [];
        const tickText = options.ticktext || [];

        for (let i = 0; i < tickValues.length; i++) {
            const val = tickValues[i];
            const t = (val - colorbar.zmin) / (colorbar.zmax - colorbar.zmin);

            ticks.push({
                position: Math.max(0, Math.min(1, t)),
                value: val,
                label: tickText[i] || formatTickValue(val, options.tickformat)
            });
        }
    } else if (tickMode === 'auto') {
        // Auto mode - use nice ticks
        const smartTicks = computeSmartTicks(colorbar.zmin, colorbar.zmax, tickCount);

        for (let i = 0; i < smartTicks.values.length; i++) {
            const value = smartTicks.values[i];
            const position = (value - colorbar.zmin) / (colorbar.zmax - colorbar.zmin);

            ticks.push({
                position: Math.max(0, Math.min(1, position)),
                value: value,
                label: formatTickValue(value, options.tickformat)
            });
        }
    }

    return ticks;
}

/**
 * Compute smart tick positions using nice numbers
 * Based on the same algorithm used in levels.js
 *
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} nTicks - Desired number of ticks
 * @returns {Object} Object with {values: [], positions: []}
 */
function computeSmartTicks(start, end, nTicks) {
    const range = end - start;

    if (range <= 0 || nTicks <= 0) {
        return {
            values: [start],
            positions: [0.5]
        };
    }

    // Calculate rough step size
    const roughStep = range / (nTicks - 1);

    // Calculate exponent and nice fraction
    const exponent = Math.floor(Math.log10(roughStep));
    const fraction = roughStep / Math.pow(10, exponent);

    let niceFraction;
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;

    const step = niceFraction * Math.pow(10, exponent);

    // Generate tick values
    const values = [];
    const positions = [];

    let firstTick = Math.ceil(start / step) * step;
    if (firstTick > start) firstTick -= step;

    for (let val = firstTick; val <= end + step * 0.0001; val += step) {
        if (val >= start - step * 0.0001) {
            values.push(val);
            positions.push((val - start) / range);
        }
    }

    return {
        values: values,
        positions: positions
    };
}

/**
 * Legacy formatTick function for backward compatibility
 */
function formatTick(value, options) {
    options = options || {};
    return formatTickValue(value, options.tickformat);
}

module.exports = computeTicks;
module.exports.formatTickValue = formatTickValue;
module.exports.autoFormatValue = autoFormatValue;
module.exports.computeSmartTicks = computeSmartTicks;
