'use strict';

/**
 * ZRender axes utilities
 */

var zrender = require('zrender');

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

module.exports = {
    drawXAxis: drawXAxis,
    drawYAxis: drawYAxis,
    drawXGrid: drawXGrid,
    drawYGrid: drawYGrid
};
