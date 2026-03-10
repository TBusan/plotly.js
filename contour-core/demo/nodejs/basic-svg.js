'use strict';

/**
 * Node.js Demo: Basic SVG Export
 *
 * This demo shows how to:
 * 1. Compute contours from grid data
 * 2. Export to SVG file
 * 3. Save to disk
 */

var fs = require('fs');
var path = require('path');
var contourCore = require('../../index.js');

// Create a simple grid data (10x10)
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

// Main demo
function runDemo() {
    console.log('=== Basic SVG Export Demo ===\n');

    // 1. Create grid data
    var grid = createSimpleGrid();
    console.log('Grid size:', grid.length, 'x', grid[0].length);

    // 2. Compute contours
    var result = contourCore.computeContours({
        z: grid
    }, {
        autocontour: true,
        ncontours: 10,
        smoothing: 0.5
    });

    console.log('Computed levels:', result.levels.length);
    console.log('Level range:', result.levels[0].toFixed(2), '-', result.levels[result.levels.length - 1].toFixed(2));

    // 3. Export to SVG
    var svgRenderer = contourCore.renderers.svg;
    var svgString = svgRenderer.renderSVG(result, {
        width: 600,
        height: 500,
        coloring: 'fill',
        showLines: true,
        colorScale: [
            [0, '#440154'],
            [20, '#31688e'],
            [40, '#35b779'],
            [60, '#fde725'],
            [100, '#fde725']
        ]
    });

    // 4. Save SVG to file
    var outputPath = path.join(__dirname, 'output', 'basic-contour.svg');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, svgString, 'utf8');

    console.log('\nSVG saved to:', outputPath);
    console.log('File size:', (svgString.length / 1024).toFixed(2), 'KB');
    console.log('\nDone!');
}

runDemo();
