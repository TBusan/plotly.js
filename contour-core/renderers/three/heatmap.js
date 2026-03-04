'use strict';

/**
 * Three.js heatmap utilities for contour rendering
 * Creates heatmap background as a textured plane
 */

// Try to get THREE from require, fall back to global
var THREE;
try {
    THREE = require('three');
} catch (e) {
    THREE = typeof window !== 'undefined' ? window.THREE : null;
}

/**
 * Interpolate color from colorscale
 */
function getColorFromScale(value, colorScale) {
    if (!colorScale || !Array.isArray(colorScale) || colorScale.length === 0) {
        return [128, 128, 128, 255];
    }

    if (colorScale.length === 1) {
        return hexToRgba(colorScale[0][1]);
    }

    // Find the two colors to interpolate between
    for (var i = 0; i < colorScale.length - 1; i++) {
        if (value >= colorScale[i][0] && value <= colorScale[i + 1][0]) {
            var t = (value - colorScale[i][0]) / (colorScale[i + 1][0] - colorScale[i][0]);
            return interpolateRgba(
                hexToRgba(colorScale[i][1]),
                hexToRgba(colorScale[i + 1][1]),
                t
            );
        }
    }

    // Clamp to ends
    if (value < colorScale[0][0]) {
        return hexToRgba(colorScale[0][1]);
    }
    return hexToRgba(colorScale[colorScale.length - 1][1]);
}

/**
 * Convert hex color to RGBA array
 */
function hexToRgba(hex) {
    if (!hex || typeof hex !== 'string') {
        return [128, 128, 128, 255];
    }

    // Handle rgba format
    if (hex.startsWith('rgba')) {
        var match = hex.match(/[\d.]+/g);
        if (match && match.length >= 3) {
            return [
                parseInt(match[0]),
                parseInt(match[1]),
                parseInt(match[2]),
                match.length > 3 ? Math.round(parseFloat(match[3]) * 255) : 255
            ];
        }
    }

    // Handle hex format
    var h = hex.replace('#', '');
    if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }

    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        255
    ];
}

/**
 * Interpolate between two RGBA colors
 */
function interpolateRgba(rgba1, rgba2, t) {
    return [
        Math.round(rgba1[0] + (rgba2[0] - rgba1[0]) * t),
        Math.round(rgba1[1] + (rgba2[1] - rgba1[1]) * t),
        Math.round(rgba1[2] + (rgba2[2] - rgba1[2]) * t),
        Math.round(rgba1[3] + (rgba2[3] - rgba1[3]) * t)
    ];
}

/**
 * Create heatmap mesh from grid data
 */
function createHeatmapMesh(contourResult, style, renderer) {
    if (!contourResult || !contourResult.pathinfo || !contourResult.pathinfo[0]) {
        return null;
    }

    var pathInfo = contourResult.pathinfo[0];
    var z = pathInfo.z;
    var x = pathInfo.x;
    var y = pathInfo.y;

    if (!z || !Array.isArray(z) || z.length === 0) {
        return null;
    }

    var m = z.length;
    var n = z[0] ? z[0].length : 0;

    if (m === 0 || n === 0) {
        return null;
    }

    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var colorScale = style.colorScale || style.colorscale || [
        [0, '#313695'],
        [0.25, '#4575b4'],
        [0.5, '#fee090'],
        [0.75, '#f46d43'],
        [1, '#a50026']
    ];

    var dataRange = style.dataRange || {
        min: contourResult.zmin,
        max: contourResult.zmax
    };
    var zmin = dataRange.min;
    var zmax = dataRange.max;
    var zrange = zmax - zmin || 1;

    // Create canvas for heatmap texture
    var canvas = document.createElement('canvas');
    var texWidth = n;
    var texHeight = m;
    canvas.width = texWidth;
    canvas.height = texHeight;

    var ctx = canvas.getContext('2d');
    var imageData = ctx.createImageData(texWidth, texHeight);
    var data = imageData.data;

    // Fill image data with colors based on z values
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            var zVal = z[i][j];
            var normalized = (zVal - zmin) / zrange;
            normalized = Math.max(0, Math.min(1, normalized));

            var color = getColorFromScale(normalized, colorScale);
            var idx = ((texHeight - 1 - i) * texWidth + j) * 4;

            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    }

    ctx.putImageData(imageData, 0, 0);

    // Create texture
    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    // Create plane geometry
    var planeWidth = width - 2 * padding;
    var planeHeight = height - 2 * padding;
    var geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

    var material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
    });

    var mesh = new THREE.Mesh(geometry, material);

    // Position at center of data area
    mesh.position.set(0, 0, -1);

    return mesh;
}

/**
 * Create interpolated heatmap with smooth gradients
 */
function createInterpolatedHeatmap(grid, style, renderer) {
    // For now, use the same implementation
    // Could be enhanced with WebGL shaders for better interpolation
    return createHeatmapMesh({ pathinfo: [grid] }, style, renderer);
}

module.exports = {
    createHeatmapMesh: createHeatmapMesh,
    createInterpolatedHeatmap: createInterpolatedHeatmap,
    getColorFromScale: getColorFromScale
};
