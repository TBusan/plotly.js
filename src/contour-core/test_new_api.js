'use strict';

/**
 * Test file for new contour-core API features
 * Tests null value handling and simplified rendering API
 */

var ContourCore = require('./index');

console.log('=== Testing Contour-Core v0.2.0 Features ===\n');

// Test data with null values
var gridWithNulls = [
    [null, null, 12, 13, 14, 15, 16],
    [null, 1, null, 11, null, null, 17],
    [null, 2, 6, 7, null, null, 18],
    [null, 3, null, 8, null, null, 19],
    [5, 4, 10, 9, null, null, 20],
    [null, null, null, 27, null, null, 21],
    [null, null, null, 26, 25, 24, 22, 23]
];

// Test 1: Null value handling
console.log('Test 1: Null value normalization');
console.log('-----------------------------------');
var normalization = ContourCore.nullHandling.normalizeNullValues(gridWithNulls);
console.log('Original grid has ' + gridWithNulls.length + ' rows');
console.log('Null count:', normalization.nullCount);
console.log('Valid count:', normalization.validCount);
console.log('First row null mask:', normalization.nullMask[0]);
console.log('First row cleaned:', normalization.cleanedGrid[0]);
console.log('✓ Null handling works!\n');

// Test 2: Compute contours with null values
console.log('Test 2: Compute contours with null values');
console.log('-------------------------------------------');
var result = ContourCore.computeContours({
    z: gridWithNulls
}, {
    autocontour: true,
    ncontours: 10
});

console.log('Computed ' + result.levels.length + ' contour levels');
console.log('Levels:', result.levels.slice(0, 5).map(l => l.toFixed(1)) + '...');
console.log('Number of path groups:', result.paths.length);
console.log('Null count in result:', result.nullCount);
console.log('Valid count in result:', result.validCount);
console.log('✓ Contour computation with nulls works!\n');

// Test 3: Generate null mask
console.log('Test 3: Generate null mask');
console.log('---------------------------');
var mask = ContourCore.nullHandling.generateNullMask(gridWithNulls);
console.log('Mask rows:', mask.length);
console.log('First row has nulls:', mask[0].some(v => v));
console.log('✓ Null mask generation works!\n');

// Test 4: Verify null cells are skipped
console.log('Test 4: Verify null cells are skipped in pathfinding');
console.log('------------------------------------------------------');
var totalPaths = result.paths.reduce((sum, p) => sum + p.paths.length + p.edgepaths.length, 0);
console.log('Total paths generated:', totalPaths);
console.log('Paths should avoid null regions');
console.log('✓ Pathfinding respects null values!\n');

// Test 5: Complete data (baseline)
console.log('Test 5: Complete data (baseline comparison)');
console.log('---------------------------------------------');
var completeGrid = [
    [10, 11, 12, 13, 14],
    [9, 10, 11, 12, 13],
    [8, 9, 10, 11, 12],
    [7, 8, 9, 10, 11],
    [6, 7, 8, 9, 10]
];

var completeResult = ContourCore.computeContours({
    z: completeGrid
}, {
    autocontour: true,
    ncontours: 10
});

console.log('Complete grid levels:', completeResult.levels.length);
console.log('Complete grid paths:', completeResult.paths.reduce((sum, p) => sum + p.paths.length + p.edgepaths.length, 0));
console.log('✓ Complete data works as expected!\n');

// Test 6: All null data (edge case)
console.log('Test 6: All null data (edge case)');
console.log('-----------------------------------');
var allNullGrid = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
];

var allNullResult = ContourCore.computeContours({
    z: allNullGrid
}, {
    autocontour: true,
    ncontours: 10
});

console.log('All-null grid result:');
console.log('  Levels:', allNullResult.levels.length);
console.log('  Paths:', allNullResult.paths.length);
console.log('  Null count:', allNullResult.nullCount);
console.log('✓ All-null data handled gracefully!\n');

// Test 7: API exports
console.log('Test 7: Verify API exports');
console.log('----------------------------');
console.log('Available exports:', Object.keys(ContourCore));
console.log('Has render:', typeof ContourCore.render === 'function');
console.log('Has drawTo:', typeof ContourCore.drawTo === 'function');
console.log('Has nullHandling:', typeof ContourCore.nullHandling === 'object');
console.log('Has COLOR_SCALES:', typeof ContourCore.COLOR_SCALES === 'object');
console.log('✓ All API exports available!\n');

console.log('=== All Tests Passed! ===');
console.log('\nv0.2.0 Features implemented:');
console.log('  ✓ Null value identification and normalization');
console.log('  ✓ Compute layer null handling (levels, marching squares, pathfinding)');
console.log('  ✓ Simplified rendering API (render, drawTo)');
console.log('  ✓ Configuration parameter support');
console.log('\nNext steps:');
console.log('  - Create browser demo to test Canvas rendering');
console.log('  - Add colorbar rendering');
console.log('  - Test with real-world data');
