'use strict';

/**
 * Unit tests for null handling module
 */

var nullHandling = require('../../null_handling');

console.log('=== Null Handling Unit Tests ===\n');

// Test 1: normalizeNullValues
console.log('Test 1: normalizeNullValues');
var grid = [
    [1, null, 3],
    [undefined, 5, NaN],
    [7, 8, 9]
];
var result = nullHandling.normalizeNullValues(grid);
console.assert(result.nullCount === 3, 'Should have 3 null values');
console.assert(result.validCount === 6, 'Should have 6 valid values');
console.assert(result.cleanedGrid[0][1] !== result.cleanedGrid[0][1], 'null should become NaN');
console.log('✓ normalizeNullValues works\n');

// Test 2: generateNullMask
console.log('Test 2: generateNullMask');
var mask = nullHandling.generateNullMask(grid);
console.assert(mask[0][0] === false, 'Valid value should be false');
console.assert(mask[0][1] === true, 'Null value should be true');
console.assert(mask[1][0] === true, 'Undefined should be true');
console.assert(mask[1][2] === true, 'NaN should be true');
console.log('✓ generateNullMask works\n');

// Test 3: isValidValue
console.log('Test 3: isValidValue');
console.assert(nullHandling.isValidValue(5) === true, 'Number should be valid');
console.assert(nullHandling.isValidValue(0) === true, 'Zero should be valid');
console.assert(nullHandling.isValidValue(null) === false, 'null should be invalid');
console.assert(nullHandling.isValidValue(undefined) === false, 'undefined should be invalid');
console.assert(nullHandling.isValidValue(NaN) === false, 'NaN should be invalid');
console.assert(nullHandling.isValidValue(Infinity) === false, 'Infinity should be invalid');
console.log('✓ isValidValue works\n');

console.log('=== All Null Handling Tests Passed ===');
