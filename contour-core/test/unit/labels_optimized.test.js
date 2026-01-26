'use strict';

/**
 * Unit tests for optimized label placement algorithm
 * Tests the complete implementation based on Plotly's algorithm
 */

var findBestTextLocation = require('../../labels').findBestTextLocation;
var locationCost = require('../../labels').locationCost;
var formatContourLabel = require('../../labels').formatContourLabel;

console.log('=== Optimized Labels Unit Tests ===\n');

var testsPassed = 0;
var testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✓ ' + name);
        testsPassed++;
    } catch (e) {
        console.log('✗ ' + name + ': ' + e.message);
        testsFailed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertApproxEqual(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error((message || '') + ' expected: ' + expected + ' ± ' + tolerance + ', actual: ' + actual);
    }
}

// ============================================
// Test 1: Basic Label Position
// ============================================
test('1.1: Find position on straight path', function() {
    var path = [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]];
    var pos = findBestTextLocation(path, {level: 5, width: 10, height: 20}, [], {});

    assert(pos !== null, 'Should find position');
    assert(typeof pos.x === 'number', 'Should have x coordinate');
    assert(typeof pos.y === 'number', 'Should have y coordinate');
    assertApproxEqual(pos.y, 0, 0.1, 'Y should be close to 0 (straight line)');
    assertApproxEqual(Math.abs(pos.theta), 0, 0.1, 'Theta should be ~0 (horizontal)');
});

// ============================================
// Test 2: Diagonal Path
// ============================================
test('2.1: Find position on diagonal path', function() {
    var path = [[0, 0], [10, 10], [20, 20], [30, 30]];
    var pos = findBestTextLocation(path, {level: 1, width: 10, height: 20}, [], {});

    assert(pos !== null, 'Should find position');
    assertApproxEqual(pos.theta, Math.PI / 4, 0.2, 'Theta should be ~45 degrees');
});

// ============================================
// Test 3: Overlap Avoidance
// ============================================
test('3.1: Avoid existing labels', function() {
    var path = [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]];

    // Add existing label in middle
    var existingLabels = [{
        x: 20,
        y: 0,
        theta: 0,
        width: 30,
        height: 15,
        level: 1
    }];

    var pos = findBestTextLocation(
        path,
        {level: 2, width: 30, height: 15},
        existingLabels,
        {left: 0, right: 40, top: -20, bottom: 20, center: 20, middle: 0}
    );

    assert(pos !== null, 'Should find position avoiding overlap');
    // Position should be different from existing label
    var dist = Math.sqrt(Math.pow(pos.x - 20, 2) + Math.pow(pos.y - 0, 2));
    assert(dist > 10, 'Position should be at least 10 units away from existing label');
});

// ============================================
// Test 4: Edge Avoidance
// ============================================
test('4.1: Avoid plot edges', function() {
    var path = [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]];
    var bounds = {left: 5, right: 35, top: -20, bottom: 20, center: 20, middle: 0};

    var pos = findBestTextLocation(
        path,
        {level: 1, width: 20, height: 15},
        [],
        bounds
    );

    assert(pos !== null, 'Should find position');
    // Position should be within bounds (with margin)
    assert(pos.x > bounds.left + 5, 'Should avoid left edge');
    assert(pos.x < bounds.right - 5, 'Should avoid right edge');
});

// ============================================
// Test 5: Cost Function
// ============================================
test('5.1: Edge cost calculation', function() {
    var loc = {x: 50, y: 50, theta: 0};
    var bounds = {left: 0, right: 100, top: 0, bottom: 100, center: 50, middle: 50};

    var cost = locationCost(
        loc,
        {width: 40, height: 20, level: 1},
        [],
        bounds
    );

    assert(typeof cost === 'number', 'Cost should be a number');
    assert(cost < Infinity, 'Cost should be finite for valid position');
    assert(cost > 0, 'Cost should be positive');
});

test('5.2: High cost at edges', function() {
    var loc = {x: 5, y: 50, theta: 0}; // Near left edge
    var bounds = {left: 0, right: 100, top: 0, bottom: 100, center: 50, middle: 50};

    var cost = locationCost(
        loc,
        {width: 40, height: 20, level: 1},
        [],
        bounds
    );

    assert(cost === Infinity || cost > 100, 'Cost should be high near edges');
});

test('5.3: Angle penalty', function() {
    var bounds = {left: 0, right: 100, top: 0, bottom: 100, center: 50, middle: 50};

    var cost1 = locationCost(
        {x: 50, y: 50, theta: 0}, // Horizontal
        {width: 40, height: 20, level: 1},
        [],
        bounds
    );

    var cost2 = locationCost(
        {x: 50, y: 50, theta: Math.PI / 2}, // Vertical
        {width: 40, height: 20, level: 1},
        [],
        bounds
    );

    assert(cost1 < cost2, 'Horizontal labels should have lower cost than vertical');
});

test('5.4: Neighbor penalty', function() {
    var loc = {x: 50, y: 50, theta: 0};
    var bounds = {left: 0, right: 100, top: 0, bottom: 100, center: 50, middle: 50};

    var existingLabels = [{
        x: 55,
        y: 50,
        theta: 0,
        width: 30,
        height: 15,
        level: 2
    }];

    var costWithNeighbor = locationCost(
        loc,
        {width: 40, height: 20, level: 1},
        existingLabels,
        bounds
    );

    var costWithoutNeighbor = locationCost(
        loc,
        {width: 40, height: 20, level: 1},
        [],
        bounds
    );

    assert(costWithNeighbor > costWithoutNeighbor, 'Cost should be higher with nearby labels');
});

test('5.5: Same-level penalty', function() {
    var loc = {x: 50, y: 50, theta: 0};
    var bounds = {left: 0, right: 100, top: 0, bottom: 100, center: 50, middle: 50};

    var sameLevelLabels = [{
        x: 60,
        y: 50,
        theta: 0,
        width: 20,
        height: 15,
        level: 1
    }];

    var differentLevelLabels = [{
        x: 60,
        y: 50,
        theta: 0,
        width: 20,
        height: 15,
        level: 2
    }];

    var costSameLevel = locationCost(
        loc,
        {width: 40, height: 20, level: 1},
        sameLevelLabels,
        bounds
    );

    var costDifferentLevel = locationCost(
        loc,
        {width: 40, height: 20, level: 1},
        differentLevelLabels,
        bounds
    );

    assert(costSameLevel > costDifferentLevel, 'Same-level labels should have higher penalty');
});

// ============================================
// Test 6: Label Formatting
// ============================================
test('6.1: Format to fixed decimals', function() {
    assert(formatContourLabel(5.1234, '.2f') === '5.12', 'Should format to 2 decimals');
    assert(formatContourLabel(5.1234, '.1f') === '5.1', 'Should format to 1 decimal');
    assert(formatContourLabel(5.1234, '.0f') === '5', 'Should format to 0 decimals');
});

test('6.2: Format with sign', function() {
    assert(formatContourLabel(5.1, '+.1f') === '+5.1', 'Should show positive sign');
    assert(formatContourLabel(-5.1, '+.1f') === '-5.1', 'Should show negative sign');
});

test('6.3: Format percentage', function() {
    assert(formatContourLabel(0.567, '.0%') === '57%', 'Should format as percentage');
});

// ============================================
// Test 7: Edge Cases
// ============================================
test('7.1: Handle very short paths', function() {
    var path = [[0, 0], [1, 0]];
    var pos = findBestTextLocation(path, {level: 1, width: 50, height: 20}, [], {});

    // Should still return a position (fallback to middle)
    assert(pos !== null, 'Should handle short paths');
});

test('7.2: Handle single point path', function() {
    var path = [[5, 5]];
    var pos = findBestTextLocation(path, {level: 1, width: 10, height: 20}, [], {});

    // Single point paths should return null or a reasonable fallback
    assert(pos === null || pos.x === 5, 'Should handle single point gracefully');
});

test('7.3: Handle empty path', function() {
    var path = [];
    var pos = findBestTextLocation(path, {level: 1, width: 10, height: 20}, [], {});

    assert(pos === null, 'Should return null for empty path');
});

test('7.4: Handle null path', function() {
    var pos = findBestTextLocation(null, {level: 1, width: 10, height: 20}, [], {});

    assert(pos === null, 'Should return null for null path');
});

// ============================================
// Test 8: Complex Path Scenarios
// ============================================
test('8.1: Curved path', function() {
    var path = [];
    for (var i = 0; i <= 20; i++) {
        var x = i * 2;
        var y = Math.sin(i * 0.3) * 10;
        path.push([x, y]);
    }

    var pos = findBestTextLocation(path, {level: 1, width: 15, height: 20}, [], {});

    assert(pos !== null, 'Should find position on curved path');
    assert(pos.theta !== undefined, 'Should calculate angle for curved path');
});

test('8.2: Circular path', function() {
    var path = [];
    for (var i = 0; i < 36; i++) {
        var angle = i * Math.PI * 2 / 36;
        path.push([Math.cos(angle) * 10, Math.sin(angle) * 10]);
    }

    var pos = findBestTextLocation(path, {level: 1, width: 10, height: 20}, [], {});

    assert(pos !== null, 'Should find position on circular path');
});

// ============================================
// Test 9: Multiple Labels Optimization
// ============================================
test('9.1: Optimize multiple labels on same path', function() {
    var path = [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0], [50, 0], [60, 0], [70, 0]];
    var bounds = {left: 0, right: 70, top: -20, bottom: 20, center: 35, middle: 0};

    var labels = [];
    for (var i = 0; i < 3; i++) {
        var pos = findBestTextLocation(
            path,
            {level: 1, width: 15, height: 15},
            labels,
            bounds
        );

        if (pos) {
            labels.push({
                x: pos.x,
                y: pos.y,
                theta: pos.theta,
                width: 15,
                height: 15,
                level: 1
            });
        }
    }

    // Should place multiple labels without complete overlap
    assert(labels.length >= 2, 'Should place at least 2 labels');

    // Check minimum distance between labels
    for (var i = 0; i < labels.length - 1; i++) {
        for (var j = i + 1; j < labels.length; j++) {
            var dist = Math.sqrt(
                Math.pow(labels[i].x - labels[j].x, 2) +
                Math.pow(labels[i].y - labels[j].y, 2)
            );
            assert(dist > 5, 'Labels should not overlap (dist > 5)');
        }
    }
});

// ============================================
// Summary
// ============================================
console.log('\n=== Test Summary ===');
console.log('Passed: ' + testsPassed);
console.log('Failed: ' + testsFailed);
console.log('Total: ' + (testsPassed + testsFailed));

if (testsFailed === 0) {
    console.log('\n✅ All optimized label tests passed!');
} else {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
}
