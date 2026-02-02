'use strict';

/**
 * Canvas axes renderer
 * Draws X and Y axis ticks, labels, and titles
 */

var axes = require('../../axes');

/**
 * Draw X-axis on canvas
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} axisSetup - Axis setup result from axes.setupAxes()
 * @param {number} yOffset - Y offset for axis line
 */
function drawXAxis(ctx, axisSetup, yOffset) {
    var xAxis = axisSetup.x;
    var config = xAxis.config;
    var ticks = xAxis.ticks;
    var drawingArea = axisSetup.drawingArea;

    if (config.show === false) {
        return;
    }

    var side = config.side || 'bottom';
    var tickLength = config.ticklen || 5;
    var tickColor = config.tickcolor || '#666666';
    var tickWidth = config.tickwidth || 1;
    var showLabels = config.showticklabels !== false;

    // Determine axis position
    var axisY;
    var labelY;
    var labelAlign = 'center';
    var labelBaseline = 'top';

    if (side === 'top') {
        axisY = drawingArea.margins.top;
        labelY = axisY - tickLength - 5;
        labelBaseline = 'bottom';
    } else {
        // bottom (default)
        axisY = drawingArea.y + drawingArea.height;
        labelY = axisY + tickLength + 5;
        labelBaseline = 'top';
    }

    // Draw axis line
    ctx.beginPath();
    ctx.strokeStyle = config.linecolor || '#333';
    ctx.lineWidth = config.linewidth || 1;
    ctx.moveTo(drawingArea.x, axisY);
    ctx.lineTo(drawingArea.x + drawingArea.width, axisY);
    ctx.stroke();

    // Draw ticks and labels
    ctx.font = (config.tickfont || '12px Arial, sans-serif');
    ctx.fillStyle = config.tickfontcolor || '#333';
    ctx.textAlign = labelAlign;
    ctx.textBaseline = labelBaseline;

    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var x = drawingArea.x + tick.pixel;

        // Skip ticks outside drawing area (with some tolerance)
        if (tick.pixel < -10 || tick.pixel > drawingArea.width + 10) {
            continue;
        }

        // Draw tick line
        ctx.beginPath();
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = tickWidth;
        if (side === 'top') {
            ctx.moveTo(x, axisY);
            ctx.lineTo(x, axisY - tickLength);
        } else {
            ctx.moveTo(x, axisY);
            ctx.lineTo(x, axisY + tickLength);
        }
        ctx.stroke();

        // Draw tick label
        if (showLabels) {
            ctx.fillText(tick.text, x, labelY);
        }
    }

    // Draw axis title
    if (config.title) {
        ctx.save();
        ctx.font = (config.titlefont || 'bold 14px Arial, sans-serif');
        ctx.fillStyle = config.titlefontcolor || '#000';
        ctx.textAlign = 'center';

        var titleY;
        if (side === 'top') {
            titleY = labelY - 25;
        } else {
            titleY = labelY + 20;
        }

        ctx.fillText(config.title, drawingArea.x + drawingArea.width / 2, titleY);
        ctx.restore();
    }
}

/**
 * Draw Y-axis on canvas
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} axisSetup - Axis setup result from axes.setupAxes()
 * @param {number} xOffset - X offset for axis line
 */
function drawYAxis(ctx, axisSetup, xOffset) {
    var yAxis = axisSetup.y;
    var config = yAxis.config;
    var ticks = yAxis.ticks;
    var drawingArea = axisSetup.drawingArea;

    if (config.show === false) {
        return;
    }

    var side = config.side || 'left';
    var tickLength = config.ticklen || 5;
    var tickColor = config.tickcolor || '#666666';
    var tickWidth = config.tickwidth || 1;
    var showLabels = config.showticklabels !== false;

    // Determine axis position
    var axisX;
    var labelX;
    var labelAlign = 'end';
    var labelBaseline = 'middle';

    if (side === 'right') {
        axisX = drawingArea.x + drawingArea.width;
        labelX = axisX + tickLength + 5;
        labelAlign = 'start';
    } else {
        // left (default)
        axisX = drawingArea.margins.left;
        labelX = axisX - tickLength - 5;
        labelAlign = 'end';
    }

    // Draw axis line
    ctx.beginPath();
    ctx.strokeStyle = config.linecolor || '#333';
    ctx.lineWidth = config.linewidth || 1;
    ctx.moveTo(axisX, drawingArea.y);
    ctx.lineTo(axisX, drawingArea.y + drawingArea.height);
    ctx.stroke();

    // Draw ticks and labels
    ctx.font = (config.tickfont || '12px Arial, sans-serif');
    ctx.fillStyle = config.tickfontcolor || '#333';
    ctx.textAlign = labelAlign;
    ctx.textBaseline = labelBaseline;

    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var y = drawingArea.y + tick.pixel;

        // Skip ticks outside drawing area (with some tolerance)
        if (tick.pixel < -10 || tick.pixel > drawingArea.height + 10) {
            continue;
        }

        // Draw tick line
        ctx.beginPath();
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = tickWidth;
        if (side === 'right') {
            ctx.moveTo(axisX, y);
            ctx.lineTo(axisX + tickLength, y);
        } else {
            ctx.moveTo(axisX, y);
            ctx.lineTo(axisX - tickLength, y);
        }
        ctx.stroke();

        // Draw tick label
        if (showLabels) {
            ctx.fillText(tick.text, labelX, y);
        }
    }

    // Draw axis title
    if (config.title) {
        ctx.save();
        ctx.font = (config.titlefont || 'bold 14px Arial, sans-serif');
        ctx.fillStyle = config.titlefontcolor || '#000';
        ctx.textAlign = 'center';

        var titleX;
        var titleY = drawingArea.y + drawingArea.height / 2;

        if (side === 'right') {
            titleX = labelX + 30;
        } else {
            titleX = labelX - 25;
        }

        // Rotate text for Y-axis title
        ctx.translate(titleX, titleY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(config.title, 0, 0);
        ctx.restore();
    }
}

/**
 * Draw grid lines for an axis
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} axisSetup - Axis setup result from axes.setupAxes()
 * @param {boolean} isXAxis - True for X-axis grid, false for Y-axis
 */
function drawGrid(ctx, axisSetup, isXAxis) {
    var axis = isXAxis ? axisSetup.x : axisSetup.y;
    var config = axis.config;
    var ticks = axis.ticks;
    var drawingArea = axisSetup.drawingArea;

    if (!config.showgrid) {
        return;
    }

    ctx.beginPath();
    ctx.strokeStyle = config.gridcolor || '#e0e0e0';
    ctx.lineWidth = config.gridwidth || 1;

    if (config.griddash) {
        var dashArray = typeof config.griddash === 'string' ?
            config.griddash.split(',').map(Number) : [5, 5];
        ctx.setLineDash(dashArray);
    } else {
        ctx.setLineDash([]);
    }

    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];

        // Skip ticks outside drawing area
        if (tick.pixel < 0 || tick.pixel > (isXAxis ? drawingArea.width : drawingArea.height)) {
            continue;
        }

        if (isXAxis) {
            var x = drawingArea.x + tick.pixel;
            ctx.moveTo(x, drawingArea.y);
            ctx.lineTo(x, drawingArea.y + drawingArea.height);
        } else {
            var y = drawingArea.y + tick.pixel;
            ctx.moveTo(drawingArea.x, y);
            ctx.lineTo(drawingArea.x + drawingArea.width, y);
        }
    }

    ctx.stroke();
    ctx.setLineDash([]);
}

/**
 * Draw complete axes on canvas
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} axesConfig - Axes configuration
 * @param {number} axesConfig.width - Canvas width
 * @param {number} axesConfig.height - Canvas height
 * @param {Object} axesConfig.x - X-axis configuration
 * @param {Object} axesConfig.y - Y-axis configuration
 * @param {Array} axesConfig.xData - X-axis data values (for range inference)
 * @param {Array} axesConfig.yData - Y-axis data values (for range inference)
 */
function drawAxes(ctx, axesConfig) {
    axesConfig = axesConfig || {};

    var width = axesConfig.width || ctx.canvas.width;
    var height = axesConfig.height || ctx.canvas.height;

    // Set up axes with ticks and positions
    var axisSetup = axes.setupAxes(axesConfig);

    // Draw grid lines first (behind the plot)
    drawGrid(ctx, axisSetup, true);   // X-axis grid
    drawGrid(ctx, axisSetup, false);  // Y-axis grid

    // Draw axes
    drawXAxis(ctx, axisSetup);
    drawYAxis(ctx, axisSetup);

    return axisSetup;
}

/**
 * Draw axes with existing axis setup
 * Use this when you've already called setupAxes and just need to draw
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} axisSetup - Axis setup result from axes.setupAxes()
 */
function drawAxesFromSetup(ctx, axisSetup) {
    // Draw grid lines first
    drawGrid(ctx, axisSetup, true);
    drawGrid(ctx, axisSetup, false);

    // Draw axes
    drawXAxis(ctx, axisSetup);
    drawYAxis(ctx, axisSetup);
}

module.exports = {
    drawAxes: drawAxes,
    drawAxesFromSetup: drawAxesFromSetup,
    drawXAxis: drawXAxis,
    drawYAxis: drawYAxis,
    drawGrid: drawGrid
};
