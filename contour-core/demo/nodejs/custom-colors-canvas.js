'use strict';

/**
 * Node.js Demo: Custom Color Scales (Canvas)
 *
 * This demo shows how to use different color scales and custom colors
 */

var fs = require('fs');
var path = require('path');
var { createCanvas } = require('@napi-rs/canvas');
var contourCore = require('../../index.js');

// Create a circular gradient grid
function createCircularGrid() {
    var rows = 40;
    var cols = 40;
    var grid = [];

    for (var i = 0; i < rows; i++) {
        var row = [];
        for (var j = 0; j < cols; j++) {
            var x = (j - cols / 2) / cols;
            var y = (i - rows / 2) / rows;
            var dist = Math.sqrt(x * x + y * y);
            row.push((1 - dist) * 100);
        }
        grid.push(row);
    }

    return grid;
}

// Color scale definitions
var colorScales = {
    'Viridis': [
        [0, '#440154'],
        [25, '#482878'],
        [50, '#3e4a89'],
        [75, '#35b779'],
        [100, '#fde725']
    ],
    'Plasma': [
        [0, '#0d0887'],
        [25, '#7e03a8'],
        [50, '#cc4778'],
        [75, '#f89540'],
        [100, '#f0f921']
    ],
    'CoolWarm': [
        [0, '#3b4cc0'],
        [25, '#7b9ff9'],
        [50, '#f7f7f7'],
        [75, '#f4987a'],
        [100, '#b40426']
    ],
    'Earth': [
        [0, '#000080'],
        [20, '#0000ff'],
        [40, '#00ffff'],
        [60, '#00ff00'],
        [80, '#ffff00'],
        [100, '#ff0000']
    ],
    'Grayscale': [
        [0, '#000000'],
        [50, '#888888'],
        [100, '#ffffff']
    ]
};

function runDemo() {
    console.log('=== Custom Color Scales Canvas Demo ===\n');

    var grid = createCircularGrid();
    console.log('Grid size:', grid.length, 'x', grid[0].length);

    // Compute contours
    var result = contourCore.computeContours({
        z: grid
    }, {
        autocontour: true,
        ncontours: 15,
        smoothing: 0.5
    });

    console.log('Levels:', result.levels.length);

    var canvasRenderer = contourCore.renderers.canvas;
    var outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    // Generate PNG for each color scale
    var scaleNames = Object.keys(colorScales);
    for (var i = 0; i < scaleNames.length; i++) {
        var scaleName = scaleNames[i];
        var colorScale = colorScales[scaleName];

        var canvas = createCanvas(500, 500);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 500, 500);

        canvasRenderer.drawContours(ctx, result, {
            width: 500,
            height: 500,
            coloring: 'fill',
            showLines: true,
            lineColor: 'rgba(0,0,0,0.3)',
            colorScale: colorScale
        });

        var fileName = 'colorscale-' + scaleName.toLowerCase() + '-canvas.png';
        var outputPath = path.join(outputDir, fileName);
        var buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        console.log('Generated:', fileName, '(' + (buffer.length / 1024).toFixed(1), 'KB)');
    }

    console.log('\nAll PNGs saved to:', outputDir);
    console.log('\nDone!');
}

runDemo();
