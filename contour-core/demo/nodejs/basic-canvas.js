'use strict';

/**
 * Node.js Demo: Basic Canvas Export
 *
 * This demo shows how to:
 * 1. Use @napi-rs/canvas to create a canvas in Node.js
 * 2. Compute contours from grid data
 * 3. Render to canvas and export as PNG
 */

var fs = require('fs');
var path = require('path');
var { createCanvas } = require('@napi-rs/canvas');
var contourCore = require('../../index.js');

// Create a simple grid data (20x20)
function createSimpleGrid() {
    var rows = 20;
    var cols = 20;
    var grid = [];

    for (var i = 0; i < rows; i++) {
        var row = [];
        for (var j = 0; j < cols; j++) {
            // Create a simple peak in the center
            var x = (j - cols / 2) / cols;
            var y = (i - rows / 2) / rows;
            var value = Math.exp(-(x * x + y * y) * 8) * 100;
            row.push(value);
        }
        grid.push(row);
    }

    return grid;
}

function runDemo() {
    console.log('=== Basic Canvas Export Demo ===\n');

    // 1. Create canvas
    var width = 600;
    var height = 500;
    var canvas = createCanvas(width, height);
    var ctx = canvas.getContext('2d');
    console.log('Canvas created:', width, 'x', height);

    // 2. Create grid data
    var grid = createSimpleGrid();
    console.log('Grid size:', grid.length, 'x', grid[0].length);

    // 3. Compute contours
    var result = contourCore.computeContours({
        z: grid
    }, {
        autocontour: true,
        ncontours: 10,
        smoothing: 0.5
    });

    console.log('Computed levels:', result.levels.length);
    console.log('Level range:', result.levels[0].toFixed(2), '-', result.levels[result.levels.length - 1].toFixed(2));

    // 4. Render to canvas
    var canvasRenderer = contourCore.renderers.canvas;
    canvasRenderer.drawContours(ctx, result, {
        width: width,
        height: height,
        coloring: 'fill',
        showLines: true,
        lineWidth: 1.5,
        lineColor: 'rgba(255, 255, 255, 0.5)',
        colorScale: [
            [0, '#440154'],
            [20, '#31688e'],
            [40, '#35b779'],
            [60, '#fde725'],
            [100, '#fde725']
        ]
    });

    // 5. Export as PNG
    var outputPath = path.join(__dirname, 'output', 'basic-contour-canvas.png');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    var buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log('\nPNG saved to:', outputPath);
    console.log('File size:', (buffer.length / 1024).toFixed(2), 'KB');
    console.log('\nDone!');
}

runDemo();
