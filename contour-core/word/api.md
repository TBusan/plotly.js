# contour-core API 文档

> 版本: 0.3.0
> 更新日期: 2026-03-12

## 目录

- [快速开始](#快速开始)
- [核心计算 API](#核心计算-api)
- [简化渲染 API](#简化渲染-api)
- [Canvas 渲染器 API](#canvas-渲染器-api)
- [Overlay 系统 API](#overlay-系统-api)
- [GeoJSON 导出 API](#geojson-导出-api)
- [坐标轴 API](#坐标轴-api)
- [ColorBar API](#colorbar-api)
- [标签系统 API](#标签系统-api)
- [Null 值处理 API](#null-值处理-api)
- [交互系统 API](#交互系统-api)
- [预设配色方案](#预设配色方案)

---

## 快速开始

### 安装

```bash
npm install contour-core
```

### 浏览器引入

```html
<!-- IIFE 格式 -->
<script src="contour-core.browser.js"></script>
<script>
  contourCore.render(canvas, config);
</script>

<!-- ES Module 格式 -->
<script type="module">
  import contourCore from './contour-core.esm.mjs';
  contourCore.render(canvas, config);
</script>
```

### Node.js 引入

```javascript
const contourCore = require('contour-core');
```

### 最简示例

```javascript
// 生成数据
const z = [];
for (let i = 0; i < 50; i++) {
  z[i] = [];
  for (let j = 0; j < 50; j++) {
    z[i][j] = Math.sin(i / 5) * Math.cos(j / 5);
  }
}

// 渲染
contourCore.render(canvas, {
  z: z,
  smoothing: 0.5,
  colorscale: 'Viridis'
});
```

---

## 核心计算 API

### contourCore.computeContours(grid, options)

计算等值线路径。

**参数：**

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `grid` | Object \| Array | 是 | 数据网格 |
| `grid.z` | Array[Array] | 是 | Z 值二维数组 (支持 null/undefined/NaN) |
| `grid.x` | Array | 否 | X 坐标数组 (默认 [0, 1, 2, ...]) |
| `grid.y` | Array | 否 | Y 坐标数组 (默认 [0, 1, 2, ...]) |
| `options` | Object | 否 | 计算选项 |

**options 配置：**

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `autocontour` | Boolean | true | 自动计算等值线级别 |
| `ncontours` | Number | 15 | 自动模式下的等值线数量 |
| `start` | Number | - | 手动模式起始值 |
| `end` | Number | - | 手动模式结束值 |
| `size` | Number | - | 手动模式步长 |
| `smoothing` | Number | 0 | 平滑度 (0-1) |
| `valueColorMap` | Array | - | 分段颜色映射 [[value, color], ...] |

**返回值：**

```javascript
{
  paths: Array,           // 等值线路径数组
  levels: Array,          // 等值线级别数组
  pathinfo: Array,        // 详细路径信息
  crossings: Array,       // 交叉点信息
  nullMask: Array,        // Null 值掩码
  nullCount: Number,      // Null 值数量
  hasNulls: Boolean       // 是否包含 Null 值
}
```

**示例：**

```javascript
const result = contourCore.computeContours({
  z: zData,
  x: [0, 1, 2, 3, 4],
  y: [0, 1, 2, 3]
}, {
  smoothing: 0.5,
  ncontours: 20
});

console.log(result.levels); // [0.1, 0.2, 0.3, ...]
console.log(result.paths.length); // 等值线数量
```

### contourCore.scalePathsToData(paths, scale)

将路径缩放到数据坐标。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `paths` | Array | 等值线路径数组 |
| `scale` | Number | 缩放因子 |

---

## 简化渲染 API

### contourCore.render(canvas, config)

一步完成等值线计算和渲染。

**参数：**

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `canvas` | HTMLCanvasElement | 是 | Canvas 元素 |
| `config` | Object \| Array | 是 | 配置对象或直接传入 z 数组 |

**config 配置：**

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `z` | Array[Array] | - | Z 值矩阵 |
| `x` | Array | - | X 坐标数组 |
| `y` | Array | - | Y 坐标数组 |
| `width` | Number | canvas.width | 画布宽度 |
| `height` | Number | canvas.height | 画布高度 |
| `smoothing` | Number | 0.5 | 平滑度 (0-1) |
| `colorscale` | String \| Array | 'Viridis' | 配色方案名称或颜色数组 |
| `valueColorMap` | Array | - | 分段颜色映射 [[value, color], ...] |
| `zmin` | Number | - | Z 值最小值 (用于颜色映射) |
| `zmax` | Number | - | Z 值最大值 |
| `reversescale` | Boolean | false | 反转颜色映射 |
| `autocontour` | Boolean | true | 自动计算等值线 |
| `ncontours` | Number | 15 | 等值线数量 |

**contours 配置：**

```javascript
contours: {
  type: 'fill',        // 'fill' | 'lines' | 'heatmap' | 'none'
  showlabels: false,   // 显示标签
  start: 0,            // 起始值 (手动模式)
  end: 100,            // 结束值 (手动模式)
  size: 10             // 步长 (手动模式)
}
```

**colorbar 配置：**

```javascript
colorbar: {
  show: true,          // 是否显示
  title: 'Value',      // 标题
  thickness: 20,       // 厚度
  len: 0.8,            // 长度比例 (0-1)
  position: 'right',   // 位置
  tickInterval: 5      // 刻度间隔
}
```

**axes 配置：**

```javascript
axes: {
  x: {
    show: true,
    title: 'X Axis',
    range: [0, 100],     // 范围
    tickmode: 'auto',    // 'auto' | 'linear' | 'array'
    dtick: 10,           // 刻度间隔
    nticks: 10,          // 目标刻度数
    tickvals: [...],     // 自定义刻度值
    ticktext: [...],     // 自定义刻度文本
    showgrid: true,      // 显示网格线
    gridcolor: '#e0e0e0',
    gridwidth: 1
  },
  y: { /* 类似 x */ }
}
```

**nullRegion 配置：**

```javascript
nullRegion: {
  visible: true,        // 显示 null 区域
  fill: '#ffffff',      // 填充色
  stroke: '#cccccc',    // 边框色
  strokeWidth: 1        // 边框宽度
}
```

**示例：**

```javascript
// 基础用法
contourCore.render(canvas, {
  z: zData,
  smoothing: 0.5,
  colorscale: 'Plasma'
});

// 完整配置
contourCore.render(canvas, {
  z: zData,
  x: xCoords,
  y: yCoords,
  width: 800,
  height: 600,
  smoothing: 0.5,
  colorscale: 'Viridis',
  contours: {
    type: 'fill',
    showlabels: true
  },
  colorbar: {
    show: true,
    title: 'Temperature'
  },
  axes: {
    x: { title: 'X' },
    y: { title: 'Y' }
  },
  nullRegion: {
    visible: true,
    fill: '#f0f0f0'
  }
});

// 直接传入 z 数组
contourCore.render(canvas, zData);
```

### contourCore.drawTo(canvas, result, options)

两步渲染：先计算，后渲染。适用于需要复用计算结果的场景。

**参数：**

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `canvas` | HTMLCanvasElement | 是 | Canvas 元素 |
| `result` | Object | 是 | computeContours 的返回值 |
| `options` | Object | 否 | 渲染选项 |

**示例：**

```javascript
// 步骤1: 计算
const result = contourCore.computeContours({ z: zData }, { smoothing: 0.5 });

// 可以在这里处理 result...

// 步骤2: 渲染
contourCore.drawTo(canvas, result, {
  coloring: 'fill',
  showLines: true,
  valueColorMap: [
    [0, '#313695'],
    [0.5, '#ffffbf'],
    [1, '#a50026']
  ]
});
```

---

## Canvas 渲染器 API

### contourCore.renderers.canvas.drawContours(ctx, contourResult, style)

底层 Canvas 渲染函数。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `ctx` | CanvasRenderingContext2D | Canvas 上下文 |
| `contourResult` | Object | computeContours 返回值 |
| `style` | Object | 渲染样式 |

**style 配置：**

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `width` | Number | 600 | 画布宽度 |
| `height` | Number | 500 | 画布高度 |
| `padding` | Number | 50 | 边距 |
| `coloring` | String | 'lines' | 'fill' \| 'lines' \| 'heatmap' \| 'fill+lines' |
| `showLines` | Boolean | true | 显示等值线 |
| `lineWidth` | Number | 1.5 | 线宽 |
| `lineColor` | String | '#666' | 线颜色 |
| `smoothing` | Number | 0 | 平滑度 |
| `valueColorMap` | Array | - | 颜色映射 |
| `colorScale` | Array | - | 颜色比例尺 |
| `aspectRatio` | String \| Number | 'auto' | 'auto' \| 'equal' \| 1 |

**返回值：** 交互控制器对象

**示例：**

```javascript
const ctx = canvas.getContext('2d');
const result = contourCore.computeContours({ z: zData }, options);

const controller = contourCore.renderers.canvas.drawContours(ctx, result, {
  width: 800,
  height: 600,
  coloring: 'fill',
  showLines: true,
  smoothing: 0.5,
  interaction: {
    zoom: true,
    pan: true,
    dblclickReset: true
  },
  axes: {
    x: { title: 'X Axis' },
    y: { title: 'Y Axis' }
  },
  colorbar: {
    show: true,
    title: 'Value'
  }
});
```

### 控制器 API

`drawContours` 返回的控制器对象：

```javascript
// 视图控制
controller.resetView();                          // 重置视图
controller.setViewRange(xMin, xMax, yMin, yMax); // 设置视图范围
controller.getViewState();                       // 获取当前视图状态

// 样式更新
controller.updateStyle(newStyle);                // 更新样式

// 尺寸调整
controller.resize(width, height);                // 调整画布尺寸

// 数据获取
controller.getContourResult();                   // 获取等值线结果
controller.getOverlay();                         // 获取 Overlay 系统

// 动态更新
controller.updateData({ z: newZ });              // 更新数据 (重新计算)
controller.updateColorScale(valueColorMap);       // 更新颜色映射 (重新计算)
controller.updateColorbar(config);               // 更新 ColorBar
controller.updateContours({ smoothing: 0.8 });   // 更新等值线参数

// 批量更新
controller.update({
  data: { z: newZ },
  colorScale: newColorScale,
  contours: { smoothing: 0.7 },
  colorbar: { title: 'New Title' }
});

// 销毁
controller.destroy();                            // 销毁渲染器
```

---

## Overlay 系统 API

Overlay 系统用于在等值线图上绘制覆盖物（点、线、面、文字）。

### 获取 Overlay 实例

```javascript
const controller = contourCore.renderers.canvas.drawContours(ctx, result, style);
const overlay = controller.getOverlay();
```

### 绘制 API

#### overlay.drawPoint(x, y, options)

绘制点。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `x` | Number | X 数据坐标 |
| `y` | Number | Y 数据坐标 |
| `options` | Object | 点选项 |

**options 配置：**

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `color` | String | '#ff0000' | 颜色 |
| `size` | Number | 8 | 大小 |
| `shape` | String | 'circle' | 'circle' \| 'square' \| 'triangle' \| 'diamond' |
| `strokeColor` | String | - | 边框颜色 |
| `strokeWidth` | Number | 0 | 边框宽度 |
| `opacity` | Number | 1 | 透明度 |

**返回值：** 元素 ID

```javascript
const pointId = overlay.drawPoint(10, 20, {
  color: 'red',
  size: 10,
  shape: 'circle',
  strokeColor: 'black',
  strokeWidth: 2
});
```

#### overlay.drawLine(points, options)

绘制线。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `points` | Array | 点数组 [{x, y}, ...] 或 [[x, y], ...] |
| `options` | Object | 线选项 |

**options 配置：**

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `color` | String | '#000000' | 颜色 |
| `width` | Number | 2 | 线宽 |
| `style` | String | 'solid' | 'solid' \| 'dashed' \| 'dotted' |
| `opacity` | Number | 1 | 透明度 |

```javascript
const lineId = overlay.drawLine([
  { x: 0, y: 0 },
  { x: 10, y: 5 },
  { x: 20, y: 15 }
], {
  color: 'blue',
  width: 2,
  style: 'dashed'
});
```

#### overlay.drawPolygon(points, options)

绘制多边形。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `points` | Array | 顶点数组 [{x, y}, ...] |
| `options` | Object | 多边形选项 |

**options 配置：**

支持两种格式：

**扁平格式（推荐）：**

| 属性 | 类型 | 描述 |
|------|------|------|
| `color` / `fillColor` | String | 填充颜色 |
| `strokeColor` | String | 边框颜色 |
| `strokeWidth` | Number | 边框宽度 |
| `opacity` | Number | 透明度 |

**嵌套格式：**

| 属性 | 类型 | 描述 |
|------|------|------|
| `fill` | Object | 填充配置 |
| `fill.color` | String | 填充颜色 |
| `stroke` | Object | 边框配置 |
| `stroke.color` | String | 边框颜色 |
| `stroke.width` | Number | 边框宽度 |

**图案填充：**

```javascript
// 网格图案
overlay.drawPolygon(points, {
  fill: {
    type: 'pattern',
    pattern: 'grid',           // 'grid' | 'diagonal' | 'dots' | 'hash'
    patternColor: '#666666',
    patternSize: 12,
    color: 'rgba(255,255,255,0.3)'  // 背景色
  },
  stroke: { color: '#333', width: 1 }
});
```

```javascript
// 纯色填充
const polygonId = overlay.drawPolygon([
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
], {
  fillColor: 'rgba(255, 0, 0, 0.5)',
  strokeColor: '#333',
  strokeWidth: 2
});
```

#### overlay.drawText(x, y, content, options)

绘制文字。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `x` | Number | X 数据坐标 |
| `y` | Number | Y 数据坐标 |
| `content` | String | 文字内容 |
| `options` | Object | 文字选项 |

**options 配置：**

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `color` | String | '#000000' | 颜色 |
| `fontSize` | Number | 14 | 字号 |
| `fontFamily` | String | 'Arial' | 字体 |
| `fontWeight` | String | 'normal' | 'normal' \| 'bold' |
| `background` | String | - | 背景色 |
| `opacity` | Number | 1 | 透明度 |

```javascript
const textId = overlay.drawText(10, 20, 'Label', {
  color: '#333',
  fontSize: 16,
  fontWeight: 'bold',
  background: 'rgba(255,255,255,0.8)'
});
```

#### overlay.drawBatch(items)

批量绘制。

```javascript
const ids = overlay.drawBatch([
  { type: 'point', data: { x: 5, y: 5, options: { color: 'red' } } },
  { type: 'line', data: { points: [...], options: { color: 'blue' } } },
  { type: 'polygon', data: { points: [...], options: { fillColor: 'green' } } }
]);
```

### 数据操作 API

```javascript
// 获取
overlay.getItem(id);                  // 获取单个元素
overlay.getAllItems();                // 获取所有元素
overlay.getItemsByType('point');      // 按类型获取
overlay.count('point');               // 统计数量

// 更新
overlay.updateItem(id, data);         // 更新元素
overlay.updateStyle(id, style);       // 只更新样式
overlay.updateData(id, data);         // 只更新数据

// 删除
overlay.removeItem(id);               // 删除单个元素
overlay.clear();                      // 清空所有
overlay.clear('point');               // 清空指定类型
```

### 显示/隐藏 API

```javascript
overlay.hide(id);                     // 隐藏
overlay.show(id);                     // 显示
overlay.toggle(id);                   // 切换
overlay.isHidden(id);                 // 检查是否隐藏

overlay.hideAll();                    // 隐藏全部
overlay.showAll();                    // 显示全部
overlay.hideByType('line');           // 按类型隐藏
overlay.showByType('line');           // 按类型显示

overlay.getVisibleItems();            // 获取可见元素
overlay.getHiddenItems();             // 获取隐藏元素
```

### 定位/聚焦 API

```javascript
// 聚焦到元素
overlay.focusTo(id, { padding: 100 });

// 聚焦到多个元素
overlay.focusToBounds([id1, id2, id3], { padding: 50 });
```

### 高亮 API

```javascript
// 高亮元素
overlay.highlight(id, {
  color: '#ffff00',       // 高亮颜色
  duration: 2000,         // 持续时间 (ms), 0 表示持续
  lineWidth: 3            // 线宽 (线/多边形)
});

// 取消高亮
overlay.clearHighlight(id);
overlay.clearAllHighlights();

// 检查状态
overlay.isHighlighted(id);
overlay.getHighlightedIds();          // 获取所有高亮元素 ID
```

### 坐标转换 API

```javascript
// 数据坐标 -> Canvas 坐标
const canvasPos = overlay.dataToCanvas(10, 20);
// { x: 150, y: 200 }

// Canvas 坐标 -> 数据坐标
const dataPos = overlay.canvasToData(150, 200);
// { x: 10, y: 20 }

// 获取缩放比例
const scale = overlay.getScale();
// { x: 15, y: 10 }

// 检查坐标是否在范围内
overlay.isInBounds(10, 20);
```

### 交互绘制 API

**注意： v0.3.0 版本重构了交互绘制 API，使用统一的事件驱动模式。**

```javascript
// ========================================
// 推荐方式：使用事件订阅
// ========================================

// 订阅事件
overlay.on('draw:complete', function(result) {
  console.log('绘制完成:', result);
});

overlay.on('draw:cancel', function(data) {
  console.log('绘制取消:', data.reason);
});

overlay.on('draw:point', function(data) {
  console.log('添加点:', data.position);
});

overlay.on('draw:preview', function(state) {
  // 预览更新，});

// 开始绘制（不再需要回调参数）
overlay.startDrawing('point', options, canvas);
overlay.startDrawing('line', options, canvas);
overlay.startDrawing('polygon', options, canvas);
overlay.startDrawing('text', options, canvas);

// 停止绘制
overlay.stopDrawing();

// 取消绘制（触发 draw:cancel 事件）
overlay.cancelDrawing();

// 查询状态
overlay.isDrawing();                  // 是否正在绘制
overlay.getDrawMode();                // 当前绘制模式
overlay.getDrawStatus();              // 当前状态 ('idle' | 'drawing' | 'completed')
overlay.getDrawState();               // 绘制状态详情
overlay.getTempPoints();              // 临时点
```

#### 事件列表

| 事件名 | 触发时机 | 数据结构 |
|------|----------|----------|
| `draw:start` | 开始绘制 | `{ mode: string }` |
| `draw:point` | 添加点 | `{ index: number, position: {x, y}, total: number }` |
| `draw:preview` | 预览更新 | `{ mode, status, points, mousePos, options }` |
| `draw:complete` | 绘制完成 | `{ type: string, id: string, ...data }` |
| `draw:cancel` | 绘制取消 | `{ reason: string, discardedPoints: [] }` |
| `draw:stop` | 绘制停止 | `{ reason: string }` |

#### 状态枚举

```javascript
contourCore.DrawStatus.IDLE      // 'idle' - 空闲状态
contourCore.DrawStatus.DRAWING   // 'drawing' - 绘制中
contourCore.DrawStatus.COMPLETED // 'completed' - 已完成
```

#### 事件枚举

```javascript
contourCore.DrawEvents.START    // 'draw:start'
contourCore.DrawEvents.POINT    // 'draw:point'
contourCore.DrawEvents.PREVIEW  // 'draw:preview'
contourCore.DrawEvents.COMPLETE // 'draw:complete'
contourCore.DrawEvents.CANCEL   // 'draw:cancel'
contourCore.DrawEvents.STOP     // 'draw:stop'
```

### 事件订阅 API

```javascript
// 订阅事件（使用事件枚举更安全）
var Events = contourCore.DrawEvents;

overlay.on(Events.COMPLETE, function(result) {
  console.log('绘制完成:', result);
});

overlay.on(Events.CANCEL, function(data) {
  console.log('取消原因:', data.reason);
});

// 也可以直接使用字符串
overlay.on('draw:complete', handler);

// 取消订阅
overlay.off(Events.COMPLETE, handler);

// 订阅一次（自动取消）
overlay.once(Events.COMPLETE, handler);
```

---

## GeoJSON 导出 API

### contourCore.toGeoJSON(contourResult, options)

将等值线转换为 GeoJSON 格式。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `contourResult` | Object | computeContours 返回值 |
| `options` | Object | 导出选项 |

```javascript
const result = contourCore.computeContours({ z: zData }, options);
const geojson = contourCore.toGeoJSON(result);
// {
//   type: 'FeatureCollection',
//   features: [...]
// }
```

### contourCore.toFilledGeoJSON(contourResult, options)

将填充等值线转换为 GeoJSON 格式。

```javascript
const filledGeojson = contourCore.toFilledGeoJSON(result);
```

### contourCore.geojsonStringify(geojson, options)

将 GeoJSON 对象序列化为字符串。

```javascript
const jsonString = contourCore.geojsonStringify(geojson, { pretty: true });
```

---

## 坐标轴 API

### contourCore.axes

坐标轴模块，提供刻度计算和格式化功能。

```javascript
const axes = contourCore.axes;

// 计算刻度
const ticks = axes.calcTicks({
  range: [0, 100],
  nticks: 10,
  tickmode: 'auto'
});

// 格式化刻度
const formatted = axes.tickFormat(ticks, {
  format: '.2f'
});
```

---

## ColorBar API

### contourCore.colorbar

ColorBar 模块。

```javascript
const colorbar = contourCore.colorbar;

// 计算颜色
const colors = colorbar.colors({
  levels: [0, 10, 20, 30],
  colorScale: 'Viridis'
});

// 计算 ColorBar 刻度
const ticks = colorbar.ticks({
  min: 0,
  max: 100,
  interval: 10
});
```

---

## 标签系统 API

### contourCore.labels

等值线标签模块。

```javascript
const labels = contourCore.labels;

// 计算标签位置
const positions = labels.position(contourResult, {
  density: 0.5,
  minDistance: 50
});

// 格式化标签
const formatted = labels.format(positions, {
  format: '.1f'
});
```

---

## Null 值处理 API

### contourCore.nullHandling

Null 值处理模块。

```javascript
const nullHandling = contourCore.nullHandling;

// 验证数据
const validated = nullHandling.validate(zData);

// 规范化数据
const normalized = nullHandling.normalize(zData);

// 生成掩码
const mask = nullHandling.mask(zData);

// 插值填充
const interpolated = nullHandling.interp2d(zData, mask);
```

---

## 交互系统 API

### contourCore.interaction

交互系统模块。

```javascript
const interaction = contourCore.interaction;

// 创建视图状态管理器
const viewManager = interaction.createViewManager(fullRange, {
  minZoom: 0.1,
  maxZoom: 10
});

// 获取当前状态
const state = viewManager.getState();
// { xMin, xMax, yMin, yMax, scale }

// 设置范围
viewManager.setRange(0, 100, 0, 50);

// 重置
viewManager.reset();

// 悬停检测
const hover = interaction.hover(contourResult, canvasX, canvasY, drawingArea);
```

---

## 预设配色方案

### contourCore.COLOR_SCALES

内置配色方案：

```javascript
const scales = contourCore.COLOR_SCALES;

// Viridis - 科研可视化标准
scales.Viridis  // ['#440154', '#482878', ..., '#fde725']

// Plasma - 高对比度
scales.Plasma   // ['#0d0887', '#46039f', ..., '#f0f921']

// Hot - 热力图
scales.Hot      // ['#000000', '#4a0000', ..., '#ffff80']

// Jet - 经典彩虹
scales.Jet      // ['#000080', '#0000ff', ..., '#000000']

// Earth - 地理数据
scales.Earth    // ['#2a1c0b', '#5c4033', ..., '#deb887']

// Electric - 电场数据
scales.Electric // ['#000004', '#1b0c42', ..., '#fcffa4']
```

### 使用配色方案

```javascript
// 使用预设名称
contourCore.render(canvas, {
  z: zData,
  colorscale: 'Viridis'
});

// 使用自定义颜色数组
contourCore.render(canvas, {
  z: zData,
  colorscale: ['#0000ff', '#00ff00', '#ff0000']
});

// 使用分段映射 (精确控制)
contourCore.render(canvas, {
  z: zData,
  valueColorMap: [
    [0, '#313695'],
    [0.25, '#74add1'],
    [0.5, '#ffffbf'],
    [0.75, '#f46d43'],
    [1, '#a50026']
  ]
});
```

---

## 完整示例

### 带交互的等值线图

```javascript
const canvas = document.getElementById('canvas');
const z = generateData(50, 50);

// 渲染
const controller = contourCore.renderers.canvas.drawContours(
  canvas.getContext('2d'),
  contourCore.computeContours({ z }, { smoothing: 0.5 }),
  {
    width: 800,
    height: 600,
    coloring: 'fill',
    showLines: true,
    smoothing: 0.5,
    interaction: {
      zoom: true,
      pan: true,
      dblclickReset: true
    },
    axes: {
      x: { title: 'X Axis', showgrid: true },
      y: { title: 'Y Axis', showgrid: true }
    },
    colorbar: {
      show: true,
      title: 'Value'
    }
  }
);

// 获取 Overlay
const overlay = controller.getOverlay();

// 添加覆盖物
overlay.drawPoint(25, 25, { color: 'red', size: 10 });
overlay.drawLine([{x: 10, y: 10}, {x: 40, y: 40}], { color: 'blue', width: 2 });

// 高亮点
overlay.highlight(pointId, { color: 'yellow', duration: 2000 });

// 动态更新
document.getElementById('updateBtn').onclick = function() {
  const newZ = generateData(50, 50);
  controller.updateData({ z: newZ });
};
```

### 使用 valueColorMap 精确控制颜色

```javascript
const valueColorMap = [
  [-1, '#313695'],   // < -1: 深蓝
  [-0.5, '#4575b4'],
  [0, '#74add1'],
  [0.5, '#e0f3f8'],
  [0.75, '#fee090'],
  [1, '#fdae61'],
  [1.5, '#d73027'],
  [2, '#a50026']     // >= 2: 深红
];

contourCore.render(canvas, {
  z: zData,
  valueColorMap: valueColorMap,
  smoothing: 0.5
});
```

---

## 低级模块

以下模块可直接访问，用于高级定制：

```javascript
// Marching Squares 算法
contourCore.marchingSquares

// 路径查找算法
contourCore.pathFinding

// 等值线级别计算
contourCore.levels

// 平滑算法
contourCore.smooth

// 常量
contourCore.constants

// Overlay 类（独立使用）
contourCore.Overlay
contourCore.Overlay.Overlay
contourCore.Overlay.CoordSystem
contourCore.Overlay.EventEmitter
contourCore.Overlay.primitives
```

---

## TypeScript 类型定义

```typescript
declare namespace ContourCore {
  // 数据类型
  interface GridData {
    z: (number | null | undefined)[][];
    x?: number[];
    y?: number[];
  }

  interface ComputeOptions {
    autocontour?: boolean;
    ncontours?: number;
    start?: number;
    end?: number;
    size?: number;
    smoothing?: number;
    valueColorMap?: [number, string][];
  }

  interface ContourResult {
    paths: Path[];
    levels: number[];
    pathinfo: PathInfo[];
    crossings: Crossings;
    nullMask: boolean[][];
    nullCount: number;
    hasNulls: boolean;
  }

  // Overlay 类型
  interface PointOptions {
    color?: string;
    size?: number;
    shape?: 'circle' | 'square' | 'triangle' | 'diamond';
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
  }

  interface LineOptions {
    color?: string;
    width?: number;
    style?: 'solid' | 'dashed' | 'dotted';
    opacity?: number;
  }

  interface PolygonOptions {
    color?: string;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    fill?: {
      type: 'color' | 'pattern';
      color?: string;
      pattern?: 'grid' | 'diagonal' | 'dots' | 'hash';
      patternColor?: string;
      patternSize?: number;
    };
    stroke?: {
      color: string;
      width?: number;
      style?: string;
    };
    opacity?: number;
  }

  interface TextOptions {
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: 'normal' | 'bold';
    background?: string;
    opacity?: number;
  }

  // 控制器类型
  interface Controller {
    resetView(): void;
    setViewRange(xMin: number, xMax: number, yMin: number, yMax: number): void;
    getViewState(): ViewState;
    updateStyle(style: StyleOptions): void;
    resize(width: number, height: number): void;
    getContourResult(): ContourResult;
    getOverlay(): OverlaySystem;
    updateData(data: GridData): void;
    updateColorScale(valueColorMap: [number, string][]): void;
    updateColorbar(config: ColorbarConfig): void;
    updateContours(options: ComputeOptions): void;
    update(config: UpdateConfig): void;
    destroy(): void;
  }

  // Overlay 系统类型
  interface OverlaySystem {
    drawPoint(x: number, y: number, options?: PointOptions): string;
    drawLine(points: Point[], options?: LineOptions): string;
    drawPolygon(points: Point[], options?: PolygonOptions): string;
    drawText(x: number, y: number, content: string, options?: TextOptions): string;
    drawBatch(items: DrawItem[]): string[];
    getItem(id: string): OverlayItem | null;
    getAllItems(): OverlayItem[];
    removeItem(id: string): boolean;
    clear(type?: string): void;
    hide(id: string): boolean;
    show(id: string): boolean;
    toggle(id: string): boolean;
    highlight(id: string, options?: HighlightOptions): boolean;
    clearHighlight(id: string): boolean;
    focusTo(id: string, options?: FocusOptions): boolean;
    dataToCanvas(x: number, y: number): Point;
    canvasToData(x: number, y: number): Point;
    // ... 更多方法
  }
}
```

---

## 更新日志

### v0.3.0 (2026-03-12)
- 重构 Overlay 目录结构 (`overlay/renderers/` → `overlay/primitives/`)
- 重命名 `overlay/services/renderer.js` → `overlay/services/drawing.js`
- 修复多边形高亮和样式更新 bug
- 修复图案填充 bug
- 优化 OverlayManager 支持扁平格式和嵌套格式

### v0.2.0
- 新增 Null 值支持
- 新增简化渲染 API (`render`, `drawTo`)
- 新增 Overlay 系统
- 新增动态更新 API (`updateData`, `updateColorScale`, `updateContours`)

### v0.1.0
- 初始版本
- 基础等值线计算
- Canvas 渲染
- SVG 渲染
