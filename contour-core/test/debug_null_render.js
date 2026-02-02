'use strict';

/**
 * Debug script to understand null handling in contour rendering
 */

var contourCore = require('../index');

// Data1: Normal gradient data
var data1 = [[2, 4, 7, 12, 13, 14, 15, 16],
    [3, 1, 6, 11, 12, 13, 16, 17],
    [4, 2, 7, 7, 11, 14, 17, 18],
    [5, 3, 8, 8, 13, 15, 18, 19],
    [7, 4, 10, 9, 16, 18, 20, 19],
    [9, 10, 5, 27, 23, 21, 21, 21],
    [11, 14, 17, 26, 25, 24, 23, 22]];

// Data2: Contains null values
var data2 = [[null, null, null, 12, 13, 14, 15, 16],
    [null, 1, null, 11, null, null, null, 17],
    [null, 2, 6, 7, null, null, null, 18],
    [null, 3, null, 8, null, null, null, 19],
    [5, 4, 10, 9, null, null, null, 20],
    [null, null, null, 27, null, null, null, 21],
    [null, null, null, 26, 25, 24, 23, 22]];

console.log('=== Null Handling Debug ===\n');

// Function to create grid object
function createGrid(zData) {
    var m = zData.length;
    var n = zData[0].length;
    var grid = {
        z: zData,
        x: [],
        y: []
    };
    for (var i = 0; i < n; i++) grid.x.push(i);
    for (var j = 0; j < m; j++) grid.y.push(j);
    return grid;
}

// Test data1
console.log('--- DATA1 (No nulls) ---');
var grid1 = createGrid(data1);
var result1 = contourCore.computeContours(grid1, {
    autocontour: true,
    ncontours: 10
});
console.log('Levels:', result1.levels);
console.log('Null count:', result1.nullCount);
console.log('Valid count:', result1.validCount);
console.log('First row of z (after processing):', result1.pathinfo[0].z[0]);
console.log('edgeVal2 (z[0][0], z[0][1]):', result1.pathinfo[0].z[0][0], result1.pathinfo[0].z[0][1]);
console.log('Number of paths per level:');
result1.paths.forEach(function(p, i) {
    console.log('  Level', result1.levels[i], ': edgepaths=' + p.edgepaths.length + ', paths=' + p.paths.length);
});

// Test data2 with connectgaps=true
console.log('\n--- DATA2 (With nulls, connectgaps=true) ---');
var grid2 = createGrid(data2);
var result2 = contourCore.computeContours(grid2, {
    autocontour: true,
    ncontours: 10,
    connectgaps: true
});
console.log('Levels:', result2.levels);
console.log('Null count:', result2.nullCount);
console.log('Valid count:', result2.validCount);
console.log('connectgaps:', result2.connectgaps);
console.log('First row of z (AFTER interpolation):', result2.pathinfo[0].z[0]);
console.log('edgeVal2 (z[0][0], z[0][1]):', result2.pathinfo[0].z[0][0], result2.pathinfo[0].z[0][1]);
console.log('Number of paths per level:');
result2.paths.forEach(function(p, i) {
    console.log('  Level', result2.levels[i], ': edgepaths=' + p.edgepaths.length + ', paths=' + p.paths.length);
});

// Show null mask
console.log('\n--- NULL MASK (data2) ---');
console.log('First row of nullMask:', result2.nullMask[0]);
console.log('Last row of nullMask:', result2.nullMask[result2.nullMask.length - 1]);

// Compare edgeVal2
console.log('\n--- COMPARISON ---');
console.log('data1 edgeVal2:', Math.min(result1.pathinfo[0].z[0][0], result1.pathinfo[0].z[0][1]));
console.log('data2 edgeVal2:', Math.min(result2.pathinfo[0].z[0][0], result2.pathinfo[0].z[0][1]));
console.log('Difference in edgeVal2 affects which levels get prefixBoundary flag');

// Test a specific level
var testLevel = result1.levels[3];
console.log('\n--- Testing level', testLevel, '---');
var p1 = result1.paths[3];
var p2 = result2.paths[3];
console.log('data1: edgepaths=' + p1.edgepaths.length + ', paths=' + p1.paths.length + ', prefixBoundary=' + result1.pathinfo[3].prefixBoundary);
console.log('data2: edgepaths=' + p2.edgepaths.length + ', paths=' + p2.paths.length + ', prefixBoundary=' + result2.pathinfo[3].prefixBoundary);
