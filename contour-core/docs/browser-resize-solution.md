# 浏览器缩放时渲染区域自适应方案

## 问题描述

contour-core 在浏览器中渲染时，当浏览器窗口大小发生变化（用户拖拽窗口边缘、最大化/还原窗口、移动端旋转屏幕等），Canvas 渲染区域不会自动调整，导致：

1. 图表被裁剪或留有大量空白
2. Canvas 内容变形（CSS 拉伸而非重新渲染）
3. 交互区域（zoom/pan 的 hitTest）与视觉位置不匹配

## 根因分析

### 1. Canvas 尺寸在初始化时固定，无监听机制

`createInteractiveRenderer`（`renderers/canvas/index.js`）在创建时从 `style` 中读取 `width`/`height`，之后不再自动更新：

```javascript
// renderers/canvas/index.js 第 240 行附近
var width = style.width || canvas.width;
var height = style.height || canvas.height;
```

虽然交互式渲染器暴露了 `resize(newWidth, newHeight)` 方法，但它是被动的——需要外部调用者主动调用。

### 2. 库内部没有任何 ResizeObserver 或 window.resize 监听

全局搜索 `ResizeObserver`、`addEventListener('resize'` 等关键词，在库源码中（排除 demo 文件）没有任何匹配。resize 完全依赖使用者在外部手动处理。

### 3. demo 中的 resize 处理不完整

`demo/interactive.html` 中有一个 `window.addEventListener('resize', ...)` 监听，但存在问题：

```javascript
window.addEventListener('resize', function() {
    var newWidth = container.clientWidth;
    var newHeight = container.clientHeight;
    chart.resize(newWidth, newHeight);
});
```

- 没有 debounce，高频触发导致性能问题
- 没有处理 devicePixelRatio 变化（浏览器缩放比例变化时）
- `container.clientHeight` 在 CSS 高度为固定值（`500px`）时不会变化，只有宽度自适应

### 4. resize() 方法本身的局限

`createInteractiveRenderer` 的 `resize` 方法：

```javascript
resize: function(newWidth, newHeight) {
    width = newWidth;
    height = newHeight;
    canvas.width = width;
    canvas.height = height;
    // 重新计算 baseDrawingArea ...
    // 重新计算 drawingArea ...
    render();
},
```

- 没有处理 `devicePixelRatio`（高 DPI 屏幕会模糊）
- 没有更新交互管理器中缓存的 `drawingArea`（`interaction_manager.js` 在创建时缓存了 `drawingArea`，resize 后不会更新）

## 解决方案

### 方案一：库内置 autoResize 选项（推荐）

在 `createInteractiveRenderer` 中增加自动 resize 能力，使用 `ResizeObserver` 监听容器尺寸变化。

#### 核心实现

```javascript
// 在 createInteractiveRenderer 函数中，render() 定义之后添加：

var _resizeObserver = null;
var _resizeTimer = null;

function setupAutoResize(container) {
    if (typeof ResizeObserver === 'undefined') {
        // 降级方案：监听 window resize
        var handler = debounce(function() {
            var rect = container.getBoundingClientRect();
            handleResize(rect.width, rect.height);
        }, 150);
        window.addEventListener('resize', handler);
        return function cleanup() {
            window.removeEventListener('resize', handler);
        };
    }

    _resizeObserver = new ResizeObserver(debounce(function(entries) {
        var entry = entries[0];
        if (!entry) return;
        var cr = entry.contentRect;
        handleResize(cr.width, cr.height);
    }, 100));

    _resizeObserver.observe(container);

    return function cleanup() {
        if (_resizeObserver) {
            _resizeObserver.disconnect();
            _resizeObserver = null;
        }
    };
}

function handleResize(newWidth, newHeight) {
    if (newWidth === width && newHeight === height) return;
    if (newWidth <= 0 || newHeight <= 0) return;

    var dpr = window.devicePixelRatio || 1;

    // 更新 canvas 物理尺寸（高 DPI 支持）
    canvas.width = newWidth * dpr;
    canvas.height = newHeight * dpr;
    canvas.style.width = newWidth + 'px';
    canvas.style.height = newHeight + 'px';

    // 更新逻辑尺寸
    width = newWidth;
    height = newHeight;

    // 重新计算绘图区域
    baseDrawingArea = {
        x: padding.left,
        y: padding.top,
        width: width - padding.left - padding.right - colorbarSpace,
        height: height - padding.top - padding.bottom,
        margins: { left: padding.left, right: padding.right + colorbarSpace,
                   top: padding.top, bottom: padding.bottom }
    };
    drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
    _drawingArea = drawingArea;

    // 在 render 前应用 DPR 缩放
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    render();
}

function debounce(fn, delay) {
    var timer = null;
    return function() {
        var args = arguments;
        var context = this;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(context, args); }, delay);
    };
}
```

#### API 变更

在 `style.interaction` 配置中增加 `autoResize` 选项：

```javascript
var controller = canvasRenderer.drawContours(ctx, result, {
    // ... 其他配置
    interaction: {
        zoom: true,
        pan: true,
        autoResize: true,          // 新增：启用自动 resize
        autoResizeContainer: container, // 新增：监听的容器元素
        autoResizeDebounce: 150    // 新增：debounce 延迟（ms）
    }
});
```

在 `destroy()` 方法中清理 observer：

```javascript
destroy: function() {
    interaction.destroy();
    if (_cleanupResize) _cleanupResize();
}
```

### 方案二：交互管理器修复 drawingArea 缓存问题

`interaction_manager.js` 中 `drawingArea` 在创建时被缓存为值，resize 后不会更新：

```javascript
// interaction_manager.js 第 38 行
var drawingArea = layeredRenderer.getDrawingArea(); // 缓存了初始值
```

需要改为每次使用时动态获取：

```javascript
// 修改为函数调用
function getDrawingArea() {
    return layeredRenderer.getDrawingArea();
}
```

然后将所有 `drawingArea` 引用改为 `getDrawingArea()` 调用。

注意：`createInteractiveRenderer` 中的 `createInteractionManagerInternal` 已经使用了 getter 函数模式：

```javascript
var interaction = createInteractionManagerInternal(
    canvas,
    function() { return drawingArea; },  // getter 函数
    viewManager, render, interactionConfig
);
```

但 `interaction_manager.js` 中的 `createInteractionManager` 没有使用这个模式。需要统一。

### 方案三：高 DPI (devicePixelRatio) 支持

当前代码完全没有处理 `devicePixelRatio`。在 Retina 屏幕或浏览器缩放比例非 100% 时，Canvas 内容会模糊。

```javascript
// 在初始化和 resize 时都需要处理
function applyDPR(canvas, width, height) {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return dpr;
}
```

同时需要监听 `devicePixelRatio` 变化（用户通过 Ctrl+/- 缩放浏览器时）：

```javascript
// 监听 DPR 变化
var dprMediaQuery = window.matchMedia(
    '(resolution: ' + window.devicePixelRatio + 'dppx)'
);
dprMediaQuery.addEventListener('change', function() {
    handleResize(width, height); // 尺寸不变，但 DPR 变了
});
```

### 方案四：CSS 容器自适应 + Canvas 跟随

对于静态渲染模式（非交互式），可以用纯 CSS 方案：

```css
.contour-container {
    width: 100%;
    aspect-ratio: 4 / 3;  /* 或由用户指定 */
}

.contour-container canvas {
    width: 100%;
    height: 100%;
}
```

但这只是 CSS 拉伸，不会重新渲染。需要配合 ResizeObserver 触发重绘。

## 推荐实施路径

1. **第一步**：修复 `interaction_manager.js` 中 `drawingArea` 的缓存问题（方案二），这是一个 bug 修复
2. **第二步**：在 `createInteractiveRenderer` 中实现 `autoResize` 选项（方案一），这是核心功能
3. **第三步**：增加 `devicePixelRatio` 支持（方案三），提升渲染质量
4. **第四步**：更新 demo 文件，展示自适应用法

## 兼容性说明

| API | 浏览器支持 | 降级方案 |
|-----|-----------|---------|
| `ResizeObserver` | Chrome 64+, Firefox 69+, Safari 13.1+ | `window.resize` 事件 |
| `devicePixelRatio` | 所有现代浏览器 | 默认为 1 |
| `matchMedia` (DPR 监听) | Chrome 9+, Firefox 6+ | 不监听 DPR 变化 |
| `canvas.style.width/height` | 所有浏览器 | 无需降级 |
