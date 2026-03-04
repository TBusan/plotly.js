'use strict';

/**
 * Three.js null region utilities for contour rendering
 * Handles areas with null/missing data
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
 * Create null region overlay meshes
 */
function createNullMeshes(contourResult, style, renderer) {
    var meshes = [];

    if (!contourResult || !contourResult.nullMask) {
        return meshes;
    }

    var nullMask = contourResult.nullMask;
    var m = nullMask.length;
    var n = nullMask[0] ? nullMask[0].length : 0;

    if (m === 0 || n === 0) {
        return meshes;
    }

    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var cellWidth = (width - 2 * padding) / (n - 1);
    var cellHeight = (height - 2 * padding) / (m - 1);

    var nullColor = style.nullColor || '#d0d0d0';
    var threeNullColor = new THREE.Color(nullColor);
    var nullOpacity = style.nullOpacity !== undefined ? style.nullOpacity : 0.7;

    // Create meshes for null cells
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
                var x = padding + j * cellWidth;
                var y = padding + (m - 1 - i) * cellHeight;

                var worldX = x - width / 2;
                var worldY = -(y - height / 2);

                var geometry = new THREE.PlaneGeometry(cellWidth, cellHeight);
                var material = new THREE.MeshBasicMaterial({
                    color: threeNullColor,
                    transparent: true,
                    opacity: nullOpacity,
                    side: THREE.DoubleSide
                });

                var mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(worldX + cellWidth / 2, worldY - cellHeight / 2, 0.5);

                meshes.push(mesh);
            }
        }
    }

    return meshes;
}

/**
 * Create clip mesh for null regions (for stencil clipping)
 */
function createClipMesh(contourResult, style, renderer) {
    if (!contourResult || !contourResult.nullMask) {
        return null;
    }

    // For now, return null - full stencil clipping requires more complex implementation
    // The fallback is to use overlay meshes (createNullMeshes)
    return null;
}

/**
 * Create null region boundary path
 */
function createNullBoundaryPath(contourResult, style) {
    // This would use marching squares to find null region boundaries
    // For now, return null - implemented as overlay instead
    return null;
}

module.exports = {
    createNullMeshes: createNullMeshes,
    createClipMesh: createClipMesh,
    createNullBoundaryPath: createNullBoundaryPath
};
