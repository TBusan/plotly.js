'use strict';

/**
 * Unit tests for color mapping
 */

var colors = require('../colorbar/colors');

console.log('=== Testing Color Mapping ===\n');

// Test 1: Parse colorscale
console.log('Test 1: Parse colorscale');
var parsed1 = colors.parseColorscale('Viridis');
console.log('Parsed Viridis (first 3 stops):', parsed1.slice(0, 3));
console.log('');

var parsed2 = colors.parseColorscale(['#000', '#fff', '#f00']);
console.log('Parsed custom colorscale:', parsed2);
console.log('');

var parsed3 = colors.parseColorscale([[0, 'blue'], [0.5, 'green'], [1, 'red']]);
console.log('Already normalized colorscale:', parsed3);
console.log('');

// Test 2: Color interpolation
console.log('Test 2: Color interpolation');
console.log('Blue to Red at 0.0:', colors.interpolateColor('#0000ff', '#ff0000', 0.0));
console.log('Blue to Red at 0.5:', colors.interpolateColor('#0000ff', '#ff0000', 0.5));
console.log('Blue to Red at 1.0:', colors.interpolateColor('#0000ff', '#ff0000', 1.0));
console.log('');

// Test 3: Get color at position
console.log('Test 3: Get color at position from Viridis');
var viridis = colors.parseColorscale('Viridis');
console.log('Position 0.0:', colors.getColorAtPosition(viridis, 0.0));
console.log('Position 0.5:', colors.getColorAtPosition(viridis, 0.5));
console.log('Position 1.0:', colors.getColorAtPosition(viridis, 1.0));
console.log('');

// Test 4: Map colors
console.log('Test 4: Map values to colors (Viridis, 0-100)');
console.log('Value 0:', colors.mapColors(0, 0, 100, 'Viridis'));
console.log('Value 25:', colors.mapColors(25, 0, 100, 'Viridis'));
console.log('Value 50:', colors.mapColors(50, 0, 100, 'Viridis'));
console.log('Value 75:', colors.mapColors(75, 0, 100, 'Viridis'));
console.log('Value 100:', colors.mapColors(100, 0, 100, 'Viridis'));
console.log('');

// Test 5: Map with reverse
console.log('Test 5: Map colors with reverse');
console.log('Value 25 (normal):', colors.mapColors(25, 0, 100, 'Viridis'));
console.log('Value 25 (reversed):', colors.mapColors(25, 0, 100, 'Viridis', { reverse: true }));
console.log('');

// Test 6: Build color scale with custom thresholds
console.log('Test 6: Build color scale with custom thresholds');
var customLevels = [1, 5, 10, 50, 100, 500, 1000];
var colorScale = colors.buildColorScale(customLevels, 'Hot');
console.log('Custom levels:', customLevels);
console.log('Color stops (first 3):', colorScale.slice(0, 3));
console.log('Color stops (last 3):', colorScale.slice(-3));
console.log('');

// Test 7: Build color scale with extension
console.log('Test 7: Build color scale with data range extension');
var levels = [10, 20, 30, 40, 50];
var extendedScale = colors.buildColorScale(levels, 'Plasma', {
    extend: true,
    dataMin: 0,
    dataMax: 100
});
console.log('Levels:', levels);
console.log('Extended color stops:');
extendedScale.forEach(function(stop) {
    console.log('  ' + stop[0] + ' -> ' + stop[1]);
});
console.log('');

// Test 8: Create color mapper
console.log('Test 8: Create color mapper function');
var mapper = colors.createColorMapper([0, 25, 50, 75, 100], 'Viridis');
console.log('Mapped values:');
console.log('  0:', mapper(0));
console.log('  12.5:', mapper(12.5));
console.log('  37.5:', mapper(37.5));
console.log('  62.5:', mapper(62.5));
console.log('  100:', mapper(100));
console.log('');

// Test 9: Get gradient stops
console.log('Test 9: Get gradient stops for canvas/SVG');
var levels = [0, 20, 40, 60, 80, 100];
var gradientStops = colors.getGradientStops(levels, 'Electric');
console.log('Gradient stops:');
gradientStops.forEach(function(stop) {
    console.log('  offset=' + stop.offset.toFixed(2) + ', color=' + stop.color);
});
console.log('');

console.log('=== Color Mapping Tests Complete ===\n');

module.exports = {
    parsed1: parsed1,
    parsed2: parsed2,
    colorScale: colorScale,
    extendedScale: extendedScale,
    gradientStops: gradientStops
};
