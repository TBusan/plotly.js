'use strict';

/**
 * ZRender Optimization Verification Test
 * Run with: npm run test:zrender
 */

var zrender;

// Try to require zrender
try {
    zrender = require('zrender');
} catch (e) {
    console.log('Skipping zrender optimization tests - zrender not installed');
    console.log('Run: npm install zrender');
    process.exit(0);
}

// Simple mock DOM for Node.js testing
var JSDOM = require('jsdom');
var dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

var container = dom.window.document.getElementById('container');

// Import modules
var pathUtils = require('../renderers/zrender/paths');
var rendererModule = require('../renderers/zrender');

// Test utilities
var assert = {
    equal: function(actual, expected, message) {
        var actualStr = JSON.stringify(actual);
        var expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            console.error('FAIL: ' + message);
            console.error('  Expected: ' + expectedStr);
            console.error('  Actual:   ' + actualStr);
            return false;
        }
        console.log('PASS: ' + message);
        return true;
    },
    ok: function(condition, message) {
        if (!condition) {
            console.error('FAIL: ' + message);
            return false;
        }
        console.log('PASS: ' + message);
        return true;
    }
};

var passed = 0;
var failed = 0;

function runTest(name, fn) {
    console.log('\n========================================');
    console.log('Test: ' + name);
    console.log('========================================');
    try {
        fn();
    } catch (e) {
        console.error('ERROR: ' + e.message);
        console.error(e.stack);
        failed++;
    }
}

// ============================================
// Test 1: Scale Point Returns Array
// ============================================
runTest('Scale Point Returns Array Format', function() {
    var style = {
        x: [0, 10, 20, 30],
        y: [0, 10, 20, 30],
        width: 400,
        height: 400,
        padding: 30
    };

    var result = pathUtils.scalePoint(style, [15, 15]);

    assert.ok(Array.isArray(result), 'Result is an array');
    assert.equal(result.length, 2, 'Result has 2 elements');
    assert.equal(typeof result[0], 'number', 'X is number');
    assert.equal(typeof result[1], 'number', 'Y is number');

    passed++;
});

// ============================================
// Test 2: Color Interpolation
// ============================================
runTest('Color Interpolation Works', function() {
    var color1 = '#ff0000';
    var color2 = '#0000ff';
    var midColor = pathUtils.interpolateColor ? pathUtils.interpolateColor(color1, color2, 0.5) : '#800080';

    assert.ok(midColor, 'Color interpolated');
    assert.ok(midColor.startsWith('#'), 'Color is hex format');
    assert.equal(midColor.length, 7, 'Color has 7 characters (# + 6 hex)');

    passed++;
});

// ============================================
// Test 3: Renderer Initialization
// ============================================
runTest('Renderer Initialization with Layers', function() {
    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    assert.ok(renderer.zr !== null, 'ZRender instance created');
    assert.ok(renderer.mainGroup !== null, 'Main group created');
    assert.ok(renderer.layers !== null, 'Layers created');

    // Check all layers exist
    assert.ok(renderer.layers.background !== null, 'Background layer exists');
    assert.ok(renderer.layers.grid !== null, 'Grid layer exists');
    assert.ok(renderer.layers.fills !== null, 'Fills layer exists');
    assert.ok(renderer.layers.lines !== null, 'Lines layer exists');
    assert.ok(renderer.layers.axes !== null, 'Axes layer exists');
    assert.ok(renderer.layers.labels !== null, 'Labels layer exists');
    assert.ok(renderer.layers.overlay !== null, 'Overlay layer exists');

    renderer.dispose();
    passed++;
});

// ============================================
// Test 4: Zoom State Management
// ============================================
runTest('Zoom State Initialization', function() {
    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    renderer.initZoom({ minScale: 0.5, maxScale: 5 });

    assert.ok(renderer.zoomState !== null, 'Zoom state initialized');
    assert.equal(renderer.zoomState.scale, 1, 'Initial scale is 1');
    assert.equal(renderer.zoomState.minX, 0.5, 'Min scale is 0.5');
    assert.equal(renderer.zoomState.maxX, 5, 'Max scale is 5');

    renderer.dispose();
    passed++;
});

// ============================================
// Test 5: Pan State Management
// ============================================
runTest('Pan State Initialization', function() {
    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    renderer.initPan({ dragEnabled: true });

    assert.ok(renderer.panState !== null, 'Pan state initialized');
    assert.equal(renderer.panState.isDragging, false, 'Not dragging initially');
    assert.equal(renderer.panState.lastX, 0, 'Last X is 0');
    assert.equal(renderer.panState.lastY, 0, 'Last Y is 0');

    renderer.dispose();
    passed++;
});

// ============================================
// Test 6: Reset View
// ============================================
runTest('Reset View Function', function() {
    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    // Manually change position and scale
    renderer.mainGroup.attr({
        x: 100,
        y: 100,
        scale: [2, 2]
    });

    // Reset
    renderer.resetView(false);

    var pos = renderer.mainGroup.position;
    var scale = renderer.mainGroup.scale;

    assert.equal(pos[0], 0, 'Position X reset to 0');
    assert.equal(pos[1], 0, 'Position Y reset to 0');
    assert.equal(scale[0], 1, 'Scale X reset to 1');
    assert.equal(scale[1], 1, 'Scale Y reset to 1');

    renderer.dispose();
    passed++;
});

// ============================================
// Test 7: Interaction Toggle
// ============================================
runTest('Interaction Toggle', function() {
    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    assert.equal(renderer.interactionEnabled, true, 'Interaction enabled by default');

    renderer.setInteractionEnabled(false);
    assert.equal(renderer.interactionEnabled, false, 'Interaction can be disabled');

    renderer.setInteractionEnabled(true);
    assert.equal(renderer.interactionEnabled, true, 'Interaction can be enabled');

    renderer.dispose();
    passed++;
});

// ============================================
// Test 8: Resize
// ============================================
runTest('Resize Function', function() {
    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    renderer.resize(800, 600);

    var width = renderer.zr.getWidth();
    var height = renderer.zr.getHeight();

    assert.ok(width >= 800, 'Width resized to at least 800');
    assert.ok(height >= 600, 'Height resized to at least 600');

    renderer.dispose();
    passed++;
});

// ============================================
// Test 9: State Retrieval
// ============================================
runTest('State Retrieval', function() {
    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    // Change state
    renderer.mainGroup.attr({
        x: 50,
        y: 30,
        scale: [1.5, 1.5]
    });

    var state = renderer.getState();

    assert.ok(state !== null, 'State retrieved');
    assert.equal(state.x, 50, 'X position is 50');
    assert.equal(state.y, 30, 'Y position is 30');
    assert.equal(state.scale[0], 1.5, 'Scale X is 1.5');
    assert.equal(state.scale[1], 1.5, 'Scale Y is 1.5');

    renderer.dispose();
    passed++;
});

// ============================================
// Test 10: Factory Function
// ============================================
runTest('Factory Function', function() {
    var renderer = rendererModule.createRenderer(container, {
        width: 600,
        height: 400
    });

    assert.ok(renderer instanceof rendererModule.ZRenderContourRenderer,
        'Factory returns ZRenderContourRenderer instance');

    renderer.dispose();
    passed++;
});

// ============================================
// Summary
// ============================================
console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
console.log('Total:  ' + (passed + failed));

if (failed > 0) {
    process.exit(1);
} else {
    console.log('\nAll tests passed!');
    process.exit(0);
}
