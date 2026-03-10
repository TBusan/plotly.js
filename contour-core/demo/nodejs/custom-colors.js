'use strict';

/**
 * Node.js Demo: Custom Color Scales
 *
 * This demo shows how to use different color scales and custom colors
 */

var fs = require('fs');
var path = require('path');
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
    console.log('=== Custom Color Scales Demo ===\n');

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

    var svgRenderer = contourCore.renderers.svg;
    var outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    // Generate SVG for each color scale
    var scaleNames = Object.keys(colorScales);
    for (var i = 0; i < scaleNames.length; i++) {
        var scaleName = scaleNames[i];
        var colorScale = colorScales[scaleName];

        var svgString = svgRenderer.renderSVG(result, {
            width: 500,
            height: 500,
            coloring: 'fill',
            showLines: true,
            lineColor: 'rgba(0,0,0,0.3)',
            colorScale: colorScale
        });

        var fileName = 'colorscale-' + scaleName.toLowerCase() + '.svg';
        var outputPath = path.join(outputDir, fileName);
        fs.writeFileSync(outputPath, svgString, 'utf8');

        console.log('Generated:', fileName);
    }

    // Also test with segmented colors (valueColorMap)
    console.log('\n--- Segmented Color Mapping ---');

    var segmentedResult = contourCore.computeContours({
        z: grid
    }, {
        autocontour: true,
        ncontours: 10,
        smoothing: 0.5,
        valueColorMap: [
            [0, '#0000ff'],   // < 20: blue
            [30, '#00ff00'],  // 20-40: green
            [50, '#ffff00'],  // 40-60: yellow
            [70, '#ff8000'],  // 60-80: orange
            [90, '#ff0000']   // >= 80: red
        ]
    });

    console.log('Segmented levels:', segmentedResult.levels.map(function(l) {
        return l.toFixed(0);
    }).join(', '));

    console.log('\nAll SVGs saved to:', outputDir);
    console.log('\nDone!');
}

runDemo();
