'use strict';

/**
 * Node.js Demo: Canvas with Axes
 *
 * This demo shows how to render contours with axes and labels
 */

var fs = require('fs');
var path = require('path');
var { createCanvas } = require('@napi-rs/canvas');
var contourCore = require('../../index.js');

// Create a terrain-like grid
function createTerrainGrid() {
    var rows = 50;
    var cols = 60;
    var grid = [];

    for (var i = 0; i < rows; i++) {
        var row = [];
        for (var j = 0; j < cols; j++) {
            var x = j / cols;
            var y = i / rows;

            // Combine multiple features
            var base = 50;
            var ridge = Math.exp(-Math.pow((x - 0.3) * 2, 2)) * 30 * (1 - y);
            var valley = -Math.exp(-Math.pow((x - 0.7) * 3, 2)) * 20;
            var hill1 = Math.exp(-((x - 0.2) ** 2 + (y - 0.8) ** 2) * 20) * 40;
            var hill2 = Math.exp(-((x - 0.8) ** 2 + (y - 0.2) ** 2) * 15) * 35;
            var noise = Math.sin(x * 30) * Math.cos(y * 25) * 3;

            row.push(base + ridge + valley + hill1 + hill2 + noise);
        }
        grid.push(row);
    }

    return grid;
}

function runDemo() {
    console.log('=== Canvas with Axes Demo ===\n');

    var width = 900;
    var height = 600;
    var canvas = createCanvas(width, height);
    var ctx = canvas.getContext('2d');

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    var grid = createTerrainGrid();
    console.log('Grid size:', grid.length, 'x', grid[0].length);

    // Compute contours
    var result = contourCore.computeContours({
        z: grid
    }, {
        autocontour: true,
        ncontours: 15,
        smoothing: 0.6
    });

    console.log('Levels:', result.levels.length);

    // Render with axes
    var canvasRenderer = contourCore.renderers.canvas;
    canvasRenderer.drawContours(ctx, result, {
        width: width,
        height: height,
        coloring: 'fill',
        showLines: true,
        lineColor: 'rgba(255,255,255,0.5)',
        lineWidth: 1,
        colorScale: [
            [20, '#2c7bb6'],
            [40, '#abd9e9'],
            [60, '#ffffbf'],
            [80, '#fdae61'],
            [100, '#d7191c']
        ],
        // Axes configuration
        axes: {
            x: {
                title: 'X Distance (m)',
                color: '#333'
            },
            y: {
                title: 'Y Distance (m)',
                color: '#333'
            }
        },
        showGrid: true,
        gridColor: '#e0e0e0'
    });

    var outputPath = path.join(__dirname, 'output', 'contour-with-axes-canvas.png');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    var buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log('\nPNG saved to:', outputPath);
    console.log('File size:', (buffer.length / 1024).toFixed(2), 'KB');
    console.log('\nDone!');
}

runDemo();
