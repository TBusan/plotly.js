# Plotly.js 第三方渲染插件详解

## 目录
1. [概述](#概述)
2. [核心渲染依赖](#核心渲染依赖)
3. [数学计算依赖](#数学计算依赖)
4. [颜色处理依赖](#颜色处理依赖)
5. [交互事件依赖](#交互事件依赖)
6. [Contour 专用依赖](#contour专用依赖)
7. [依赖精简建议](#依赖精简建议)

---

## 概述

Plotly.js 是一个功能强大的 JavaScript 图表库，在渲染 contour（等值线）时使用了多个第三方插件。这些插件按功能可分为：

- **SVG/WebGL 渲染** - 负责图形绘制
- **数学/几何计算** - 处理路径、多边形运算
- **颜色处理** - 颜色解析、转换、标准化
- **交互事件** - 鼠标、触摸事件处理
- **数据计算** - 插值、统计等

---

## 核心渲染依赖

### 1. D3.js - 核心渲染引擎

```json
"@plotly/d3": "3.8.2"
```

**作用**：Plotly.js 的核心渲染引擎

**主要功能**：
- **SVG 元素创建** - `d3.select()`, `selectAll()`, `append()`
- **数据绑定** - `.data()`, `.enter()`, `.exit()`
- **路径生成** - `d3.line()`, `d3.area()`, `d3.path()`
- **比例尺** - `d3.scaleLinear()`, `d3.scaleLog()`
- **轴生成** - `d3.axis()`, `d3.axisBottom()`

**Contour 渲染中的应用**：
```javascript
// src/traces/contour/plot.js
var d3 = require('@plotly/d3');

// 创建等值线路径
var contourPath = d3.svg.line()
    .x(function(d) { return xa.c2p(d[0]; })
    .y(function(d) { return ya.c2p(d[1]; });

// 绑定数据到 SVG path 元素
var paths = plotGroup.selectAll('path')
    .data(pathinfo)
    .enter().append('path')
    .attr('d', function(d) { return contourPath(d); });
```

---

### 2. svg-path-sdf - 路径距离场渲染

```json
"svg-path-sdf": "^1.1.3"
```

**作用**：为 SVG 路径生成有符号距离场（SDF），用于优化渲染

**主要功能**：
- 将 SVG 路径转换为 SDF 图像
- 提供高质量的抗锯齿效果
- 优化复杂路径的渲染性能

**使用方式**：
```javascript
// 用于复杂等值线路径的渲染优化
var sdf = require('svg-path-sdf');
var pathSDF = sdf(pathElement, {
    width: width,
    height: height,
    canvas: canvasElement
});
```

---

### 3. WebGL 渲染插件组

#### 3.1 regl - WebGL 框架

```json
"@plotly/regl": "^2.1.2"
```

**作用**：WebGL 2.0 渲染框架，提供简洁的 WebGL 接口

**主要功能**：
- WebGL 上下文管理
- 缓冲区创建和数据绑定
- 着色器编译和链接
- 绘制命令封装

#### 3.2 gl-text - WebGL 文本渲染

```json
"gl-text": "^1.4.0"
```

**作用**：在 WebGL 中渲染文本

**主要功能**：
- 文本纹理生成
- SDF 文本渲染（支持缩放）
- 多种字体支持

#### 3.3 gl-mat4 - 矩阵运算

```json
"gl-mat4": "^1.2.0"
```

**作用**：WebGL 矩阵和向量数学运算

**主要功能**：
- 矩阵乘法、求逆
- 向量运算（点积、叉积）
- 视图/投影矩阵计算

#### 3.4 regl-scatter2d - WebGL 散点

```json
"regl-scatter2d": "^3.3.1"
```

**作用**：WebGL 2D 散点图渲染器

**主要功能**：
- 高性能散点渲染
- 点符号支持
- 颜色映射

#### 3.5 regl-line2d - WebGL 线图

```json
"regl-line2d": "^3.1.3"
```

**作用**：WebGL 2D 线图渲染器

**主要功能**：
- 线段渲染
- 连接线绘制
- 错误带渲染

#### 3.6 regl-error2d - WebGL 误差条

```json
"regl-error2d": "^2.0.12"
```

**作用**：WebGL 误差条渲染

---

### 4. webgl-context - WebGL 上下文管理

```json
"webgl-context": "^2.2.0"
```

**作用**：跨浏览器的 WebGL 上下文获取

**主要功能**：
- 自动处理浏览器前缀
- WebGL 2 上下文获取
- 上下文丢失恢复

**使用示例**：
```javascript
// src/lib/prepare_regl.js
var webglContext = require('webgl-context');
var gl = webglContext(canvasElement, { preserveDrawingBuffer: true });
```

---

## 数学计算依赖

### 1. polybooljs - 多边形布尔运算

```json
"polybooljs": "^1.2.2"
```

**作用**：多边形布尔运算（并、交、差、异或）

**主要功能**：
- `regions.union(polyA, polyB)` - 并集
- `regions.xor(polyA, polyB)` - 异或
- `regions.difference(polyA, polyB)` - 差集
- `regions.intersect(polyA, polyB)` - 交集

**Contour 中的应用**：
```javascript
// 用于处理等值线填充时的多边形运算
// 将多个等值线区域合并为最终的填充区域
```

### 2. point-in-polygon - 点在多边形检测

```json
"point-in-polygon": "^1.1.0"
```

**作用**：判断点是否在多边形内部

**主要功能**：
- 射线法判断点是否在多边形内
- 支持凹多边形
- 边界情况处理

**Contour 中的应用**：
```javascript
// 判断标注点是否在等值线区域内
// 检测鼠标点击位置对应的等值线级别
```

### 3. fast-isnumeric - 快速数值检测

```json
"fast-isnumeric": "^1.1.4"
```

**作用**：快速检测值是否为数字

**主要功能**：
- 比 `typeof` 更严格的数字检测
- 处理字符串形式的数字
- 过滤 `NaN` 和 `Infinity`

**使用示例**：
```javascript
// src/traces/contour/calc.js
var isNumeric = require('fast-isnumeric');

function validateZ(zData) {
    for (var i = 0; i < zData.length; i++) {
        for (var j = 0; j < zData[i].length; j++) {
            if (!isNumeric(zData[i][j])) {
                zData[i][j] = null; // 标记为无效值
            }
        }
    }
}
```

---

## 颜色处理依赖

### 1. tinycolor2 - 颜色解析和处理

```json
"tinycolor2": "^1.4.2"
```

**作用**：强大的颜色解析、操作和格式化库

**主要功能**：
- 颜色解析：`tinycolor('red')`, `tinycolor('#f00')`
- 颜色转换：`.toRgb()`, `.toHsv()`, `.toHsl()`
- 颜色操作：`.lighten()`, `.darken()`, `.saturate()`
- 格式化：`.toString()`, `.toHexString()`

**Contour 中的应用**：
```javascript
// src/traces/contour/plot.js
var tinycolor = require('tinycolor2');

// 计算颜色标尺
var colorScale = levels.map(function(level) {
    var t = (level - min) / (max - min);
    return tinycolor(startColor)
        .mix(endColor, t)
        .toHexString();
});
```

### 2. color-parse - 颜色解析

```json
"color-parse": "2.0.0"
```

**作用**：解析各种格式的颜色字符串

**支持格式**：
- 十六进制：`#ff0000`, `#f00`
- RGB：`rgb(255, 0, 0)`, `rgba(255, 0, 0, 0.5)`
- HSL：`hsl(0, 100%, 50%)`
- 颜色名称：`red`, `blue`, `transparent`

### 3. color-normalize - 颜色标准化

```json
"color-normalize": "1.5.0"
```

**作用**：将颜色转换为统一的标准化格式

### 4. color-rgba - RGBA 颜色处理

```json
"color-rgba": "3.0.0"
```

**作用**：RGBA 颜色处理和转换

### 5. color-alpha - 透明度处理

```json
"color-alpha": "1.0.4"
```

**作用**：颜色的 alpha 通道处理

---

## 交互事件依赖

### 1. mouse-wheel - 滚轮事件

```json
"mouse-wheel": "^1.2.0"
```

**作用**：跨浏览器的滚轮事件规范化

**主要功能**：
- 统一 `wheelDelta` 值
- 支持 `wheelDeltaMode`
- 阻止默认滚动行为

**Contour 缩放中的应用**：
```javascript
// src/plots/cartesian/dragbox.js
var mouseWheel = require('mouse-wheel');

maindrag.onwheel = function(evt) {
    var zoom = Math.exp(-Math.min(Math.max(evt.wheelDelta, -20), 20) / 200);
    // 应用缩放...
};
```

### 2. mouse-change - 鼠标状态变化

```json
"mouse-change": "^1.4.0"
```

**作用**：检测鼠标位置变化

### 3. mouse-event-offset - 鼠标事件偏移

```json
"mouse-event-offset": "^3.0.2"
```

**作用**：获取鼠标事件相对于元素的偏移

### 4. has-passive-events - 被动事件支持

```json
"has-passive-events": "^1.0.0"
```

**作用**：检测浏览器是否支持被动事件监听器

```javascript
// src/plots/cartesian/graph_interact.js
var supportsPassive = require('has-passive-events');

element.addEventListener('wheel', onWheel, supportsPassive ? { passive: false } : false);
```

---

## Contour 专用依赖

### 1. parse-svg-path - SVG 路径解析

```json
"parse-svg-path": "^0.1.2"
```

**作用**：解析 SVG 路径字符串为命令数组

**主要功能**：
- 将 `d="M 10 10 L 20 20"` 解析为命令对象
- 支持 M, L, C, Q, Z 等命令
- 用于路径操作和重新生成

**应用**：
```javascript
// 解析等值线路径后，可以重新计算标注位置
var parsed = parseSvgPath(pathElement.getAttribute('d'));
```

### 2. canvas-fit - Canvas 适配

```json
"canvas-fit": "^1.5.0"
```

**作用**：计算 Canvas 的最佳显示尺寸

**应用**：
```javascript
// 确保等值线图在不同屏幕尺寸下正确显示
var fit = require('canvas-fit');
var container = fit(containerElement);
canvas.width = container.width;
canvas.height = container.height;
```

### 3. strongly-connected-components - 强连通分量

```json
"strongly-connected-components": "^1.0.1"
```

**作用**：图的强连通分量算法

**应用**：
- 分析等值线的连通性
- 检测闭合路径

### 4. probe-image-size - 图像尺寸探测

```json
"probe-image-size": "^7.2.3"
```

**作用**：同步探测图片尺寸

**应用**：
- 加载自定义背景图片时获取尺寸
- 等值线纹理映射

---

## 依赖精简建议

### Contour-Core 最小依赖集

如果要重构一个只支持 contour 的轻量级库，以下是最小依赖集合：

```json
{
  "dependencies": {
    // 核心 SVG 渲染（必需）
    "@plotly/d3": "3.8.2",

    // 数学计算（必需）
    "fast-isnumeric": "1.1.4",
    "point-in-polygon": "1.1.0",

    // 颜色处理（必需）
    "tinycolor2": "1.4.2",
    "color-parse": "2.0.0",

    // 可选：多边形运算（用于复杂填充）
    "polybooljs": "1.2.2",

    // 可选：路径解析（用于路径操作）
    "parse-svg-path": "0.1.2",

    // 交互事件（如需交互功能）
    "mouse-wheel": "1.2.0",
    "has-passive-events": "1.0.0",
    "mouse-event-offset": "3.0.2"
  }
}
```

### 不需要的依赖

对于纯 contour 渲染，以下依赖可以移除：

| 依赖 | 用途 | 是否需要 |
|------|------|----------|
| `@plotly/d3-sankey` | 桑基图 | ❌ |
| `@plotly/d3-sankey-circular` | 圆形桑基图 | ❌ |
| `@plotly/mapbox-gl` | 地图渲染 | ❌ |
| `maplibre-gl` | 地图渲染 | ❌ |
| `@turf/*` | 地理计算 | ❌ |
| `d3-geo*` | 地理投影 | ❌ |
| `d3-force` | 力导向布局 | ❌ |
| `d3-hierarchy` | 层级布局 | ❌ |
| `regl-*` | WebGL 散点/线图 | ❌ |
| `gl-*` | WebGL 工具 | ❌ |
| `world-calendars` | 日历系统 | ❌ |

---

## 依赖使用示例

### SVG 路径渲染

```javascript
// 使用 @plotly/d3 创建等值线路径
var d3 = require('@plotly/d3');

var lineGenerator = d3.svg.line()
    .x(function(d) { return d.x; })
    .y(function(d) { return d.y; })
    .curve(d3.curveBasisClosed);  // 闭合曲线

var pathElement = d3.select('svg')
    .append('path')
    .datum(contourPathData)
    .attr('d', lineGenerator);
```

### 颜色插值

```javascript
// 使用 tinycolor2 进行颜色插值
var tinycolor = require('tinycolor2');

function interpolateColor(level, minLevel, maxLevel, startColor, endColor) {
    var t = (level - minLevel) / (maxLevel - minLevel);
    return tinycolor(startColor)
        .mix(endColor, t)
        .toHexString();
}
```

### 数值验证

```javascript
// 使用 fast-isnumeric 验证数据
var isNumeric = require('fast-isnumeric');

function cleanData(zData) {
    return zData.map(function(row) {
        return row.map(function(val) {
            return isNumeric(val) ? Number(val) : null;
        });
    });
}
```

### 滚轮缩放

```javascript
// 使用 mouse-wheel 实现缩放
var mouseWheel = require('mouse-wheel');

element.addEventListener('wheel', function(evt) {
    var zoomFactor = Math.exp(-evt.wheelDelta / 200);

    // 应用缩放
    currentRange = currentRange / zoomFactor;

    // 重新渲染等值线
    renderContours(newRange);
}, { passive: false });
```

---

## 总结

Plotly.js 在渲染 contour 时使用的核心第三方插件包括：

1. **@plotly/d3** - 核心 SVG 渲染引擎
2. **tinycolor2** - 颜色处理
3. **polybooljs** - 多边形布尔运算（用于填充）
4. **fast-isnumeric** - 数值验证
5. **point-in-polygon** - 几何计算
6. **parse-svg-path** - 路径操作
7. **mouse-wheel** - 缩放交互

这些插件共同构成了 Plotly.js 强大的等值线渲染能力。对于 contour-core 的重构，可以根据实际需求选择保留核心依赖，移除不相关的功能模块。
