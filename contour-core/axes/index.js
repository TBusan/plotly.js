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
 * Supports both static (full range) and dynamic (visible range) modes
 *
 * @param {Object} config - Axes configuration
 * @param {Object} config.x - X-axis configuration
 * @param {Object} config.y - Y-axis configuration
 * @param {number} config.width - Drawing area width (pixels)
 * @param {number} config.height - Drawing area height (pixels)
 * @param {Object} config.margins - Custom margins {left, right, top, bottom} (optional)
 * @param {Object} config.visibleRange - Visible range for dynamic mode {xMin, xMax, yMin, yMax} (optional)
 * @param {Object} config.fullRange - Full data range {xMin, xMax, yMin, yMax} (optional)
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

    // Determine the range to use for ticks and position conversion
    // If visibleRange is provided, use it; otherwise use full range
    var xRange, yRange;
    var visibleRange = config.visibleRange;

    if (visibleRange) {
        // Dynamic mode: use visible range for ticks and position
        xRange = [visibleRange.xMin, visibleRange.xMax];
        yRange = [visibleRange.yMin, visibleRange.yMax];
    } else {
        // Static mode: infer from config or data
        if (!xConfig.range && config.xData) {
            xConfig.range = calcTicks.inferRangeFromData(config.xData);
        }
        if (!yConfig.range && config.yData) {
            yConfig.range = calcTicks.inferRangeFromData(config.yData);
        }
        xRange = xConfig.range || [0, width];
        yRange = yConfig.range || [0, height];
    }

    // Calculate ticks
    var ticksResult;
    if (visibleRange) {
        // Use dynamic tick calculation for visible range
        ticksResult = calcTicks.calcDynamicTicks(visibleRange, {
            width: drawingArea.width,
            height: drawingArea.height,
            x: xConfig,
            y: yConfig
        });

        // Convert to same format as calcAxesTicks
        ticksResult = {
            xTicks: ticksResult.x.values.map(function(value, i) {
                return {
                    value: value,
                    text: ticksResult.x.texts[i],
                    index: i
                };
            }),
            yTicks: ticksResult.y.values.map(function(value, i) {
                return {
                    value: value,
                    text: ticksResult.y.texts[i],
                    index: i
                };
            })
        };
    } else {
        ticksResult = calcTicks.calcAxesTicks({
            x: xConfig,
            y: yConfig
        });
    }

    // Create position converters based on visible range
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

    // Store full range for reference (if provided)
    var fullRange = config.fullRange || {
        xMin: xRange[0],
        xMax: xRange[1],
        yMin: yRange[0],
        yMax: yRange[1]
    };

    return {
        // Drawing area
        drawingArea: drawingArea,

        // Visible range (for dynamic mode)
        visibleRange: visibleRange,

        // Full data range
        fullRange: fullRange,

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
    calcDynamicTicks: calcTicks.calcDynamicTicks,
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
