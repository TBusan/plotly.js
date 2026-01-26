#!/usr/bin/env node

/**
 * Test null/NaN value handling in contour-core
 */

const contourCore = require('./src/contour-core');

console.log('=== Testing Null Value Handling ===\n');

// Test with null values
const dataWithNulls = [
    [null, null, null, 12, 13, 14, 15, 16],
    [null, 1, null, 11, null, null, null, 17],
    [null, 2, 6, 7, null, null, null, 18],
    [null, 3, null, 8, null, null, null, 19],
    [5, 4, 10, 9, null, null, null, 20],
    [null, null, null, 27, null, null, null, 21],
    [null, null, null, 26, 25, 24, 23, 22]
];

console.log('Data with nulls:');
console.log('  Shape:', dataWithNulls.length, 'x', dataWithNulls[0].length);

// Count valid values
let validCount = 0;
let nullCount = 0;
dataWithNulls.forEach(row => {
    row.forEach(val => {
        if (val === null || val === undefined || isNaN(val)) {
            nullCount++;
        } else {
            validCount++;
        }
    });
});

console.log('  Valid values:', validCount);
console.log('  Null values:', nullCount);

// Compute contours
const result = contourCore.computeContours({ z: dataWithNulls }, {
    autocontour: true,
    ncontours: 10,
    smoothing: 0.5
});

console.log('\nResult:');
console.log('  Levels:', result.levels.length);
console.log('  Level range:', result.levels[0], '-', result.levels[result.levels.length - 1]);
console.log('  Paths:', result.paths.length);

// Count total paths
let totalPaths = 0;
result.paths.forEach(p => {
    totalPaths += p.paths.length + p.edgepaths.length;
});
console.log('  Total path segments:', totalPaths);

console.log('\n✅ Null handling test passed!');
