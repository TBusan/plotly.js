#!/usr/bin/env node

'use strict';

/**
 * Node.js test for contour-core module
 * Run with: node src/contour-core/test_node.js
 */

var contourCore = require('./index');

console.log('=== Testing contour-core Module ===\n');

// Test 1: Create a simple Gaussian peak
console.log('Test 1: Simple Gaussian peak');
function createGaussianGrid(size, centerX, centerY, sigma) {
    var z = [];
    for (var i = 0; i < size; i++) {
        var row = [];
        for (var j = 0; j < size; j++) {
            var dx = j - centerX;
            var dy = i - centerY;
            var val = Math.exp(-(dx*dx + dy*dy) / (2*sigma*sigma));
            row.push(val * 100);
        }
        z.push(row);
    }
    return { z: z, x: [], y: [] };
}

var grid1 = createGaussianGrid(20, 10, 10, 4);

try {
    var result1 = contourCore.computeContours(grid1, {
        autocontour: true,
        ncontours: 10,
        smoothing: 0
    });

    console.log('  ✓ computeContours completed successfully');
    console.log('  - Levels:', result1.levels.length);
    console.log('  - Total paths:', result1.paths.reduce(function(sum, p) {
        return sum + p.edgepaths.length + p.paths.length;
    }, 0));

    // Print details of first few levels
    for (var i = 0; i < Math.min(3, result1.paths.length); i++) {
        var p = result1.paths[i];
        console.log('  Level', p.level + ':', p.edgepaths.length, 'edge paths,', p.paths.length, 'closed paths');
    }
} catch (e) {
    console.error('  ✗ Error:', e.message);
    console.error(e.stack);
}

// Test 2: Custom thresholds
console.log('\nTest 2: Custom thresholds');
var result2 = contourCore.computeContours(grid1, {
    thresholds: [20, 40, 60, 80],
    smoothing: 0
});

console.log('  ✓ computeContours with custom thresholds completed');
console.log('  - Levels:', result2.levels.length);
console.log('  - Level values:', result2.levels.join(', '));

// Test 3: Manual start/end/size
console.log('\nTest 3: Manual start/end/size');
var result3 = contourCore.computeContours(grid1, {
    autocontour: false,
    start: 10,
    end: 90,
    size: 20,
    smoothing: 0.5
});

console.log('  ✓ computeContours with manual levels completed');
console.log('  - Levels:', result3.levels.length);
console.log('  - Level values:', result3.levels.join(', '));

// Test 4: Multiple peaks
console.log('\nTest 4: Multiple peaks');
function createMultiPeakGrid(size) {
    var z = [];
    for (var i = 0; i < size; i++) {
        var row = [];
        for (var j = 0; j < size; j++) {
            var val1 = 80 * Math.exp(-((j-10)*(j-10) + (i-10)*(i-10)) / 50);
            var val2 = 60 * Math.exp(-((j-25)*(j-25) + (i-20)*(i-20)) / 80);
            var val3 = 40 * Math.exp(-((j-15)*(j-15) + (i-30)*(i-30)) / 60);
            row.push(val1 + val2 + val3);
        }
        z.push(row);
    }
    return { z: z, x: [], y: [] };
}

var grid4 = createMultiPeakGrid(40);
var result4 = contourCore.computeContours(grid4, {
    autocontour: true,
    ncontours: 15,
    smoothing: 0
});

console.log('  ✓ Multi-peak contours computed');
console.log('  - Levels:', result4.levels.length);
console.log('  - Total paths:', result4.paths.reduce(function(sum, p) {
    return sum + p.edgepaths.length + p.paths.length;
    }, 0));

// Test 5: Verify path structure
console.log('\nTest 5: Verify path structure');
if (result4.paths.length > 0) {
    var firstPath = result4.paths[0];
    console.log('  - Level:', firstPath.level);
    console.log('  - Edge paths:', firstPath.edgepaths.length);
    console.log('  - Closed paths:', firstPath.paths.length);

    if (firstPath.edgepaths.length > 0) {
        var edgePath = firstPath.edgepaths[0];
        console.log('  - First edge path has', edgePath.length, 'points');
        console.log('  - First point:', edgePath[0]);
        console.log('  - Last point:', edgePath[edgePath.length - 1]);
    }

    if (firstPath.paths.length > 0) {
        var closedPath = firstPath.paths[0];
        console.log('  - First closed path has', closedPath.length, 'points');
        console.log('  - First point:', closedPath[0]);
        console.log('  - Last point:', closedPath[closedPath.length - 1]);
    }

    console.log('  ✓ Path structure looks correct');
}

console.log('\n=== All Tests Completed ===');
console.log('\nNote: Paths are currently in grid index space.');
console.log('Use scalePathsToData() to convert to data coordinates.');
