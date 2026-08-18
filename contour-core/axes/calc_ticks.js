'use strict';

/**
 * Tick calculation module
 * Main entry point for calculating axis ticks
 * Based on Plotly's axes.calcTicks function
 */

var autoTicks = require('./auto_ticks');
var tickFormat = require('./tick_format');

/**
 * Default axis configuration
 */
var DEFAULT_AXIS_CONFIG = {
    show: true,
    showticklabels: true,
    showgrid: false,
    tickmode: 'auto',
    dtick: undefined,
    tick0: undefined,
    nticks: 5,
    tickvals: undefined,
    ticktext: undefined,
    ticklen: 5,
    tickcolor: '#666666',
    tickwidth: 1,
    side: 'bottom',  // for x-axis: 'bottom' | 'top', for y-axis: 'left' | 'right'
    title: '',
    exponentformat: 'auto',  // 'auto' | 'none' | 'e' | 'E' | 'power' | 'SI'
    // The following are consumed by calcTicks but were silently stripped by
    // normalizeAxisConfig's whitelist (only keys in DEFAULT_AXIS_CONFIG are
    // copied through). Without them the axis always fell back to [0,10] and
    // axes/index.js's inferRangeFromData became dead code.
    range: undefined,
    data: undefined,
    precision: undefined
};

/**
 * Infer range from data array
 *
 * @param {Array} data - Data values array
 * @returns {Array} [min, max] range
 */
function inferRangeFromData(data) {
    if (!data || data.length === 0) {
        return [0, 1];
    }

    var min = data[0];
    var max = data[0];

    for (var i = 1; i < data.length; i++) {
        var val = data[i];
        if (typeof val === 'number' && isFinite(val)) {
            if (val < min) min = val;
            if (val > max) max = val;
        }
    }

    // Handle case where all values are the same
    if (min === max) {
        if (min === 0) {
            return [0, 1];
        }
        return [min - Math.abs(min) * 0.1, max + Math.abs(max) * 0.1];
    }

    return [min, max];
}

/**
 * Normalize axis configuration with defaults
 *
 * @param {Object} axis - User-provided axis config
 * @returns {Object} Normalized axis config
 */
function normalizeAxisConfig(axis) {
    if (!axis) {
        axis = {};
    }

    var normalized = {};

    for (var key in DEFAULT_AXIS_CONFIG) {
        if (axis.hasOwnProperty(key)) {
            normalized[key] = axis[key];
        } else {
            // Use the literal `key` (not `axis[key]`, which is undefined for
            // any missing property) to look up the default — otherwise every
            // defaulted field becomes undefined and downstream behavior
            // (tickmode, ticklen, etc.) silently breaks.
            normalized[key] = DEFAULT_AXIS_CONFIG[key];
        }
    }

    return normalized;
}

/**
 * Calculate ticks for an axis
 *
 * @param {Object} axis - Axis configuration
 * @param {Array<number>} axis.range - Axis range [min, max] (optional, inferred from data if not provided)
 * @param {string} axis.tickmode - 'auto', 'linear', or 'array'
 * @param {number} axis.dtick - Tick interval (for linear mode)
 * @param {number} axis.tick0 - First tick value (optional)
 * @param {number} axis.nticks - Number of ticks (for auto mode)
 * @param {Array} axis.tickvals - Custom tick values (for array mode)
 * @param {Array} axis.ticktext - Custom tick labels (for array mode)
 * @param {string} axis.exponentformat - How to format exponents
 * @param {number} axis.precision - Decimal precision (optional)
 * @returns {Array<Object>} Array of tick objects
 *          Each object has: { value, text, index }
 */
function calcTicks(axis) {
    axis = normalizeAxisConfig(axis);

    // Get range
    var range = axis.range;
    if (!range) {
        if (axis.data) {
            range = inferRangeFromData(axis.data);
        } else {
            range = [0, 10];
        }
    }

    var rangeMin = Math.min(range[0], range[1]);
    var rangeMax = Math.max(range[0], range[1]);
    var tickValues = [];
    var tickTexts = [];

    // Calculate tick values based on mode
    if (axis.tickmode === 'array' && axis.tickvals && axis.tickvals.length > 0) {
        // Use custom tick values
        tickValues = axis.tickvals.slice();

        // Filter to only include ticks within range
        tickValues = tickValues.filter(function(v) {
            return v >= rangeMin && v <= rangeMax;
        });

        // Use custom text if provided
        if (axis.ticktext && axis.ticktext.length === axis.tickvals.length) {
            // Need to match filtered values
            var textMap = {};
            for (var i = 0; i < axis.tickvals.length; i++) {
                textMap[axis.tickvals[i]] = axis.ticktext[i];
            }
            tickTexts = tickValues.map(function(v) {
                return String(textMap[v] !== undefined ? textMap[v] : v);
            });
        }
    } else if (axis.tickmode === 'linear' && axis.dtick) {
        // Manual tick interval
        var dtick = axis.dtick;
        var tick0 = axis.tick0 !== undefined ? axis.tick0 : 0;

        var firstTick = autoTicks.calcFirstTick(rangeMin, rangeMax, dtick, tick0);
        var lastTick = autoTicks.calcLastTick(rangeMax, dtick, tick0);
        tickValues = autoTicks.generateTickValues(firstTick, lastTick, dtick);
    } else {
        // Auto mode - calculate optimal tick interval
        var autoResult = autoTicks.autoTicks(
            rangeMin,
            rangeMax,
            axis.nticks || 5,
            axis.tick0
        );
        tickValues = autoResult.values;
    }

    // Format tick labels
    if (tickTexts.length === 0) {
        var formatOptions = {
            exponentformat: axis.exponentformat,
            precision: axis.precision
        };

        // Use uniform formatting based on tick interval
        var dtick = axis.dtick || autoTicks.calcTickInterval(rangeMin, rangeMax, axis.nticks || 5);
        tickTexts = tickFormat.formatTickLabelsUniform(tickValues, dtick, formatOptions);
    }

    // Build tick objects
    var ticks = [];
    for (var i = 0; i < tickValues.length; i++) {
        ticks.push({
            value: tickValues[i],
            text: tickTexts[i],
            index: i
        });
    }

    return ticks;
}

/**
 * Calculate ticks for both X and Y axes
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.x - X-axis configuration
 * @param {Object} config.y - Y-axis configuration
 * @param {Array} config.x.data - X-axis data values (optional)
 * @param {Array} config.y.data - Y-axis data values (optional)
 * @returns {Object} { xTicks, yTicks }
 */
function calcAxesTicks(config) {
    config = config || {};

    var xConfig = config.x || {};
    var yConfig = config.y || {};

    // Merge data into config if provided separately
    if (config.xData) {
        xConfig.data = config.xData;
    }
    if (config.yData) {
        yConfig.data = config.yData;
    }

    return {
        xTicks: calcTicks(xConfig),
        yTicks: calcTicks(yConfig)
    };
}

/**
 * Calculate dynamic ticks based on visible range
 * This is used for interactive zoom/pan where the visible range changes
 *
 * @param {Object} visibleRange - The currently visible data range
 * @param {number} visibleRange.xMin - Visible X minimum
 * @param {number} visibleRange.xMax - Visible X maximum
 * @param {number} visibleRange.yMin - Visible Y minimum
 * @param {number} visibleRange.yMax - Visible Y maximum
 * @param {Object} options - Configuration options
 * @param {number} options.width - Drawing area width in pixels (for X tick density)
 * @param {number} options.height - Drawing area height in pixels (for Y tick density)
 * @param {Object} options.x - X-axis options (optional)
 * @param {Object} options.y - Y-axis options (optional)
 * @returns {Object} { x: { values, dtick, texts }, y: { values, dtick, texts } }
 */
function calcDynamicTicks(visibleRange, options) {
    options = options || {};

    var xMin = visibleRange.xMin;
    var xMax = visibleRange.xMax;
    var yMin = visibleRange.yMin;
    var yMax = visibleRange.yMax;

    // Calculate optimal number of ticks based on pixel density
    // Rule of thumb: ~80-100 pixels per tick for readability
    var width = options.width || 500;
    var height = options.height || 400;

    var xNTicks = Math.max(3, Math.min(10, Math.floor(width / 80)));
    var yNTicks = Math.max(3, Math.min(10, Math.floor(height / 60)));

    // Override with user-specified nticks if provided
    var xOptions = options.x || {};
    var yOptions = options.y || {};
    if (xOptions.nticks) xNTicks = xOptions.nticks;
    if (yOptions.nticks) yNTicks = yOptions.nticks;

    // Calculate ticks for X axis
    var xResult = autoTicks.autoTicks(xMin, xMax, xNTicks, xOptions.tick0);

    // Calculate ticks for Y axis
    var yResult = autoTicks.autoTicks(yMin, yMax, yNTicks, yOptions.tick0);

    // Format tick labels
    var formatOptions = {
        exponentformat: xOptions.exponentformat || 'auto'
    };
    var xTexts = tickFormat.formatTickLabelsUniform(xResult.values, xResult.dtick, formatOptions);

    formatOptions.exponentformat = yOptions.exponentformat || 'auto';
    var yTexts = tickFormat.formatTickLabelsUniform(yResult.values, yResult.dtick, formatOptions);

    return {
        x: {
            values: xResult.values,
            dtick: xResult.dtick,
            texts: xTexts,
            tick0: xResult.tick0
        },
        y: {
            values: yResult.values,
            dtick: yResult.dtick,
            texts: yTexts,
            tick0: yResult.tick0
        }
    };
}

module.exports = {
    calcTicks: calcTicks,
    calcAxesTicks: calcAxesTicks,
    calcDynamicTicks: calcDynamicTicks,
    normalizeAxisConfig: normalizeAxisConfig,
    inferRangeFromData: inferRangeFromData,
    DEFAULT_AXIS_CONFIG: DEFAULT_AXIS_CONFIG
};
