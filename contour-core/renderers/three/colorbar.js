'use strict';

/**
 * Three.js colorbar utilities for contour rendering
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
 * Interpolate between two hex colors
 */
function interpolateColor(color1, color2, t) {
    var r1 = parseInt(color1.slice(1, 3), 16);
    var g1 = parseInt(color1.slice(3, 5), 16);
    var b1 = parseInt(color1.slice(5, 7), 16);

    var r2 = parseInt(color2.slice(1, 3), 16);
    var g2 = parseInt(color2.slice(3, 5), 16);
    var b2 = parseInt(color2.slice(5, 7), 16);

    t = Math.max(0, Math.min(1, t));

    var r = Math.round(r1 + (r2 - r1) * t);
    var g = Math.round(g1 + (g2 - g1) * t);
    var b = Math.round(b1 + (b2 - b1) * t);

    return '#' + [r, g, b].map(function(x) {
        var hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Create colorbar mesh using gradient texture
 */
function createColorbar(result, colors, config, renderer) {
    if (!config || config.show === false) {
        return null;
    }

    var width = renderer.width;
    var height = renderer.height;
    var style = renderer.style || {};

    var barWidth = config.width || 20;
    var barHeight = config.height || (height - 100);
    var barX = config.x || (width - 60);
    var barY = config.y || 50;

    // Create gradient texture
    var canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    var ctx = canvas.getContext('2d');

    var gradient = ctx.createLinearGradient(0, 256, 0, 0);

    var colorScale = style.colorScale || colors;
    if (Array.isArray(colorScale)) {
        for (var i = 0; i < colorScale.length; i++) {
            var stop = colorScale[i];
            gradient.addColorStop(stop[0], stop[1]);
        }
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 256);

    var texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create colorbar plane
    var worldX = barX - width / 2;
    var worldY = -(barY - height / 2);
    var worldBarWidth = barWidth;
    var worldBarHeight = barHeight;

    var geometry = new THREE.PlaneGeometry(worldBarWidth, worldBarHeight);
    var material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
    });

    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(worldX + worldBarWidth / 2, worldY - worldBarHeight / 2, 0);

    // Create group to hold colorbar and labels
    var group = new THREE.Group();
    group.add(mesh);

    // Add border
    var borderGeometry = new THREE.EdgesGeometry(geometry);
    var borderMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
    var border = new THREE.LineSegments(borderGeometry, borderMaterial);
    border.position.copy(mesh.position);
    group.add(border);

    // Add tick labels
    var levels = result.levels || [];
    var zmin = result.zmin || (levels.length > 0 ? levels[0] : 0);
    var zmax = result.zmax || (levels.length > 0 ? levels[levels.length - 1] : 10);

    var numTicks = config.numTicks || 5;
    for (var i = 0; i <= numTicks; i++) {
        var t = i / numTicks;
        var value = zmin + t * (zmax - zmin);
        var yPos = worldY - t * worldBarHeight;

        var labelCanvas = document.createElement('canvas');
        var labelCtx = labelCanvas.getContext('2d');
        labelCanvas.width = 50;
        labelCanvas.height = 20;

        labelCtx.fillStyle = '#333333';
        labelCtx.font = '11px Arial';
        labelCtx.textAlign = 'left';
        labelCtx.textBaseline = 'middle';
        labelCtx.fillText(value.toFixed(1), 5, 10);

        var labelTexture = new THREE.CanvasTexture(labelCanvas);
        var labelMaterial = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true
        });

        var labelSprite = new THREE.Sprite(labelMaterial);
        labelSprite.scale.set(25, 10, 1);
        labelSprite.position.set(worldX + worldBarWidth + 15, yPos, 1);
        group.add(labelSprite);
    }

    // Add title if provided
    if (config.title) {
        var titleCanvas = document.createElement('canvas');
        var titleCtx = titleCanvas.getContext('2d');
        titleCanvas.width = 100;
        titleCanvas.height = 20;

        titleCtx.fillStyle = '#333333';
        titleCtx.font = 'bold 12px Arial';
        titleCtx.textAlign = 'center';
        titleCtx.textBaseline = 'middle';
        titleCtx.fillText(config.title, 50, 10);

        var titleTexture = new THREE.CanvasTexture(titleCanvas);
        var titleMaterial = new THREE.SpriteMaterial({
            map: titleTexture,
            transparent: true
        });

        var titleSprite = new THREE.Sprite(titleMaterial);
        titleSprite.scale.set(50, 10, 1);
        titleSprite.position.set(worldX + worldBarWidth / 2, worldY + 15, 1);
        group.add(titleSprite);
    }

    return group;
}

module.exports = {
    createColorbar: createColorbar
};
