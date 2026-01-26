'use strict';

/**
 * Comprehensive test suite for contour-core
 * Tests all major functionality including:
 * - Core computation
 * - Null handling
 * - Labels (optimized algorithm)
 * - Colorbar
 * - Canvas renderer
 * - SVG renderer
 */

var ContourCore = require('../index');
var fs = require('fs');

// ANSI color codes for terminal output
var colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m'
};

function pass(msg) {
    console.log(colors.green + '✓ ' + msg + colors.reset);
}

function fail(msg) {
    console.log(colors.red + '✗ ' + msg + colors.reset);
}

function info(msg) {
    console.log(colors.blue + 'ℹ ' + msg + colors.reset);
}

function section(msg) {
    console.log('\n' + colors.yellow + '═══ ' + msg + ' ═══' + colors.reset);
}

var testsPassed = 0;
var testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        pass(name);
        testsPassed++;
    } catch (e) {
        fail(name + ': ' + e.message);
        testsFailed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error((message || '') + ' expected: ' + expected + ', actual: ' + actual);
    }
}

console.log(colors.blue + '\n╔══════════════════════════════════════════════════════╗' + colors.reset);
console.log(colors.blue + '║   Contour-Core v0.3.0 - Comprehensive Test Suite    ║' + colors.reset);
console.log(colors.blue + '╚══════════════════════════════════════════════════════╝' + colors.reset);

// ============================================
// Section 1: Core Computation
// ============================================
section('1. Core Computation Tests');

test('1.1: Basic contour computation', function() {
    var grid = [
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [3, 4, 5, 6]
    ];
    var result = ContourCore.computeContours({z: grid}, {autocontour: true, ncontours: 5});

    assert(result, 'Result should exist');
    assert(result.levels.length > 0, 'Should have levels');
    assert(result.paths.length > 0, 'Should have paths');
});

test('1.2: Custom contour levels', function() {
    var grid = [[0, 1, 2], [1, 2, 3], [2, 3, 4]];
    var result = ContourCore.computeContours({
        z: grid
    }, {
        start: 1,
        end: 3,
        size: 0.5
    });

    assertEqual(result.levels.length, 5, 'Should have 5 levels (1, 1.5, 2, 2.5, 3)');
});

test('1.3: Smoothing', function() {
    var grid = [[1, 2, 3], [2, 3, 4], [3, 4, 5]];
    var result1 = ContourCore.computeContours({z: grid}, {smoothing: 0});
    var result2 = ContourCore.computeContours({z: grid}, {smoothing: 0.5});

    assert(result1, 'Unsmoothed result should exist');
    assert(result2, 'Smoothed result should exist');
});

// ============================================
// Section 2: Null Handling
// ============================================
section('2. Null Handling Tests');

test('2.1: Null values are handled', function() {
    var grid = [
        [null, 1, 2],
        [1, null, 3],
        [2, 3, null]
    ];
    var result = ContourCore.computeContours({z: grid});

    assertEqual(result.nullCount, 3, 'Should detect 3 null values');
    assertEqual(result.validCount, 6, 'Should have 6 valid values');
    assert(result.nullMask, 'Should have null mask');
});

test('2.2: Undefined and NaN handling', function() {
    var grid = [
        [undefined, 1, 2],
        [1, NaN, 3],
        [2, 3, 4]
    ];
    var result = ContourCore.computeContours({z: grid});

    assertEqual(result.nullCount, 2, 'Should detect undefined and NaN as null');
});

test('2.3: All null grid', function() {
    var grid = [[null, null], [null, null]];
    var result = ContourCore.computeContours({z: grid});

    assertEqual(result.nullCount, 4, 'All values should be null');
    assertEqual(result.validCount, 0, 'No valid values');
});

test('2.4: nullHandling module API', function() {
    var grid = [[null, 1], [2, 3]];
    var normalized = ContourCore.nullHandling.normalizeNullValues(grid);
    var mask = ContourCore.nullHandling.generateNullMask(grid);

    assert(normalized, 'normalizeNullValues should work');
    assert(mask, 'generateNullMask should work');
    assertEqual(ContourCore.nullHandling.isValidValue(1), true, '1 should be valid');
    assertEqual(ContourCore.nullHandling.isValidValue(null), false, 'null should be invalid');
});

// ============================================
// Section 3: Labels (Optimized Algorithm)
// ============================================
section('3. Labels Tests (Optimized Algorithm)');

test('3.1: Label position calculation', function() {
    var path = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];
    var labelPos = ContourCore.labels.findBestTextLocation(
        path,
        {level: 5, width: 50, height: 20},
        [],
        {}
    );

    assert(labelPos, 'Should find label position');
    assert(labelPos.x !== undefined, 'Should have x coordinate');
    assert(labelPos.y !== undefined, 'Should have y coordinate');
    assert(labelPos.theta !== undefined, 'Should have theta');
    assertEqual(labelPos.level, 5, 'Should have correct level');
});

test('3.2: Label text formatting', function() {
    var f1 = ContourCore.labels.formatContourLabel(5.123, '.2f');
    var f2 = ContourCore.labels.formatContourLabel(5.123, '.1f');
    var f3 = ContourCore.labels.formatContourLabel(5.123, '.0f');

    assertEqual(f1, '5.12', 'Should format to 2 decimals');
    assertEqual(f2, '5.1', 'Should format to 1 decimal');
    assertEqual(f3, '5', 'Should format to 0 decimals');
});

test('3.3: Location cost calculation', function() {
    var loc = {x: 50, y: 50, theta: 0};
    var cost = ContourCore.labels.locationCost(
        loc,
        {width: 40, height: 20, level: 1},
        [],
        {left: 0, right: 100, top: 0, bottom: 100, center: 50, middle: 50}
    );

    assert(typeof cost === 'number', 'Cost should be a number');
    assert(cost < Infinity, 'Cost should be finite');
});

test('3.4: Overlap avoidance', function() {
    var path = [[0, 0], [10, 0], [20, 0], [30, 0]];
    var existingLabels = [{x: 15, y: 0, theta: 0, width: 40, height: 20, level: 1}];

    var labelPos = ContourCore.labels.findBestTextLocation(
        path,
        {level: 1, width: 40, height: 20},
        existingLabels,
        {left: 0, right: 100, top: 0, bottom: 100, center: 50, middle: 50}
    );

    assert(labelPos, 'Should still find position avoiding overlap');
});

// ============================================
// Section 4: Colorbar
// ============================================
section('4. Colorbar Tests');

test('4.1: Colorbar computation', function() {
    var grid = [[1, 2, 3], [2, 3, 4], [3, 4, 5]];
    var result = ContourCore.computeContours({z: grid}, {autocontour: true, ncontours: 5});
    var colorbar = ContourCore.colorbar.computeColorbar(result, {
        zmin: 1,
        zmax: 5
    });

    assert(colorbar, 'Colorbar should be computed');
    assert(colorbar.levels, 'Should have levels');
    assert(colorbar.colors, 'Should have colors');
});

test('4.2: Colorbar tick computation', function() {
    var grid = [[0, 1, 2], [1, 2, 3], [2, 3, 4]];
    var result = ContourCore.computeContours({z: grid});
    var colorbar = ContourCore.colorbar.computeColorbar(result, {});
    var ticks = ContourCore.colorbar.computeTicks(colorbar, {nticks: 5});

    assert(ticks, 'Ticks should be computed');
    assert(ticks.length > 0, 'Should have ticks');
});

test('4.3: Color mapping', function() {
    var color = ContourCore.colorbar.mapColors(5, 0, 10, 'Viridis');
    assert(color, 'Should map color');
    assert(color.startsWith('#'), 'Color should be hex');
});

test('4.4: Preset color scales', function() {
    assert(ContourCore.COLOR_SCALES.Viridis, 'Should have Viridis');
    assert(ContourCore.COLOR_SCALES.Plasma, 'Should have Plasma');
    assert(ContourCore.COLOR_SCALES.Hot, 'Should have Hot');
    assertEqual(ContourCore.COLOR_SCALES.Viridis.length, 10, 'Viridis should have 10 colors');
});

// ============================================
// Section 5: Canvas Renderer
// ============================================
section('5. Canvas Renderer Tests');

test('5.1: Canvas renderer API exists', function() {
    assert(ContourCore.renderers.canvas, 'Canvas renderer should exist');
    assert(ContourCore.renderers.canvas.drawContours, 'Should have drawContours');
    assert(ContourCore.renderers.canvas.drawLabels, 'Should have drawLabels');
    assert(ContourCore.renderers.canvas.drawColorbar, 'Should have drawColorbar');
});

// ============================================
// Section 6: SVG Renderer
// ============================================
section('6. SVG Renderer Tests');

test('6.1: SVG renderer API exists', function() {
    assert(ContourCore.renderers.svg, 'SVG renderer should exist');
    assert(ContourCore.renderers.svg.renderSVG, 'Should have renderSVG');
    assert(ContourCore.renderers.svg.createFilledPaths, 'Should have createFilledPaths');
    assert(ContourCore.renderers.svg.createStrokePaths, 'Should have createStrokePaths');
});

test('6.2: SVG generation', function() {
    var grid = [[1, 2, 3], [2, 3, 4], [3, 4, 5]];
    var result = ContourCore.computeContours({z: grid});
    var svg = ContourCore.renderers.svg.renderSVG(result, {
        width: 500,
        height: 400,
        coloring: 'fill',
        colorscale: 'Viridis'
    });

    assert(svg, 'SVG should be generated');
    assert(svg.includes('<svg'), 'Should be valid SVG');
    assert(svg.includes('</svg>'), 'Should have closing tag');
    assert(svg.includes('<path'), 'Should contain paths');
});

test('6.3: SVG with labels', function() {
    // Generate larger grid for label testing
    var grid = [];
    for(var i = 0; i < 25; i++) {
        grid[i] = [];
        for(var j = 0; j < 30; j++) {
            grid[i][j] = Math.sin(i * 0.3) * Math.cos(j * 0.3) * 10 + i + j;
        }
    }
    var result = ContourCore.computeContours({z: grid}, {ncontours: 5});
    var svg = ContourCore.renderers.svg.renderSVG(result, {
        width: 500,
        height: 400,
        coloring: 'lines',
        showLabels: true
    });

    assert(svg.includes('<text'), 'SVG should contain text labels');
});

test('6.4: SVG with colorbar', function() {
    var grid = [[1, 2, 3], [2, 3, 4], [3, 4, 5]];
    var result = ContourCore.computeContours({z: grid});
    var svg = ContourCore.renderers.svg.renderSVG(result, {
        width: 500,
        height: 400,
        coloring: 'fill',
        colorbar: true
    });

    assert(svg.includes('<linearGradient'), 'SVG should have gradient for colorbar');
});

test('6.5: SVG with null regions', function() {
    var grid = [[null, 1, 2], [1, null, 3], [2, 3, 4]];
    var result = ContourCore.computeContours({z: grid});
    var svg = ContourCore.renderers.svg.renderSVG(result, {
        width: 400,
        height: 300,
        nullRegion: {visible: true, fill: '#fff', stroke: '#ccc'}
    });

    assert(svg.includes('<rect'), 'SVG should have rectangles for null regions');
});

// ============================================
// Section 7: API Integration
// ============================================
section('7. API Integration Tests');

test('7.1: Simplified render API', function() {
    // Test that the API exists (actual canvas rendering needs browser)
    assert(ContourCore.render, 'Should have render function');
    assert(ContourCore.drawTo, 'Should have drawTo function');
});

test('7.2: All module exports', function() {
    // Check all expected exports exist
    assert(ContourCore.computeContours, 'Should export computeContours');
    assert(ContourCore.scalePathsToData, 'Should export scalePathsToData');
    assert(ContourCore.nullHandling, 'Should export nullHandling');
    assert(ContourCore.labels, 'Should export labels');
    assert(ContourCore.colorbar, 'Should export colorbar');
    assert(ContourCore.renderers, 'Should export renderers');
    assert(ContourCore.COLOR_SCALES, 'Should export COLOR_SCALES');
});

test('7.3: Low-level modules', function() {
    assert(ContourCore.marchingSquares, 'Should export marchingSquares');
    assert(ContourCore.pathFinding, 'Should export pathFinding');
    assert(ContourCore.levels, 'Should export levels');
    assert(ContourCore.smooth, 'Should export smooth');
    assert(ContourCore.constants, 'Should export constants');
});

// ============================================
// Section 8: Edge Cases
// ============================================
section('8. Edge Cases Tests');

test('8.1: Single cell grid (minimum)', function() {
    var grid = [[1, 2], [2, 3]];
    var result = ContourCore.computeContours({z: grid});

    assert(result, 'Should handle minimum grid size');
});

test('8.2: Large grid performance', function() {
    var m = 50, n = 50;
    var grid = [];
    for (var i = 0; i < m; i++) {
        grid[i] = [];
        for (var j = 0; j < n; j++) {
            grid[i][j] = i + j;
        }
    }

    var start = Date.now();
    var result = ContourCore.computeContours({z: grid}, {ncontours: 10});
    var elapsed = Date.now() - start;

    assert(result, 'Should handle large grid');
    assert(elapsed < 5000, 'Should complete in reasonable time (< 5s), took ' + elapsed + 'ms');
});

test('8.3: Constant grid (all same values)', function() {
    var grid = [[5, 5, 5], [5, 5, 5], [5, 5, 5]];
    var result = ContourCore.computeContours({z: grid}, {autocontour: true, ncontours: 5});

    assert(result, 'Should handle constant grid');
});

test('8.4: Very high precision values', function() {
    var grid = [[1.123456789, 2.987654321], [2.5, 3.5]];
    var result = ContourCore.computeContours({z: grid});

    assert(result, 'Should handle high precision values');
});

// ============================================
// Summary
// ============================================
section('Test Summary');

console.log('\n' + colors.green + 'Tests Passed: ' + testsPassed + colors.reset);
console.log(colors.red + 'Tests Failed: ' + testsFailed + colors.reset);
console.log('Total Tests: ' + (testsPassed + testsFailed));

if (testsFailed === 0) {
    console.log('\n' + colors.green + '╔══════════════════════════════════════════════════════╗' + colors.reset);
    console.log(colors.green + '║           🎉 ALL TESTS PASSED! 🎉                     ║' + colors.reset);
    console.log(colors.green + '╚══════════════════════════════════════════════════════╝' + colors.reset);
    process.exit(0);
} else {
    console.log('\n' + colors.red + '╔══════════════════════════════════════════════════════╗' + colors.reset);
    console.log(colors.red + '║           ❌ SOME TESTS FAILED ❌                      ║' + colors.reset);
    console.log(colors.red + '╚══════════════════════════════════════════════════════╝' + colors.reset);
    process.exit(1);
}
