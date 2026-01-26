'use strict';

/**
 * Unit tests for smart levels (intelligent tick generation)
 */

var levels = require('../levels');

console.log('=== Testing Smart Levels Algorithm ===\n');

// Test 1: Basic range
console.log('Test 1: Basic range (0-100, 5 ticks)');
var result1 = levels.computeNiceTicks(0, 100, 5);
console.log('Input: start=0, end=100, ncontours=5');
console.log('Output:', result1);
console.log('Generated levels:');
for (var v = result1.start; v <= result1.end; v += result1.step) {
    console.log('  ' + v);
}
console.log('Expected: Nice numbers like 0, 20, 40, 60, 80, 100\n');

// Test 2: Small range
console.log('Test 2: Small range (0-10, 5 ticks)');
var result2 = levels.computeNiceTicks(0, 10, 5);
console.log('Input: start=0, end=10, ncontours=5');
console.log('Output:', result2);
console.log('Generated levels:');
for (var v = result2.start; v <= result2.end; v += result2.step) {
    console.log('  ' + v);
}
console.log('Expected: 0, 2, 4, 6, 8, 10\n');

// Test 3: Large range
console.log('Test 3: Large range (0-10000, 5 ticks)');
var result3 = levels.computeNiceTicks(0, 10000, 5);
console.log('Input: start=0, end=10000, ncontours=5');
console.log('Output:', result3);
console.log('Generated levels:');
for (var v = result3.start; v <= result3.end; v += result3.step) {
    console.log('  ' + v);
}
console.log('Expected: 0, 2000, 4000, 6000, 8000, 10000\n');

// Test 4: Fractional range
console.log('Test 4: Fractional range (0-1, 5 ticks)');
var result4 = levels.computeNiceTicks(0, 1, 5);
console.log('Input: start=0, end=1, ncontours=5');
console.log('Output:', result4);
console.log('Generated levels:');
for (var v = result4.start; v <= result4.end; v += result4.step) {
    console.log('  ' + v);
}
console.log('Expected: 0, 0.2, 0.4, 0.6, 0.8, 1.0\n');

// Test 5: Negative range
console.log('Test 5: Negative range (-50 to 50, 5 ticks)');
var result5 = levels.computeNiceTicks(-50, 50, 5);
console.log('Input: start=-50, end=50, ncontours=5');
console.log('Output:', result5);
console.log('Generated levels:');
for (var v = result5.start; v <= result5.end; v += result5.step) {
    console.log('  ' + v);
}
console.log('Expected: -50, -30, -10, 10, 30, 50 (or similar nice numbers)\n');

// Test 6: Real-world example
console.log('Test 6: Real-world data (elevation data)');
var zmin = 234.5;
var zmax = 1876.3;
var result6 = levels.computeNiceTicks(zmin, zmax, 10);
console.log('Input: start=' + zmin + ', end=' + zmax + ', ncontours=10');
console.log('Output:', result6);
console.log('Generated levels:');
for (var v = result6.start; v <= result6.end; v += result6.step) {
    console.log('  ' + v.toFixed(1));
}
console.log('Expected: Nice round numbers like 200, 400, 600, ...\n');

console.log('=== Smart Levels Tests Complete ===\n');

module.exports = {
    result1: result1,
    result2: result2,
    result3: result3,
    result4: result4,
    result5: result5,
    result6: result6
};
