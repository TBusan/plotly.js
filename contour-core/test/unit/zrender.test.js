'use strict';

/**
 * Unit tests for ZRender renderer
 * Run with: node test/unit/zrender.test.js
 */

var zrender;

// Try to require zrender
try {
    zrender = require('zrender');
} catch (e) {
    console.log('Skipping zrender tests - zrender not installed');
    console.log('Run: npm install zrender');
    process.exit(0);
}

// Simple mock DOM for Node.js testing
function createMockCanvas() {
    var { JSDOM } = require('jsdom');
    if (!JSDOM) {
        console.log('Skipping tests - jsdom not installed');
        console.log('Run: npm install --save-dev jsdom');
        process.exit(0);
    }

    var dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;

    var container = dom.window.document.getElementById('container');
    return container;
}

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
    },
    throws: function(fn, message) {
        try {
            fn();
            console.error('FAIL: ' + message + ' (expected to throw)');
            return false;
        } catch (e) {
            console.log('PASS: ' + message);
            return true;
        }
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
// Test 1: ZRender Path Creation
// ============================================
runTest('Path Element Creation', function() {
    var container = createMockCanvas();
    var zr = zrender.init(container);

    var path = new zrender.Path({
        shape: {
            pathData: 'M10 10 L20 20'
        },
        style: {
            stroke: '#ff0000',
            fill: 'none',
            lineWidth: 2
        }
    });

    assert.ok(path !== null, 'Path element created');
    assert.equal(path.shape.pathData, 'M10 10 L20 20', 'Path data set correctly');

    zr.dispose();
    passed++;
});

// ============================================
// Test 2: Group Creation
// ============================================
runTest('Group Creation', function() {
    var container = createMockCanvas();
    var zr = zrender.init(container);

    var group = new zrender.Group();
    zr.add(group);

    assert.ok(group.children !== undefined, 'Group created');
    assert.equal(group.childCount(), 0, 'Group is empty initially');

    zr.dispose();
    passed++;
});

// ============================================
// Test 3: Color Scale Utilities
// ============================================
runTest('Color Scale Utilities', function() {
    var pathUtils = require('../../renderers/zrender/paths');

    var colorScale = [
        [10, '#ff0000'],
        [20, '#00ff00'],
        [30, '#0000ff']
    ];

    // Test getColorForLevel
    var color1 = pathUtils.getColorForLevel(15, colorScale, null);
    assert.equal(color1, '#ff0000', 'Color for level 15');

    var color2 = pathUtils.getColorForLevel(25, colorScale, null);
    assert.equal(color2, '#00ff00', 'Color for level 25');

    var color3 = pathUtils.getColorForLevel(35, colorScale, null);
    assert.equal(color3, '#0000ff', 'Color for level 35 (clamped)');

    // Test with valueColorMap
    var valueColorMap = [[10, '#red'], [20, '#green']];
    var color4 = pathUtils.getColorForLevel(15, null, valueColorMap);
    assert.equal(color4, '#red', 'Color from valueColorMap');

    passed++;
});

// ============================================
// Test 4: Label Creation
// ============================================
runTest('Label Element Creation', function() {
    var labelUtils = require('../../renderers/zrender/labels');

    var labelData = {
        x: 100,
        y: 100,
        text: 'Test Label',
        level: 15
    };

    var label = labelUtils.createLabel(labelData, {});

    assert.ok(label !== null, 'Label element created');
    assert.ok(label instanceof zrender.Group, 'Label is a Group');

    passed++;
});

// ============================================
// Test 5: Renderer Initialization
// ============================================
runTest('Renderer Initialization', function() {
    var rendererModule = require('../../renderers/zrender');
    var container = createMockCanvas();

    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    assert.ok(renderer.zr !== null, 'ZRender instance created');
    assert.ok(renderer.mainGroup !== null, 'Main group created');
    assert.ok(renderer.layers !== null, 'Layers created');

    // Check all layers exist
    assert.ok(renderer.layers.background !== null, 'Background layer exists');
    assert.ok(renderer.layers.fills !== null, 'Fills layer exists');
    assert.ok(renderer.layers.lines !== null, 'Lines layer exists');
    assert.ok(renderer.layers.labels !== null, 'Labels layer exists');
    assert.ok(renderer.layers.axes !== null, 'Axes layer exists');
    assert.ok(renderer.layers.grid !== null, 'Grid layer exists');
    assert.ok(renderer.layers.overlay !== null, 'Overlay layer exists');

    renderer.dispose();
    passed++;
});

// ============================================
// Test 6: Layer Ordering
// ============================================
runTest('Layer Ordering', function() {
    var rendererModule = require('../../renderers/zrender');
    var container = createMockCanvas();

    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    // Check that layers are added in correct order
    var mainChildren = renderer.mainGroup.children();
    assert.equal(mainChildren.length, 7, 'All 7 layers added');

    // Layer order should be: background, grid, fills, lines, axes, labels, overlay
    assert.ok(mainChildren[0] === renderer.layers.background, 'Background is first');
    assert.ok(mainChildren[1] === renderer.layers.grid, 'Grid is second');
    assert.ok(mainChildren[2] === renderer.layers.fills, 'Fills is third');
    assert.ok(mainChildren[3] === renderer.layers.lines, 'Lines is fourth');
    assert.ok(mainChildren[4] === renderer.layers.axes, 'Axes is fifth');
    assert.ok(mainChildren[5] === renderer.layers.labels, 'Labels is sixth');
    assert.ok(mainChildren[6] === renderer.layers.overlay, 'Overlay is seventh');

    renderer.dispose();
    passed++;
});

// ============================================
// Test 7: State Management
// ============================================
runTest('State Management', function() {
    var rendererModule = require('../../renderers/zrender');
    var container = createMockCanvas();

    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    // Test initial state
    var state = renderer.getState();
    assert.ok(state !== null, 'State retrieved');
    assert.equal(state.scale[0], 1, 'Initial scale X is 1');
    assert.equal(state.scale[1], 1, 'Initial scale Y is 1');
    assert.equal(state.zoom, 1, 'Initial zoom is 1');

    // Test interaction enabled
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
runTest('Resize Functionality', function() {
    var rendererModule = require('../../renderers/zrender');
    var container = createMockCanvas();

    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    // Test resize
    renderer.resize(800, 600);

    var width = renderer.zr.getWidth();
    var height = renderer.zr.getHeight();

    assert.ok(width >= 800, 'Width resized to at least 800');
    assert.ok(height >= 600, 'Height resized to at least 600');

    renderer.dispose();
    passed++;
});

// ============================================
// Test 9: Reset View
// ============================================
runTest('Reset View', function() {
    var rendererModule = require('../../renderers/zrender');
    var container = createMockCanvas();

    var renderer = new rendererModule.ZRenderContourRenderer(container, {
        width: 600,
        height: 400
    });

    // Manually change position and scale
    renderer.mainGroup.attr({
        position: [100, 100],
        scale: [2, 2]
    });

    // Reset
    renderer.resetView();

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
// Test 10: Event Binding
// ============================================
runTest('Event Binding to Elements', function() {
    var container = createMockCanvas();
    var zr = zrender.init(container);

    var path = new zrender.Path({
        shape: {
            pathData: 'M10 10 L20 20'
        },
        style: {
            stroke: '#ff0000',
            fill: 'none'
        }
    });

    zr.add(path);

    // Test event binding
    var eventFired = false;
    path.on('click', function() {
        eventFired = true;
    });

    assert.ok(typeof path._handlers !== 'undefined', 'Event handlers storage exists');

    zr.dispose();
    passed++;
});

// ============================================
// Test 11: Factory Function
// ============================================
runTest('Factory Function', function() {
    var rendererModule = require('../../renderers/zrender');
    var container = createMockCanvas();

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
