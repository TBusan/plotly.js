'use strict';

/**
 * Node.js Demo: GeoJSON Export
 *
 * This demo shows how to export contours to GeoJSON format
 * which can be used in GIS applications or mapping libraries
 */

var fs = require('fs');
var path = require('path');
var contourCore = require('../../index.js');

// Create grid with geographic-like coordinates
function createGeoGrid() {
    var rows = 30;
    var cols = 40;
    var grid = [];

    // Simulate elevation data for a small geographic area
    // Coordinates: longitude 116.3-116.5, latitude 39.9-40.0 (Beijing area)
    var lonStart = 116.3;
    var lonEnd = 116.5;
    var latStart = 39.9;
    var latEnd = 40.0;

    for (var i = 0; i < rows; i++) {
        var row = [];
        for (var j = 0; j < cols; j++) {
            var lon = lonStart + (lonEnd - lonStart) * (j / (cols - 1));
            var lat = latStart + (latEnd - latStart) * (i / (rows - 1));

            // Simulate terrain with a hill
            var centerX = 116.4;
            var centerY = 39.95;
            var dist = Math.sqrt((lon - centerX) ** 2 + (lat - centerY) ** 2);
            var elevation = 100 - dist * 1000 + Math.random() * 5;

            row.push(Math.max(0, elevation));
        }
        grid.push(row);
    }

    // Create coordinate arrays
    var x = [];
    var y = [];
    for (var j = 0; j < cols; j++) {
        x.push(lonStart + (lonEnd - lonStart) * (j / (cols - 1)));
    }
    for (var i = 0; i < rows; i++) {
        y.push(latStart + (latEnd - latStart) * (i / (rows - 1)));
    }

    return { z: grid, x: x, y: y };
}

function runDemo() {
    console.log('=== GeoJSON Export Demo ===\n');

    var gridData = createGeoGrid();
    console.log('Grid size:', gridData.z.length, 'x', gridData.z[0].length);
    console.log('X range:', gridData.x[0].toFixed(4), '-', gridData.x[gridData.x.length - 1].toFixed(4));
    console.log('Y range:', gridData.y[0].toFixed(4), '-', gridData.y[gridData.y.length - 1].toFixed(4));

    // Compute contours
    var result = contourCore.computeContours(gridData, {
        autocontour: true,
        ncontours: 8,
        smoothing: 0.4
    });

    console.log('Levels:', result.levels.map(function(l) { return l.toFixed(1); }).join(', '));

    // Export as GeoJSON LineString (for contour lines)
    var lineGeoJSON = contourCore.toGeoJSON(result, {
        type: 'lines',
        propertyName: 'elevation',
        includeEdgePaths: true
    });

    // Export as GeoJSON Polygon (for filled contours)
    var fillGeoJSON = contourCore.toFilledGeoJSON(result, {
        propertyName: 'elevation',
        clip: true
    });

    // Save files
    var outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    // Save line GeoJSON
    var linePath = path.join(outputDir, 'contour-lines.geojson');
    fs.writeFileSync(linePath, JSON.stringify(lineGeoJSON, null, 2), 'utf8');
    console.log('\nLine GeoJSON saved to:', linePath);
    console.log('Features:', lineGeoJSON.features.length);

    // Save fill GeoJSON
    var fillPath = path.join(outputDir, 'contour-fill.geojson');
    fs.writeFileSync(fillPath, JSON.stringify(fillGeoJSON, null, 2), 'utf8');
    console.log('\nFill GeoJSON saved to:', fillPath);
    console.log('Features:', fillGeoJSON.features.length);

    // Print sample feature
    if (lineGeoJSON.features.length > 0) {
        console.log('\nSample feature:');
        var sample = lineGeoJSON.features[0];
        console.log('  Type:', sample.geometry.type);
        console.log('  Elevation:', sample.properties.elevation.toFixed(1));
        console.log('  Points:', sample.geometry.coordinates.length);
    }

    console.log('\nDone!');
}

runDemo();
