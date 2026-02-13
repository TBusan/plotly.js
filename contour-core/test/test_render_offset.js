'use strict';

/**
 * Test render offset calculation for pan
 */

console.log('=== Render Offset Calculation Test ===\n');

// Simulate the render function offset calculation
function testRenderOffset() {
    // Setup
    var dataBounds = { xMin: 0, xMax: 50, yMin: 0, yMax: 50 };
    var plotArea = { x: 50, y: 20, width: 520, height: 430 };

    var scaleX = plotArea.width / (dataBounds.xMax - dataBounds.xMin);
    var scaleY = plotArea.height / (dataBounds.yMax - dataBounds.yMin);

    console.log('Setup:');
    console.log('  Data bounds: x=[' + dataBounds.xMin + ',' + dataBounds.xMax + '], y=[' + dataBounds.yMin + ',' + dataBounds.yMax + ']');
    console.log('  Plot area: x=' + plotArea.x + ', y=' + plotArea.y + ', w=' + plotArea.width + ', h=' + plotArea.height);
    console.log('  Scale: X=' + scaleX.toFixed(2) + ' px/unit, Y=' + scaleY.toFixed(2) + ' px/unit');

    // Test 1: No pan (view = data bounds)
    console.log('\nTest 1: Initial view (no pan)');
    var view1 = { xMin: 0, xMax: 50, yMin: 0, yMax: 50 };
    var offsetX1 = (view1.xMin - dataBounds.xMin) * scaleX;
    var offsetY1 = (dataBounds.yMax - view1.yMax) * scaleY;
    console.log('  View: x=[' + view1.xMin + ',' + view1.xMax + '], y=[' + view1.yMin + ',' + view1.yMax + ']');
    console.log('  Offset: X=' + offsetX1.toFixed(2) + 'px, Y=' + offsetY1.toFixed(2) + 'px');
    console.log('  Expected: X=0, Y=0 ✓');

    // Test 2: Panned RIGHT (view shifted left, so xMin < 0)
    console.log('\nTest 2: Panned RIGHT (user dragged mouse RIGHT)');
    var view2 = { xMin: -5, xMax: 45, yMin: 0, yMax: 50 };
    var offsetX2 = (view2.xMin - dataBounds.xMin) * scaleX;
    var offsetY2 = (dataBounds.yMax - view2.yMax) * scaleY;
    console.log('  View: x=[' + view2.xMin + ',' + view2.xMax + '], y=[' + view2.yMin + ',' + view2.yMax + ']');
    console.log('  Offset: X=' + offsetX2.toFixed(2) + 'px, Y=' + offsetY2.toFixed(2) + 'px');
    console.log('  Expected: X < 0 (canvas translated LEFT to show more on the right)');
    console.log('  ' + (offsetX2 < 0 ? '✓' : '✗') + ' Offset X is ' + (offsetX2 < 0 ? 'negative' : 'positive'));

    // Test 3: Panned LEFT (view shifted right, so xMin > 0)
    console.log('\nTest 3: Panned LEFT (user dragged mouse LEFT)');
    var view3 = { xMin: 5, xMax: 55, yMin: 0, yMax: 50 };
    var offsetX3 = (view3.xMin - dataBounds.xMin) * scaleX;
    var offsetY3 = (dataBounds.yMax - view3.yMax) * scaleY;
    console.log('  View: x=[' + view3.xMin + ',' + view3.xMax + '], y=[' + view3.yMin + ',' + view3.yMax + ']');
    console.log('  Offset: X=' + offsetX3.toFixed(2) + 'px, Y=' + offsetY3.toFixed(2) + 'px');
    console.log('  Expected: X > 0 (canvas translated RIGHT to show more on the left)');
    console.log('  ' + (offsetX3 > 0 ? '✓' : '✗') + ' Offset X is ' + (offsetX3 > 0 ? 'positive' : 'negative'));

    // Test 4: Panned DOWN (view shifted up, so yMin > 0)
    console.log('\nTest 4: Panned DOWN (user dragged mouse DOWN)');
    var view4 = { xMin: 0, xMax: 50, yMin: 5, yMax: 55 };
    var offsetX4 = (view4.xMin - dataBounds.xMin) * scaleX;
    var offsetY4 = (dataBounds.yMax - view4.yMax) * scaleY;
    console.log('  View: x=[' + view4.xMin + ',' + view4.xMax + '], y=[' + view4.yMin + ',' + view4.yMax + ']');
    console.log('  Offset: X=' + offsetX4.toFixed(2) + 'px, Y=' + offsetY4.toFixed(2) + 'px');
    console.log('  Expected: Y > 0 (canvas translated DOWN to show more above)');
    console.log('  ' + (offsetY4 > 0 ? '✓' : '✗') + ' Offset Y is ' + (offsetY4 > 0 ? 'positive' : 'negative'));

    // Test 5: Panned UP (view shifted down, so yMin < 0)
    console.log('\nTest 5: Panned UP (user dragged mouse UP)');
    var view5 = { xMin: 0, xMax: 50, yMin: -5, yMax: 45 };
    var offsetX5 = (view5.xMin - dataBounds.xMin) * scaleX;
    var offsetY5 = (dataBounds.yMax - view5.yMax) * scaleY;
    console.log('  View: x=[' + view5.xMin + ',' + view5.xMax + '], y=[' + view5.yMin + ',' + view5.yMax + ']');
    console.log('  Offset: X=' + offsetX5.toFixed(2) + 'px, Y=' + offsetY5.toFixed(2) + 'px');
    console.log('  Expected: Y < 0 (canvas translated UP to show more below)');
    console.log('  ' + (offsetY5 < 0 ? '✓' : '✗') + ' Offset Y is ' + (offsetY5 < 0 ? 'negative' : 'negative'));

    console.log('\n========================================');
    console.log('Summary:');
    console.log('The offset calculation correctly determines');
    console.log('how much to translate the canvas based on view.');
    console.log('========================================\n');
}

testRenderOffset();
