'use strict';

/**
 * Node.js Demo: Null Value Handling (Canvas)
 *
 * This demo shows how to handle null/undefined/NaN values in grid data
 */

var fs = require('fs');
var path = require('path');
var { createCanvas } = require('@napi-rs/canvas');
var contourCore = require('../../index.js');

// Create a grid with some null values
function createGridWithNulls() {
    var rows = 20;
    var cols = 20;
    var grid = [];

    for (var i = 0; i < rows; i++) {
        var row = [];
        for (var j = 0; j < cols; j++) {
            var x = (j - cols / 2) / cols;
            var y = (i - rows / 2) / rows;

            // Create a peak
            var value = Math.exp(-(x * x + y * y) * 8) * 100;

            // Add null values in a rectangular region
            if (i >= 5 && i <= 8 && j >= 3 && j <= 6) {
                row.push(null);  // Null region
            } else if (i >= 12 && i <= 14 && j >= 12 && j <= 15) {
                row.push(NaN);  // NaN region
            } else if (i === 17 && j >= 8 && j <= 12) {
                row.push(undefined);  // Undefined region
            } else {
                row.push(value);
            }
        }
        grid.push(row);
    }

    return grid;
}

function runDemo() {
    console.log('=== Null Value Handling Canvas Demo ===\n');

    var width = 600;
    var height = 500;

    var grid = createGridWithNulls();
    console.log('Grid size:', grid.length, 'x', grid[0].length);

    // Count null values
    var nullCount = 0;
    for (var i = 0; i < grid.length; i++) {
        for (var j = 0; j < grid[i].length; j++) {
            if (grid[i][j] === null || grid[i][j] === undefined || isNaN(grid[i][j])) {
                nullCount++;
            }
        }
    }
    console.log('Null values in grid:', nullCount);

    // Compute contours with null handling
    var result = contourCore.computeContours({
        z: grid
    }, {
        autocontour: true,
        ncontours: 10,
        smoothing: 0.5
    });

    console.log('Null values detected:', result.nullCount);
    console.log('Levels:', result.levels.length);

    // Render with clip mask (smooth null boundaries)
    var canvas1 = createCanvas(width, height);
    var ctx1 = canvas1.getContext('2d');
    ctx1.fillStyle = '#ffffff';
    ctx1.fillRect(0, 0, width, height);

    var canvasRenderer = contourCore.renderers.canvas;
    canvasRenderer.drawContours(ctx1, result, {
        width: width,
        height: height,
        coloring: 'fill',
        showLines: true,
        useClipMask: true,  // Use clip path for smooth null boundaries
        colorScale: [
            [0, '#440154'],
            [25, '#31688e'],
            [50, '#35b779'],
            [75, '#fde725'],
            [100, '#fde725']
        ]
    });

    var outputPath1 = path.join(__dirname, 'output', 'contour-with-nulls-canvas.png');
    fs.mkdirSync(path.dirname(outputPath1), { recursive: true });
    fs.writeFileSync(outputPath1, canvas1.toBuffer('image/png'));
    console.log('\nPNG (with clip mask) saved to:', outputPath1);

    // Render with rectangle-based null regions
    var canvas2 = createCanvas(width, height);
    var ctx2 = canvas2.getContext('2d');
    ctx2.fillStyle = '#ffffff';
    ctx2.fillRect(0, 0, width, height);

    canvasRenderer.drawContours(ctx2, result, {
        width: width,
        height: height,
        coloring: 'fill',
        showLines: true,
        useClipMask: false  // Use rectangles for null regions
    });

    var outputPath2 = path.join(__dirname, 'output', 'contour-with-nulls-rect-canvas.png');
    fs.writeFileSync(outputPath2, canvas2.toBuffer('image/png'));
    console.log('PNG (with rectangles) saved to:', outputPath2);

    console.log('\nDone!');
}

runDemo();
