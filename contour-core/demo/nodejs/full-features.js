'use strict';

/**
 * Node.js Demo: Full Features
 *
 * This demo shows all major features of contour-core in one example:
 * - Computation with custom options
 * - SVG export with colorbar
 * - GeoJSON export
 * - Multiple contour types
 */

var fs = require('fs');
var path = require('path');
var contourCore = require('../../index.js');

// Create a realistic terrain-like grid
function createTerrainGrid() {
    var rows = 60;
    var cols = 80;
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

    // Add coordinate arrays (simulating real-world coordinates)
    var x = [];
    var y = [];
    for (var j = 0; j < cols; j++) {
        x.push(j * 10);  // 0 to 790 meters
    }
    for (var i = 0; i < rows; i++) {
        y.push(i * 10);  // 0 to 590 meters
    }

    return { z: grid, x: x, y: y };
}

function runDemo() {
    console.log('=== Full Features Demo ===\n');
    console.log('This demo generates multiple output files:\n');

    var gridData = createTerrainGrid();
    console.log('Grid size:', gridData.z.length, 'x', gridData.z[0].length);
    console.log('X range:', gridData.x[0], '-', gridData.x[gridData.x.length - 1]);
    console.log('Y range:', gridData.y[0], '-', gridData.y[gridData.y.length - 1]);

    var outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    // ========================================
    // 1. Compute contours
    // ========================================
    console.log('\n--- Computing Contours ---');

    var result = contourCore.computeContours(gridData, {
        autocontour: true,
        ncontours: 15,
        smoothing: 0.6
    });

    console.log('Levels computed:', result.levels.length);
    console.log('Level range:', result.levels[0].toFixed(1), '-', result.levels[result.levels.length - 1].toFixed(1));
    console.log('Total paths:', result.paths.reduce(function(sum, p) {
        return sum + (p.paths ? p.paths.length : 0);
    }, 0));

    // ========================================
    // 2. SVG Export - Fill mode with colorbar
    // ========================================
    console.log('\n--- SVG Export (Fill) ---');

    var svgRenderer = contourCore.renderers.svg;
    var fillSvg = svgRenderer.renderSVG(result, {
        width: 900,
        height: 600,
        coloring: 'fill',
        showLines: true,
        lineColor: 'rgba(255,255,255,0.5)',
        lineWidth: 1,
        colorbar: true,
        colorScale: [
            [20, '#2c7bb6'],
            [40, '#abd9e9'],
            [60, '#ffffbf'],
            [80, '#fdae61'],
            [100, '#d7191c']
        ]
    });

    var fillPath = path.join(outputDir, 'full-features-fill.svg');
    fs.writeFileSync(fillPath, fillSvg, 'utf8');
    console.log('Saved:', fillPath);

    // ========================================
    // 3. SVG Export - Lines only
    // ========================================
    console.log('\n--- SVG Export (Lines) ---');

    var linesSvg = svgRenderer.renderSVG(result, {
        width: 900,
        height: 600,
        coloring: 'lines',
        showLines: true,
        lineWidth: 1.5,
        lineColor: '#333'
    });

    var linesPath = path.join(outputDir, 'full-features-lines.svg');
    fs.writeFileSync(linesPath, linesSvg, 'utf8');
    console.log('Saved:', linesPath);

    // ========================================
    // 4. SVG Export - Heatmap style
    // ========================================
    console.log('\n--- SVG Export (Heatmap) ---');

    var heatmapResult = contourCore.computeContours(gridData, {
        autocontour: true,
        ncontours: 30,
        smoothing: 0
    });

    var heatmapSvg = svgRenderer.renderSVG(heatmapResult, {
        width: 900,
        height: 600,
        coloring: 'heatmap',
        showLines: false,
        colorbar: true,
        colorScale: [
            [20, '#313695'],
            [35, '#4575b4'],
            [50, '#74add1'],
            [65, '#e0f3f8'],
            [80, '#fee090'],
            [95, '#f46d43'],
            [110, '#a50026']
        ]
    });

    var heatmapPath = path.join(outputDir, 'full-features-heatmap.svg');
    fs.writeFileSync(heatmapPath, heatmapSvg, 'utf8');
    console.log('Saved:', heatmapPath);

    // ========================================
    // 5. GeoJSON Export
    // ========================================
    console.log('\n--- GeoJSON Export ---');

    // Line GeoJSON
    var lineGeoJSON = contourCore.toGeoJSON(result, {
        type: 'lines',
        propertyName: 'elevation'
    });

    var lineJsonPath = path.join(outputDir, 'full-features-lines.geojson');
    fs.writeFileSync(lineJsonPath, JSON.stringify(lineGeoJSON, null, 2), 'utf8');
    console.log('Line GeoJSON:', lineJsonPath);
    console.log('  Features:', lineGeoJSON.features.length);

    // Fill GeoJSON
    var fillGeoJSON = contourCore.toFilledGeoJSON(result, {
        propertyName: 'elevation',
        clip: true
    });

    var fillJsonPath = path.join(outputDir, 'full-features-fill.geojson');
    fs.writeFileSync(fillJsonPath, JSON.stringify(fillGeoJSON, null, 2), 'utf8');
    console.log('Fill GeoJSON:', fillJsonPath);
    console.log('  Features:', fillGeoJSON.features.length);

    // ========================================
    // 6. Statistics
    // ========================================
    console.log('\n--- Output Statistics ---');

    var files = [
        { name: 'full-features-fill.svg', path: fillPath },
        { name: 'full-features-lines.svg', path: linesPath },
        { name: 'full-features-heatmap.svg', path: heatmapPath },
        { name: 'full-features-lines.geojson', path: lineJsonPath },
        { name: 'full-features-fill.geojson', path: fillJsonPath }
    ];

    console.log('\nFile sizes:');
    for (var i = 0; i < files.length; i++) {
        var stats = fs.statSync(files[i].path);
        console.log('  ' + files[i].name + ': ' + (stats.size / 1024).toFixed(2) + ' KB');
    }

    console.log('\n=== All outputs saved to: ' + outputDir + ' ===');
    console.log('\nDone!');
}

runDemo();
