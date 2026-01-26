'use strict';

/**
 * Unit tests for tick formatting
 */

var ticks = require('../colorbar/ticks');

console.log('=== Testing Tick Formatting ===\n');

// Test 1: Fixed-point formatting
console.log('Test 1: Fixed-point formatting');
console.log('123.456 with .2f:', ticks.formatTickValue(123.456, '.2f'));
console.log('123.456 with .1f:', ticks.formatTickValue(123.456, '.1f'));
console.log('123.456 with .0f:', ticks.formatTickValue(123.456, '.0f'));
console.log('');

// Test 2: Percentage formatting
console.log('Test 2: Percentage formatting');
console.log('0.1234 with .1%:', ticks.formatTickValue(0.1234, '.1%'));
console.log('0.5678 with .2%:', ticks.formatTickValue(0.5678, '.2%'));
console.log('1.5 with .0%:', ticks.formatTickValue(1.5, '.0%'));
console.log('');

// Test 3: Exponential formatting
console.log('Test 3: Exponential formatting');
console.log('12345 with .2e:', ticks.formatTickValue(12345, '.2e'));
console.log('0.0001234 with .2e:', ticks.formatTickValue(0.0001234, '.2e'));
console.log('1.23e5 with .1E:', ticks.formatTickValue(123000, '.1E'));
console.log('');

// Test 4: Auto formatting
console.log('Test 4: Auto formatting (intelligent)');
var testValues = [
    0.0000123,
    0.00123,
    0.123,
    1.23,
    12.3,
    123.456,
    12345,
    1234567
];

testValues.forEach(function(val) {
    console.log(val + ' formatted as:', ticks.autoFormatValue(val));
});
console.log('');

// Test 5: Smart ticks computation
console.log('Test 5: Smart ticks computation');
var smartTicks1 = ticks.computeSmartTicks(0, 100, 6);
console.log('Range 0-100, 6 ticks:');
console.log('  Values:', smartTicks1.values);
console.log('  Positions:', smartTicks1.positions);
console.log('');

var smartTicks2 = ticks.computeSmartTicks(0.5, 5.5, 5);
console.log('Range 0.5-5.5, 5 ticks:');
console.log('  Values:', smartTicks2.values);
console.log('  Positions:', smartTicks2.positions);
console.log('');

// Test 6: Full tick computation
console.log('Test 6: Full tick computation with mock colorbar');
var mockColorbar = {
    levels: [0, 20, 40, 60, 80, 100],
    zmin: 0,
    zmax: 100
};

var ticksResult = ticks({
    levels: mockColorbar.levels,
    zmin: mockColorbar.zmin,
    zmax: mockColorbar.zmax
}, {
    nticks: 5,
    tickmode: 'linear',
    tickformat: '.1f'
});

console.log('Generated ticks:');
ticksResult.forEach(function(tick, i) {
    console.log('  Tick ' + i + ':');
    console.log('    Position: ' + tick.position.toFixed(2));
    console.log('    Value: ' + tick.value);
    console.log('    Label: ' + tick.label);
});
console.log('');

console.log('=== Tick Formatting Tests Complete ===\n');

module.exports = {
    ticksResult: ticksResult
};
