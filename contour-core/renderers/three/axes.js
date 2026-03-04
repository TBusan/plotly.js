'use strict';

/**
 * Three.js axes utilities for contour rendering
 */

// Try to get THREE from require, fall back to global
var THREE;
try {
    THREE = require('three');
} catch (e) {
    THREE = typeof window !== 'undefined' ? window.THREE : null;
}

var paths = require('./paths');

/**
 * Create axis line mesh
 */
function createAxisLine(x1, y1, x2, y2, color, lineWidth) {
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        x1, y1, 0,
        x2, y2, 0
    ], 3));

    var material = new THREE.LineBasicMaterial({
        color: color,
        linewidth: lineWidth || 1
    });

    return new THREE.Line(geometry, material);
}

/**
 * Create tick line mesh
 */
function createTickLine(x1, y1, x2, y2, color, lineWidth) {
    return createAxisLine(x1, y1, x2, y2, color, lineWidth || 1);
}

/**
 * Create tick label sprite
 */
function createTickLabel(text, x, y, options) {
    options = options || {};

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    var fontSize = options.fontSize || 12;
    var fontFamily = options.fontFamily || 'Arial, sans-serif';
    var fontColor = options.fontColor || '#333333';

    ctx.font = fontSize + 'px ' + fontFamily;
    var metrics = ctx.measureText(text);

    canvas.width = metrics.width + 10;
    canvas.height = fontSize + 6;

    ctx.font = fontSize + 'px ' + fontFamily;
    ctx.fillStyle = fontColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    var texture = new THREE.CanvasTexture(canvas);
    var material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });

    var sprite = new THREE.Sprite(material);
    sprite.scale.set(canvas.width * 0.5, canvas.height * 0.5, 1);
    sprite.position.set(x, y, 1);

    return sprite;
}

/**
 * Create grid lines for axis
 */
function createGridLines(axesConfig, style, axisType, renderer) {
    var meshes = [];
    var config = axesConfig[axisType];
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    if (!config || !config.showgrid) {
        return meshes;
    }

    var gridColor = style.gridColor || '#e0e0e0';
    var threeGridColor = new THREE.Color(gridColor);
    var lineWidth = style.gridLineWidth || 1;

    var xMin = padding;
    var xMax = width - padding;
    var yMin = padding;
    var yMax = height - padding;

    var ticks = config.ticks || [];
    var range = config.range || [0, 10];

    if (axisType === 'x') {
        for (var i = 0; i < ticks.length; i++) {
            var tickVal = ticks[i];
            var x = padding + ((tickVal - range[0]) / (range[1] - range[0])) * (width - 2 * padding);
            var worldX = x - width / 2;
            var worldY1 = -(yMin - height / 2);
            var worldY2 = -(yMax - height / 2);

            var line = createAxisLine(worldX, worldY1, worldX, worldY2, threeGridColor, lineWidth);
            meshes.push(line);
        }
    } else if (axisType === 'y') {
        for (var i = 0; i < ticks.length; i++) {
            var tickVal = ticks[i];
            var y = padding + ((tickVal - range[0]) / (range[1] - range[0])) * (height - 2 * padding);
            y = height - y; // Flip Y
            var worldY = -(y - height / 2);
            var worldX1 = xMin - width / 2;
            var worldX2 = xMax - width / 2;

            var line = createAxisLine(worldX1, worldY, worldX2, worldY, threeGridColor, lineWidth);
            meshes.push(line);
        }
    }

    return meshes;
}

/**
 * Create axis with ticks and labels
 */
function createAxis(axesConfig, style, axisType, renderer) {
    var meshes = [];
    var config = axesConfig[axisType];
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    if (!config) {
        return meshes;
    }

    var axisColor = style.axisColor || '#333333';
    var threeAxisColor = new THREE.Color(axisColor);
    var lineWidth = style.axisLineWidth || 2;

    var xMin = padding;
    var xMax = width - padding;
    var yMin = padding;
    var yMax = height - padding;

    // Create main axis line
    if (axisType === 'x') {
        var worldX1 = xMin - width / 2;
        var worldX2 = xMax - width / 2;
        var worldY = -(yMin - height / 2);

        var axisLine = createAxisLine(worldX1, worldY, worldX2, worldY, threeAxisColor, lineWidth);
        meshes.push(axisLine);

        // Create ticks and labels
        var ticks = config.ticks || [];
        var tickLabels = config.ticklabels || ticks;
        var range = config.range || [0, 10];
        var tickLen = style.tickLength || 5;

        for (var i = 0; i < ticks.length; i++) {
            var tickVal = ticks[i];
            var x = padding + ((tickVal - range[0]) / (range[1] - range[0])) * (width - 2 * padding);
            var worldX = x - width / 2;

            // Tick line
            var tickLine = createTickLine(worldX, worldY, worldX, worldY - tickLen, threeAxisColor, 1);
            meshes.push(tickLine);

            // Tick label
            if (tickLabels[i] !== undefined) {
                var label = createTickLabel(String(tickLabels[i]), worldX, worldY - tickLen - 15, {
                    fontSize: style.tickFontSize || 11,
                    fontColor: style.tickColor || '#333333'
                });
                meshes.push(label);
            }
        }
    } else if (axisType === 'y') {
        var worldY1 = -(yMin - height / 2);
        var worldY2 = -(yMax - height / 2);
        var worldX = xMin - width / 2;

        var axisLine = createAxisLine(worldX, worldY1, worldX, worldY2, threeAxisColor, lineWidth);
        meshes.push(axisLine);

        var ticks = config.ticks || [];
        var tickLabels = config.ticklabels || ticks;
        var range = config.range || [0, 10];
        var tickLen = style.tickLength || 5;

        for (var i = 0; i < ticks.length; i++) {
            var tickVal = ticks[i];
            var y = padding + ((tickVal - range[0]) / (range[1] - range[0])) * (height - 2 * padding);
            y = height - y;
            var worldY = -(y - height / 2);

            var tickLine = createTickLine(worldX, worldY, worldX - tickLen, worldY, threeAxisColor, 1);
            meshes.push(tickLine);

            if (tickLabels[i] !== undefined) {
                var label = createTickLabel(String(tickLabels[i]), worldX - tickLen - 20, worldY, {
                    fontSize: style.tickFontSize || 11,
                    fontColor: style.tickColor || '#333333'
                });
                meshes.push(label);
            }
        }
    }

    return meshes;
}

module.exports = {
    createAxis: createAxis,
    createGridLines: createGridLines,
    createAxisLine: createAxisLine,
    createTickLabel: createTickLabel
};
