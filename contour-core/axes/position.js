'use strict';

/**
 * Position conversion module
 * Handles conversion between data values and pixel positions
 * Similar to Plotly's l2p (linear to pixel) function
 */

/**
 * Create a linear-to-pixel conversion function
 * Converts data values to pixel positions along an axis
 *
 * @param {Array<number>} range - Data range [min, max]
 * @param {number} pixelLength - Length of the axis in pixels
 * @param {boolean} reverse - If true, reverse the axis (max at 0, min at length)
 * @returns {Function} l2p function that converts value to pixel position
 */
function createLinearToPixel(range, pixelLength, reverse) {
    var rMin = Math.min(range[0], range[1]);
    var rMax = Math.max(range[0], range[1]);
    var rRange = rMax - rMin;

    // Handle zero range
    if (rRange === 0) {
        return function l2p(value) {
            return pixelLength / 2;
        };
    }

    return function l2p(value) {
        // Clamp value to range
        var clampedValue = Math.max(rMin, Math.min(rMax, value));

        // Normalize to [0, 1]
        var normalized = (clampedValue - rMin) / rRange;

        // Apply reverse if needed
        if (reverse) {
            normalized = 1 - normalized;
        }

        // Convert to pixel position
        return normalized * pixelLength;
    };
}

/**
 * Create a pixel-to-linear conversion function
 * Converts pixel positions back to data values
 *
 * @param {Array<number>} range - Data range [min, max]
 * @param {number} pixelLength - Length of the axis in pixels
 * @param {boolean} reverse - If true, reverse the axis
 * @returns {Function} p2l function that converts pixel position to value
 */
function createPixelToLinear(range, pixelLength, reverse) {
    var rMin = Math.min(range[0], range[1]);
    var rMax = Math.max(range[0], range[1]);
    var rRange = rMax - rMin;

    // Handle zero range
    if (rRange === 0) {
        return function p2l(pixel) {
            return rMin;
        };
    }

    return function p2l(pixel) {
        // Normalize pixel to [0, 1]
        var normalized = pixel / pixelLength;

        // Apply reverse if needed
        if (reverse) {
            normalized = 1 - normalized;
        }

        // Convert to data value
        return rMin + normalized * rRange;
    };
}

/**
 * Create category-to-pixel conversion function
 * For categorical axes (string labels)
 *
 * @param {Array<string>} categories - Array of category labels
 * @param {number} pixelLength - Length of the axis in pixels
 * @param {boolean} reverse - If true, reverse the axis
 * @returns {Function} c2p function that converts category index to pixel position
 */
function createCategoryToPixel(categories, pixelLength, reverse) {
    var numCategories = categories.length;

    if (numCategories === 0) {
        return function c2p(index) {
            return 0;
        };
    }

    // Each category gets an equal portion of the axis
    var categoryWidth = pixelLength / numCategories;

    return function c2p(index) {
        // Clamp index
        var clampedIndex = Math.max(0, Math.min(numCategories - 1, Math.floor(index)));

        // Position at the center of the category
        var position = clampedIndex * categoryWidth + categoryWidth / 2;

        if (reverse) {
            position = pixelLength - position;
        }

        return position;
    };
}

/**
 * Calculate margins needed for axis labels and titles
 *
 * @param {Object} axis - Axis configuration
 * @param {boolean} isHorizontal - True for x-axis, false for y-axis
 * @returns {Object} Margin requirements { left, right, top, bottom }
 */
function calculateAxisMargins(axis, isHorizontal) {
    var margins = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
    };

    if (!axis || axis.show === false) {
        return margins;
    }

    var tickLength = axis.ticklen || 5;
    var showLabels = axis.showticklabels !== false;
    var title = axis.title;

    if (isHorizontal) {
        // X-axis margins
        if (axis.side === 'top') {
            margins.top = tickLength;
            if (showLabels) margins.top += 15; // Label space
            if (title) margins.top += 20; // Title space
        } else {
            // Default: bottom
            margins.bottom = tickLength;
            if (showLabels) margins.bottom += 15;
            if (title) margins.bottom += 20;
        }
    } else {
        // Y-axis margins
        if (axis.side === 'right') {
            margins.right = tickLength;
            if (showLabels) margins.right += 30; // More space for y-axis labels
            if (title) margins.right += 20;
        } else {
            // Default: left
            margins.left = tickLength;
            if (showLabels) margins.left += 30;
            if (title) margins.left += 20;
        }
    }

    return margins;
}

/**
 * Calculate drawing area within a canvas
 *
 * @param {number} canvasWidth - Total canvas width
 * @param {number} canvasHeight - Total canvas height
 * @param {Object} xAxis - X-axis configuration
 * @param {Object} yAxis - Y-axis configuration
 * @returns {Object} Drawing area { x, y, width, height, margins }
 */
function calculateDrawingArea(canvasWidth, canvasHeight, xAxis, yAxis) {
    var xMargins = calculateAxisMargins(xAxis, true);
    var yMargins = calculateAxisMargins(yAxis, false);

    var margins = {
        left: Math.max(xMargins.left, yMargins.left, 30),
        right: Math.max(xMargins.right, yMargins.right, 30),
        top: Math.max(xMargins.top, yMargins.top, 30),
        bottom: Math.max(xMargins.bottom, yMargins.bottom, 30)
    };

    return {
        x: margins.left,
        y: margins.top,
        width: canvasWidth - margins.left - margins.right,
        height: canvasHeight - margins.top - margins.bottom,
        margins: margins
    };
}

module.exports = {
    createLinearToPixel: createLinearToPixel,
    createPixelToLinear: createPixelToLinear,
    createCategoryToPixel: createCategoryToPixel,
    calculateAxisMargins: calculateAxisMargins,
    calculateDrawingArea: calculateDrawingArea
};
