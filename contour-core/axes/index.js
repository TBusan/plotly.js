'use strict';

/**
 * Axes module for contour-core
 * Provides X/Y axis ticks calculation and rendering utilities
 * Based on Plotly's cartesian axes implementation
 */

// Import sub-modules
var calcTicks = require('./calc_ticks');
var autoTicks = require('./auto_ticks');
var tickFormat = require('./tick_format');
var position = require('./position');

/**
 * Calculate complete axis configuration including ticks and position converters
 *
 * @param {Object} config - Axes configuration
 * @param {Object} config.x - X-axis configuration
 * @param {Object} config.y - Y-axis configuration
 * @param {number} config.width - Drawing area width (pixels)
 * @param {number} config.height - Drawing area height (pixels)
 * @param {Object} config.margins - Custom margins {left, right, top, bottom} (optional)
 * @returns {Object} Complete axes configuration
 */
function setupAxes(config) {
    config = config || {};

    var width = config.width || 600;
    var height = config.height || 500;

    // Calculate drawing area with margins
    var drawingArea;
    if (config.margins) {
        // Use custom margins (e.g., from contour rendering)
        drawingArea = {
            x: config.margins.left,
            y: config.margins.top,
            width: width - config.margins.left - config.margins.right,
            height: height - config.margins.top - config.margins.bottom,
            margins: config.margins
        };
    } else {
        // Auto-calculate margins based on axis configuration
        drawingArea = position.calculateDrawingArea(
            width,
            height,
            config.x || {},
            config.y || {}
        );
    }

    // Get axis configurations
    var xConfig = config.x || {};
    var yConfig = config.y || {};

    // Infer ranges if not provided
    if (!xConfig.range && config.xData) {
        xConfig.range = calcTicks.inferRangeFromData(config.xData);
    }
    if (!yConfig.range && config.yData) {
        yConfig.range = calcTicks.inferRangeFromData(config.yData);
    }

    // Calculate ticks
    var xRange = xConfig.range || [0, width];
    var yRange = yConfig.range || [0, height];

    var ticksResult = calcTicks.calcAxesTicks({
        x: xConfig,
        y: yConfig
    });

    // Create position converters
    // Note: Y-axis is typically reversed (0 at top in canvas coordinates)
    var xIsReversed = xRange[0] > xRange[1];
    var yIsReversed = yRange[0] < yRange[1];  // Canvas Y is inverted

    var xL2P = position.createLinearToPixel(
        xRange,
        drawingArea.width,
        xIsReversed
    );

    var yL2P = position.createLinearToPixel(
        yRange,
        drawingArea.height,
        yIsReversed
    );

    // Calculate pixel positions for ticks
    var xTicksWithPos = ticksResult.xTicks.map(function(tick) {
        return {
            value: tick.value,
            text: tick.text,
            index: tick.index,
            pixel: xL2P(tick.value)
        };
    });

    var yTicksWithPos = ticksResult.yTicks.map(function(tick) {
        return {
            value: tick.value,
            text: tick.text,
            index: tick.index,
            pixel: yL2P(tick.value)
        };
    });

    return {
        // Drawing area
        drawingArea: drawingArea,

        // X-axis
        x: {
            ticks: xTicksWithPos,
            l2p: xL2P,
            range: xRange,
            config: calcTicks.normalizeAxisConfig(xConfig)
        },

        // Y-axis
        y: {
            ticks: yTicksWithPos,
            l2p: yL2P,
            range: yRange,
            config: calcTicks.normalizeAxisConfig(yConfig)
        }
    };
}

// Export all public APIs
module.exports = {
    // Main setup function
    setupAxes: setupAxes,

    // Tick calculation
    calcTicks: calcTicks.calcTicks,
    calcAxesTicks: calcTicks.calcAxesTicks,
    normalizeAxisConfig: calcTicks.normalizeAxisConfig,
    inferRangeFromData: calcTicks.inferRangeFromData,

    // Auto ticks algorithm
    calcTickInterval: autoTicks.calcTickInterval,
    calcFirstTick: autoTicks.calcFirstTick,
    calcLastTick: autoTicks.calcLastTick,
    generateTickValues: autoTicks.generateTickValues,
    autoTicks: autoTicks.autoTicks,

    // Position conversion
    createLinearToPixel: position.createLinearToPixel,
    createPixelToLinear: position.createPixelToLinear,
    createCategoryToPixel: position.createCategoryToPixel,
    calculateAxisMargins: position.calculateAxisMargins,
    calculateDrawingArea: position.calculateDrawingArea,

    // Tick formatting
    countDecimals: tickFormat.countDecimals,
    roundTo: tickFormat.roundTo,
    formatTickLabel: tickFormat.formatTickLabel,
    formatTickLabels: tickFormat.formatTickLabels,
    formatTickLabelsUniform: tickFormat.formatTickLabelsUniform,
    calculatePrecision: tickFormat.calculatePrecision
};
