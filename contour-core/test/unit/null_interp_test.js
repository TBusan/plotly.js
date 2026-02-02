'use strict';

/**
 * Integration test for null handling:
 * - normalizeNullValues (converts invalid to undefined)
 * - findEmpties (finds undefined points)
 * - interp2d (fills in undefined points)
 *
 * This test verifies the complete null handling pipeline matches plotly.js behavior
 */

var normalizeNullValues = require('../../null_handling/normalize');
var findEmpties = require('../../null_handling/find_empties');
var doInterp = require('../../null_handling/interp2d');

console.log('=== Null Handling Pipeline Test ===\n');

// Test 1: Single null value in middle of grid
console.log('Test 1: Single null value in middle');
var grid1 = [
    [1, 2, 3],
    [4, null, 6],
    [7, 8, 9]
];

var norm1 = normalizeNullValues(grid1);
console.log('  - After normalize: null at [1][1] is', norm1.cleanedGrid[1][1]);

var empties1 = findEmpties(norm1.cleanedGrid);
console.log('  - Found', empties1.length, 'empty points');
console.log('  - Empty point:', empties1[0]);

var grid1_result = doInterp(JSON.parse(JSON.stringify(norm1.cleanedGrid)), empties1);
console.log('  - After interpolation: [1][1] =', grid1_result[1][1].toFixed(2));
console.assert(grid1_result[1][1] !== undefined, 'Value should be filled in');
console.assert(grid1_result[1][1] > 4 && grid1_result[1][1] < 6, 'Value should be between neighbors');
console.log('✓ Single null interpolation works\n');

// Test 2: Multiple null values
console.log('Test 2: Multiple adjacent null values');
var grid2 = [
    [1, 2, null, 4],
    [null, 6, 7, 8],
    [9, 10, 11, 12]
];

var norm2 = normalizeNullValues(grid2);
var empties2 = findEmpties(norm2.cleanedGrid);
console.log('  - Found', empties2.length, 'empty points');

var grid2_interp = JSON.parse(JSON.stringify(norm2.cleanedGrid));
doInterp(grid2_interp, empties2);

console.log('  - After interpolation:');
console.log('    [0][2] =', grid2_interp[0][2].toFixed(2), '(was null)');
console.log('    [1][0] =', grid2_interp[1][0].toFixed(2), '(was null)');
console.assert(grid2_interp[0][2] !== undefined, '[0][2] should be filled');
console.assert(grid2_interp[1][0] !== undefined, '[1][0] should be filled');
console.log('✓ Multiple null interpolation works\n');

// Test 3: Edge null values
console.log('Test 3: Null values at edges');
var grid3 = [
    [null, 2, 3],
    [4, 5, 6],
    [7, 8, null]
];

var norm3 = normalizeNullValues(grid3);
var empties3 = findEmpties(norm3.cleanedGrid);
console.log('  - Found', empties3.length, 'empty points');

var grid3_interp = JSON.parse(JSON.stringify(norm3.cleanedGrid));
doInterp(grid3_interp, empties3);

console.log('  - After interpolation:');
console.log('    [0][0] =', grid3_interp[0][0].toFixed(2), '(was null)');
console.log('    [2][2] =', grid3_interp[2][2].toFixed(2), '(was null)');
console.assert(grid3_interp[0][0] !== undefined, '[0][0] should be filled');
console.assert(grid3_interp[2][2] !== undefined, '[2][2] should be filled');
console.log('✓ Edge null interpolation works\n');

// Test 4: NaN values
console.log('Test 4: NaN values (should be treated as null)');
var grid4 = [
    [1, 2, 3],
    [4, NaN, 6],
    [7, 8, 9]
];

var norm4 = normalizeNullValues(grid4);
console.log('  - After normalize: NaN at [1][1] is', norm4.cleanedGrid[1][1]);

var empties4 = findEmpties(norm4.cleanedGrid);
console.log('  - Found', empties4.length, 'empty points (NaN should be detected)');

var grid4_interp = JSON.parse(JSON.stringify(norm4.cleanedGrid));
doInterp(grid4_interp, empties4);

console.log('  - After interpolation: [1][1] =', grid4_interp[1][1].toFixed(2));
console.assert(grid4_interp[1][1] !== undefined, 'NaN value should be filled');
console.log('✓ NaN handling works\n');

// Test 5: Larger null region
console.log('Test 5: Larger null region (2x2)');
var grid5 = [
    [1, 2, null, null],
    [3, null, null, 8],
    [9, 10, 11, 12]
];

var norm5 = normalizeNullValues(grid5);
var empties5 = findEmpties(norm5.cleanedGrid);
console.log('  - Found', empties5.length, 'empty points');

// Verify sorting by neighbor count (descending)
for (var i = 0; i < empties5.length - 1; i++) {
    console.assert(empties5[i][2] >= empties5[i + 1][2],
        'Should be sorted by neighbor count descending');
}

var grid5_interp = JSON.parse(JSON.stringify(norm5.cleanedGrid));
doInterp(grid5_interp, empties5);

console.log('  - After interpolation:');
console.log('    [0][2] =', grid5_interp[0][2].toFixed(2));
console.log('    [0][3] =', grid5_interp[0][3].toFixed(2));
console.log('    [1][1] =', grid5_interp[1][1].toFixed(2));
console.log('    [1][2] =', grid5_interp[1][2].toFixed(2));

// Verify all values are filled
var allFilled = true;
for (var i = 0; i < grid5_interp.length; i++) {
    for (var j = 0; j < grid5_interp[i].length; j++) {
        if (grid5_interp[i][j] === undefined) {
            allFilled = false;
            console.log('  WARNING: [' + i + '][' + j + '] still undefined');
        }
    }
}
console.assert(allFilled, 'All null values should be filled');
console.log('✓ Larger null region interpolation works\n');

console.log('=== All Null Handling Pipeline Tests Passed ===');
