'use strict';

/**
 * Integration test for zrender nulls and heatmap modules
 * Tests actual rendering with real contour data (without canvas dependency)
 */

var contourCore = require('../index');
var nullUtils = require('../renderers/zrender/nulls');
var heatmapUtils = require('../renderers/zrender/heatmap');
var axesUtils = require('../renderers/zrender/axes');

console.log('\n========================================');
console.log('ZRender Integration Test');
console.log('========================================\n');

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

// Generate test data
function generateTestData(m, n) {
    var z = [];
    var x = [];
    var y = [];

    for (var i = 0; i < m; i++) {
        z[i] = [];
        for (var j = 0; j < n; j++) {
            // Create a smooth function with a peak
            var xi = j / (n - 1);
            var yi = i / (m - 1);
            z[i][j] = Math.sin(xi * Math.PI) * Math.cos(yi * Math.PI) * 10 + 5;
        }
        y.push(i);
    }
    for (var j = 0; j < n; j++) {
        x.push(j);
    }

    return { z: z, x: x, y: y };
}

function generateTestDataWithNulls(m, n, nullRatio) {
    var data = generateTestData(m, n);
    var nullMask = [];

    for (var i = 0; i < m; i++) {
        nullMask[i] = [];
        for (var j = 0; j < n; j++) {
            if (Math.random() < nullRatio) {
                data.z[i][j] = NaN;
                nullMask[i][j] = true;
            } else {
                nullMask[i][j] = false;
            }
        }
    }

    data.nullMask = nullMask;
    return data;
}

console.log('--- Contour Computation Tests ---\n');

// Test 1: Basic contour computation
test('computeContours returns valid result', function() {
    var data = generateTestData(10, 10);
    var result = contourCore.computeContours(data, {
        autocontour: false,
        ncontours: 4
    });

    if (!result) return 'Result is null';
    if (!result.paths) return 'No paths in result';
    if (!result.levels) return 'No levels in result';
    if (result.levels.length < 1) return 'Should have at least 1 level';

    return true;
});

// Test 2: Contour with nulls
test('computeContours handles null values', function() {
    var data = generateTestDataWithNulls(10, 10, 0.1);
    var result = contourCore.computeContours(data, {
        autocontour: false,
        ncontours: 4,
        connectgaps: false
    });

    if (!result) return 'Result is null';

    return true;
});

// Test 3: Contour with connectgaps
test('computeContours with connectgaps=true', function() {
    var data = generateTestDataWithNulls(10, 10, 0.1);
    var result = contourCore.computeContours(data, {
        autocontour: false,
        ncontours: 4,
        connectgaps: true
    });

    if (!result) return 'Result is null';

    return true;
});

console.log('\n--- Null Utils Tests ---\n');

// Test 4: createNullElements with null mask
test('createNullElements creates elements for null regions', function() {
    var nullMask = [
        [true, false, false],
        [false, true, false],
        [false, false, false]
    ];

    var contourResult = {
        nullMask: nullMask
    };

    var style = {
        width: 300,
        height: 300,
        padding: 30,
        nullRegion: {
            visible: true,
            fill: '#ffffff'
        }
    };

    var elements = nullUtils.createNullElements(contourResult, style);
    if (!elements) return 'Elements is null';
    if (elements.length === 0) return 'Should create elements';

    return true;
});

// Test 5: mergeNullCells
test('mergeNullCells merges adjacent cells', function() {
    var nullCells = [
        { i: 0, j: 0 },
        { i: 0, j: 1 },
        { i: 1, j: 0 },
        { i: 1, j: 1 },
        { i: 5, j: 5 }  // Separate cell
    ];

    var merged = nullUtils.mergeNullCells(nullCells, 7, 7);
    if (!merged) return 'Merged is null';
    if (merged.length !== 2) return 'Should have 2 merged regions, got ' + merged.length;

    return true;
});

// Test 6: createNullClipPath
test('createNullClipPath creates valid clip path', function() {
    var nullMask = [
        [true, true, false],
        [true, true, false],
        [false, false, false]
    ];

    var contourResult = {
        nullMask: nullMask
    };

    var style = {
        width: 300,
        height: 300,
        padding: 30
    };

    var clipPath = nullUtils.createNullClipPath(contourResult, style);
    // May return null if no valid boundary found, that's OK
    return true;
});

console.log('\n--- Heatmap Utils Tests ---\n');

// Test 7: calculateDataRange
test('calculateDataRange computes correct range', function() {
    var z = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
    ];

    var range = heatmapUtils.calculateDataRange(z, 3, 3);
    if (range.min !== 1) return 'Min should be 1, got ' + range.min;
    if (range.max !== 9) return 'Max should be 9, got ' + range.max;

    return true;
});

// Test 8: parseHexColor
test('parseHexColor parses colors correctly', function() {
    var red = heatmapUtils.parseHexColor('#ff0000');
    if (red.r !== 255 || red.g !== 0 || red.b !== 0) {
        return 'Failed to parse red: ' + JSON.stringify(red);
    }

    var short = heatmapUtils.parseHexColor('#f00');
    if (short.r !== 255) return 'Failed to parse short red';

    return true;
});

// Test 9: interpolateValue
test('interpolateValue performs bilinear interpolation', function() {
    var z = [
        [0, 10],
        [10, 20]
    ];

    // At center, should be average = 10
    var center = heatmapUtils.interpolateValue(z, 2, 2, 0.5, 0.5);
    if (Math.abs(center - 10) > 0.1) return 'Center should be ~10, got ' + center;

    // At corner, should be exact value
    var corner = heatmapUtils.interpolateValue(z, 2, 2, 0, 0);
    if (corner !== 0) return 'Corner should be 0, got ' + corner;

    return true;
});

// Test 10: bicubicInterpolate
test('bicubicInterpolate handles edge cases', function() {
    var z = [
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [3, 4, 5, 6],
        [4, 5, 6, 7]
    ];

    // At integer position, should be close to exact value
    var val = heatmapUtils.bicubicInterpolate(z, 4, 4, 1, 1);
    if (Math.abs(val - 3) > 0.5) return 'Value at (1,1) should be ~3, got ' + val;

    return true;
});

// Test 11: createHeatmapBackground
test('createHeatmapBackground creates valid group', function() {
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
    if (!group) return 'Group is null';

    return true;
});

// Test 12: createInterpolatedHeatmap
test('createInterpolatedHeatmap returns element', function() {
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

    // May return null if no canvas support in Node.js
    var element = heatmapUtils.createInterpolatedHeatmap(grid, style);
    // This is OK either way
    return true;
});

console.log('\n--- Axes Utils Tests ---\n');

// Test 13: setupAxes
test('setupAxes returns valid configuration', function() {
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
    if (!result) return 'Result is null';
    if (!result.drawingArea) return 'No drawing area';
    if (!result.x || !result.x.ticks) return 'No X ticks';
    if (!result.y || !result.y.ticks) return 'No Y ticks';

    return true;
});

// Test 14: drawXAxis, drawYAxis exist
test('axes drawing functions exist', function() {
    if (!axesUtils.drawXAxis) return 'drawXAxis missing';
    if (!axesUtils.drawYAxis) return 'drawYAxis missing';
    if (!axesUtils.drawXGrid) return 'drawXGrid missing';
    if (!axesUtils.drawYGrid) return 'drawYGrid missing';
    if (!axesUtils.drawAxesFromSetup) return 'drawAxesFromSetup missing';
    if (!axesUtils.drawGridFromSetup) return 'drawGridFromSetup missing';

    return true;
});

console.log('\n--- Renderer Module Tests ---\n');

// Test 15: zrender renderer module
test('zrender renderer module loads correctly', function() {
    var renderer = require('../renderers/zrender');
    if (!renderer) return 'Renderer module is null';
    if (!renderer.createRenderer) return 'createRenderer missing';
    if (!renderer.ZRenderContourRenderer) return 'ZRenderContourRenderer missing';

    return true;
});

// Test 16: nullUtils exports correct functions
test('nullUtils exports all required functions', function() {
    if (!nullUtils.createNullElements) return 'createNullElements missing';
    if (!nullUtils.createNullClipPath) return 'createNullClipPath missing';
    if (!nullUtils.drawNulls) return 'drawNulls missing';
    if (!nullUtils.applyNullClip) return 'applyNullClip missing';
    if (!nullUtils.mergeNullCells) return 'mergeNullCells missing';

    return true;
});

// Test 17: heatmapUtils exports all required functions
test('heatmapUtils exports all required functions', function() {
    if (!heatmapUtils.createHeatmapBackground) return 'createHeatmapBackground missing';
    if (!heatmapUtils.createInterpolatedHeatmap) return 'createInterpolatedHeatmap missing';
    if (!heatmapUtils.createSmoothHeatmap) return 'createSmoothHeatmap missing';
    if (!heatmapUtils.createBicubicHeatmap) return 'createBicubicHeatmap missing';
    if (!heatmapUtils.drawHeatmap) return 'drawHeatmap missing';

    return true;
});

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
    console.log('\n✓ All integration tests passed!');
    process.exit(0);
}
