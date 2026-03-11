'use strict';

/**
 * Discrete colorbar module
 * Handles discrete color block computation and rendering
 */

/**
 * Compute discrete colorbar data from color blocks
 * @param {Array} blocks - Array of [color, value] pairs
 * @param {Object} options - Options for computation
 * @param {number} options.tickInterval - Show label every N blocks (0 = all)
 * @returns {Object} Discrete colorbar data
 */
function computeDiscreteColorbar(blocks, options) {
    options = options || {};

    if (!blocks || blocks.length === 0) {
        return { blocks: [], min: 0, max: 1 };
    }

    var tickInterval = options.tickInterval || 0;

    var result = {
        blocks: [],
        min: blocks[0][1],
        max: blocks[blocks.length - 1][1]
    };

    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var showLabel = tickInterval === 0 ||
                        i === 0 ||
                        i === blocks.length - 1 ||
                        i % tickInterval === 0;

        result.blocks.push({
            color: block[0],
            value: block[1],
            index: i,
            showLabel: showLabel
        });
    }

    return result;
}

/**
 * Calculate colorbar dimensions based on position
 * @param {Object} options - Position and size options
 * @param {string} options.position - 'left' | 'right' | 'top' | 'bottom'
 * @param {number} options.thickness - Block thickness in pixels
 * @param {number} options.padding - Padding from plot area
 * @param {number} options.width - Canvas width
 * @param {number} options.height - Canvas height
 * @param {number} options.blockCount - Number of blocks
 * @returns {Object} Dimension data {x, y, thickness, length, isVertical, blockThickness}
 */
function calculateColorbarDimensions(options) {
    var position = options.position || 'right';
    var thickness = options.thickness || 25;
    var padding = options.padding || 10;
    var width = options.width;
    var height = options.height;
    var blockCount = options.blockCount || 10;

    var isVertical = position === 'left' || position === 'right';
    var x, y, length;

    if (isVertical) {
        length = height * 0.8;
        y = (height - length) / 2;

        if (position === 'right') {
            x = width - thickness - padding;
        } else {
            x = padding;
        }
    } else {
        length = width * 0.8;
        x = (width - length) / 2;

        if (position === 'bottom') {
            y = height - thickness - padding;
        } else {
            y = padding;
        }
    }

    return {
        x: x,
        y: y,
        thickness: thickness,
        length: length,
        isVertical: isVertical,
        blockThickness: isVertical ? length / blockCount : length / blockCount
    };
}

module.exports = {
    computeDiscreteColorbar: computeDiscreteColorbar,
    calculateColorbarDimensions: calculateColorbarDimensions
};
