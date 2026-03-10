# Overlay 绘图功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 contour-core 新增 Overlay 绘图模块，支持在等值线图上叠加绘制文字、点、线、面。

**Architecture:** 创建独立的 `renderers/canvas/overlay/` 模块，通过 `getOverlay()` 方法与现有渲染器集成。Overlay 存储数据坐标，渲染时自动转换为画布坐标。

**Tech Stack:** JavaScript (CommonJS), Canvas 2D API

**Design Doc:** `docs/plans/2026-03-09-overlay-drawing-design.md`

---

## Task 1: 创建 Overlay 管理器基础框架

**Files:**
- Create: `renderers/canvas/overlay/index.js`

**Step 1: 创建 Overlay 目录和管理器骨架**

```javascript
'use strict';

/**
 * Overlay Manager - 绘图叠加层管理器
 * 支持在等值线图上绘制文字、点、线、面
 */

var textDrawer = require('./text');
var pointDrawer = require('./point');
var lineDrawer = require('./line');
var polygonDrawer = require('./polygon');

/**
 * Overlay 构造函数
 * @param {Object} renderer - Canvas 渲染器实例
 */
function Overlay(renderer) {
    this._renderer = renderer;
    this._viewManager = renderer.getViewManager ? renderer.getViewManager() : null;

    // 存储各类型图形
    this._texts = [];
    this._points = [];
    this._lines = [];
    this._polygons = [];

    // 图形计数器（用于ID生成）
    this._idCounter = 0;
}

/**
 * 生成唯一ID
 */
Overlay.prototype._generateId = function() {
    return 'overlay_' + (++this._idCounter);
};

/**
 * 数据坐标转画布坐标
 * @param {number} x - 数据 x 坐标
 * @param {number} y - 数据 y 坐标
 * @returns {Object} {x, y} 画布坐标
 */
Overlay.prototype._toCanvasCoords = function(x, y) {
    if (!this._viewManager) {
        return { x: x, y: y };
    }
    return this._viewManager.dataToCanvas(x, y);
};

/**
 * 获取当前缩放比例
 */
Overlay.prototype._getScale = function() {
    if (!this._viewManager) return 1;
    return this._viewManager.getScale ? this._viewManager.getScale() : 1;
};

/**
 * 绘制文字
 */
Overlay.prototype.drawText = function(x, y, content, options) {
    var item = {
        id: this._generateId(),
        x: x,
        y: y,
        content: content,
        options: options || {}
    };
    this._texts.push(item);
    return item.id;
};

/**
 * 绘制点
 */
Overlay.prototype.drawPoint = function(x, y, options) {
    var item = {
        id: this._generateId(),
        x: x,
        y: y,
        options: options || {}
    };
    this._points.push(item);
    return item.id;
};

/**
 * 绘制线
 */
Overlay.prototype.drawLine = function(points, options) {
    var item = {
        id: this._generateId(),
        points: points,
        options: options || {}
    };
    this._lines.push(item);
    return item.id;
};

/**
 * 绘制面
 */
Overlay.prototype.drawPolygon = function(points, options) {
    var item = {
        id: this._generateId(),
        points: points,
        options: options || {}
    };
    this._polygons.push(item);
    return item.id;
};

/**
 * 清除图形
 * @param {string} type - 可选：'texts' | 'points' | 'lines' | 'polygons'
 */
Overlay.prototype.clear = function(type) {
    if (!type) {
        this._texts = [];
        this._points = [];
        this._lines = [];
        this._polygons = [];
    } else if (this['_' + type]) {
        this['_' + type] = [];
    }
};

/**
 * 渲染所有图形
 */
Overlay.prototype.render = function(ctx) {
    ctx = ctx || (this._renderer && this._renderer._ctx);

    if (!ctx) return;

    // 按顺序渲染：面 -> 线 -> 点 -> 文字
    polygonDrawer.render(ctx, this._polygons, this);
    lineDrawer.render(ctx, this._lines, this);
    pointDrawer.render(ctx, this._points, this);
    textDrawer.render(ctx, this._texts, this);
};

/**
 * 刷新（触发重绘）
 */
Overlay.prototype.refresh = function() {
    if (this._renderer && this._renderer.render) {
        this._renderer.render();
    }
};

module.exports = Overlay;
```

**Step 2: 创建占位模块文件**

创建以下空模块文件，确保主模块可以加载：

`renderers/canvas/overlay/text.js`:
```javascript
'use strict';

module.exports = {
    render: function(ctx, items, overlay) {
        // TODO: implement
    }
};
```

`renderers/canvas/overlay/point.js`:
```javascript
'use strict';

module.exports = {
    render: function(ctx, items, overlay) {
        // TODO: implement
    }
};
```

`renderers/canvas/overlay/line.js`:
```javascript
'use strict';

module.exports = {
    render: function(ctx, items, overlay) {
        // TODO: implement
    }
};
```

`renderers/canvas/overlay/polygon.js`:
```javascript
'use strict';

module.exports = {
    render: function(ctx, items, overlay) {
        // TODO: implement
    }
};
```

**Step 3: 验证模块加载**

```bash
cd D:\study\code\webgl\plotly.js\contour-core
node -e "var o = require('./renderers/canvas/overlay'); console.log('Overlay loaded:', typeof o)"
```

Expected: `Overlay loaded: function`

**Step 4: Commit**

```bash
git add renderers/canvas/overlay/
git commit -m "feat(overlay): add overlay manager skeleton"
```

---

## Task 2: 实现文字绘制模块

**Files:**
- Modify: `renderers/canvas/overlay/text.js`

**Step 1: 实现文字绘制**

```javascript
'use strict';

/**
 * 文字绘制模块
 */

var DEFAULTS = {
    fontSize: 12,
    fontFamily: 'Arial',
    fontWeight: 'normal',
    color: '#000000',
    rotation: 0,
    align: 'center',
    baseline: 'middle',
    background: null
};

/**
 * 合并选项与默认值
 */
function mergeOptions(options) {
    var result = {};
    for (var key in DEFAULTS) {
        result[key] = options[key] !== undefined ? options[key] : DEFAULTS[key];
    }
    return result;
}

/**
 * 绘制单个文字
 */
function drawText(ctx, x, y, content, options, overlay) {
    if (!content) return;

    var opts = mergeOptions(options);

    ctx.save();

    // 设置字体
    ctx.font = opts.fontWeight + ' ' + opts.fontSize + 'px ' + opts.fontFamily;
    ctx.fillStyle = opts.color;
    ctx.textAlign = opts.align;
    ctx.textBaseline = opts.baseline;

    // 移动到位置并旋转
    ctx.translate(x, y);
    if (opts.rotation) {
        ctx.rotate(opts.rotation);
    }

    // 绘制背景
    if (opts.background) {
        var metrics = ctx.measureText(content);
        var bgWidth = metrics.width + 6;
        var bgHeight = opts.fontSize + 4;
        ctx.fillStyle = opts.background;
        ctx.fillRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight);
        ctx.fillStyle = opts.color;
    }

    ctx.fillText(content, 0, 0);
    ctx.restore();
}

/**
 * 渲染所有文字
 */
function render(ctx, items, overlay) {
    if (!items || !items.length) return;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var canvasPos = overlay._toCanvasCoords(item.x, item.y);
        drawText(ctx, canvasPos.x, canvasPos.y, item.content, item.options, overlay);
    }
}

module.exports = {
    render: render,
    drawText: drawText,
    DEFAULTS: DEFAULTS
};
```

**Step 2: 测试文字绘制**

创建测试文件 `test/test_overlay_text.js`:
```javascript
'use strict';

var Overlay = require('../renderers/canvas/overlay');

// 模拟渲染器
var mockRenderer = {
    getViewManager: function() {
        return {
            dataToCanvas: function(x, y) {
                return { x: x * 10 + 50, y: y * 10 + 50 };
            },
            getScale: function() { return 1; }
        };
    }
};

var overlay = new Overlay(mockRenderer);

// 测试添加文字
var id = overlay.drawText(5, 5, '测试文字', { fontSize: 14, color: 'red' });
console.log('Text ID:', id);
console.log('Texts count:', overlay._texts.length);

// 测试坐标转换
var pos = overlay._toCanvasCoords(5, 5);
console.log('Canvas pos:', pos);

console.log('Text module test passed!');
```

运行测试：
```bash
cd D:\study\code\webgl\plotly.js\contour-core
node test/test_overlay_text.js
```

Expected: 无错误，显示测试通过

**Step 3: Commit**

```bash
git add renderers/canvas/overlay/text.js test/test_overlay_text.js
git commit -m "feat(overlay): implement text drawing module"
```

---

## Task 3: 实现形状绘制模块

**Files:**
- Create: `renderers/canvas/overlay/shapes.js`

**Step 1: 实现内置形状绘制**

```javascript
'use strict';

/**
 * 形状绘制模块
 * 支持圆形、方形、三角形、菱形及自定义形状
 */

/**
 * 绘制圆形
 */
function drawCircle(ctx, x, y, size) {
    var radius = size / 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
}

/**
 * 绘制方形
 */
function drawSquare(ctx, x, y, size) {
    var half = size / 2;
    ctx.beginPath();
    ctx.rect(x - half, y - half, size, size);
    ctx.closePath();
}

/**
 * 绘制三角形
 */
function drawTriangle(ctx, x, y, size) {
    var half = size / 2;
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + half, y + half);
    ctx.lineTo(x - half, y + half);
    ctx.closePath();
}

/**
 * 绘制菱形
 */
function drawDiamond(ctx, x, y, size) {
    var half = size / 2;
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + half, y);
    ctx.lineTo(x, y + half);
    ctx.lineTo(x - half, y);
    ctx.closePath();
}

/**
 * 绘制五角星
 */
function drawStar(ctx, x, y, size) {
    var outerRadius = size / 2;
    var innerRadius = outerRadius * 0.4;
    var points = 5;

    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
        var radius = i % 2 === 0 ? outerRadius : innerRadius;
        var angle = (i * Math.PI / points) - Math.PI / 2;
        var px = x + Math.cos(angle) * radius;
        var py = y + Math.sin(angle) * radius;
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
}

/**
 * 根据形状名称获取绘制函数
 */
function getShapeDrawer(shape) {
    var shapeMap = {
        'circle': drawCircle,
        'square': drawSquare,
        'triangle': drawTriangle,
        'diamond': drawDiamond,
        'star': drawStar
    };
    return shapeMap[shape] || drawCircle;
}

/**
 * 检查是否为自定义形状
 */
function isCustomShape(shape) {
    return typeof shape === 'object' && (shape.svg || shape.image);
}

module.exports = {
    drawCircle: drawCircle,
    drawSquare: drawSquare,
    drawTriangle: drawTriangle,
    drawDiamond: drawDiamond,
    drawStar: drawStar,
    getShapeDrawer: getShapeDrawer,
    isCustomShape: isCustomShape
};
```

**Step 2: Commit**

```bash
git add renderers/canvas/overlay/shapes.js
git commit -m "feat(overlay): add shape drawing functions"
```

---

## Task 4: 实现点绘制模块

**Files:**
- Modify: `renderers/canvas/overlay/point.js`

**Step 1: 实现点绘制**

```javascript
'use strict';

/**
 * 点绘制模块
 */

var shapes = require('./shapes');
var textDrawer = require('./text');

var DEFAULTS = {
    size: 8,
    color: '#ff0000',
    strokeColor: null,
    strokeWidth: 0,
    shape: 'circle'
};

/**
 * 合并选项
 */
function mergeOptions(options) {
    var result = {};
    for (var key in DEFAULTS) {
        result[key] = options[key] !== undefined ? options[key] : DEFAULTS[key];
    }
    return result;
}

/**
 * 绘制自定义图片形状
 */
function drawCustomImage(ctx, x, y, size, customShape, callback) {
    var img = new Image();
    var src = customShape.svg || customShape.image;

    img.onload = function() {
        ctx.drawImage(img, x - size/2, y - size/2, size, size);
        if (callback) callback();
    };

    img.onerror = function() {
        // 加载失败时绘制默认圆形
        shapes.drawCircle(ctx, x, y, size);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        if (callback) callback();
    };

    img.src = src;
}

/**
 * 绘制单个点
 */
function drawPoint(ctx, x, y, options, overlay) {
    var opts = mergeOptions(options);

    ctx.save();

    // 绘制形状
    if (shapes.isCustomShape(opts.shape)) {
        // 自定义形状（异步）
        drawCustomImage(ctx, x, y, opts.size, opts.shape);
    } else {
        // 内置形状
        var drawShape = shapes.getShapeDrawer(opts.shape);
        drawShape(ctx, x, y, opts.size);

        // 填充
        ctx.fillStyle = opts.color;
        ctx.fill();

        // 边框
        if (opts.strokeColor && opts.strokeWidth > 0) {
            ctx.strokeStyle = opts.strokeColor;
            ctx.lineWidth = opts.strokeWidth;
            ctx.stroke();
        }
    }

    ctx.restore();

    // 绘制文字标注
    if (options.text && options.text.content) {
        var textOpts = options.text;
        var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
        var offsetY = textOpts.offset ? textOpts.offset[1] : -opts.size / 2 - 10;

        textDrawer.drawText(ctx, x + offsetX, y + offsetY, textOpts.content, {
            fontSize: textOpts.fontSize,
            fontFamily: textOpts.fontFamily,
            fontWeight: textOpts.fontWeight,
            color: textOpts.color,
            background: textOpts.background
        }, overlay);
    }
}

/**
 * 渲染所有点
 */
function render(ctx, items, overlay) {
    if (!items || !items.length) return;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var canvasPos = overlay._toCanvasCoords(item.x, item.y);
        drawPoint(ctx, canvasPos.x, canvasPos.y, item.options, overlay);
    }
}

module.exports = {
    render: render,
    drawPoint: drawPoint,
    DEFAULTS: DEFAULTS
};
```

**Step 2: Commit**

```bash
git add renderers/canvas/overlay/point.js
git commit -m "feat(overlay): implement point drawing with shapes and labels"
```

---

## Task 5: 实现线绘制模块

**Files:**
- Modify: `renderers/canvas/overlay/line.js`

**Step 1: 实现线绘制**

```javascript
'use strict';

/**
 * 线绘制模块
 */

var textDrawer = require('./text');

var DEFAULTS = {
    color: '#000000',
    width: 1,
    style: 'solid',
    cap: 'round',
    join: 'round'
};

/**
 * 合并选项
 */
function mergeOptions(options) {
    var result = {};
    for (var key in DEFAULTS) {
        result[key] = options[key] !== undefined ? options[key] : DEFAULTS[key];
    }
    return result;
}

/**
 * 设置线样式
 */
function setLineStyle(ctx, style, width) {
    switch (style) {
        case 'dashed':
            ctx.setLineDash([width * 3, width * 2]);
            break;
        case 'dotted':
            ctx.setLineDash([width, width * 2]);
            break;
        default:
            ctx.setLineDash([]);
    }
}

/**
 * 计算路径上某点的角度
 */
function getAngleAtPoint(points, index) {
    var prev = Math.max(0, index - 1);
    var next = Math.min(points.length - 1, index + 1);
    var dx = points[next][0] - points[prev][0];
    var dy = points[next][1] - points[prev][1];
    return Math.atan2(dy, dx);
}

/**
 * 获取路径上指定位置的点
 */
function getPointAtPosition(points, position) {
    if (position === 'start') {
        return { index: 0, point: points[0] };
    }
    if (position === 'end') {
        return { index: points.length - 1, point: points[points.length - 1] };
    }
    if (position === 'middle' || typeof position === 'undefined') {
        var midIndex = Math.floor(points.length / 2);
        return { index: midIndex, point: points[midIndex] };
    }
    // 数字索引
    var idx = Math.min(Math.max(0, position), points.length - 1);
    return { index: idx, point: points[idx] };
}

/**
 * 绘制单条线
 */
function drawLine(ctx, points, options, overlay) {
    if (!points || points.length < 2) return;

    var opts = mergeOptions(options);

    ctx.save();

    // 转换坐标
    var canvasPoints = points.map(function(p) {
        return overlay._toCanvasCoords(p[0], p[1]);
    });

    // 设置样式
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = opts.width;
    ctx.lineCap = opts.cap;
    ctx.lineJoin = opts.join;
    setLineStyle(ctx, opts.style, opts.width);

    // 绘制路径
    ctx.beginPath();
    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (var i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
    }
    ctx.stroke();

    ctx.restore();

    // 绘制文字标注
    if (options.text && options.text.content) {
        var textOpts = options.text;
        var posInfo = getPointAtPosition(canvasPoints, textOpts.position);
        var angle = textOpts.rotation === 'auto'
            ? getAngleAtPoint(canvasPoints, posInfo.index)
            : (textOpts.rotation || 0);

        var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
        var offsetY = textOpts.offset ? textOpts.offset[1] : -opts.width - 10;

        // 计算垂直于线的偏移
        var perpAngle = angle + Math.PI / 2;
        var perpOffsetX = Math.cos(perpAngle) * Math.abs(offsetY);
        var perpOffsetY = Math.sin(perpAngle) * Math.abs(offsetY);

        ctx.save();
        ctx.translate(posInfo.point.x + perpOffsetX + offsetX, posInfo.point.y + perpOffsetY);
        ctx.rotate(angle);

        textDrawer.drawText(ctx, 0, 0, textOpts.content, {
            fontSize: textOpts.fontSize,
            fontFamily: textOpts.fontFamily,
            fontWeight: textOpts.fontWeight,
            color: textOpts.color,
            background: textOpts.background,
            align: 'center',
            baseline: 'middle'
        }, overlay);

        ctx.restore();
    }
}

/**
 * 渲染所有线
 */
function render(ctx, items, overlay) {
    if (!items || !items.length) return;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        drawLine(ctx, item.points, item.options, overlay);
    }
}

module.exports = {
    render: render,
    drawLine: drawLine,
    DEFAULTS: DEFAULTS
};
```

**Step 2: Commit**

```bash
git add renderers/canvas/overlay/line.js
git commit -m "feat(overlay): implement line drawing with styles and labels"
```

---

## Task 6: 实现填充图案模块

**Files:**
- Create: `renderers/canvas/overlay/patterns.js`

**Step 1: 实现填充图案**

```javascript
'use strict';

/**
 * 填充图案模块
 */

// 图案缓存
var patternCache = {};

/**
 * 创建网格图案
 */
function createGridPattern(size, color, lineWidth) {
    var cacheKey = 'grid_' + size + '_' + color + '_' + lineWidth;
    if (patternCache[cacheKey]) {
        return patternCache[cacheKey];
    }

    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 1;

    // 竖线
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    // 横线
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();

    patternCache[cacheKey] = ctx.createPattern(canvas, 'repeat');
    return patternCache[cacheKey];
}

/**
 * 创建井号图案（斜网格）
 */
function createHashPattern(size, color, lineWidth, angle) {
    var cacheKey = 'hash_' + size + '_' + color + '_' + lineWidth + '_' + angle;
    if (patternCache[cacheKey]) {
        return patternCache[cacheKey];
    }

    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 1;

    var rad = (angle || 45) * Math.PI / 180;
    var offset = size / 2;

    // 斜线1
    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(size, offset + size * Math.tan(rad));
    ctx.stroke();

    // 斜线2
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + size * Math.tan(rad), size);
    ctx.stroke();

    patternCache[cacheKey] = ctx.createPattern(canvas, 'repeat');
    return patternCache[cacheKey];
}

/**
 * 创建双斜线图案
 */
function createDiagonalPattern(size, color, lineWidth, angle) {
    var cacheKey = 'diagonal_' + size + '_' + color + '_' + lineWidth + '_' + angle;
    if (patternCache[cacheKey]) {
        return patternCache[cacheKey];
    }

    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 1;

    var rad = (angle || 45) * Math.PI / 180;

    ctx.beginPath();
    ctx.moveTo(0, size);
    ctx.lineTo(size * Math.cos(rad), size - size * Math.sin(rad));
    ctx.stroke();

    patternCache[cacheKey] = ctx.createPattern(canvas, 'repeat');
    return patternCache[cacheKey];
}

/**
 * 创建圆点图案
 */
function createDotsPattern(size, color, dotSize) {
    var cacheKey = 'dots_' + size + '_' + color + '_' + dotSize;
    if (patternCache[cacheKey]) {
        return patternCache[cacheKey];
    }

    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, dotSize || size / 6, 0, Math.PI * 2);
    ctx.fill();

    patternCache[cacheKey] = ctx.createPattern(canvas, 'repeat');
    return patternCache[cacheKey];
}

/**
 * 创建 SVG 图案
 */
function createSVGPattern(svgSource, size, callback) {
    var img = new Image();
    img.onload = function() {
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);

        var pattern = ctx.createPattern(canvas, 'repeat');
        callback(pattern);
    };
    img.src = svgSource;
}

/**
 * 根据配置获取图案
 */
function getPattern(fillConfig, ctx) {
    if (!fillConfig || fillConfig.type !== 'pattern') {
        return null;
    }

    var pattern = fillConfig.pattern;
    var color = fillConfig.patternColor || '#000000';
    var size = fillConfig.patternSize || 10;
    var lineWidth = fillConfig.patternLineWidth || 1;

    if (typeof pattern === 'string') {
        switch (pattern) {
            case 'grid':
                return createGridPattern(size, color, lineWidth);
            case 'hash':
                return createHashPattern(size, color, lineWidth, fillConfig.patternAngle);
            case 'diagonal':
                return createDiagonalPattern(size, color, lineWidth, fillConfig.patternAngle);
            case 'dots':
                return createDotsPattern(size, color, fillConfig.patternDotSize);
        }
    }

    return null;
}

/**
 * 清除图案缓存
 */
function clearCache() {
    patternCache = {};
}

module.exports = {
    createGridPattern: createGridPattern,
    createHashPattern: createHashPattern,
    createDiagonalPattern: createDiagonalPattern,
    createDotsPattern: createDotsPattern,
    createSVGPattern: createSVGPattern,
    getPattern: getPattern,
    clearCache: clearCache
};
```

**Step 2: Commit**

```bash
git add renderers/canvas/overlay/patterns.js
git commit -m "feat(overlay): add fill pattern generators"
```

---

## Task 7: 实现面绘制模块

**Files:**
- Modify: `renderers/canvas/overlay/polygon.js`

**Step 1: 实现面绘制**

```javascript
'use strict';

/**
 * 面绘制模块
 */

var patterns = require('./patterns');
var textDrawer = require('./text');
var lineDrawer = require('./line');

var DEFAULT_FILL = {
    type: 'color',
    color: 'rgba(0, 0, 0, 0.3)'
};

var DEFAULT_STROKE = {
    color: '#000000',
    width: 1,
    style: 'solid'
};

/**
 * 计算多边形中心点
 */
function calculateCenter(points) {
    if (!points || points.length === 0) {
        return { x: 0, y: 0 };
    }

    var sumX = 0, sumY = 0;
    for (var i = 0; i < points.length; i++) {
        sumX += points[i].x !== undefined ? points[i].x : points[i][0];
        sumY += points[i].y !== undefined ? points[i].y : points[i][1];
    }

    return {
        x: sumX / points.length,
        y: sumY / points.length
    };
}

/**
 * 绘制单个面
 */
function drawPolygon(ctx, points, options, overlay) {
    if (!points || points.length < 3) return;

    options = options || {};

    // 转换坐标
    var canvasPoints = points.map(function(p) {
        return overlay._toCanvasCoords(p[0], p[1]);
    });

    ctx.save();

    // 绘制路径
    ctx.beginPath();
    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (var i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
    }
    ctx.closePath();

    // 填充
    var fill = options.fill || DEFAULT_FILL;
    if (fill.type === 'pattern') {
        var pattern = patterns.getPattern(fill, ctx);
        if (pattern) {
            ctx.fillStyle = pattern;
        } else {
            ctx.fillStyle = fill.color || DEFAULT_FILL.color;
        }
    } else {
        ctx.fillStyle = fill.color || DEFAULT_FILL.color;
    }
    ctx.fill();

    // 边框
    var stroke = options.stroke;
    if (stroke && stroke.color) {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width || DEFAULT_STROKE.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 线样式
        switch (stroke.style) {
            case 'dashed':
                ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
                break;
            case 'dotted':
                ctx.setLineDash([ctx.lineWidth, ctx.lineWidth * 2]);
                break;
            default:
                ctx.setLineDash([]);
        }

        ctx.stroke();
    }

    ctx.restore();

    // 绘制文字标注
    if (options.text && options.text.content) {
        var textOpts = options.text;
        var center;

        if (textOpts.position === 'center' || !textOpts.position) {
            center = calculateCenter(canvasPoints);
        } else if (Array.isArray(textOpts.position)) {
            center = overlay._toCanvasCoords(textOpts.position[0], textOpts.position[1]);
        } else {
            center = calculateCenter(canvasPoints);
        }

        var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
        var offsetY = textOpts.offset ? textOpts.offset[1] : 0;

        textDrawer.drawText(ctx, center.x + offsetX, center.y + offsetY, textOpts.content, {
            fontSize: textOpts.fontSize,
            fontFamily: textOpts.fontFamily,
            fontWeight: textOpts.fontWeight,
            color: textOpts.color,
            background: textOpts.background
        }, overlay);
    }
}

/**
 * 渲染所有面
 */
function render(ctx, items, overlay) {
    if (!items || !items.length) return;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        drawPolygon(ctx, item.points, item.options, overlay);
    }
}

module.exports = {
    render: render,
    drawPolygon: drawPolygon,
    calculateCenter: calculateCenter,
    DEFAULT_FILL: DEFAULT_FILL,
    DEFAULT_STROKE: DEFAULT_STROKE
};
```

**Step 2: Commit**

```bash
git add renderers/canvas/overlay/polygon.js
git commit -m "feat(overlay): implement polygon drawing with patterns and labels"
```

---

## Task 8: 集成到 Canvas 渲染器

**Files:**
- Modify: `renderers/canvas/index.js`

**Step 1: 添加 getOverlay 方法**

在 `renderers/canvas/index.js` 中添加：

1. 在文件顶部引入 Overlay：
```javascript
var Overlay = require('./overlay');
```

2. 在 `drawContours` 函数返回的对象中添加 `getOverlay` 方法：

找到返回对象的位置，添加：
```javascript
// Overlay 实例缓存
var _overlay = null;

return {
    // ... 现有方法

    /**
     * 获取 Overlay 绘图器
     */
    getOverlay: function() {
        if (!_overlay) {
            _overlay = new Overlay({
                getViewManager: function() {
                    return viewManager;
                },
                render: function() {
                    render();
                },
                _ctx: ctx
            });
        }
        return _overlay;
    }
};
```

3. 在渲染函数中添加 overlay 渲染调用：

在主 `render` 函数中，找到绘制等值线之后的合适位置，添加：
```javascript
// 渲染 Overlay 层
if (_overlay) {
    _overlay.render(ctx);
}
```

**Step 2: 测试集成**

创建测试文件 `demo/overlay-demo.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Overlay Demo</title>
</head>
<body>
    <canvas id="canvas" width="800" height="600"></canvas>
    <script src="../dist/contour-core.browser.js"></script>
    <script>
        var canvas = document.getElementById('canvas');
        var ctx = canvas.getContext('2d');

        // 简单测试数据
        var z = [];
        for (var i = 0; i < 20; i++) {
            z[i] = [];
            for (var j = 0; j < 20; j++) {
                z[i][j] = Math.sin(i/3) * Math.cos(j/3) * 10;
            }
        }

        var result = contourCore.computeContours({ z: z }, { autocontour: true, ncontours: 10 });

        var renderer = contourCore.renderers.canvas.drawContours(ctx, result, {
            width: 800,
            height: 600,
            padding: 50,
            interaction: { zoom: true, pan: true }
        });

        // 获取 overlay
        var overlay = renderer.getOverlay();

        // 绘制点
        overlay.drawPoint(10, 10, {
            size: 12,
            color: 'red',
            shape: 'circle',
            text: { content: 'P1', fontSize: 12, color: '#000' }
        });

        // 绘制线
        overlay.drawLine([[5, 5], [15, 5]], {
            color: 'blue',
            width: 2,
            style: 'dashed',
            text: { content: 'Line', position: 'middle' }
        });

        // 绘制面
        overlay.drawPolygon([[5, 8], [10, 8], [10, 15], [5, 15]], {
            fill: { type: 'color', color: 'rgba(0,255,0,0.3)' },
            stroke: { color: 'green', width: 2 },
            text: { content: 'Area', position: 'center' }
        });

        console.log('Overlay demo ready');
    </script>
</body>
</html>
```

**Step 3: 重新构建**

```bash
cd D:\study\code\webgl\plotly.js\contour-core
npm run build
```

**Step 4: Commit**

```bash
git add renderers/canvas/index.js demo/overlay-demo.html
git commit -m "feat(overlay): integrate overlay module into canvas renderer"
```

---

## Task 9: 处理 Node.js 环境（SSR 支持）

**Files:**
- Modify: `renderers/canvas/overlay/patterns.js`

**Step 1: 添加 Node.js 兼容**

```javascript
'use strict';

/**
 * 填充图案模块 - 支持 Node.js 环境
 */

// 检测环境
var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

// 图案缓存
var patternCache = {};

// Canvas 创建函数
function createCanvas(size) {
    if (isBrowser) {
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        return canvas;
    } else {
        // Node.js 环境
        try {
            var { createCanvas } = require('canvas');
            return createCanvas(size, size);
        } catch (e) {
            console.warn('node-canvas not available, patterns will not work in SSR');
            return null;
        }
    }
}

// Pattern 创建函数
function createPattern(ctx, canvas) {
    if (isBrowser) {
        return ctx.createPattern(canvas, 'repeat');
    } else {
        // Node.js 环境
        return ctx.createPattern(canvas, 'repeat');
    }
}

// ... 其余代码保持不变，将 document.createElement('canvas') 替换为 createCanvas()
// 将 ctx.createPattern() 替换为 createPattern()
```

**Step 2: Commit**

```bash
git add renderers/canvas/overlay/patterns.js
git commit -m "feat(overlay): add Node.js/SSR support for patterns"
```

---

## Task 10: 创建完整 Demo

**Files:**
- Create: `demo/overlay-full-demo.html`

**Step 1: 创建完整功能演示**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Overlay 绘图功能演示</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        .container {
            display: flex;
            gap: 20px;
        }
        .canvas-section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .controls {
            width: 300px;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        canvas {
            border: 1px solid #ddd;
            cursor: grab;
        }
        canvas:active { cursor: grabbing; }
        h2 { margin-top: 0; color: #333; }
        h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
        .btn-group { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            background: #2196F3;
            color: white;
            transition: background 0.2s;
        }
        button:hover { background: #1976D2; }
        button.secondary { background: #f0f0f0; color: #333; }
        button.secondary:hover { background: #e0e0e0; }
        .info { background: #e3f2fd; padding: 10px; border-radius: 4px; font-size: 12px; margin-bottom: 15px; }
    </style>
</head>
<body>
    <h1>Overlay 绘图功能演示</h1>

    <div class="container">
        <div class="canvas-section">
            <canvas id="mainCanvas" width="700" height="500"></canvas>
        </div>

        <div class="controls">
            <h2>控制面板</h2>

            <div class="info">
                <strong>交互：</strong>滚轮缩放，拖拽平移，双击重置
            </div>

            <h3>点绘制</h3>
            <div class="btn-group">
                <button onclick="addPoint('circle')">圆形点</button>
                <button onclick="addPoint('square')">方形点</button>
                <button onclick="addPoint('triangle')">三角形</button>
                <button onclick="addPoint('diamond')">菱形</button>
            </div>

            <h3>线绘制</h3>
            <div class="btn-group">
                <button onclick="addLine('solid')">实线</button>
                <button onclick="addLine('dashed')">虚线</button>
                <button onclick="addLine('dotted')">点线</button>
            </div>

            <h3>面绘制</h3>
            <div class="btn-group">
                <button onclick="addPolygon('color')">纯色填充</button>
                <button onclick="addPolygon('grid')">网格填充</button>
                <button onclick="addPolygon('diagonal')">斜线填充</button>
                <button onclick="addPolygon('dots')">圆点填充</button>
            </div>

            <h3>文字绘制</h3>
            <div class="btn-group">
                <button onclick="addText()">添加文字</button>
            </div>

            <h3>操作</h3>
            <div class="btn-group">
                <button onclick="clearOverlay('points')" class="secondary">清除点</button>
                <button onclick="clearOverlay('lines')" class="secondary">清除线</button>
                <button onclick="clearOverlay('polygons')" class="secondary">清除面</button>
                <button onclick="clearOverlay()" class="secondary" style="background:#f44336;color:white;">清除全部</button>
            </div>
        </div>
    </div>

    <script src="../dist/contour-core.browser.js"></script>
    <script>
        var canvas = document.getElementById('mainCanvas');
        var ctx = canvas.getContext('2d');
        var overlay = null;

        // 生成等值线数据
        var z = [];
        for (var i = 0; i < 30; i++) {
            z[i] = [];
            for (var j = 0; j < 30; j++) {
                z[i][j] = Math.sin(i/4) * Math.cos(j/4) * 10 + Math.random() * 2;
            }
        }

        // 渲染等值线
        var result = contourCore.computeContours({ z: z }, { autocontour: true, ncontours: 12 });

        var renderer = contourCore.renderers.canvas.drawContours(ctx, result, {
            width: 700,
            height: 500,
            padding: 50,
            coloring: 'fill+lines',
            interaction: { zoom: true, pan: true, dblclickReset: true }
        });

        overlay = renderer.getOverlay();

        // 添加点
        function addPoint(shape) {
            var x = 5 + Math.random() * 20;
            var y = 5 + Math.random() * 20;
            var colors = ['red', 'blue', 'green', 'orange', 'purple'];
            var color = colors[Math.floor(Math.random() * colors.length)];

            overlay.drawPoint(x, y, {
                size: 10 + Math.random() * 8,
                color: color,
                strokeColor: 'black',
                strokeWidth: 1,
                shape: shape,
                text: {
                    content: shape.charAt(0).toUpperCase() + Math.floor(Math.random() * 100),
                    offset: [0, -15],
                    fontSize: 11,
                    color: '#333'
                }
            });
        }

        // 添加线
        function addLine(style) {
            var startX = Math.random() * 10;
            var startY = Math.random() * 20 + 5;
            var points = [[startX, startY]];
            var segments = 2 + Math.floor(Math.random() * 3);

            for (var i = 0; i < segments; i++) {
                points.push([
                    startX + (i + 1) * (5 + Math.random() * 3),
                    startY + (Math.random() - 0.5) * 10
                ]);
            }

            var colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12'];

            overlay.drawLine(points, {
                color: colors[Math.floor(Math.random() * colors.length)],
                width: 1 + Math.random() * 2,
                style: style,
                text: {
                    content: style,
                    position: 'middle',
                    rotation: 'auto',
                    fontSize: 10
                }
            });
        }

        // 添加面
        function addPolygon(fillType) {
            var cx = 10 + Math.random() * 10;
            var cy = 10 + Math.random() * 10;
            var size = 3 + Math.random() * 4;
            var sides = 4 + Math.floor(Math.random() * 3);

            var points = [];
            for (var i = 0; i < sides; i++) {
                var angle = (i / sides) * Math.PI * 2;
                points.push([
                    cx + Math.cos(angle) * size,
                    cy + Math.sin(angle) * size
                ]);
            }

            var fill;
            if (fillType === 'color') {
                fill = {
                    type: 'color',
                    color: 'rgba(' + Math.floor(Math.random()*255) + ',' +
                           Math.floor(Math.random()*255) + ',' +
                           Math.floor(Math.random()*255) + ',0.4)'
                };
            } else {
                fill = {
                    type: 'pattern',
                    pattern: fillType,
                    patternColor: '#333',
                    patternSize: 8
                };
            }

            overlay.drawPolygon(points, {
                fill: fill,
                stroke: {
                    color: '#333',
                    width: 1,
                    style: 'solid'
                },
                text: {
                    content: fillType,
                    position: 'center',
                    fontSize: 12,
                    fontWeight: 'bold'
                }
            });
        }

        // 添加文字
        function addText() {
            var x = 5 + Math.random() * 20;
            var y = 5 + Math.random() * 20;
            var texts = ['标注A', '标记点', '区域名称', '测量值', '说明文字'];
            var text = texts[Math.floor(Math.random() * texts.length)];

            overlay.drawText(x, y, text, {
                fontSize: 12 + Math.floor(Math.random() * 8),
                fontWeight: Math.random() > 0.5 ? 'bold' : 'normal',
                color: '#333',
                background: 'rgba(255,255,255,0.8)'
            });
        }

        // 清除
        function clearOverlay(type) {
            overlay.clear(type);
        }
    </script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add demo/overlay-full-demo.html
git commit -m "docs: add comprehensive overlay demo"
```

---

## Task 11: 更新主入口导出

**Files:**
- Modify: `index.js`

**Step 1: 导出 Overlay 模块**

在 `index.js` 中添加导出：

```javascript
// 在 exports 对象中添加
exports.Overlay = require('./renderers/canvas/overlay');
```

**Step 2: 重新构建并测试**

```bash
cd D:\study\code\webgl\plotly.js\contour-core
npm run build
```

**Step 3: Commit**

```bash
git add index.js
git commit -m "feat: export Overlay module from main entry"
```

---

## Task 12: 最终验证

**Step 1: 运行所有测试**

```bash
cd D:\study\code\webgl\plotly.js\contour-core
npm test
```

**Step 2: 启动 Demo 服务**

```bash
npm run demo
```

**Step 3: 浏览器测试**

打开 `http://localhost:8080/demo/overlay-full-demo.html`，验证：
- [ ] 点绘制正常，支持各种形状
- [ ] 线绘制正常，支持各种线形
- [ ] 面绘制正常，支持各种填充
- [ ] 文字标注正常显示
- [ ] 缩放平移时图形正确跟随

**Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat(overlay): complete overlay drawing module implementation"
```

---

## 实施顺序总结

| Task | 描述 | 预估时间 |
|------|------|----------|
| 1 | Overlay 管理器骨架 | 15 min |
| 2 | 文字绘制模块 | 15 min |
| 3 | 形状绘制模块 | 10 min |
| 4 | 点绘制模块 | 15 min |
| 5 | 线绘制模块 | 15 min |
| 6 | 填充图案模块 | 15 min |
| 7 | 面绘制模块 | 20 min |
| 8 | 集成到渲染器 | 20 min |
| 9 | Node.js 支持 | 10 min |
| 10 | 完整 Demo | 15 min |
| 11 | 导出更新 | 5 min |
| 12 | 最终验证 | 15 min |
| **总计** | | **~3 小时** |

---

*计划创建日期：2026-03-09*
