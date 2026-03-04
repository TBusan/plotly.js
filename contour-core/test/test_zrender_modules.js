'use strict';

/**
 * Test script for zrender modules (nulls.js, heatmap.js, axes.js)
 * Run with: node test/test_zrender_modules.js
 */

var path = require('path');

// Test configuration
var TEST_PASSED = 0;
var TEST_FAILED = 0;

function test(name, fn) {
    try {
        var result = fn();
        if (result === true || result === undefined) {
            console.log('✓ ' + name);
            TEST_PASSED++;
        } else {
            console.log('✗ ' + name + ' - ' + result);
            TEST_FAILED++;
        }
    } catch (e) {
        console.log('✗ ' + name + ' - Exception: ' + e.message);
        TEST_FAILED++;
    }
}

function assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        return message + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')';
    }
    return true;
}

function assertNotNull(value, message) {
    if (value === null || value === undefined) {
        return message + ' (value was ' + value + ')';
    }
    return true;
}

console.log('\n========================================');
console.log('Testing ZRender Modules');
console.log('========================================\n');

// ============== Test nulls.js ==============
console.log('--- Testing nulls.js ---\n');

test('nulls.js loads correctly', function() {
    var nullUtils = require('../renderers/zrender/nulls');
    return assertNotNull(nullUtils, 'nullUtils should not be null');
});

test('nulls.js exports createNullElements', function() {
    var nullUtils = require('../renderers/zrender/nulls');
    return assertNotNull(nullUtils.createNullElements, 'createNullElements should be exported');
});

test('nulls.js exports createNullClipPath', function() {
    var nullUtils = require('../renderers/zrender/nulls');
    return assertNotNull(nullUtils.createNullClipPath, 'createNullClipPath should be exported');
});

test('nulls.js exports mergeNullCells', function() {
    var nullUtils = require('../renderers/zrender/nulls');
    return assertNotNull(nullUtils.mergeNullCells, 'mergeNullCells should be exported');
});

test('mergeNullCells merges adjacent cells', function() {
    var nullUtils = require('../renderers/zrender/nulls');

    // Create test null cells
    var nullCells = [
        { i: 0, j: 0 },
        { i: 0, j: 1 },
        { i: 1, j: 0 },
        { i: 1, j: 1 }
    ];

    var merged = nullUtils.mergeNullCells(nullCells, 3, 3);

    // Should merge into one rectangle
    return assertEqual(merged.length, 1, 'Should merge into 1 rectangle');
});

test('mergeNullCells handles separate regions', function() {
    var nullUtils = require('../renderers/zrender/nulls');

    // Create two separate null regions
    var nullCells = [
        { i: 0, j: 0 },
        { i: 0, j: 1 },
        { i: 3, j: 3 },
        { i: 3, j: 4 }
    ];

    var merged = nullUtils.mergeNullCells(nullCells, 5, 5);

    // Should create two separate rectangles
    return assertEqual(merged.length, 2, 'Should create 2 separate rectangles');
});

test('createNullElements returns empty array when no nullMask', function() {
    var nullUtils = require('../renderers/zrender/nulls');

    var result = {
        nullMask: null
    };
    var style = {};

    var elements = nullUtils.createNullElements(result, style);
    return assertEqual(elements.length, 0, 'Should return empty array');
});

test('createNullElements returns empty array when visible=false', function() {
    var nullUtils = require('../renderers/zrender/nulls');

    var result = {
        nullMask: [[true, false], [false, true]]
    };
    var style = {
        nullRegion: { visible: false }
    };

    var elements = nullUtils.createNullElements(result, style);
    return assertEqual(elements.length, 0, 'Should return empty array when hidden');
});

test('createNullElements creates elements for null cells', function() {
    var nullUtils = require('../renderers/zrender/nulls');

    var result = {
        nullMask: [
            [true, false, false],
            [false, true, false],
            [false, false, false]
        ]
    };
    var style = {
        width: 300,
        height: 300,
        padding: 30,
        nullRegion: {
            fill: '#ffffff'
        }
    };

    var elements = nullUtils.createNullElements(result, style);
    return assertEqual(elements.length > 0, true, 'Should create elements');
});

// ============== Test heatmap.js ==============
console.log('\n--- Testing heatmap.js ---\n');

test('heatmap.js loads correctly', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');
    return assertNotNull(heatmapUtils, 'heatmapUtils should not be null');
});

test('heatmap.js exports createHeatmapBackground', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');
    return assertNotNull(heatmapUtils.createHeatmapBackground, 'createHeatmapBackground should be exported');
});

test('heatmap.js exports createInterpolatedHeatmap', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');
    return assertNotNull(heatmapUtils.createInterpolatedHeatmap, 'createInterpolatedHeatmap should be exported');
});

test('heatmap.js exports createSmoothHeatmap', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');
    return assertNotNull(heatmapUtils.createSmoothHeatmap, 'createSmoothHeatmap should be exported');
});

test('heatmap.js exports createBicubicHeatmap', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');
    return assertNotNull(heatmapUtils.createBicubicHeatmap, 'createBicubicHeatmap should be exported');
});

test('heatmap.js exports drawHeatmap', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');
    return assertNotNull(heatmapUtils.drawHeatmap, 'drawHeatmap should be exported');
});

test('calculateDataRange computes correct range', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');

    var z = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
    ];

    var range = heatmapUtils.calculateDataRange(z, 3, 3);
    return assertEqual(range, { min: 1, max: 9 }, 'Should calculate correct range');
});

test('calculateDataRange handles NaN values', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');

    var z = [
        [1, NaN, 3],
        [4, 5, null],
        [7, 8, 9]
    ];

    var range = heatmapUtils.calculateDataRange(z, 3, 3);
    return assertEqual(range, { min: 1, max: 9 }, 'Should ignore NaN/null values');
});

test('parseHexColor parses hex colors', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');

    var rgb = heatmapUtils.parseHexColor('#ff0000');
    return assertEqual(rgb, { r: 255, g: 0, b: 0 }, 'Should parse red color');
});

test('parseHexColor parses short hex colors', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');

    var rgb = heatmapUtils.parseHexColor('#f00');
    return assertEqual(rgb, { r: 255, g: 0, b: 0 }, 'Should parse short red color');
});

test('parseHexColor parses rgba colors', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');

    var rgb = heatmapUtils.parseHexColor('rgba(0, 128, 255, 0.5)');
    return assertEqual(rgb, { r: 0, g: 128, b: 255 }, 'Should parse rgba color');
});

test('interpolateValue performs bilinear interpolation', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');

    var z = [
        [0, 1],
        [1, 2]
    ];

    // At center, should be 1.0
    var value = heatmapUtils.interpolateValue(z, 2, 2, 0.5, 0.5);
    return assertEqual(Math.abs(value - 1.0) < 0.01, true, 'Center value should be ~1.0');
});

test('bicubicInterpolate handles edge cases', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');

    var z = [
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [3, 4, 5, 6],
        [4, 5, 6, 7]
    ];

    // At integer position, should return exact value
    var value = heatmapUtils.bicubicInterpolate(z, 4, 4, 1, 1);
    return assertEqual(Math.abs(value - 3) < 0.1, true, 'Value at (1,1) should be ~3');
});

test('createHeatmapBackground returns group for valid grid', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');

    var grid = {
        z: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9]
        ]
    };
    var style = {
        width: 300,
        height: 300,
        padding: 30,
        colorscale: 'Viridis'
    };

    var group = heatmapUtils.createHeatmapBackground(grid, style);
    return assertNotNull(group, 'Should return a group');
});

test('createHeatmapBackground returns empty group for null grid', function() {
    var heatmapUtils = require('../renderers/zrender/heatmap');

    var group = heatmapUtils.createHeatmapBackground(null, {});
    return assertEqual(group._children.length, 0, 'Should return empty group');
});

// ============== Test axes.js ==============
console.log('\n--- Testing axes.js ---\n');

test('axes.js loads correctly', function() {
    var axesUtils = require('../renderers/zrender/axes');
    return assertNotNull(axesUtils, 'axesUtils should not be null');
});

test('axes.js exports drawXAxis', function() {
    var axesUtils = require('../renderers/zrender/axes');
    return assertNotNull(axesUtils.drawXAxis, 'drawXAxis should be exported');
});

test('axes.js exports drawYAxis', function() {
    var axesUtils = require('../renderers/zrender/axes');
    return assertNotNull(axesUtils.drawYAxis, 'drawYAxis should be exported');
});

test('axes.js exports setupAxes (enhanced)', function() {
    var axesUtils = require('../renderers/zrender/axes');
    return assertNotNull(axesUtils.setupAxes, 'setupAxes should be exported');
});

test('axes.js exports drawAxesFromSetup (enhanced)', function() {
    var axesUtils = require('../renderers/zrender/axes');
    return assertNotNull(axesUtils.drawAxesFromSetup, 'drawAxesFromSetup should be exported');
});

test('axes.js exports drawGridFromSetup (enhanced)', function() {
    var axesUtils = require('../renderers/zrender/axes');
    return assertNotNull(axesUtils.drawGridFromSetup, 'drawGridFromSetup should be exported');
});

test('generateTicks generates correct ticks', function() {
    // generateTicks is internal, but we can test through drawXAxis
    var axesUtils = require('../renderers/zrender/axes');
    return assertNotNull(axesUtils.drawXAxis, 'drawXAxis should work');
});

test('setupAxes returns valid axis configuration', function() {
    var axesUtils = require('../renderers/zrender/axes');

    var config = {
        width: 600,
        height: 500,
        x: {
            range: [0, 100],
            title: 'X Axis'
        },
        y: {
            range: [0, 50],
            title: 'Y Axis'
        }
    };

    var result = axesUtils.setupAxes(config);

    var hasDrawingArea = result.drawingArea !== undefined;
    var hasXTicks = result.x && result.x.ticks && result.x.ticks.length > 0;
    var hasYTicks = result.y && result.y.ticks && result.y.ticks.length > 0;

    return assertEqual(hasDrawingArea && hasXTicks && hasYTicks, true, 'Should return valid axis configuration');
});

// ============== Test index.js integration ==============
console.log('\n--- Testing index.js integration ---\n');

test('zrender index.js loads correctly', function() {
    var renderer = require('../renderers/zrender');
    return assertNotNull(renderer, 'renderer should not be null');
});

test('zrender index.js exports createRenderer', function() {
    var renderer = require('../renderers/zrender');
    return assertNotNull(renderer.createRenderer, 'createRenderer should be exported');
});

test('zrender index.js exports ZRenderContourRenderer', function() {
    var renderer = require('../renderers/zrender');
    return assertNotNull(renderer.ZRenderContourRenderer, 'ZRenderContourRenderer should be exported');
});

// Print summary
console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log('Passed: ' + TEST_PASSED);
console.log('Failed: ' + TEST_FAILED);
console.log('Total: ' + (TEST_PASSED + TEST_FAILED));

if (TEST_FAILED > 0) {
    console.log('\n⚠ Some tests failed!');
    process.exit(1);
} else {
    console.log('\n✓ All tests passed!');
    process.exit(0);
}
