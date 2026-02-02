'use strict';

/**
 * Auto ticks calculation module
 * Implements the "nice numbers" algorithm for tick spacing
 * Based on Plotly's axes.autoTicks function
 */

/**
 * Calculate optimal tick interval using "nice numbers" algorithm
 * Prefers intervals of 1, 2, 5, and their powers of 10 multiples
 *
 * @param {number} rangeMin - Range minimum value
 * @param {number} rangeMax - Range maximum value
 * @param {number} targetTickCount - Target number of ticks (default: 5)
 * @returns {number} Optimized tick interval (dtick)
 */
function calcTickInterval(rangeMin, rangeMax, targetTickCount) {
    if (targetTickCount === undefined) {
        targetTickCount = 5;
    }

    var range = Math.abs(rangeMax - rangeMin);

    // Handle zero or very small range
    if (range === 0) {
        return 1;
    }

    // Rough tick interval based on desired count
    var roughDTick = range / targetTickCount;

    // Calculate the power of 10 base
    // For example: roughDTick=0.34 -> base=0.1, roughDTick=340 -> base=100
    var exponent = Math.floor(Math.log10(roughDTick));
    var base = Math.pow(10, exponent);

    // Normalize to [1, 10] range
    var normalized = roughDTick / base;

    // Find closest "nice number": 1, 2, 5, 10
    var niceNumbers = [1, 2, 5, 10];
    var niceNum = niceNumbers[0];
    var minDiff = Math.abs(normalized - niceNum);

    for (var i = 1; i < niceNumbers.length; i++) {
        var diff = Math.abs(normalized - niceNumbers[i]);
        if (diff < minDiff) {
            minDiff = diff;
            niceNum = niceNumbers[i];
        }
    }

    // Scale back to original magnitude
    var dtick = niceNum * base;

    // Prevent zero or negative interval
    if (dtick <= 0 || !isFinite(dtick)) {
        dtick = 1;
    }

    return dtick;
}

/**
 * Calculate the first tick value
 * Finds the first tick value >= rangeMin that aligns with dtick and tick0
 *
 * @param {number} rangeMin - Range minimum value
 * @param {number} rangeMax - Range maximum value
 * @param {number} dtick - Tick interval
 * @param {number} tick0 - Reference tick value (default: 0)
 * @returns {number} First tick value
 */
function calcFirstTick(rangeMin, rangeMax, dtick, tick0) {
    if (tick0 === undefined) {
        tick0 = 0;
    }

    // For positive range
    if (rangeMin >= 0) {
        var firstTick = Math.ceil((rangeMin - tick0) / dtick) * dtick + tick0;
        return firstTick;
    }

    // For negative range
    var firstTick = Math.floor((rangeMin - tick0) / dtick) * dtick + tick0;

    // Adjust if we're below the range
    if (firstTick < rangeMin) {
        firstTick += dtick;
    }

    return firstTick;
}

/**
 * Calculate the last tick value
 *
 * @param {number} rangeMax - Range maximum value
 * @param {number} dtick - Tick interval
 * @param {number} tick0 - Reference tick value
 * @returns {number} Last tick value
 */
function calcLastTick(rangeMax, dtick, tick0) {
    if (tick0 === undefined) {
        tick0 = 0;
    }

    var lastTick = Math.floor((rangeMax - tick0) / dtick) * dtick + tick0;

    // Adjust if we're above the range
    if (lastTick > rangeMax) {
        lastTick -= dtick;
    }

    return lastTick;
}

/**
 * Generate tick values from first to last with given interval
 *
 * @param {number} firstTick - First tick value
 * @param {number} lastTick - Last tick value
 * @param {number} dtick - Tick interval
 * @returns {Array<number>} Array of tick values
 */
function generateTickValues(firstTick, lastTick, dtick) {
    var ticks = [];
    var numTicks = Math.round((lastTick - firstTick) / dtick) + 1;

    // Limit to reasonable number of ticks
    numTicks = Math.min(100, Math.max(2, numTicks));

    for (var i = 0; i < numTicks; i++) {
        ticks.push(firstTick + i * dtick);
    }

    return ticks;
}

/**
 * Main auto ticks function - calculates complete tick configuration
 *
 * @param {number} rangeMin - Range minimum value
 * @param {number} rangeMax - Range maximum value
 * @param {number} targetTickCount - Target number of ticks
 * @param {number} tick0 - Reference tick value (optional)
 * @returns {Object} Tick configuration
 *          { dtick, tick0, firstTick, lastTick, values }
 */
function autoTicks(rangeMin, rangeMax, targetTickCount, tick0) {
    var dtick = calcTickInterval(rangeMin, rangeMax, targetTickCount);

    if (tick0 === undefined) {
        // Default tick0 depends on range
        if (rangeMin >= 0) {
            tick0 = 0;
        } else if (rangeMax <= 0) {
            // For negative ranges, align to nice boundary
            tick0 = Math.ceil(rangeMin / dtick) * dtick;
        } else {
            tick0 = 0;
        }
    }

    var firstTick = calcFirstTick(rangeMin, rangeMax, dtick, tick0);
    var lastTick = calcLastTick(rangeMax, dtick, tick0);
    var values = generateTickValues(firstTick, lastTick, dtick);

    return {
        dtick: dtick,
        tick0: tick0,
        firstTick: firstTick,
        lastTick: lastTick,
        values: values
    };
}

module.exports = {
    calcTickInterval: calcTickInterval,
    calcFirstTick: calcFirstTick,
    calcLastTick: calcLastTick,
    generateTickValues: generateTickValues,
    autoTicks: autoTicks
};
