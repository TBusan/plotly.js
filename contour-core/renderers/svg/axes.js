'use strict';

/**
 * SVG axes renderer
 * Generates X and Y axis ticks, labels, and titles as SVG elements
 */

var axes = require('../../axes');

/**
 * Generate X-axis SVG elements
 *
 * @param {Object} axisSetup - Axis setup result from axes.setupAxes()
 * @returns {String} SVG string for X-axis
 */
function createXAxis(axisSetup) {
    var xAxis = axisSetup.x;
    var config = xAxis.config;
    var ticks = xAxis.ticks;
    var drawingArea = axisSetup.drawingArea;

    if (config.show === false) {
        return '';
    }

    var parts = [];
    var side = config.side || 'bottom';
    var tickLength = config.ticklen || 5;
    var tickColor = config.tickcolor || '#666666';
    var tickWidth = config.tickwidth || 1;
    var showLabels = config.showticklabels !== false;
    var lineColor = config.linecolor || '#333';
    var lineWidth = config.linewidth || 1;

    // Determine axis position
    var axisY;
    var labelY;
    var labelBaseline = 'start';

    if (side === 'top') {
        axisY = drawingArea.margins.top;
        labelY = axisY - tickLength - 5;
    } else {
        // bottom (default)
        axisY = drawingArea.y + drawingArea.height;
        labelY = axisY + tickLength + 5;
    }

    // Draw axis line
    parts.push('<line class="axis-line x-axis-line" x1="' + drawingArea.x + '" y1="' + axisY +
               '" x2="' + (drawingArea.x + drawingArea.width) + '" y2="' + axisY +
               '" stroke="' + lineColor + '" stroke-width="' + lineWidth + '"/>');

    // Draw ticks and labels
    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var x = drawingArea.x + tick.pixel;

        // Skip ticks outside drawing area (with some tolerance)
        if (tick.pixel < -10 || tick.pixel > drawingArea.width + 10) {
            continue;
        }

        // Draw tick line
        var tickY2 = side === 'top' ? axisY - tickLength : axisY + tickLength;
        parts.push('<line class="axis-tick x-axis-tick" x1="' + x + '" y1="' + axisY +
                   '" x2="' + x + '" y2="' + tickY2 +
                   '" stroke="' + tickColor + '" stroke-width="' + tickWidth + '"/>');

        // Draw tick label
        if (showLabels) {
            parts.push('<text class="axis-label x-axis-label" x="' + x + '" y="' + labelY +
                       '" text-anchor="middle">' + tick.text + '</text>');
        }
    }

    // Draw axis title
    if (config.title) {
        var titleY;
        if (side === 'top') {
            titleY = labelY - 25;
        } else {
            titleY = labelY + 20;
        }

        parts.push('<text class="axis-title x-axis-title" x="' + (drawingArea.x + drawingArea.width / 2) + '" y="' + titleY +
                   '" text-anchor="middle">' + config.title + '</text>');
    }

    return parts.join('\n');
}

/**
 * Generate Y-axis SVG elements
 *
 * @param {Object} axisSetup - Axis setup result from axes.setupAxes()
 * @returns {String} SVG string for Y-axis
 */
function createYAxis(axisSetup) {
    var yAxis = axisSetup.y;
    var config = yAxis.config;
    var ticks = yAxis.ticks;
    var drawingArea = axisSetup.drawingArea;

    if (config.show === false) {
        return '';
    }

    var parts = [];
    var side = config.side || 'left';
    var tickLength = config.ticklen || 5;
    var tickColor = config.tickcolor || '#666666';
    var tickWidth = config.tickwidth || 1;
    var showLabels = config.showticklabels !== false;
    var lineColor = config.linecolor || '#333';
    var lineWidth = config.linewidth || 1;

    // Determine axis position
    var axisX;
    var labelX;
    var labelAnchor = 'end';

    if (side === 'right') {
        axisX = drawingArea.x + drawingArea.width;
        labelX = axisX + tickLength + 5;
        labelAnchor = 'start';
    } else {
        // left (default)
        axisX = drawingArea.margins.left;
        labelX = axisX - tickLength - 5;
        labelAnchor = 'end';
    }

    // Draw axis line
    parts.push('<line class="axis-line y-axis-line" x1="' + axisX + '" y1="' + drawingArea.y +
               '" x2="' + axisX + '" y2="' + (drawingArea.y + drawingArea.height) +
               '" stroke="' + lineColor + '" stroke-width="' + lineWidth + '"/>');

    // Draw ticks and labels
    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var y = drawingArea.y + tick.pixel;

        // Skip ticks outside drawing area (with some tolerance)
        if (tick.pixel < -10 || tick.pixel > drawingArea.height + 10) {
            continue;
        }

        // Draw tick line
        var tickX2 = side === 'right' ? axisX + tickLength : axisX - tickLength;
        parts.push('<line class="axis-tick y-axis-tick" x1="' + axisX + '" y1="' + y +
                   '" x2="' + tickX2 + '" y2="' + y +
                   '" stroke="' + tickColor + '" stroke-width="' + tickWidth + '"/>');

        // Draw tick label
        if (showLabels) {
            parts.push('<text class="axis-label y-axis-label" x="' + labelX + '" y="' + (y + 4) +
                       '" text-anchor="' + labelAnchor + '">' + tick.text + '</text>');
        }
    }

    // Draw axis title
    if (config.title) {
        var titleX;
        var titleY = drawingArea.y + drawingArea.height / 2;

        if (side === 'right') {
            titleX = labelX + 30;
        } else {
            titleX = labelX - 25;
        }

        // Rotate text for Y-axis title
        parts.push('<text class="axis-title y-axis-title" x="' + titleX + '" y="' + titleY +
                   '" text-anchor="middle" transform="rotate(-90, ' + titleX + ', ' + titleY + ')">' +
                   config.title + '</text>');
    }

    return parts.join('\n');
}

/**
 * Generate grid lines for an axis
 *
 * @param {Object} axisSetup - Axis setup result from axes.setupAxes()
 * @param {boolean} isXAxis - True for X-axis grid, false for Y-axis
 * @returns {String} SVG string for grid lines
 */
function createGrid(axisSetup, isXAxis) {
    var axis = isXAxis ? axisSetup.x : axisSetup.y;
    var config = axis.config;
    var ticks = axis.ticks;
    var drawingArea = axisSetup.drawingArea;

    if (!config.showgrid) {
        return '';
    }

    var parts = [];
    var gridColor = config.gridcolor || '#e0e0e0';
    var gridWidth = config.gridwidth || 1;
    var dashArray = config.griddash || '';

    // Convert dash array to SVG format
    var strokeDasharray = '';
    if (dashArray) {
        if (typeof dashArray === 'string') {
            strokeDasharray = 'stroke-dasharray="' + dashArray + '"';
        } else if (Array.isArray(dashArray)) {
            strokeDasharray = 'stroke-dasharray="' + dashArray.join(',') + '"';
        }
    }

    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];

        // Skip ticks outside drawing area
        if (tick.pixel < 0 || tick.pixel > (isXAxis ? drawingArea.width : drawingArea.height)) {
            continue;
        }

        if (isXAxis) {
            var x = drawingArea.x + tick.pixel;
            parts.push('<line class="axis-grid x-grid-line" x1="' + x + '" y1="' + drawingArea.y +
                       '" x2="' + x + '" y2="' + (drawingArea.y + drawingArea.height) +
                       '" stroke="' + gridColor + '" stroke-width="' + gridWidth + '" ' + strokeDasharray + '/>');
        } else {
            var y = drawingArea.y + tick.pixel;
            parts.push('<line class="axis-grid y-grid-line" x1="' + drawingArea.x + '" y1="' + y +
                       '" x2="' + (drawingArea.x + drawingArea.width) + '" y2="' + y +
                       '" stroke="' + gridColor + '" stroke-width="' + gridWidth + '" ' + strokeDasharray + '/>');
        }
    }

    return parts.join('\n');
}

/**
 * Generate complete axes SVG
 *
 * @param {Object} axesConfig - Axes configuration
 * @param {number} axesConfig.width - Canvas width
 * @param {number} axesConfig.height - Canvas height
 * @param {Object} axesConfig.x - X-axis configuration
 * @param {Object} axesConfig.y - Y-axis configuration
 * @param {Array} axesConfig.xData - X-axis data values (for range inference)
 * @param {Array} axesConfig.yData - Y-axis data values (for range inference)
 * @param {boolean} axesConfig.gridOnly - If true, only generate grid (not axes)
 * @returns {Object} { svg: String, axisSetup: Object }
 */
function createAxes(axesConfig) {
    axesConfig = axesConfig || {};

    // Set up axes with ticks and positions
    var axisSetup = axes.setupAxes(axesConfig);

    var parts = [];

    // If gridOnly is true, only generate grid lines
    if (axesConfig.gridOnly) {
        parts.push(createGrid(axisSetup, true));   // X-axis grid
        parts.push(createGrid(axisSetup, false));  // Y-axis grid
        return {
            svg: parts.join('\n'),
            axisSetup: axisSetup
        };
    }

    // Normal mode: generate both grid and axes
    // Draw grid lines first (behind plot)
    parts.push(createGrid(axisSetup, true));   // X-axis grid
    parts.push(createGrid(axisSetup, false));  // Y-axis grid

    // Draw axes
    parts.push(createXAxis(axisSetup));
    parts.push(createYAxis(axisSetup));

    return {
        svg: parts.join('\n'),
        axisSetup: axisSetup
    };
}

/**
 * Generate axes with existing axis setup
 * Use this when you've already called setupAxes and just need to draw
 *
 * @param {Object} axisSetup - Axis setup result from axes.setupAxes()
 * @param {boolean} includeGrid - Whether to include grid lines
 * @returns {String} SVG string for axes and grid
 */
function createAxesFromSetup(axisSetup, includeGrid) {
    var parts = [];

    if (includeGrid !== false) {
        // Draw grid lines first
        parts.push(createGrid(axisSetup, true));
        parts.push(createGrid(axisSetup, false));
    }

    // Draw axes
    parts.push(createXAxis(axisSetup));
    parts.push(createYAxis(axisSetup));

    return parts.join('\n');
}

module.exports = {
    createAxes: createAxes,
    createAxesFromSetup: createAxesFromSetup,
    createXAxis: createXAxis,
    createYAxis: createYAxis,
    createGrid: createGrid
};
