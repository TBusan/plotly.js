# Contour-Core 优化升级分析报告

## 目录
1. [总体评估](#总体评估)
2. [已实现良好的模块](#已实现良好的模块)
3. [需要优化的关键部分](#需要优化的关键部分)
4. [缺失的重要功能](#缺失的重要功能)
5. [优化优先级](#优化优先级)
6. [具体优化建议](#具体优化建议)

---

## 总体评估

### 评分卡

| 模块 | 完成度 | 准确性 | 性能 | 备注 |
|------|--------|--------|------|------|
| Marching Squares 核心算法 | ✅ 100% | ✅ 完全匹配 | ✅ 优秀 | 完全复制 Plotly 逻辑 |
| 路径追踪 (Pathfinding) | ✅ 95% | ✅ 完全匹配 | ✅ 优秀 | 缺少少量优化细节 |
| 等值线级别设置 (Levels) | ⚠️ 70% | ⚠️ 部分实现 | ✅ 良好 | **缺少智能刻度算法** |
| 边界关闭 (Close Boundaries) | ✅ 100% | ✅ 完全匹配 | ✅ 优秀 | 完全实现 |
| 标签定位优化 (Labels) | ✅ 90% | ✅ 完全匹配 | ✅ 良好 | 代价函数完整 |
| 填充模式 (Fill Rendering) | ✅ 95% | ✅ 完全匹配 | ✅ 优秀 | 奇偶规则正确 |
| Line 模式渲染 | ✅ 100% | ✅ 完全匹配 | ✅ 优秀 | 完全实现 |
| 颜色映射 (Color Mapping) | ⚠️ 75% | ⚠️ 简化版 | ✅ 良好 | **缺少高级特性** |
| 标尺生成 (Colorbar) | ⚠️ 60% | ⚠️ 基础实现 | ✅ 良好 | **缺少智能刻度** |
| 平滑算法 (Smoothing) | ✅ 100% | ✅ 完全匹配 | ✅ 优秀 | Catmull-Rom 完整实现 |

### 总体结论

**优势：**
- ✅ 核心算法完全正确
- ✅ 模块化设计优秀
- ✅ SSR 友好
- ✅ Null 值处理完善

**需要改进：**
- ⚠️ 自动刻度算法过于简单
- ⚠️ 颜色映射缺少自定义阈值支持
- ⚠️ 标尺刻度生成不智能
- ⚠️ 插值计算可以更精确

---

## 已实现良好的模块

### 1. ✅ Marching Squares 算法 (100%)

**文件**: `contour-core/marchingsquares.js`

**对比 Plotly.js**: `src/traces/contour/make_crossings.js`

**评价**:
```javascript
// contour-core 的实现完全匹配 Plotly.js
function getMarchingIndex(val, corners) {
    var mi = (corners[0][0] > val ? 0 : 1) +
             (corners[0][1] > val ? 0 : 2) +
             (corners[1][1] > val ? 0 : 4) +
             (corners[1][0] > val ? 0 : 8);

    if (mi === 5 || mi === 10) {
        var avg = (corners[0][0] + corners[0][1] +
                   corners[1][0] + corners[1][1]) / 4;
        if (val > avg) return (mi === 5) ? 713 : 1114;
        else return (mi === 5) ? 104 : 208;
    }
    return (mi === 15) ? 0 : mi;
}
```

**无需优化** - 这是 Plotly.js 的精确复制。

---

### 2. ✅ 路径追踪算法 (95%)

**文件**: `contour-core/pathfinding.js`

**对比 Plotly.js**: `src/traces/contour/find_all_paths.js`

**评价**:
- 核心逻辑完全正确
- 路径合并逻辑完整
- 点简化算法正确

**小改进建议** (5% 差距):
```javascript
// Plotly.js 中有一个边界检查优化
// contour-core 可以添加类似优化

// 建议添加：
function isValidPath(pts, tolerance) {
    if (pts.length < 2) return false;
    // 检查路径是否自相交
    // 检查路径是否超出边界
    return true;
}
```

---

### 3. ✅ 边界关闭逻辑 (100%)

**文件**: `contour-core/close_boundaries.js`

**对比 Plotly.js**: `src/traces/contour/close_boundaries.js`

**评价**:
- 完全实现 Plotly.js 的逻辑
- 支持 constraint 类型
- prefixBoundary 标记正确

**无需优化**。

---

### 4. ✅ 标签优化算法 (90%)

**文件**: `contour-core/labels/position.js`, `contour-core/labels/cost.js`

**对比 Plotly.js**: `src/traces/contour/plot.js` (line 447-538)

**评价**:
- 代价函数完全正确
- 迭代搜索算法正确
- 边缘距离惩罚正确

**小改进建议** (10% 差距):
```javascript
// Plotly.js 使用了 Lib.getTextLocation 和 Lib.segmentDistance
// contour-core 的简化版本功能相同，但可以更精确

// 建议添加：
function segmentDistance(x1, y1, x2, y2, x3, y3, x4, y4) {
    // 完整实现 Plotly 的 segmentDistance
    // 考虑线段到线段的最短距离
}
```

---

## 需要优化的关键部分

### ⚠️ 1. 等值线级别设置 (70% → 95%)

**文件**: `contour-core/levels.js`

**对比 Plotly.js**: `src/traces/contour/set_contours.js`

**问题分析**:

#### 当前实现 (简化版):
```javascript
// contour-core/levels.js (line 68-78)
var ncontours = options.ncontours || 15;
size = (end - start) / (ncontours - 1);

// 简单等间距生成
for (var val = start; val <= end + size * 0.0001; val += size) {
    levels.push(Math.round(val * 10000) / 10000);
}
```

#### Plotly.js 实现 (智能版):
```javascript
// src/traces/contour/set_contours.js (line 129-141)
function autoContours(start, end, ncontours) {
    var dummyAx = {
        type: 'linear',
        range: [start, end]
    };

    Axes.autoTicks(
        dummyAx,
        (end - start) / (ncontours || 15)
    );

    return dummyAx;
}

// Axes.autoTicks 会：
// 1. 计算合适的刻度间隔（考虑数字的"友好性"）
// 2. 使用 math.log10 和 round 优化刻度
// 3. 生成"漂亮"的数字（如 1, 2, 5, 10, 而不是 1.234）
```

#### 优化建议:

**需要添加智能刻度算法**:

```javascript
// 新增文件: contour-core/smart_ticks.js
function autoTicks(start, end, ncontours) {
    var range = end - start;
    var roughStep = range / (ncontours || 15);

    // 计算合适的步长（使用"友好"数字）
    var exponent = Math.floor(Math.log10(roughStep));
    var fraction = roughStep / Math.pow(10, exponent);
    var niceFraction;

    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;

    var step = niceFraction * Math.pow(10, exponent);

    // 调整起始值，使其是步长的倍数
    var adjustedStart = Math.ceil(start / step) * step;
    var adjustedEnd = Math.floor(end / step) * step;

    return {
        start: adjustedStart,
        end: adjustedEnd,
        step: step
    };
}

// 更新 levels.js
function setContours(options, vals) {
    // ... 现有代码 ...

    if (options.autocontour) {
        // 使用智能刻度算法
        var smartTicks = autoTicks(zmin, zmax, ncontours);

        for (var val = smartTicks.start;
             val <= smartTicks.end + smartTicks.step * 0.0001;
             val += smartTicks.step) {
            levels.push(val);
        }
    }

    // ...
}
```

**影响**: 这会让自动生成的等值线更加美观和专业。

---

### ⚠️ 2. 颜色映射与自定义阈值 (75% → 95%)

**文件**: `contour-core/colorbar/colors.js` (推测)

**对比 Plotly.js**: `src/traces/contour/make_color_map.js`

**问题分析**:

#### Plotly.js 的高级特性:
```javascript
// src/traces/contour/make_color_map.js (line 74-143)
if(customLevels && customLevels.length > 0) {
    // 使用自定义阈值
    var levels = customLevels;
    var minLevel = levels[0];
    var maxLevel = levels[levels.length - 1];

    // 为每个自定义级别分配颜色
    for(i = 0; i < len; i++) {
        si = scl[i];
        // 将颜色位置映射到阈值范围
        domain[i] = effectiveMin + si[0] * (effectiveMax - effectiveMin);
        range[i] = si[1];
    }
}

// 关键：支持热力图模式的颜色扩展
if(zmin !== zmin0) {
    domain.splice(0, 0, zmin);
    range.splice(0, 0, range[0]);
}
```

#### 优化建议:

**需要支持以下特性**:

1. **自定义阈值颜色映射**
```javascript
function buildColorScaleForThresholds(thresholds, colorscale) {
    // 为每个阈值分配对应的颜色
    var scale = [];

    for (var i = 0; i < thresholds.length; i++) {
        var t = thresholds[i];
        var position = (t - thresholds[0]) /
                      (thresholds[thresholds.length - 1] - thresholds[0]);

        // 从 colorscale 中找到对应的颜色
        var color = interpolateColor(colorscale, position);
        scale.push([t, color]);
    }

    return scale;
}
```

2. **热力图模式颜色扩展**
```javascript
function extendColorscaleForHeatmap(domain, range, dataMin, dataMax) {
    // 如果数据范围超出 colorscale 范围，扩展颜色
    if (dataMin < domain[0]) {
        domain.unshift(dataMin);
        range.unshift(range[0]); // 使用相同颜色
    }
    if (dataMax > domain[domain.length - 1]) {
        domain.push(dataMax);
        range.push(range[range.length - 1]);
    }

    return { domain: domain, range: range };
}
```

---

### ⚠️ 3. 插值计算精度 (80% → 95%)

**文件**: `contour-core/pathfinding.js` (line 312-338)

**对比 Plotly.js**: `src/traces/contour/find_all_paths.js` (line 265-293)

**问题分析**:

#### 当前实现 (简化版):
```javascript
// contour-core/pathfinding.js (line 319-327)
if (step[1]) {
    // 垂直插值
    var dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);
    return [
        locx + dx,  // 仅使用网格索引
        locy,
        locx + dx,
        locy
    ];
}
```

#### Plotly.js 实现 (精确版):
```javascript
// src/traces/contour/find_all_paths.js (line 273-292)
if(step[1]) {
    var dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);

    // 在线性空间插值，然后转换到像素
    var dxl =
        (dx !== 1 ? (1 - dx) * xa.c2l(pi.x[locx]) : 0) +
        (dx !== 0 ? dx * xa.c2l(pi.x[locx + 1]) : 0);

    return [xa.c2p(xa.l2c(dxl), true),
            ya.c2p(pi.y[locy], true),
            locx + dx, locy];
}
```

#### 优化建议:

**需要支持精确插值**:

```javascript
// 修改 pathfinding.js 的 getInterpPx 函数
function getInterpPx(pi, loc, step, scaleFunctions) {
    var locx = loc[0] + Math.max(step[0], 0);
    var locy = loc[1] + Math.max(step[1], 0);
    var zxy = pi.z[locy][locx];

    // 添加 scaleFunctions 参数
    var xa = scaleFunctions.xa;
    var ya = scaleFunctions.ya;
    var x = pi.x;
    var y = pi.y;

    if (step[1]) {
        // 水平边插值
        var dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);

        // 在数据空间插值
        var dxl = (dx !== 1 ? (1 - dx) * x[locx] : 0) +
                  (dx !== 0 ? dx * x[locx + 1] : 0);

        return [dxl, y[locy], locx + dx, locy];
    } else {
        // 垂直边插值
        var dy = (pi.level - zxy) / (pi.z[locy + 1][locx] - zxy);

        var dyl = (dy !== 1 ? (1 - dy) * y[locy] : 0) +
                  (dy !== 0 ? dy * y[locy + 1] : 0);

        return [x[locx], dyl, locx, locy + dy];
    }
}
```

**影响**: 这对于非均匀网格（如对数坐标轴）非常重要。

---

### ⚠️ 4. 标尺刻度生成 (60% → 90%)

**文件**: `contour-core/colorbar/ticks.js` (推测)

**对比 Plotly.js**: `src/traces/contour/plot.js` (line 384-427)

**问题分析**:

#### Plotly.js 的智能格式化:
```javascript
// src/traces/contour/plot.js (line 384-427)
exports.labelFormatter = function(gd, cd0) {
    var formatAxis = {
        type: 'linear',
        _id: 'ycontour',
        showexponent: 'all',
        exponentformat: 'B'
    };

    if(contours.labelformat) {
        formatAxis.tickformat = contours.labelformat;
        setConvert(formatAxis, fullLayout);
    } else {
        // 使用 colorbar 的轴配置
        var cOpts = Colorscale.extractOpts(trace);
        if(cOpts && cOpts.colorbar && cOpts.colorbar._axis) {
            formatAxis = cOpts.colorbar._axis;
        } else {
            // 自动生成刻度
            formatAxis.range = [contours.start, contours.end];
            formatAxis.nticks = (contours.end - contours.start) / contours.size;
            setConvert(formatAxis, fullLayout);
            Axes.prepTicks(formatAxis);
        }
    }

    return function(v) { return Axes.tickText(formatAxis, v).text; };
};
```

#### 优化建议:

**需要实现智能刻度和格式化**:

```javascript
// 新增文件: contour-core/colorbar/ticks.js
function computeTicks(start, end, size, options) {
    var ticks = [];
    var formatOptions = options || {};

    // 生成刻度位置
    for (var val = start; val <= end; val += size) {
        ticks.push({
            value: val,
            label: formatTickValue(val, formatOptions)
        });
    }

    return ticks;
}

function formatTickValue(value, options) {
    var format = options.format || '';
    var showExponent = options.showExponent || false;

    if (format) {
        // 使用 D3 或自定义格式化
        return d3Format(value, format);
    }

    // 智能格式化
    if (showExponent && Math.abs(value) >= 10000) {
        return value.toExponential(2);
    }

    // 根据数值大小选择合适的小数位数
    var absValue = Math.abs(value);
    if (absValue < 0.01) {
        return value.toFixed(4);
    } else if (absValue < 1) {
        return value.toFixed(2);
    } else {
        return value.toFixed(1);
    }
}

// 支持自定义格式化字符串
function d3Format(value, format) {
    // 实现类似 D3 的格式化语法
    // 例如: ".2f", ".0%", ".2e"
    return format; // 简化版
}
```

---

## 缺失的重要功能

### ❌ 1. 缺少热力图背景渲染

**Plotly.js 支持**:
```javascript
// src/traces/contour/plot.js (line 35-40)
if(contours.coloring === 'heatmap') {
    cdheatmaps = [cd];
}
heatmapPlot(gd, plotinfo, cdheatmaps, heatmapColoringLayer);
```

**建议添加**:
```javascript
// 新增文件: contour-core/renderers/canvas/heatmap.js
function drawHeatmapBackground(ctx, grid, style) {
    // 为每个网格单元绘制颜色
    var z = grid.z;
    var m = z.length;
    var n = z[0].length;
    var colorScale = style.colorScale;

    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            var value = z[i][j];
            if (isNaN(value)) continue;

            var color = getColorFromScale(value, colorScale);
            ctx.fillStyle = color;
            ctx.fillRect(j * cellWidth, i * cellHeight, cellWidth, cellHeight);
        }
    }
}
```

---

### ❌ 2. 缺少约束类型 (constraint) 完整支持

**Plotly.js 支持**:
```javascript
// src/traces/contour/plot.js (line 57-60)
if(contours.type === 'constraint') {
    fillPathinfo = convertToConstraints(pathinfo, contours._operation);
}
```

**建议添加**:
```javascript
// 新增文件: contour-core/constraints.js
function convertToConstraints(pathinfo, operation) {
    // 根据操作符（>, <, =, [], etc.）转换路径
    // 这需要复杂的布尔运算
    return pathinfo;
}
```

---

### ❌ 3. 缺少 Log 坐标轴支持

**Plotly.js 支持**:
```javascript
// src/traces/contour/find_all_paths.js (line 276-278)
var dxl =
    (dx !== 1 ? (1 - dx) * xa.c2l(pi.x[locx]) : 0) +
    (dx !== 0 ? dx * xa.c2l(pi.x[locx + 1]) : 0);

// c2l = convert to linear (处理 log 坐标)
```

**建议添加**:
```javascript
function getInterpPxWithLogSupport(pi, loc, step, scaleOptions) {
    var logX = scaleOptions.logX || false;
    var logY = scaleOptions.logY || false;

    // 对数空间插值
    if (logX) {
        var logX1 = Math.log10(pi.x[locx]);
        var logX2 = Math.log10(pi.x[locx + 1]);
        var logValue = logX1 + dx * (logX2 - logX1);
        var pixelX = Math.pow(10, logValue);
    }

    // ...
}
```

---

## 优化优先级

### 🔴 高优先级 (关键功能)

1. **智能刻度算法** (levels.js)
   - 影响: 自动生成的等值线美观度
   - 难度: 中等
   - 时间: 2-3 小时

2. **精确插值计算** (pathfinding.js)
   - 影响: 非均匀网格的准确性
   - 难度: 中等
   - 时间: 2-3 小时

3. **自定义阈值颜色映射** (colorbar/colors.js)
   - 影响: 自定义阈值模式的视觉效果
   - 难度: 低
   - 时间: 1-2 小时

### 🟡 中优先级 (用户体验)

4. **标尺刻度格式化** (colorbar/ticks.js)
   - 影响: 标尺的专业性
   - 难度: 低
   - 时间: 1-2 小时

5. **热力图背景渲染** (renderers/canvas/heatmap.js)
   - 影响: heatmap 模式的支持
   - 难度: 低
   - 时间: 2-3 小时

### 🟢 低优先级 (高级功能)

6. **Log 坐标轴支持**
   - 影响: 特殊场景
   - 难度: 高
   - 时间: 4-5 小时

7. **Constraint 类型完整支持**
   - 影响: 约束等值线
   - 难度: 高
   - 时间: 6-8 小时

---

## 具体优化建议

### 建议 1: 优化 levels.js 的自动刻度

**当前代码**:
```javascript
// 简单等间距
var size = (end - start) / (ncontours - 1);
```

**优化后**:
```javascript
// 智能刻度（使用"友好"数字）
var smartTicks = computeNiceTicks(start, end, ncontours);
var size = smartTicks.step;

// 这样生成的刻度会是: 0, 2, 4, 6, 8, 10
// 而不是: 0, 1.987, 3.974, 5.961, 7.948, 9.935
```

---

### 建议 2: 改进 getInterpPx 支持精确插值

**当前代码**:
```javascript
return [locx + dx, locy, locx + dx, locy];
```

**优化后**:
```javascript
// 在数据空间插值
var dataX = (1 - dx) * x[locx] + dx * x[locx + 1];
return [dataX, y[locy], locx + dx, locy];

// 这样支持非均匀网格
```

---

### 建议 3: 支持热力图模式颜色扩展

**当前代码**:
```javascript
// 简单映射
var scaleIndex = Math.floor((levelIndex / nLevels) * (nColors - 1));
```

**优化后**:
```javascript
// 支持数据范围扩展
if (dataMin < levelMin) {
    // 用第一个颜色填充数据下限以下
    addColorStop(dataMin, colors[0]);
}
if (dataMax > levelMax) {
    // 用最后一个颜色填充数据上限以上
    addColorStop(dataMax, colors[colors.length - 1]);
}
```

---

### 建议 4: 增强标尺刻度格式化

**当前代码**:
```javascript
return value.toString();
```

**优化后**:
```javascript
// 支持多种格式化选项
function formatTickValue(value, options) {
    if (options.format === '.2f') {
        return value.toFixed(2);
    } else if (options.format === '.1%') {
        return (value * 100).toFixed(1) + '%';
    } else if (options.format === '.2e') {
        return value.toExponential(2);
    }

    // 智能格式化
    return autoFormat(value);
}
```

---

## 总结

### contour-core 的优势

1. **架构优秀**: 完全解耦，无外部依赖
2. **核心算法正确**: Marching Squares 和路径追踪完全正确
3. **SSR 友好**: 可在 Node.js 中运行
4. **Null 值处理**: 完善的缺失值支持

### 关键改进方向

1. **智能刻度**: 让自动生成的等值线更美观
2. **精确插值**: 支持非均匀网格和坐标轴转换
3. **高级颜色映射**: 支持自定义阈值和热力图模式
4. **专业标尺**: 智能刻度格式化

### 实施路线图

**第一阶段 (1-2 天)**:
- 实现智能刻度算法
- 改进插值计算精度
- 优化颜色映射

**第二阶段 (1-2 天)**:
- 增强标尺刻度格式化
- 添加热力图背景渲染
- 完善文档和示例

**第三阶段 (按需)**:
- Log 坐标轴支持
- Constraint 类型支持
- 性能优化

---

## 附录：对比表

| 功能 | Plotly.js | contour-core | 差距 | 优先级 |
|------|-----------|--------------|------|--------|
| Marching Squares | ✅ | ✅ | 0% | - |
| 路径追踪 | ✅ | ✅ | 5% | 低 |
| 边界关闭 | ✅ | ✅ | 0% | - |
| 智能刻度 | ✅ | ⚠️ | 30% | **高** |
| 精确插值 | ✅ | ⚠️ | 20% | **高** |
| 颜色映射 | ✅ | ⚠️ | 25% | **高** |
| 标签优化 | ✅ | ✅ | 10% | 低 |
| 标尺刻度 | ✅ | ⚠️ | 40% | 中 |
| 平滑算法 | ✅ | ✅ | 0% | - |
| Null 处理 | ✅ | ✅ | 0% | - |
| 热力图模式 | ✅ | ❌ | 100% | 中 |
| Constraint 类型 | ✅ | ❌ | 100% | 低 |
| Log 坐标 | ✅ | ❌ | 100% | 低 |

---

**报告生成时间**: 2025-01-26
**分析基于**: CONTOUR_IMPLEMENTATION.md vs contour-core 代码库
