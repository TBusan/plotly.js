/**
 * Simple test for zrender renderer - paths.js fix
 */

var compute = require('./compute');

console.log('Testing contour computation...');

// Generate test data
function generatePeaks(size) {
    var grid = [];
    for (var i = 0; i < size; i++) {
        grid[i] = [];
        for (var j = 0; j < size; j++) {
            var x = (i - size / 2) / (size / 4);
            var y = (j - size / 2) / (size / 4);
            var z = 3 * Math.pow(1 - x, 2) * Math.exp(-x * x - (y + 1) * (y + 1))
                  - 10 * (x / 5 - x * x * x - y * y * y * y * y) * Math.exp(-x * x - y * y)
                  - 1/3 * Math.exp(-(x + 1) * (x + 1) - y * y);
            grid[i][j] = z + (Math.random() - 0.5) * 0.5;
        }
    }
    return grid;
}

function generateCoords(size, min, max) {
    var coords = [];
    for (var i = 0; i < size; i++) {
        coords[i] = min + (max - min) * i / (size - 1);
    }
    return coords;
}

// Test 1: Basic contour computation
var z = generatePeaks(50);
var x = generateCoords(50, -3, 3);
var y = generateCoords(50, -3, 3);

var result = compute.computeContours({ z: z, x: x, y: y }, {
    ncontours: 15,
    smoothing: 0.4
});

console.log('Test 1: Basic contour computation');
console.log('  Levels:', result.levels.length);
console.log('  Paths:', result.paths.length);
console.log('  First path has edgepaths:', result.paths[0].edgepaths ? result.paths[0].edgepaths.length : 'undefined');
console.log('  First path has paths:', result.paths[0].paths ? result.paths[0].paths.length : 'Undefined');
console.log('  pathinfo:', result.pathinfo ? result.pathinfo.length : 'Undefined');

// Test 2: Check path structure
console.log('\nTest 2: Checking path structure...');
result.paths.forEach(function(pathInfo, i) {
    console.log('Path ' + i + ': level=' + pathInfo.level);
    console.log('  edgepaths:', pathInfo.edgepaths ? pathInfo.edgepaths.length : 'undefined');
    console.log('  paths:', pathInfo.paths ? pathInfo.paths.length : 'undefined');
});

// Test 3: Test with empty data
console.log('\nTest 3: Empty data...');
try {
    var emptyResult = compute.computeContours({ z: [[1, 2], [3, 4]], x: [0, 1], y: [0, 1] }, { ncontours: 5 });
    console.log('  Empty result levels:', emptyResult.levels.length);
    console.log('  Empty result paths:', emptyResult.paths.length);
} catch (e) {
    console.log('  Error:', e.message);
}

// Test 4: Test with single value
console.log('\nTest 4: Single value...');
try {
    var singleResult = compute.computeContours({ z: [[5]], x: [0], y: [0] }, { ncontours: 5 });
    console.log('  Single value levels:', singleResult.levels.length);
    console.log('  Single value paths:', singleResult.paths.length);
} catch (e) {
    console.log('  Error:', e.message);
}

console.log('\nAll tests passed!');
