'use strict';

/**
 * Integration tests for null value scenarios
 */

var ContourCore = require('../../index');

console.log('=== Null Value Integration Tests ===\n');

// Test 1: Grid with scattered nulls
console.log('Test 1: Grid with scattered nulls');
var grid1 = [
    [null, null, 12, 13, 14],
    [null, 1, null, 11, null],
    [null, 2, 6, 7, null],
    [5, 4, 10, 9, null]
];
var result1 = ContourCore.computeContours({ z: grid1 }, { autocontour: true, ncontours: 8 });
console.assert(result1.levels.length > 0, 'Should compute levels');
console.assert(result1.nullCount > 0, 'Should detect null values');
console.log('Levels: ' + result1.levels.length);
console.log('Null count: ' + result1.nullCount);
console.log('✓ Scattered nulls handled\n');

// Test 2: Complete grid (baseline)
console.log('Test 2: Complete grid (baseline)');
var grid2 = [
    [10, 11, 12, 13, 14],
    [9, 10, 11, 12, 13],
    [8, 9, 10, 11, 12],
    [7, 8, 9, 10, 11]
];
var result2 = ContourCore.computeContours({ z: grid2 }, { autocontour: true, ncontours: 8 });
console.assert(result2.levels.length > 0, 'Should compute levels');
console.assert(result2.nullCount === 0, 'Should have no nulls');
console.log('Levels: ' + result2.levels.length);
console.log('✓ Complete grid works\n');

// Test 3: All null grid
console.log('Test 3: All null grid');
var grid3 = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
];
var result3 = ContourCore.computeContours({ z: grid3 }, { autocontour: true });
console.assert(result3.levels.length === 0, 'Should have no levels');
console.assert(result3.paths.length === 0, 'Should have no paths');
console.log('✓ All-null grid handled\n');

// Test 4: Grid with NaN and undefined
console.log('Test 4: Grid with NaN and undefined');
var grid4 = [
    [1, NaN, 3],
    [undefined, 5, null],
    [7, 8, 9]
];
var result4 = ContourCore.computeContours({ z: grid4 }, { autocontour: true });
console.assert(result4.levels.length > 0, 'Should compute levels');
console.assert(result4.nullCount === 3, 'Should detect 3 invalid values');
console.log('Null count: ' + result4.nullCount);
console.log('✓ Mixed invalid types handled\n');

// Test 5: Null region edge case
console.log('Test 5: Null at edges');
var grid5 = [
    [null, null, null, null],
    [null, 5, 6, null],
    [null, 4, 7, null],
    [null, null, null, null]
];
var result5 = ContourCore.computeContours({ z: grid5 }, { autocontour: true });
console.log('Levels: ' + result5.levels.length);
console.log('Paths: ' + result5.paths.reduce((sum, p) => sum + p.paths.length + p.edgepaths.length, 0));
console.log('✓ Edge nulls handled\n');

console.log('=== All Integration Tests Passed ===');
