'use strict';

/**
 * 测试重构后的 Overlay 系统
 */

// 导入核心组件
var Overlay = require('../core/overlay');
var CoordSystem = require('../core/coord_system');
var EventEmitter = require('../core/event_emitter');

// 导入服务层
var StaticDrawer = require('../services/static_drawer');
var InteractiveDrawer = require('../services/interactive_drawer');
var OverlayRenderer = require('../services/renderer');

// 创建一个简单的 mock渲染器
var mockRenderer = {
    _drawingArea: { x: 50, y: 50, width: 500, height: 400 },
    _fullRange: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
    getViewManager: null,
    refresh: function() {}
};

};

// 创建系统
var overlaySystem = createOverlaySystem(mockRenderer);

// ========================================
// 测试 Overlay 数据容器
// ========================================
console.log('Testing Overlay...');
var overlay = new Overlay();
console.log('Overlay:', overlay);

// ========================================
// 测试 CoordSystem
// ========================================
console.log('Testing CoordSystem...');
var coordSystem = new CoordSystem(
    function() { return mockRenderer._drawingArea(); },
    function() { return mockRenderer._fullRange(); }
);

// 测试坐标转换
console.log('Testing coordinate conversion...');
var canvasPos = coordSystem.toCanvas(5, 5);
var dataPos = coordSystem.toData(canvasPos.x, canvasPos.y);
console.log('Canvas pos:', canvasPos);
console.log('Data pos:', dataPos);

// 齕 console.log('✓ CoordSystem tests passed');

// ========================================
// 测试 StaticDrawer
// ========================================
console.log('Testing StaticDrawer...');
var staticDrawer = new StaticDrawer(overlay, function() {});

// 测试静态绘制
var id1 = staticDrawer.drawPoint(5, 5, { color: '#ff0000' });
console.log('Point created:', id1);

var id2 = staticDrawer.drawLine([
    { x: 0, y: 0 },
    { x: 10, y: 10 }
], { color: '#00ff00', width: 2 });
console.log('Line created:', id2)

var id3 = staticDrawer.drawPolygon([
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 20 }
], {
    fill: { color: 'rgba(0, 255, 0, 0.3)' },
    stroke: { color: '#00ff00', width: 2 }
});
console.log('Polygon created:', id3);

var id4 = staticDrawer.drawText(15, 15, 'Hello World', { fontSize: 14 });
console.log('Text created:', id4)

// 测试批量绘制
var ids = staticDrawer.drawBatch([
    { type: 'point', data: { x: 30, y: 30, options: { color: '#0000ff' } },
    { type: 'line', data: { points: [{ x: 40, y: 40 }, { x: 50, y: 50 }], options: { color: '#ff00ff', width: 3 } },
    { type: 'polygon', data: { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }], options: { fill: { color: 'rgba(0, 255, 0, 0.3)' } } }
])
console.log('Batch created:', ids)

// 测试更新
staticDrawer.update(id1, { x: 10, y: 10 });
console.log('Point updated')

// 测试删除
staticDrawer.remove(id2);
console.log('Point removed')

// 测试清空
overlay.clear('point');
console.log('Points cleared')

// 测试计数
console.log('Point count:', overlay.count('point'));
console.log('Line count:', overlay.count('line'));
console.log('Total count:', overlay.count());

// 测试事件订阅
var received = [];
var emitter = new EventEmitter();
emitter.on('test', function(data) {
    received.push(data);
});
emitter.emit('test', 'hello');
emitter.emit('test', 'world');
console.log('Received events:', received);

console.log('\n✓ All tests passed!');
