'use strict';

/**
 * Test new data2 with proper null distribution
 */

var contourCore = require('../index');

// Data1
var data1 = [[2, 4, 7, 12, 13, 14, 15, 16],
    [3, 1, 6, 11, 12, 13, 16, 17],
    [4, 2, 7, 7, 11, 14, 17, 18],
    [5, 3, 8, 8, 13, 15, 18, 19],
    [7, 4, 10, 9, 16, 18, 20, 19],
    [9, 10, 5, 27, 23, 21, 21, 21],
    [11, 14, 17, 26, 25, 24, 23, 22]];

// NEW data2: Proper null distribution (valid values match data1)
var data2 = [[2, 4, 7, 12, 13, 14, 15, 16],
    [null, 1, 6, 11, 12, 13, 16, null],
    [null, null, 7, 7, 11, 14, 17, null],
    [null, null, 8, 8, 13, 15, 18, null],
    [null, null, null, 9, 16, 18, 20, 19],
    [9, 10, 5, 27, 23, 21, 21, 21],
    [11, 14, 17, 26, 25, 24, 23, 22]];

function createGrid(zData) {
    var m = zData.length;
    var n = zData[0].length;
    var grid = { z: zData, x: [], y: [] };
    for (var i = 0; i < n; i++) grid.x.push(i);
    for (var j = 0; j < m; j++) grid.y.push(j);
    return grid;
}

console.log('=== Comparison with NEW data2 ===\n');

// Compute with data1
var result1 = contourCore.computeContours(createGrid(data1), {
    autocontour: true,
    ncontours: 10
});

// Compute with new data2
var result2 = contourCore.computeContours(createGrid(data2), {
    autocontour: true,
    ncontours: 10,
    connectgaps: true
});

console.log('DATA1:');
console.log('  Null count:', result1.nullCount);
console.log('  First row z:', result1.pathinfo[0].z[0]);
console.log('  edgeVal2:', Math.min(result1.pathinfo[0].z[0][0], result1.pathinfo[0].z[0][1]));

console.log('\nNEW DATA2:');
console.log('  Null count:', result2.nullCount);
console.log('  Null percentage:', (result2.nullCount / (data2.length * data2[0].length) * 100).toFixed(1) + '%');
console.log('  First row z (AFTER interpolation):', result2.pathinfo[0].z[0]);
console.log('  Original first row: [2, 4, 7, 12, 13, 14, 15, 16]');
console.log('  edgeVal2:', Math.min(result2.pathinfo[0].z[0][0], result2.pathinfo[0].z[0][1]));

console.log('\nPATH COMPARISON:');
var matchCount = 0;
var totalCount = 0;
result1.paths.forEach(function(p, i) {
    var p2 = result2.paths[i];
    var level = result1.levels[i];
    var same = (p.edgepaths.length === p2.edgepaths.length && p.paths.length === p2.paths.length);
    if (same) matchCount++;
    totalCount++;
    console.log('  Level', level.toFixed(0), ':');
    console.log('    data1  - edgepaths=' + p.edgepaths.length + ', paths=' + p.paths.length);
    console.log('    data2  - edgepaths=' + p2.edgepaths.length + ', paths=' + p2.paths.length);
    console.log('    Match:', same ? 'YES ✓' : 'NO');
});

console.log('\nSUMMARY:');
console.log('  Matching levels: ' + matchCount + ' / ' + totalCount);
console.log('  Similarity: ' + (matchCount / totalCount * 100).toFixed(1) + '%');

if (matchCount / totalCount > 0.8) {
    console.log('\n✓ NEW data2 produces similar contours to data1!');
    console.log('  This is because valid values match, and null percentage is lower.');
} else {
    console.log('\n⚠ Contours still differ due to interpolation effects.');
}
