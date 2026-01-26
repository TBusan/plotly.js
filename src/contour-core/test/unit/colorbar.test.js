'use strict';

/**
 * Unit tests for colorbar module
 */

var colorbar = require('../../colorbar');
var colors = require('../../colorbar/colors');

console.log('=== Colorbar Unit Tests ===\n');

// Test 1: computeColorbar
console.log('Test 1: computeColorbar');
var contourResult = {
    levels: [0, 2, 4, 6, 8, 10],
    paths: []
};
var cb = colorbar.computeColorbar(contourResult, { zmin: 0, zmax: 10 });
console.assert(cb !== null, 'Should return colorbar object');
console.assert(cb.zmin === 0, 'Should have correct zmin');
console.assert(cb.zmax === 10, 'Should have correct zmax');
console.assert(cb.levels.length === 6, 'Should have 6 levels');
console.log('✓ computeColorbar works\n');

// Test 2: computeTicks
console.log('Test 2: computeTicks');
var ticks = colorbar.computeTicks(cb, { nticks: 5 });
console.assert(ticks.length === 5, 'Should have 5 ticks');
console.assert(ticks[0].position === 0, 'First tick should be at 0');
console.assert(ticks[4].position === 1, 'Last tick should be at 1');
console.log('Ticks: ' + ticks.map(t => t.label).join(', '));
console.log('✓ computeTicks works\n');

// Test 3: mapColors
console.log('Test 3: mapColors');
var color = colors.mapColors(5, 0, 10, 'Viridis', false);
console.assert(typeof color === 'string', 'Should return string');
console.assert(color.startsWith('#'), 'Should be hex color');
console.log('Mapped color: ' + color);
console.log('✓ mapColors works\n');

// Test 4: buildColorScale
console.log('Test 4: buildColorScale');
var scale = colors.buildColorScale([0, 5, 10], 'Viridis');
console.assert(Array.isArray(scale), 'Should return array');
console.assert(scale.length === 3, 'Should have 3 color stops');
console.assert(scale[0].length === 2, 'Each stop should have [value, color]');
console.log('✓ buildColorScale works\n');

// Test 5: COLOR_SCALES
console.log('Test 5: COLOR_SCALES constants');
console.assert(colors.COLOR_SCALES.Viridis !== undefined, 'Should have Viridis');
console.assert(colors.COLOR_SCALES.Plasma !== undefined, 'Should have Plasma');
console.assert(colors.COLOR_SCALES.Hot !== undefined, 'Should have Hot');
console.log('Available color scales: ' + Object.keys(colors.COLOR_SCALES).join(', '));
console.log('✓ COLOR_SCALES defined\n');

console.log('=== All Colorbar Tests Passed ===');
