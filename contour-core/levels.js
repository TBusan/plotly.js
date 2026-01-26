'use strict';

/**
 * Compute contour levels from data and options
 */

/**
 * Calculate contour levels based on options
 *
 * @param {Object} options - Contour options
 * @param {Array} options.thresholds - Custom threshold values (optional)
 * @param {Boolean} options.autocontour - Auto-generate contour levels
 * @param {Number} options.start - Start value for contours
 * @param {Number} options.end - End value for contours
 * @param {Number} options.size - Step size between contours
 * @param {Number} options.ncontours - Approximate number of contours (for auto mode)
 * @param {Array} vals - 2D array of z values
 * @returns {Array} Array of contour level values
 */
function setContours(options, vals) {
    var levels = [];

    // Check if we have custom thresholds - highest priority
    if (options.thresholds && Array.isArray(options.thresholds) && options.thresholds.length > 0) {
        // Validate and sort thresholds
        levels = options.thresholds.slice().sort(function(a, b) {
            return a - b;
        });

        // Filter out non-numeric values
        levels = levels.filter(function(val) {
            return typeof val === 'number' && !isNaN(val) && isFinite(val);
        });

        if (levels.length > 0) {
            return levels;
        }
    }

    // Auto-generate contour levels
    if (options.autocontour) {
        // Flatten and filter out NaN/null values
        var flatVals = vals.flat().filter(function(v) {
            return typeof v === 'number' && !isNaN(v) && isFinite(v);
        });

        if (flatVals.length === 0) {
            return [];  // No valid data
        }

        var zmin = Math.min.apply(Math, flatVals);
        var zmax = Math.max.apply(Math, flatVals);

        var start, end;

        if (typeof options.start === 'number') {
            start = options.start;
        } else {
            start = zmin;
        }

        if (typeof options.end === 'number') {
            end = options.end;
        } else {
            end = zmax;
        }

        var ncontours = options.ncontours || 15;

        // Use smart tick algorithm to generate "nice" contour levels
        var smartTicks = computeNiceTicks(start, end, ncontours);

        // Generate levels using nice ticks
        for (var val = smartTicks.start;
             val <= smartTicks.end + smartTicks.step * 0.0001;
             val += smartTicks.step) {
            levels.push(val);
        }

        // Remove duplicates and sort
        levels = uniqueSorted(levels);
    } else {
        // Manual contour levels
        var start = options.start || 0;
        var end = options.end || 100;
        var size = options.size || 1;

        if (start > end) {
            var temp = start;
            start = end;
            end = temp;
        }

        if (size <= 0) {
            size = 1;
        }

        // Generate levels
        for (var val = start; val <= end + size * 0.0001; val += size) {
            levels.push(Math.round(val * 10000) / 10000);
        }

        // Remove duplicates and sort
        levels = uniqueSorted(levels);
    }

    return levels;
}

/**
 * Compute "nice" tick values for contour levels
 * Based on Plotly's Axes.autoTicks algorithm
 *
 * This generates aesthetically pleasing tick values like 1, 2, 5, 10
 * instead of arbitrary values like 1.234, 2.468, 3.702
 *
 * @param {Number} start - Start value
 * @param {Number} end - End value
 * @param {Number} ncontours - Desired number of contours
 * @returns {Object} Object with {start, end, step}
 */
function computeNiceTicks(start, end, ncontours) {
    var range = end - start;

    // Handle degenerate cases
    if (range <= 0) {
        return {
            start: start,
            end: end,
            step: 1
        };
    }

    // Calculate rough step size
    var roughStep = range / (ncontours || 15);

    // Avoid zero or very small steps
    if (roughStep <= 0) {
        roughStep = 1;
    }

    // Calculate the exponent (power of 10)
    var exponent = Math.floor(Math.log10(roughStep));

    // Normalize the step to be between 1 and 10
    var fraction = roughStep / Math.pow(10, exponent);

    // Choose a "nice" fraction
    // These are the preferred numbers: 1, 2, 5, 10
    var niceFraction;

    if (fraction < 1.5) {
        niceFraction = 1;
    } else if (fraction < 3) {
        niceFraction = 2;
    } else if (fraction < 7) {
        niceFraction = 5;
    } else {
        niceFraction = 10;
    }

    // Calculate the nice step size
    var step = niceFraction * Math.pow(10, exponent);

    // Adjust the start to be a multiple of the step
    // This ensures ticks align on nice boundaries
    var adjustedStart;

    if (start >= 0) {
        adjustedStart = Math.ceil(start / step) * step;
    } else {
        adjustedStart = Math.floor(start / step) * step;
    }

    // Make sure we don't go below the original start
    if (adjustedStart > start) {
        adjustedStart -= step;
    }

    // Adjust the end to be a multiple of the step
    var adjustedEnd;

    if (end >= 0) {
        adjustedEnd = Math.floor(end / step) * step;
    } else {
        adjustedEnd = Math.ceil(end / step) * step;
    }

    // Make sure we don't go above the original end
    if (adjustedEnd < end) {
        adjustedEnd += step;
    }

    // Handle edge case where range is too small
    if (adjustedEnd <= adjustedStart) {
        adjustedEnd = adjustedStart + step;
    }

    // Round to appropriate precision to avoid floating point issues
    var precision = Math.max(0, -exponent);

    return {
        start: roundToPrecision(adjustedStart, precision),
        end: roundToPrecision(adjustedEnd, precision),
        step: roundToPrecision(step, precision)
    };
}

/**
 * Round a number to a specified precision
 *
 * @param {Number} value - Value to round
 * @param {Number} precision - Number of decimal places
 * @returns {Number} Rounded value
 */
function roundToPrecision(value, precision) {
    if (precision <= 0) {
        return Math.round(value);
    }

    var factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
}

/**
 * Remove duplicates and sort array
 */
function uniqueSorted(arr) {
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
        var val = arr[i];
        if (!seen[val]) {
            seen[val] = true;
            out.push(val);
        }
    }
    return out.sort(function(a, b) { return a - b; });
}

/**
 * Calculate the end value for contours (inclusive)
 */
function endPlus(contours) {
    var end = contours.end;
    var size = contours.size;

    if (!isFinite(size)) {
        size = 1;
    }

    // Add a small fraction to make the end inclusive
    return end + size * 0.0001;
}

module.exports = {
    setContours: setContours,
    endPlus: endPlus,
    computeNiceTicks: computeNiceTicks,
    roundToPrecision: roundToPrecision
};
