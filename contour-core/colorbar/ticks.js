'use strict';

/**
 * Compute tick positions and labels for colorbar
 */

/**
 * Compute tick marks for colorbar
 * @param {Object} colorbar - Colorbar data from computeColorbar
 * @param {Object} options - Options
 * @returns {Array} Array of tick objects {position, label}
 */
function computeTicks(colorbar, options) {
    options = options || {};

    const levels = colorbar.levels;
    const tickCount = options.nticks || 5;
    const tickMode = options.tickmode || 'linear';

    const ticks = [];

    if (tickMode === 'linear' && levels.length > 0) {
        const min = levels[0];
        const max = levels[levels.length - 1];

        for (let i = 0; i < tickCount; i++) {
            const t = i / (tickCount - 1);
            const value = min + t * (max - min);
            const position = t;

            ticks.push({
                position: position,
                value: value,
                label: formatTick(value, options)
            });
        }
    } else if (tickMode === 'array') {
        // Use explicit tick values
        const tickValues = options.tickvals || [];
        for (const val of tickValues) {
            const t = (val - colorbar.zmin) / (colorbar.zmax - colorbar.zmin);
            ticks.push({
                position: t,
                value: val,
                label: formatTick(val, options)
            });
        }
    }

    return ticks;
}

/**
 * Format a tick value
 */
function formatTick(value, options) {
    const format = options.tickformat || '.1f';
    return String(value);
}

module.exports = computeTicks;
