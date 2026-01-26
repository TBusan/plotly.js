'use strict';

/**
 * Unit tests for labels module
 */

var labels = require('../../labels');

console.log('=== Labels Unit Tests ===\n');

// Test 1: findBestTextLocation
console.log('Test 1: findBestTextLocation');
var path = [[0, 0], [10, 10], [20, 10], [30, 5]];
var location = labels.findBestTextLocation(path, { level: 5 });
console.assert(location !== null, 'Should return a location');
console.assert(typeof location.x === 'number', 'Should have x coordinate');
console.assert(typeof location.y === 'number', 'Should have y coordinate');
console.assert(typeof location.theta === 'number', 'Should have theta angle');
console.assert(location.level === 5, 'Should have correct level');
console.log('✓ findBestTextLocation works\n');

// Test 2: formatContourLabel
console.log('Test 2: formatContourLabel');
var formatted = labels.formatContourLabel(3.14159, '.2f');
console.assert(formatted === '3.14', 'Should format to 2 decimal places');

var signed = labels.formatContourLabel(5.2, '+.1f');
console.assert(signed === '+5.2', 'Should add + sign');

console.log('✓ formatContourLabel works\n');

// Test 3: locationCost
console.log('Test 3: locationCost');
var label1 = { x: 10, y: 10, theta: 0, level: 1 };
var label2 = { x: 15, y: 10, theta: 0, level: 1 };
var cost = labels.locationCost(label2, [label1], { sameLevelDistance: 10 });
console.assert(cost > 0, 'Should have positive cost');
console.log('Cost for nearby label: ' + cost.toFixed(2));
console.log('✓ locationCost works\n');

console.log('=== All Labels Tests Passed ===');
