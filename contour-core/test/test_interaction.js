'use strict';

/**
 * Test interaction layer components
 */

var assert = require('assert');
var interaction = require('../interaction');

// Mock document for Node.js environment
var mockDocument = {
    addEventListener: function() {},
    removeEventListener: function() {},
    querySelector: function() {
        return {
            addEventListener: function() {},
            removeEventListener: function() {}
        };
    }
};

console.log('Testing interaction layer...\n');

// ============================================
// Test EventManager
// ============================================
console.log('1. Testing EventManager...');

var eventManager = new interaction.EventManager();

var callCount = 0;
function testHandler() {
    callCount++;
}

// Test on
eventManager.on(mockDocument, 'test', testHandler);
assert.strictEqual(eventManager.getListenerCount(), 1, 'Should have 1 listener');

// Test pause/resume
eventManager.pause();
assert.strictEqual(eventManager.isPaused(), true, 'Should be paused');

eventManager.resume();
assert.strictEqual(eventManager.isPaused(), false, 'Should be resumed');

// Test destroy
eventManager.destroy();
assert.strictEqual(eventManager.getListenerCount(), 0, 'Should have 0 listeners after destroy');

console.log('   EventManager: OK\n');

// ============================================
// Test StateManager
// ============================================
console.log('2. Testing StateManager...');

var stateManager = new interaction.StateManager({
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100
});

// Test initial state
var view = stateManager.getViewRange();
assert.strictEqual(view.xMin, 0, 'Initial xMin should be 0');
assert.strictEqual(view.xMax, 100, 'Initial xMax should be 100');

// Test update
stateManager.update({
    view: { xMin: 10, xMax: 90, yMin: 10, yMax: 90 }
});
view = stateManager.getViewRange();
assert.strictEqual(view.xMin, 10, 'Updated xMin should be 10');

// Test reset
stateManager.reset();
view = stateManager.getViewRange();
assert.strictEqual(view.xMin, 0, 'Reset xMin should be 0');

// Clear history for testing
stateManager.clearHistory();

// Test history
assert.strictEqual(stateManager.canUndo(), false, 'Should not be able to undo yet');
stateManager.update({ view: { xMin: 5, xMax: 95, yMin: 5, yMax: 95 } });
assert.strictEqual(stateManager.canUndo(), true, 'Should be able to undo now');

stateManager.undo();
view = stateManager.getViewRange();
assert.strictEqual(view.xMin, 0, 'After undo, xMin should be 0');

console.log('   StateManager: OK\n');

// ============================================
// Test CoordinateConverter
// ============================================
console.log('3. Testing CoordinateConverter...');

var converter = new interaction.CoordinateConverter({
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    width: 600,
    height: 500,
    margins: { left: 50, right: 30, top: 20, bottom: 50 }
});

// Test data to pixel conversion
var pixel = converter.dataToPixel(50, 50);
assert(pixel.x >= 0, 'Pixel x should be valid');
assert(pixel.y >= 0, 'Pixel y should be valid');

// Test pixel to data conversion
var data = converter.pixelToData(pixel.x, pixel.y);
assert(Math.abs(data.x - 50) < 0.1, 'Data x should be close to 50');
assert(Math.abs(data.y - 50) < 0.1, 'Data y should be close to 50');

// Test plot area
var plotArea = converter.getPlotArea();
assert(plotArea.width > 0, 'Plot area width should be positive');
assert(plotArea.height > 0, 'Plot area height should be positive');

console.log('   CoordinateConverter: OK\n');

// ============================================
// Test ZoomHandler
// ============================================
console.log('4. Testing ZoomHandler...');

var zoomHandler = new interaction.ZoomHandler({
    minScale: 0.5,
    maxScale: 10
});

// Test box zoom state
var boxState = zoomHandler.startBoxZoom({ offsetX: 100, offsetY: 100 }, stateManager);
assert(boxState !== null, 'Box zoom state should be created');
assert.strictEqual(boxState.active, true, 'Box zoom should be active');

// Test cancel
boxState = zoomHandler.cancelBoxZoom();
assert.strictEqual(boxState.active, false, 'Box zoom should be cancelled');

// Test zoom by factor
var zoomResult = zoomHandler.zoomByFactor(2, { x: 50, y: 50 }, stateManager);
assert(zoomResult.view !== undefined, 'Zoom result should have view');

console.log('   ZoomHandler: OK\n');

// ============================================
// Test PanHandler
// ============================================
console.log('5. Testing PanHandler...');

var panHandler = new interaction.PanHandler();

// Test start pan
var panState = panHandler.startPan({ clientX: 100, clientY: 100 }, stateManager);
assert(panState !== null, 'Pan state should be created');
assert.strictEqual(panState.active, true, 'Pan should be active');

// Test is panning
assert.strictEqual(panHandler.isPanning(panState), true, 'Should be panning');

// Test pan by
var panResult = panHandler.panBy(10, 10, stateManager);
assert(panResult.view !== undefined, 'Pan result should have view');

console.log('   PanHandler: OK\n');

// ============================================
// Test HoverHandler
// ============================================
console.log('6. Testing HoverHandler...');

var hoverHandler = new interaction.HoverHandler();

// Test set grid data
hoverHandler.setGridData({
    x: [0, 1, 2],
    y: [0, 1, 2],
    z: [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
});

// Test format tooltip
var mockHoverData = {
    data: { x: 1.5, y: 1.5, z: 5 }
};
var tooltip = hoverHandler.formatTooltip(mockHoverData);
assert(tooltip.indexOf('x:') !== -1, 'Tooltip should contain x');
assert(tooltip.indexOf('y:') !== -1, 'Tooltip should contain y');
assert(tooltip.indexOf('z:') !== -1, 'Tooltip should contain z');

// Test clamp tooltip position
var clamped = hoverHandler.clampTooltipPosition(590, 490, 100, 50, 600, 500);
assert(clamped.x >= 0, 'Clamped x should be valid');
assert(clamped.y >= 0, 'Clamped y should be valid');
assert(clamped.x + 100 <= 600, 'Clamped tooltip should fit in width');

console.log('   HoverHandler: OK\n');

// ============================================
// Summary
// ============================================
console.log('========================================');
console.log('All interaction tests passed! ✓');
console.log('========================================\n');
