# contour-core 源码优化分析

## 一、代码重复问题

### 1.1 normalizePadding 函数重复 10 次

同一个 `normalizePadding` 函数在以下 10 个文件中各自独立定义了一份：

| 文件 | 默认值 |
|------|--------|
| `renderers/canvas/index.js` | 50 |
| `renderers/canvas/paths.js` | 30 |
| `renderers/canvas/layers.js` | 50 |
| `renderers/canvas/heatmap.js` | 30 |
| `renderers/canvas/nulls.js` | 30 |
| `renderers/canvas/labels.js` | 30 |
| `renderers/svg/paths.js` | 30 |
| `renderers/svg/nulls.js` | 30 |
| `renderers/svg/labels.js` | 30 |
| `null_handling/clip_mask.js` | 30 |

**问题**：不仅是代码冗余，默认值还不一致（有的是 50，有的是 30），容易导致不同模块之间的 padding 计算不一致。

**建议**：提取到一个共享的 `utils.js` 模块中，统一默认值。

### 1.2 interpolateColor 函数重复

`interpolateColor` 在 `renderers/canvas/paths.js` 和 `colorbar/colors.js` 中各有一份实现，逻辑完全相同。

**建议**：统一使用 `colorbar/colors.js` 中的版本。

### 1.3 createIndexArray 函数重复

`createIndexArray` 在 `compute.js` 和 `renderers/canvas/paths.js` 中各有一份，签名略有不同（一个接受 `n`，一个接受 `length, offset`）。

**建议**：合并为一个通用版本放入 `utils.js`。

---

## 二、计算性能优化

### 2.1 scalePoint 中重复计算 Math.min/Math.max

`scalePoint`（`renderers/canvas/paths.js`）是渲染热路径上的函数，每次调用都会对整个 x/y 数组执行 `Math.min.apply` 和 `Math.max.apply`：

```javascript
function scalePoint(style, pt) {
    // ...
    xMin = (x && x.length > 0) ? Math.min.apply(Math, x) : 0;
    xMax = (x && x.length > 0) ? Math.max.apply(Math, x) : 10;
    yMin = (y && y.length > 0) ? Math.min.apply(Math, y) : 0;
    yMax = (y && y.length > 0) ? Math.max.apply(Math, y) : 10;
    // ...
}
```

对于一个 100×100 的网格，每个等值线路径上的每个点都会触发 4 次 O(n) 的数组遍历。如果有 15 个等值线级别，每个级别平均 200 个点，就是 15 × 200 × 4 = 12000 次数组遍历。

**建议**：在 `drawFilledPaths` / `drawStrokePaths` 入口处预计算一次 `xMin, xMax, yMin, yMax`，通过 style 传入 scalePoint，避免重复计算。当 `style.visibleRange` 或 `style.drawArea` 存在时已经走了快速路径，但 fallback 分支的性能很差。

### 2.2 interp2d 迭代次数可能过多

`null_handling/interp2d.js` 中的 Laplace 方程求解器最多迭代 100 次：

```javascript
for (i = 0; i < 100 && maxFractionalChange > INTERPTHRESHOLD; i++) {
    maxFractionalChange = iterateInterp2d(z, emptyPoints, ...);
}
```

对于大面积空值区域，100 次迭代可能不够（会打印 warning），但对于小面积空值，可能 5-10 次就够了。

**建议**：
- 根据空值区域的大小动态调整最大迭代次数
- 考虑使用更高效的求解器（如多重网格法），但这会增加代码复杂度

### 2.3 pathfinding 中的字符串键操作

`pathfinding.js` 使用字符串拼接作为 HashMap 的键：

```javascript
label = xi + ',' + yi;
pi.crossings[label] = mi;
```

以及：

```javascript
locStr = loc.join(',');
var mi = pi.crossings[locStr];
```

每次查找都需要字符串拼接和哈希计算。

**建议**：对于固定大小的网格，可以使用 `xi * m + yi` 作为整数键，或使用 TypedArray 替代对象。这在大网格（>200×200）上会有明显的性能提升。

### 2.4 SVG 路径字符串解析开销

`paths.js` 中的 `drawSVGPath` 函数将 smooth 模块生成的 SVG 路径字符串（`M...C...Q...Z`）解析后绘制到 Canvas 上。这意味着：

1. `smooth.smoothclosed/smoothopen` 生成 SVG 字符串
2. `drawSVGPath` 解析 SVG 字符串
3. 调用 Canvas API 绘制

中间的"生成字符串 → 解析字符串"是不必要的序列化/反序列化。

**建议**：为 Canvas 渲染器提供一个直接输出 Canvas API 调用的 smooth 函数变体，跳过 SVG 字符串中间格式。SVG 字符串版本保留给 SVG 渲染器使用。

### 2.5 drawFilledPaths 中每层都重新创建 dataPerimeter

```javascript
for (var i = 0; i < paths.length; i++) {
    var dataPerimeter = createDataPerimeter(style);  // 每层都创建
    var boundaryPath = 'M' + dataPerimeter.map(function(pt) {
        var canvasPt = scalePoint(style, pt);
        return canvasPt.join(' ');
    }).join('L') + 'Z';
    // ...
}
```

`createDataPerimeter` 的结果对所有层都是相同的，不需要在循环内重复创建。

**建议**：将 `dataPerimeter` 和 `boundaryPath` 的计算提到循环外。

---

## 三、架构设计优化

### 3.1 两套交互式渲染器并存

当前存在两套交互式渲染器：

1. `renderers/canvas/index.js` 中的 `createInteractiveRenderer`（内联在 `drawContours` 中）
2. `renderers/canvas/layers.js` 中的 `createLayeredRenderer`

两者功能高度重叠，但实现方式不同。`createInteractiveRenderer` 更完整（有 `updateData`、`updateColorScale` 等 API），`createLayeredRenderer` 更结构化（明确的分层渲染）。

**建议**：统一为一套实现。推荐以 `createLayeredRenderer` 的分层架构为基础，将 `createInteractiveRenderer` 的数据更新 API 合并进去。

### 3.2 interaction_manager 中 drawingArea 缓存问题

`interaction_manager.js` 在创建时缓存了 `drawingArea` 的值：

```javascript
var drawingArea = layeredRenderer.getDrawingArea();
```

而 `createInteractiveRenderer` 中使用了 getter 函数模式：

```javascript
var interaction = createInteractionManagerInternal(
    canvas,
    function() { return drawingArea; },  // getter
    viewManager, render, interactionConfig
);
```

两种模式不统一。`createInteractionManager`（公开 API）使用值缓存，`createInteractionManagerInternal`（内部 API）使用 getter。resize 后，使用值缓存的版本会导致交互区域计算错误。

**建议**：统一使用 getter 函数模式。

### 3.3 api.js 中的 createInteractive 引用了未导入的 zrenderRenderer

```javascript
function createInteractive(container, config) {
    // ...
    var renderer = zrenderRenderer.createRenderer(container, { ... });
    // ...
}
```

`zrenderRenderer` 没有在文件顶部 require，这个函数在运行时会直接报错。

**建议**：要么移除这个函数，要么补全依赖。如果 zrender 不再是项目依赖，应该移除相关代码。

---

## 四、内存与资源管理

### 4.1 heatmap 渲染中的离屏 Canvas 未释放

`heatmap.js` 的 `drawInterpolatedHeatmap` 每次调用都创建一个离屏 Canvas：

```javascript
var heatmapCanvas = document.createElement('canvas');
heatmapCanvas.width = n;
heatmapCanvas.height = m;
```

在交互模式下（zoom/pan 时频繁重绘），这会导致大量临时 Canvas 对象被创建。虽然 GC 最终会回收，但在高频重绘时可能造成内存压力。

**建议**：缓存离屏 Canvas，仅在数据变化时重新创建。zoom/pan 只改变可视范围，不需要重新生成 heatmap 像素数据。

### 4.2 drawSmoothHeatmap 的高分辨率 Canvas

`drawSmoothHeatmap` 创建了一个放大 `scaleFactor` 倍的离屏 Canvas：

```javascript
var scaleFactor = Math.max(1, Math.min(10, Math.ceil(100 / Math.max(n, m))));
var hiresCanvas = createCanvasElement(n * scaleFactor, m * scaleFactor);
```

对于 100×100 的网格，`scaleFactor = 1`，没问题。但对于 10×10 的网格，`scaleFactor = 10`，创建 100×100 的 Canvas，也没问题。但如果网格很小（如 3×3），`scaleFactor = 10`，仍然只有 30×30，效果有限。

**建议**：考虑直接使用 Canvas 的 `imageSmoothingEnabled` 属性进行缩放，而不是创建高分辨率中间 Canvas。

### 4.3 事件监听器未在所有路径上清理

`interaction_manager.js` 的 `destroy` 方法会解绑事件，但如果 `createInteractiveRenderer` 的 `destroy` 没有被调用（例如页面直接跳转），事件监听器会泄漏。

**建议**：考虑使用 `WeakRef` 或在 `beforeunload` 事件中自动清理。

---

## 五、错误处理与健壮性

### 5.1 scalePoint 中的 console.warn 在生产环境中不合适

```javascript
if (!pt || !Array.isArray(pt) || pt.length < 2) {
    console.warn('scalePoint: Invalid point', pt);
    return [0, 0];
}
```

在渲染热路径上打印 warning 会严重影响性能（尤其是在 Chrome DevTools 打开时）。返回 `[0, 0]` 也会导致视觉上出现异常的线条（从原点画出的线）。

**建议**：
- 移除热路径上的 `console.warn`
- 返回 `null` 并在调用方过滤，而不是返回 `[0, 0]`

### 5.2 pathfinding 中的无限循环保护

```javascript
for (cnt = 0; cnt < 10000; cnt++) { ... }
if (cnt === 10000) {
    console.warn('Infinite loop in contour path');
}
```

10000 次的硬编码上限对于大网格可能不够，对于小网格又浪费检查。

**建议**：根据网格大小动态计算上限，例如 `maxIterations = m * n * 4`。

### 5.3 findEmpties 中的 throw 会中断整个渲染

```javascript
if (!foundNewNeighbors) {
    throw new Error('findEmpties: Iterated with no new neighbors');
}
```

在渲染库中抛出异常会导致整个图表无法显示。

**建议**：改为 `console.warn` 并返回已找到的结果，让渲染尽可能继续。

---

## 六、API 设计优化

### 6.1 computeContours 的 options 参数不透明

`computeContours` 接受的 options 中，`connectgaps` 的默认值是 `true`，但这个行为对用户来说不直观——大多数用户期望 null 值区域默认不被连接。

**建议**：在文档中明确说明默认行为，或考虑将默认值改为 `false`（需要评估向后兼容性）。

### 6.2 updateColorScale / updateData / updateContours 缺乏批量更新优化

当用户需要同时更新数据和颜色时，分别调用 `updateData` 和 `updateColorScale` 会触发两次 `computeContours` + `render`。虽然有 `update` 批量方法，但它的存在感不强。

**建议**：在 `updateColorScale` 等方法的文档中提示用户使用 `update` 进行批量更新，或在内部实现 dirty flag + requestAnimationFrame 合并渲染。

### 6.3 缺少 toDataURL / toBlob 导出方法

用户经常需要将渲染结果导出为图片，但当前没有便捷的导出 API。

**建议**：在交互式渲染器上增加 `toDataURL(type, quality)` 和 `toBlob(callback, type, quality)` 方法，内部直接调用 `canvas.toDataURL` / `canvas.toBlob`。

---

## 七、构建与打包优化

### 7.1 dist 文件体积

当前使用 esbuild 打包，但没有 tree-shaking 配置。`contour-core.browser.js` 包含了所有模块（包括 SVG 渲染器、overlay 系统、交互模块等），即使用户只需要静态 Canvas 渲染。

**建议**：
- 提供多个入口点（`contour-core.compute.js`、`contour-core.canvas.js`、`contour-core.full.js`）
- 或使用 ESM 格式让打包工具自动 tree-shake

### 7.2 overlay 系统的体积占比

overlay 系统（`overlay/` 目录）包含大量代码（核心组件 + 服务层 + 图元），但它是一个可选功能。将它打包进主 bundle 增加了不必要的体积。

**建议**：将 overlay 作为独立的可选模块，按需加载。

---

## 八、优先级排序

| 优先级 | 优化项 | 影响范围 | 实施难度 |
|--------|--------|---------|---------|
| P0 | scalePoint 中 min/max 重复计算 | 渲染性能 | 低 |
| P0 | normalizePadding 提取为共享模块 | 代码质量 + 一致性 | 低 |
| P0 | api.js 中 createInteractive 的 zrender 引用 | 运行时错误 | 低 |
| P1 | 离屏 Canvas 缓存 | 交互性能 + 内存 | 中 |
| P1 | SVG 路径字符串中间格式消除 | 渲染性能 | 中 |
| P1 | 两套交互式渲染器统一 | 架构清晰度 + 维护成本 | 高 |
| P1 | drawFilledPaths 循环内重复计算 | 渲染性能 | 低 |
| P2 | pathfinding 字符串键优化 | 计算性能（大网格） | 中 |
| P2 | 热路径上移除 console.warn | 渲染性能 | 低 |
| P2 | findEmpties 中 throw 改为 warn | 健壮性 | 低 |
| P2 | 多入口打包 | 包体积 | 中 |
| P3 | interp2d 动态迭代次数 | 计算性能（边缘场景） | 低 |
| P3 | 导出 API (toDataURL/toBlob) | 用户体验 | 低 |
| P3 | dirty flag + rAF 合并渲染 | 批量更新性能 | 中 |
