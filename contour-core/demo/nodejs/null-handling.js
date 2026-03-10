'use strict';

/**
 * Node.js Demo: Null Value Handling
 *
 * This demo shows how to handle null/undefined/NaN values in grid data
 */

var fs = require('fs');
var path = require('path');
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
    console.log('=== Null Value Handling Demo ===\n');

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

    // Export as SVG with null regions shown
    var svgRenderer = contourCore.renderers.svg;
    var svgString = svgRenderer.renderSVG(result, {
        width: 600,
        height: 500,
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

    var outputPath = path.join(__dirname, 'output', 'contour-with-nulls.svg');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, svgString, 'utf8');

    console.log('\nSVG saved to:', outputPath);
    console.log('File size:', (svgString.length / 1024).toFixed(2), 'KB');

    // Also export with rectangle-based null regions
    var svgString2 = svgRenderer.renderSVG(result, {
        width: 600,
        height: 500,
        coloring: 'fill',
        showLines: true,
        useClipMask: false  // Use rectangles for null regions
    });

    var outputPath2 = path.join(__dirname, 'output', 'contour-with-nulls-rect.svg');
    fs.writeFileSync(outputPath2, svgString2, 'utf8');
    console.log('Alternative SVG saved to:', outputPath2);

    console.log('\nDone!');
}

runDemo();
