'use strict';

/**
 * Three.js label utilities for contour rendering
 * Uses Sprite with CanvasTexture for labels
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
 * Create label sprite from text
 */
function createLabelSprite(text, options) {
    options = options || {};

    var fontSize = options.fontSize || 14;
    var fontFamily = options.fontFamily || 'Arial, sans-serif';
    var fontColor = options.fontColor || '#333333';
    var fontWeight = options.fontWeight || 'normal';
    var backgroundColor = options.backgroundColor || 'rgba(255, 255, 255, 0.8)';
    var padding = options.padding || 4;

    // Create canvas for text
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    // Set font and measure text
    ctx.font = fontWeight + ' ' + fontSize + 'px ' + fontFamily;
    var metrics = ctx.measureText(text);
    var textWidth = metrics.width;
    var textHeight = fontSize;

    // Set canvas size with padding
    canvas.width = textWidth + padding * 2;
    canvas.height = textHeight + padding * 2;

    // Draw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.font = fontWeight + ' ' + fontSize + 'px ' + fontFamily;
    ctx.fillStyle = fontColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create texture
    var texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create sprite material
    var material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });

    // Create sprite
    var sprite = new THREE.Sprite(material);

    // Scale sprite to match text size
    var scale = options.scale || 1;
    sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);

    return sprite;
}

/**
 * Find good label positions on contour paths
 */
function findLabelPositions(points, style) {
    if (!points || points.length < 3) {
        return [];
    }

    var positions = [];
    var minLen = style.minLabelSpacing || 100;
    var width = style.width || 500;
    var height = style.height || 400;

    // Calculate total path length
    var totalLen = 0;
    for (var i = 1; i < points.length; i++) {
        var dx = points[i][0] - points[i-1][0];
        var dy = points[i][1] - points[i-1][1];
        totalLen += Math.sqrt(dx * dx + dy * dy);
    }

    // Determine number of labels
    var numLabels = Math.max(1, Math.floor(totalLen / minLen));
    var stepLen = totalLen / numLabels;

    // Find positions along path
    var currentLen = 0;
    var nextLabelLen = stepLen / 2; // Center first label
    var segmentIndex = 0;

    for (var i = 1; i < points.length && positions.length < numLabels; i++) {
        var dx = points[i][0] - points[i-1][0];
        var dy = points[i][1] - points[i-1][1];
        var segmentLen = Math.sqrt(dx * dx + dy * dy);

        while (currentLen + segmentLen >= nextLabelLen && positions.length < numLabels) {
            var t = (nextLabelLen - currentLen) / segmentLen;
            var x = points[i-1][0] + t * dx;
            var y = points[i-1][1] + t * dy;

            positions.push({ x: x, y: y });
            nextLabelLen += stepLen;
        }

        currentLen += segmentLen;
    }

    return positions;
}

/**
 * Create labels for contours
 */
function createLabels(contourResult, style, renderer) {
    var labels = [];
    var paths = contourResult.paths;
    var levels = contourResult.levels;

    if (!paths || !style.showLabels) {
        return labels;
    }

    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        var level = pathInfo.level;

        // Get all path points
        var allPoints = [];
        if (pathInfo.edgepaths && pathInfo.edgepaths.length > 0) {
            for (var e = 0; e < pathInfo.edgepaths.length; e++) {
                var scaledPath = pathInfo.edgepaths[e].map(function(pt) {
                    return paths.scalePoint ? paths.scalePoint(style, pt) : pt;
                });
                allPoints = allPoints.concat(scaledPath);
            }
        }

        if (pathInfo.paths && pathInfo.paths.length > 0) {
            for (var p = 0; p < pathInfo.paths.length; p++) {
                var scaledPath = pathInfo.paths[p].map(function(pt) {
                    return paths.scalePoint ? paths.scalePoint(style, pt) : pt;
                });
                // Find label positions for this path
                var positions = findLabelPositions(scaledPath, style);
                for (var j = 0; j < positions.length; j++) {
                    var worldPos = paths.canvasToWorld
                        ? paths.canvasToWorld(positions[j].x, positions[j].y, width, height)
                        : { x: positions[j].x, y: positions[j].y };

                    var labelText = typeof level === 'number' ? level.toFixed(1) : String(level);
                    var sprite = createLabelSprite(labelText, {
                        fontSize: style.labelFontSize || 12,
                        fontColor: style.labelColor || '#333333',
                        backgroundColor: style.labelBackground || 'rgba(255,255,255,0.7)',
                        scale: 0.5
                    });

                    sprite.position.set(worldPos.x, worldPos.y, 1);
                    labels.push(sprite);
                }
            }
        }
    }

    return labels;
}

module.exports = {
    createLabels: createLabels,
    createLabelSprite: createLabelSprite,
    findLabelPositions: findLabelPositions
};
