'use strict';

/**
 * Node.js Demo: Contour Lines Only
 *
 * This demo shows how to export contour lines (without fill)
 */

var fs = require('fs');
var path = require('path');
var contourCore = require('../../index.js');

// Create a more complex grid with multiple peaks
function createMultiPeakGrid() {
    var rows = 40;
    var cols = 40;
    var grid = [];

    for (var i = 0; i < rows; i++) {
        var row = [];
        for (var j = 0; j < cols; j++) {
            var x = j / cols;
            var y = i / rows;

            // Create three peaks
            var peak1 = Math.exp(-((x - 0.3) * (x - 0.3) + (y - 0.3) * (y - 0.3)) * 20) * 100;
            var peak2 = Math.exp(-((x - 0.7) * (x - 0.7) + (y - 0.7) * (y - 0.7)) * 20) * 80;
            var peak3 = Math.exp(-((x - 0.5) * (x - 0.5) + (y - 0.8) * (y - 0.8)) * 30) * 60;

            row.push(peak1 + peak2 + peak3);
        }
        grid.push(row);
    }

    return grid;
}

function runDemo() {
    console.log('=== Contour Lines Demo ===\n');

    var grid = createMultiPeakGrid();
    console.log('Grid size:', grid.length, 'x', grid[0].length);

    // Compute contours with custom levels
    var result = contourCore.computeContours({
        z: grid
    }, {
        autocontour: false,
        start: 10,
        end: 100,
        size: 10,
        smoothing: 0.7
    });

    console.log('Levels:', result.levels.map(function(l) { return l.toFixed(0); }).join(', '));

    // Export as SVG with lines only
    var svgRenderer = contourCore.renderers.svg;
    var svgString = svgRenderer.renderSVG(result, {
        width: 700,
        height: 600,
        coloring: 'lines',
        showLines: true,
        lineWidth: 1.5,
        lineColor: '#333'
    });

    var outputPath = path.join(__dirname, 'output', 'contour-lines.svg');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, svgString, 'utf8');

    console.log('\nSVG saved to:', outputPath);
    console.log('File size:', (svgString.length / 1024).toFixed(2), 'KB');
    console.log('\nDone!');
}

runDemo();
