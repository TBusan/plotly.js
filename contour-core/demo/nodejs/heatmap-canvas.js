'use strict';

/**
 * Node.js Demo: Heatmap Style (Canvas)
 *
 * This demo shows how to render contours in heatmap style
 */

var fs = require('fs');
var path = require('path');
var { createCanvas } = require('@napi-rs/canvas');
var contourCore = require('../../index.js');

// Create a gradient grid
function createGradientGrid() {
    var rows = 50;
    var cols = 60;
    var grid = [];

    for (var i = 0; i < rows; i++) {
        var row = [];
        for (var j = 0; j < cols; j++) {
            var x = j / cols;
            var y = i / rows;

            // Create a smooth gradient with some variation
            var base = (x + y) / 2;
            var noise = Math.sin(x * 10) * Math.cos(y * 10) * 0.1;
            row.push((base + noise) * 100);
        }
        grid.push(row);
    }

    return grid;
}

function runDemo() {
    console.log('=== Heatmap Canvas Demo ===\n');

    var width = 800;
    var height = 600;
    var canvas = createCanvas(width, height);
    var ctx = canvas.getContext('2d');

    var grid = createGradientGrid();
    console.log('Grid size:', grid.length, 'x', grid[0].length);

    // Compute contours with many levels for smooth appearance
    var result = contourCore.computeContours({
        z: grid
    }, {
        autocontour: true,
        ncontours: 25,
        smoothing: 0
    });

    console.log('Levels:', result.levels.length);

    // Render as heatmap
    var canvasRenderer = contourCore.renderers.canvas;
    canvasRenderer.drawContours(ctx, result, {
        width: width,
        height: height,
        coloring: 'heatmap',
        showLines: false,
        colorScale: [
            [0, '#0d0887'],
            [25, '#5302a3'],
            [50, '#8b0aa5'],
            [75, '#db5c68'],
            [100, '#feb48d']
        ]
    });

    var outputPath = path.join(__dirname, 'output', 'heatmap-canvas.png');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    var buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log('\nPNG saved to:', outputPath);
    console.log('File size:', (buffer.length / 1024).toFixed(2), 'KB');
    console.log('\nDone!');
}

runDemo();
