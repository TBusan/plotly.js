'use strict';

/**
 * ZRender axes utilities
 * Enhanced version that integrates with core axes module
 */

var zrender = require('zrender');
var axesCore = require('../../axes');

/**
 * Draw X axis
 */
function drawXAxis(container, config, style) {
    var width = config.width || 600;
    var height = config.height || 500;
    var padding = config.padding || 50;
    var bottomPadding = config.bottomPadding || 50;

    var axisY = height - bottomPadding;
    var axisX = padding;
    var axisWidth = width - 2 * padding;

    var axisGroup = new zrender.Group();

    // Main axis line
    var line = new zrender.Line({
        shape: {
            x1: axisX,
            y1: axisY,
            x2: axisX + axisWidth,
            y2: axisY
        },
        style: {
            stroke: config.tickColor || '#666',
            lineWidth: config.tickWidth || 1
        }
    });
    axisGroup.add(line);

    // Ticks and labels
    var ticks = generateTicks(
        config.xMin || 0,
        config.xMax || 100,
        config.xTickCount || 5
    );

    for (var i = 0; i < ticks.length; i++) {
        var tickValue = ticks[i];
        var x = axisX + ((tickValue - (config.xMin || 0)) /
                        ((config.xMax || 100) - (config.xMin || 0))) * axisWidth;

        // Tick line
        var tickLen = config.tickLen || 5;
        var tick = new zrender.Line({
            shape: {
                x1: x,
                y1: axisY,
                x2: x,
                y2: axisY + tickLen
            },
            style: {
                stroke: config.tickColor || '#666',
                lineWidth: 1
            }
        });
        axisGroup.add(tick);

        // Tick label
        var text = new zrender.Text({
            style: {
                text: tickValue.toFixed(1),
                x: x,
                y: axisY + tickLen + 5,
                textAlign: 'center',
                textVerticalAlign: 'top',
                fill: config.textColor || '#333',
                fontSize: config.fontSize || 12
            }
        });
        axisGroup.add(text);
    }

    // Axis title
    if (config.xTitle) {
        var title = new zrender.Text({
            style: {
                text: config.xTitle,
                x: axisX + axisWidth / 2,
                y: height - 10,
                textAlign: 'center',
                textVerticalAlign: 'bottom',
                fill: '#000',
                fontSize: 14,
                fontWeight: 'bold'
            }
        });
        axisGroup.add(title);
    }

    container.add(axisGroup);
    return axisGroup;
}

/**
 * Draw Y axis
 */
function drawYAxis(container, config, style) {
    var width = config.width || 600;
    var height = config.height || 500;
    var padding = config.padding || 50;
    var bottomPadding = config.bottomPadding || 50;

    var axisX = padding;
    var axisY = padding;
    var axisHeight = height - padding - bottomPadding;

    var axisGroup = new zrender.Group();

    // Main axis line
    var line = new zrender.Line({
        shape: {
            x1: axisX,
            y1: axisY,
            x2: axisX,
            y2: axisY + axisHeight
        },
        style: {
            stroke: config.tickColor || '#666',
            lineWidth: config.tickWidth || 1
        }
    });
    axisGroup.add(line);

    // Ticks and labels
    var ticks = generateTicks(
        config.yMin || 0,
        config.yMax || 100,
        config.yTickCount || 5
    );

    for (var i = 0; i < ticks.length; i++) {
        var tickValue = ticks[i];
        var y = axisY + axisHeight - ((tickValue - (config.yMin || 0)) /
                                   ((config.yMax || 100) - (config.yMin || 0))) * axisHeight;

        // Tick line
        var tickLen = config.tickLen || 5;
        var tick = new zrender.Line({
            shape: {
                x1: axisX - tickLen,
                y1: y,
                x2: axisX,
                y2: y
            },
            style: {
                stroke: config.tickColor || '#666',
                lineWidth: 1
            }
        });
        axisGroup.add(tick);

        // Tick label
        var text = new zrender.Text({
            style: {
                text: tickValue.toFixed(1),
                x: axisX - tickLen - 5,
                y: y,
                textAlign: 'right',
                textVerticalAlign: 'middle',
                fill: config.textColor || '#333',
                fontSize: config.fontSize || 12
            }
        });
        axisGroup.add(text);
    }

    // Axis title
    if (config.yTitle) {
        var title = new zrender.Text({
            style: {
                text: config.yTitle,
                x: 15,
                y: axisY + axisHeight / 2,
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fill: '#000',
                fontSize: 14,
                fontWeight: 'bold'
            }
        });
        axisGroup.add(title);
    }

    container.add(axisGroup);
    return axisGroup;
}

/**
 * Draw X grid lines
 */
function drawXGrid(container, config, style) {
    var width = config.width || 600;
    var height = config.height || 500;
    var padding = config.padding || 50;
    var bottomPadding = config.bottomPadding || 50;
    var topPadding = config.topPadding || 20;

    var axisY = height - bottomPadding;
    var axisX = padding;
    var axisWidth = width - 2 * padding;
    var axisHeight = height - padding - bottomPadding - topPadding;

    var gridGroup = new zrender.Group();

    var ticks = generateTicks(
        config.xMin || 0,
        config.xMax || 100,
        config.xTickCount || 5
    );

    for (var i = 0; i < ticks.length; i++) {
        var tickValue = ticks[i];
        var x = axisX + ((tickValue - (config.xMin || 0)) /
                        ((config.xMax || 100) - (config.xMin || 0))) * axisWidth;

        var gridLine = new zrender.Line({
            shape: {
                x1: x,
                y1: axisY - axisHeight,
                x2: x,
                y2: axisY
            },
            style: {
                stroke: config.gridColor || '#e0e0e0',
                lineWidth: config.gridWidth || 1,
                lineDash: [4, 4]
            }
        });
        gridGroup.add(gridLine);
    }

    container.add(gridGroup);
    return gridGroup;
}

/**
 * Draw Y grid lines
 */
function drawYGrid(container, config, style) {
    var width = config.width || 600;
    var height = config.height || 500;
    var padding = config.padding || 50;
    var bottomPadding = config.bottomPadding || 50;
    var topPadding = config.topPadding || 20;

    var axisY = height - bottomPadding;
    var axisX = padding;
    var axisHeight = height - padding - bottomPadding - topPadding;

    var gridGroup = new zrender.Group();

    var ticks = generateTicks(
        config.yMin || 0,
        config.yMax || 100,
        config.yTickCount || 5
    );

    for (var i = 0; i < ticks.length; i++) {
        var tickValue = ticks[i];
        var y = axisY - ((tickValue - (config.yMin || 0)) /
                        ((config.yMax || 100) - (config.yMin || 0))) * axisHeight;

        var gridLine = new zrender.Line({
            shape: {
                x1: axisX,
                y1: y,
                x2: axisX + (width - 2 * padding),
                y2: y
            },
            style: {
                stroke: config.gridColor || '#e0e0e0',
                lineWidth: config.gridWidth || 1,
                lineDash: [4, 4]
            }
        });
        gridGroup.add(gridLine);
    }

    container.add(gridGroup);
    return gridGroup;
}

/**
 * Generate tick values
 */
function generateTicks(min, max, count) {
    var ticks = [];
    var step = (max - min) / (count - 1);

    for (var i = 0; i < count; i++) {
        ticks.push(min + step * i);
    }

    return ticks;
}

/**
 * Setup axes using core axes module
 * This provides more accurate tick calculation and formatting
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.x - X-axis configuration
 * @param {Object} config.y - Y-axis configuration
 * @param {Array} config.xData - X data values for range inference
 * @param {Array} config.yData - Y data values for range inference
 * @param {number} config.width - Canvas width
 * @param {number} config.height - Canvas height
 * @returns {Object} Axis setup result with ticks and drawing area
 */
function setupAxes(config) {
    return axesCore.setupAxes(config);
}

/**
 * Draw axes from setup result
 * Uses the output from setupAxes() to draw axes
 *
 * @param {zrender.Group} container - Container to add axes to
 * @param {Object} axisSetup - Axis setup result from setupAxes()
 * @param {Object} style - Style options
 */
function drawAxesFromSetup(container, axisSetup, style) {
    style = style || {};

    if (!axisSetup) return;

    var drawingArea = axisSetup.drawingArea;

    // Draw X axis
    if (axisSetup.x && axisSetup.x.config.show !== false) {
        drawXAxisFromSetup(container, axisSetup, style);
    }

    // Draw Y axis
    if (axisSetup.y && axisSetup.y.config.show !== false) {
        drawYAxisFromSetup(container, axisSetup, style);
    }
}

/**
 * Draw X axis from setup result
 */
function drawXAxisFromSetup(container, axisSetup, style) {
    var xAxis = axisSetup.x;
    var config = xAxis.config;
    var ticks = xAxis.ticks;
    var drawingArea = axisSetup.drawingArea;

    var axisGroup = new zrender.Group();

    var side = config.side || 'bottom';
    var tickLength = config.ticklen || 5;
    var tickColor = config.tickcolor || '#666666';
    var showLabels = config.showticklabels !== false;

    // Determine axis position
    var axisY, labelY, labelBaseline;
    if (side === 'top') {
        axisY = drawingArea.margins.top;
        labelY = axisY - tickLength - 5;
        labelBaseline = 'bottom';
    } else {
        axisY = drawingArea.y + drawingArea.height;
        labelY = axisY + tickLength + 5;
        labelBaseline = 'top';
    }

    // Draw axis line
    var line = new zrender.Line({
        shape: {
            x1: drawingArea.x,
            y1: axisY,
            x2: drawingArea.x + drawingArea.width,
            y2: axisY
        },
        style: {
            stroke: config.linecolor || '#333',
            lineWidth: config.linewidth || 1
        }
    });
    axisGroup.add(line);

    // Draw ticks and labels
    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var x = drawingArea.x + tick.pixel;

        // Skip ticks outside drawing area
        if (tick.pixel < -10 || tick.pixel > drawingArea.width + 10) continue;

        // Draw tick line
        var tickLine = new zrender.Line({
            shape: {
                x1: x,
                y1: axisY,
                x2: x,
                y2: side === 'top' ? axisY - tickLength : axisY + tickLength
            },
            style: {
                stroke: tickColor,
                lineWidth: config.tickwidth || 1
            }
        });
        axisGroup.add(tickLine);

        // Draw tick label
        if (showLabels) {
            var text = new zrender.Text({
                style: {
                    text: tick.text,
                    x: x,
                    y: labelY,
                    textAlign: 'center',
                    textVerticalAlign: labelBaseline,
                    fill: config.tickfontcolor || '#333',
                    fontSize: parseInt(config.tickfont) || 12
                }
            });
            axisGroup.add(text);
        }
    }

    // Draw axis title
    if (config.title) {
        var title = new zrender.Text({
            style: {
                text: config.title,
                x: drawingArea.x + drawingArea.width / 2,
                y: side === 'top' ? labelY - 25 : labelY + 20,
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fill: config.titlefontcolor || '#000',
                fontSize: parseInt(config.titlefont) || 14,
                fontWeight: 'bold'
            }
        });
        axisGroup.add(title);
    }

    container.add(axisGroup);
    return axisGroup;
}

/**
 * Draw Y axis from setup result
 */
function drawYAxisFromSetup(container, axisSetup, style) {
    var yAxis = axisSetup.y;
    var config = yAxis.config;
    var ticks = yAxis.ticks;
    var drawingArea = axisSetup.drawingArea;

    var axisGroup = new zrender.Group();

    var side = config.side || 'left';
    var tickLength = config.ticklen || 5;
    var tickColor = config.tickcolor || '#666666';
    var showLabels = config.showticklabels !== false;

    // Determine axis position
    var axisX, labelX, labelAlign;
    if (side === 'right') {
        axisX = drawingArea.x + drawingArea.width;
        labelX = axisX + tickLength + 5;
        labelAlign = 'start';
    } else {
        axisX = drawingArea.margins.left;
        labelX = axisX - tickLength - 5;
        labelAlign = 'end';
    }

    // Draw axis line
    var line = new zrender.Line({
        shape: {
            x1: axisX,
            y1: drawingArea.y,
            x2: axisX,
            y2: drawingArea.y + drawingArea.height
        },
        style: {
            stroke: config.linecolor || '#333',
            lineWidth: config.linewidth || 1
        }
    });
    axisGroup.add(line);

    // Draw ticks and labels
    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var y = drawingArea.y + tick.pixel;

        // Skip ticks outside drawing area
        if (tick.pixel < -10 || tick.pixel > drawingArea.height + 10) continue;

        // Draw tick line
        var tickLine = new zrender.Line({
            shape: {
                x1: side === 'right' ? axisX : axisX - tickLength,
                y1: y,
                x2: side === 'right' ? axisX + tickLength : axisX,
                y2: y
            },
            style: {
                stroke: tickColor,
                lineWidth: config.tickwidth || 1
            }
        });
        axisGroup.add(tickLine);

        // Draw tick label
        if (showLabels) {
            var text = new zrender.Text({
                style: {
                    text: tick.text,
                    x: labelX,
                    y: y,
                    textAlign: labelAlign,
                    textVerticalAlign: 'middle',
                    fill: config.tickfontcolor || '#333',
                    fontSize: parseInt(config.tickfont) || 12
                }
            });
            axisGroup.add(text);
        }
    }

    // Draw axis title (rotated)
    if (config.title) {
        var titleGroup = new zrender.Group();
        var titleY = drawingArea.y + drawingArea.height / 2;
        var titleXPos = side === 'right' ? labelX + 30 : labelX - 25;

        var title = new zrender.Text({
            style: {
                text: config.title,
                x: 0,
                y: 0,
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fill: config.titlefontcolor || '#000',
                fontSize: parseInt(config.titlefont) || 14,
                fontWeight: 'bold'
            }
        });

        titleGroup.add(title);
        titleGroup.attr({
            x: titleXPos,
            y: titleY,
            rotation: -Math.PI / 2
        });

        axisGroup.add(titleGroup);
    }

    container.add(axisGroup);
    return axisGroup;
}

/**
 * Draw grid from setup result
 *
 * @param {zrender.Group} container - Container to add grid to
 * @param {Object} axisSetup - Axis setup result
 * @param {Object} style - Style options
 */
function drawGridFromSetup(container, axisSetup, style) {
    style = style || {};

    if (!axisSetup) return;

    // Draw X grid
    if (axisSetup.x && axisSetup.x.config.showgrid) {
        drawXGridFromSetup(container, axisSetup, style);
    }

    // Draw Y grid
    if (axisSetup.y && axisSetup.y.config.showgrid) {
        drawYGridFromSetup(container, axisSetup, style);
    }
}

/**
 * Draw X grid from setup result
 */
function drawXGridFromSetup(container, axisSetup, style) {
    var xAxis = axisSetup.x;
    var config = xAxis.config;
    var ticks = xAxis.ticks;
    var drawingArea = axisSetup.drawingArea;

    var gridGroup = new zrender.Group();

    var gridColor = config.gridcolor || '#e0e0e0';
    var gridWidth = config.gridwidth || 1;
    var gridDash = config.griddash ? parseDashArray(config.griddash) : [5, 5];

    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var x = drawingArea.x + tick.pixel;

        if (tick.pixel < 0 || tick.pixel > drawingArea.width) continue;

        var gridLine = new zrender.Line({
            shape: {
                x1: x,
                y1: drawingArea.y,
                x2: x,
                y2: drawingArea.y + drawingArea.height
            },
            style: {
                stroke: gridColor,
                lineWidth: gridWidth,
                lineDash: gridDash
            },
            silent: true
        });
        gridGroup.add(gridLine);
    }

    container.add(gridGroup);
    return gridGroup;
}

/**
 * Draw Y grid from setup result
 */
function drawYGridFromSetup(container, axisSetup, style) {
    var yAxis = axisSetup.y;
    var config = yAxis.config;
    var ticks = yAxis.ticks;
    var drawingArea = axisSetup.drawingArea;

    var gridGroup = new zrender.Group();

    var gridColor = config.gridcolor || '#e0e0e0';
    var gridWidth = config.gridwidth || 1;
    var gridDash = config.griddash ? parseDashArray(config.griddash) : [5, 5];

    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var y = drawingArea.y + tick.pixel;

        if (tick.pixel < 0 || tick.pixel > drawingArea.height) continue;

        var gridLine = new zrender.Line({
            shape: {
                x1: drawingArea.x,
                y1: y,
                x2: drawingArea.x + drawingArea.width,
                y2: y
            },
            style: {
                stroke: gridColor,
                lineWidth: gridWidth,
                lineDash: gridDash
            },
            silent: true
        });
        gridGroup.add(gridLine);
    }

    container.add(gridGroup);
    return gridGroup;
}

/**
 * Parse dash array from string or array
 */
function parseDashArray(dash) {
    if (Array.isArray(dash)) return dash;
    if (typeof dash === 'string') {
        return dash.split(',').map(function(s) {
            return parseFloat(s.trim()) || 0;
        });
    }
    return [5, 5];
}

module.exports = {
    // Original simple functions
    drawXAxis: drawXAxis,
    drawYAxis: drawYAxis,
    drawXGrid: drawXGrid,
    drawYGrid: drawYGrid,

    // Enhanced functions using core axes module
    setupAxes: setupAxes,
    drawAxesFromSetup: drawAxesFromSetup,
    drawGridFromSetup: drawGridFromSetup,
    drawXAxisFromSetup: drawXAxisFromSetup,
    drawYAxisFromSetup: drawYAxisFromSetup,
    drawXGridFromSetup: drawXGridFromSetup,
    drawYGridFromSetup: drawYGridFromSetup
};
