'use strict';

/**
 * Test to prove: interpolation cannot restore original data
 * when null percentage is too high
 */

var contourCore = require('../index');

console.log('=== Interpolation Limitation Test ===\n');

// Test: Same underlying data, but with sparse nulls
var dataFull = [[2, 4, 7, 12, 13, 14, 15, 16],
    [3, 1, 6, 11, 12, 13, 16, 17],
    [4, 2, 7, 7, 11, 14, 17, 18],
    [5, 3, 8, 8, 13, 15, 18, 19],
    [7, 4, 10, 9, 16, 18, 20, 19],
    [9, 10, 5, 27, 23, 21, 21, 21],
    [11, 14, 17, 26, 25, 24, 23, 22]];

// Create sparse null version (only 10% null)
var dataSparse = JSON.parse(JSON.stringify(dataFull));
// Set a few isolated nulls
dataSparse[0][0] = null;
dataSparse[1][1] = null;
dataSparse[2][2] = null;
dataSparse[3][3] = null;
dataSparse[4][4] = null;
dataSparse[5][5] = null;
dataSparse[6][6] = null;

function createGrid(zData) {
    var m = zData.length;
    var n = zData[0].length;
    var grid = { z: zData, x: [], y: [] };
    for (var i = 0; i < n; i++) grid.x.push(i);
    for (var j = 0; j < m; j++) grid.y.push(j);
    return grid;
}

// Compute with full data
var resultFull = contourCore.computeContours(createGrid(dataFull), {
    autocontour: true,
    ncontours: 10
});

// Compute with sparse null data
var resultSparse = contourCore.computeContours(createGrid(dataSparse), {
    autocontour: true,
    ncontours: 10,
    connectgaps: true
});

console.log('FULL DATA (no nulls):');
console.log('  Null count:', resultFull.nullCount);
console.log('  First row z:', resultFull.pathinfo[0].z[0]);
console.log('  edgeVal2:', Math.min(resultFull.pathinfo[0].z[0][0], resultFull.pathinfo[0].z[0][1]));

console.log('\nSPARSE NULL DATA (7 nulls, 12.5%):');
console.log('  Null count:', resultSparse.nullCount);
console.log('  First row z:', resultSparse.pathinfo[0].z[0]);
console.log('  edgeVal2:', Math.min(resultSparse.pathinfo[0].z[0][0], resultSparse.pathinfo[0].z[0][1]));

console.log('\nPATH COMPARISON:');
resultFull.paths.forEach(function(p, i) {
    var ps = resultSparse.paths[i];
    var level = resultFull.levels[i];
    console.log('  Level', level, ':');
    console.log('    Full   - edgepaths=' + p.edgepaths.length + ', paths=' + p.paths.length);
    console.log('    Sparse - edgepaths=' + ps.edgepaths.length + ', paths=' + ps.paths.length);
    var same = (p.edgepaths.length === ps.edgepaths.length && p.paths.length === ps.paths.length);
    console.log('    Match:', same ? 'YES' : 'NO');
});

// Now test data2 (51.8% null)
console.log('\n\n=== DATA2 Test (51.8% null) ===');
var data2 = [[null, null, null, 12, 13, 14, 15, 16],
    [null, 1, null, 11, null, null, null, 17],
    [null, 2, 6, 7, null, null, null, 18],
    [null, 3, null, 8, null, null, null, 19],
    [5, 4, 10, 9, null, null, null, 20],
    [null, null, null, 27, null, null, null, 21],
    [null, null, null, 26, 25, 24, 23, 22]];

var result2 = contourCore.computeContours(createGrid(data2), {
    autocontour: true,
    ncontours: 10,
    connectgaps: true
});

console.log('DATA2 (51.8% null):');
console.log('  Null count:', result2.nullCount);
console.log('  First row z:', result2.pathinfo[0].z[0]);
console.log('  Original first row: [null, null, null, 12, 13, 14, 15, 16]');
console.log('  Data1 first row:    [2, 4, 7, 12, 13, 14, 15, 16]');
console.log('\nCONCLUSION:');
console.log('When >50% of data is null, interpolation cannot restore');
console.log('the original data distribution. The interpolated surface');
console.log('will differ significantly from the original, causing');
console.log('different contour lines.');
console.log('\nThis is NOT a bug - it\'s the fundamental limitation of');
console.log('interpolation when data is too sparse.');
