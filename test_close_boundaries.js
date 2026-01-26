#!/usr/bin/env node
/**
 * Quick test to verify closeBoundaries integration works correctly
 */

const ContourCore = require('./dist/contour-core.umd.js');

console.log('=== Testing closeBoundaries Integration ===\n');

// Simple test grid
const grid = [
    [10, 10.625, 12.5, 15.625, 20],
    [5.625, 6.25, 8.125, 11.25, 15.625],
    [2.5, 3.125, 5., 8.125, 12.5],
    [0.625, 1.25, 3.125, 6.25, 10.625],
    [0, 0.625, 2.5, 5.625, 10]
];

// Test 1: computeContours with fill mode
console.log('Test 1: computeContours with fill mode');
const result1 = ContourCore.computeContours(grid.z ? grid : { z: grid }, {
    contours: { type: 'fill' },
    autocontour: true,
    ncontours: 8
});

console.log('  Levels:', result1.levels.length);
console.log('  Paths:', result1.paths.length);

// Check if prefixBoundary is set
let hasPrefixBoundary = false;
let edgePathCount = 0;
let closedPathCount = 0;

result1.paths.forEach(p => {
    if (p.prefixBoundary) hasPrefixBoundary = true;
    edgePathCount += p.edgepaths.length;
    closedPathCount += p.paths.length;
});

console.log('  Has prefixBoundary:', hasPrefixBoundary);
console.log('  Edge paths:', edgePathCount);
console.log('  Closed paths:', closedPathCount);
console.log('  Result:', hasPrefixBoundary ? '✓ PASS' : '✗ FAIL (no prefixBoundary found)');

// Test 2: computeContours with lines mode
console.log('\nTest 2: computeContours with lines mode');
const result2 = ContourCore.computeContours({ z: grid }, {
    contours: { type: 'levels' },
    autocontour: true,
    ncontours: 8
});

console.log('  Levels:', result2.levels.length);
console.log('  Paths:', result2.paths.length);

// Test 3: Verify null handling
console.log('\nTest 3: Null value handling');
const gridWithNulls = [
    [null, null, null, 12, 13],
    [null, 1, null, 11, null],
    [null, 2, 6, 7, null],
    [null, 3, null, 8, null],
    [5, 4, 10, 9, null]
];

const result3 = ContourCore.computeContours({ z: gridWithNulls }, {
    autocontour: true,
    ncontours: 6
});

console.log('  Null count:', result3.nullCount);
console.log('  Valid count:', result3.validCount);
console.log('  Has nullMask:', !!result3.nullMask);
console.log('  Result:', result3.nullCount > 0 ? '✓ PASS' : '✗ FAIL');

// Test 4: Verify path structure
console.log('\nTest 4: Path structure validation');
const result4 = ContourCore.computeContours({ z: grid }, {
    autocontour: true,
    ncontours: 5
});

let validPaths = true;
result4.paths.forEach((p, i) => {
    if (!p.hasOwnProperty('prefixBoundary')) {
        console.log('  ✗ Path', i, 'missing prefixBoundary property');
        validPaths = false;
    }
    if (!Array.isArray(p.edgepaths)) {
        console.log('  ✗ Path', i, 'edgepaths is not an array');
        validPaths = false;
    }
    if (!Array.isArray(p.paths)) {
        console.log('  ✗ Path', i, 'paths is not an array');
        validPaths = false;
    }
});

console.log('  All paths have correct structure:', validPaths ? '✓ PASS' : '✗ FAIL');

console.log('\n=== All Tests Complete ===');
