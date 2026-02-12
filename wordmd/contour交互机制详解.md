# Plotly.js Contour 等值线交互机制详解

## 目录
1. [概述](#概述)
2. [交互事件处理](#交互事件处理)
3. [缩放实现机制](#缩放实现机制)
4. [平移实现机制](#平移实现机制)
5. [标注更新机制](#标注更新机制)
6. [坐标轴标尺更新](#坐标轴标尺更新)
7. [等值线重新渲染](#等值线重新渲染)
8. [数据流与架构](#数据流与架构)

---

## 概述

Plotly.js 的 contour 等值线支持丰富的鼠标交互功能，包括缩放、平移、选择等。这些交互通过事件监听、坐标转换、状态更新和重新渲染等步骤实现。

### 核心交互功能

| 功能 | 鼠标操作 | 说明 |
|------|----------|------|
| 缩放 | 滚轮滚动 / 拖拽框 | 以鼠标位置或选中区域为中心缩放 |
| 平移 | 拖拽绘图区域 | 移动视图范围 |
| 双击重置 | 双击 | 恢复到原始视图 |
| 轴向缩放 | 拖拽轴端点 | 单独缩放 X 或 Y 轴 |

---

## 交互事件处理

### 事件监听初始化

**核心文件**：`src/plots/cartesian/graph_interact.js`

```javascript
exports.initInteractions = function initInteractions(gd) {
    var plotinfo = gd._fullLayout._plots[plotname];
    var xa = plotinfo.xaxis;
    var ya = plotinfo.yaxis;

    // 创建主拖拽区域
    var maindrag = makeDragBox(gd, plotinfo, xa._offset, ya._offset,
        xa._length, ya._length, 'ns', 'ew');

    // 设置鼠标移动事件
    maindrag.onmousemove = function(evt) {
        Fx.hover(gd, evt, subplot);
    };

    // 设置滚轮事件
    maindrag.onwheel = function(evt) {
        zoomWheel(gd, evt, subplot);
    };
};
```

### 事件类型

```javascript
// src/plots/cartesian/dragbox.js
var dragOptions = {
    onmousedown: function(evt) {
        // 记录初始位置和时间
        numClicks++;
        mouseDownTime = evt.timeStamp;
        // ...
    },
    onmousemove: function(evt) {
        // 处理拖拽/缩放
        handleMove(evt);
    },
    onmouseup: function(evt) {
        // 完成拖拽，触发重绘
        finishDrag(evt);
    },
    onwheel: function(evt) {
        // 滚轮缩放
        zoomWheel(evt);
    }
};
```

---

## 缩放实现机制

### 滚轮缩放

**核心文件**：`src/plots/cartesian/dragbox.js`

```javascript
function zoomWheel(gd, evt) {
    var subplot = evt.target.__subplot;
    var plotinfo = gd._fullLayout._plots[subplot];
    var xa0 = plotinfo.xaxis;
    var ya0 = plotinfo.yaxis;

    // 计算缩放比例
    var wheelDelta = evt.wheelDelta || 0;
    var zoom = Math.exp(-Math.min(Math.max(wheelDelta, -20), 20) / 200);

    // 计算鼠标位置（作为缩放中心）
    var gbb = getBoundingBox(gd._fullLayout._size);
    var xfrac = (evt.clientX - gbb.left) / gbb.width;
    var yfrac = (gbb.bottom - evt.clientY) / gbb.height;

    // 应用缩放到轴范围
    zoomOneAxis(xa0, xfrac, zoom);
    zoomOneAxis(ya0, yfrac, zoom);

    // 处理关联轴
    handleLinkedAxes(gd, xa0, ya0);

    // 触发重新渲染
    Plotly.relayout(gd, updates);
}

function zoomOneAxis(ax, frac, zoom) {
    var range = ax.range;
    var newSize = range[1] - range[0];
    var center = range[0] + frac * newSize;

    // 以中心点缩放
    var newRange = newSize / zoom;
    ax.range = [
        center - frac * newRange,
        center + (1 - frac) * newRange
    ];
}
```

### 拖拽框缩放

```javascript
function zoomMove(gd, evt) {
    var evtLoc = getEventLoc(evt, gd);
    var startX = evtLoc.x;
    var startY = evtLoc.y;

    // 绘制缩放框
    var outline = gd._fullLayout._zoomlayer.selectAll('rect.zoombox')
        .attr('x', Math.min(startX, evtLoc.x))
        .attr('y', Math.min(startY, evtLoc.y))
        .attr('width', Math.abs(evtLoc.x - startX))
        .attr('height', Math.abs(evtLoc.y - startY));
}

function zoomEnd(gd, evt) {
    // 根据缩放框计算新的轴范围
    var x0 = xa.p2c(Math.min(startX, endX));
    var x1 = xa.p2c(Math.max(startX, endX));
    var y0 = ya.p2c(Math.min(startY, endY));
    var y1 = ya.p2c(Math.max(startY, endY));

    // 更新轴范围
    xa.range = [x0, x1];
    ya.range = [y0, y1];

    // 移除缩放框并重绘
    clearOutline(gd);
    Plotly.relayout(gd, updates);
}
```

---

## 平移实现机制

### 主拖拽区域平移

**核心文件**：`src/plots/cartesian/dragbox.js`

```javascript
function plotDrag(gd, dx, dy) {
    var plotinfo = gd._fullLayout._plots[subplot];
    var xa0 = plotinfo.xaxis;
    var ya0 = plotinfo.yaxis;
    var xaxes = hashValues(xaHash);
    var yaxes = hashValues(yaHash);

    // 计算缩放比例
    var scaleX = 1 / (sp.plot.call(Drawing.getScale).x || 1);
    var scaleY = 1 / (sp.plot.call(Drawing.getScale).y || 1);

    // 转换像素偏移到数据空间
    dx = dx * scaleX * xa0._input.exponent;
    dy = dy * scaleY * ya0._input.exponent;

    // 应用到各轴
    for (var i = 0; i < xaxes.length; i++) {
        xaxes[i].range[0] -= dx;
        xaxes[i].range[1] -= dx;
    }

    for (var j = 0; j < yaxes.length; j++) {
        yaxes[j].range[0] -= dy;
        yaxes[j].range[1] -= dy;
    }

    // 处理约束轴
    handleConstrainedAxes(gd, xaxes, yaxes);

    // 重新渲染
    Plotly.relayout(gd, updates);
}
```

### 轴端点拖拽

```javascript
// 拖拽 X 轴端点
function xAxisDrag(gd, ax, dx) {
    var range = ax.range;
    var pixelDelta = ax.l2p(dx) - ax.l2p(0);

    if (isLeftEnd) {
        var newRange0 = ax.p2c(ax.c2p(range[0]) + pixelDelta);
        if (newRange0 < range[1] - MINRANGE) {
            ax.range[0] = newRange0;
        }
    } else {
        var newRange1 = ax.p2c(ax.c2p(range[1]) + pixelDelta);
        if (newRange1 > range[0] + MINRANGE) {
            ax.range[1] = newRange1;
        }
    }
}

// 拖拽 Y 轴端点
function yAxisDrag(gd, ax, dy) {
    // 类似 X 轴处理
}
```

---

## 标注更新机制

### 标注位置计算流程

**核心文件**：`src/traces/contour/plot.js`

```javascript
function makeLinesAndLabels(plotgroup, pathinfo, gd, cd0, contours) {
    var xa = plotinfo.xaxis;
    var ya = plotinfo.yaxis;

    // 1. 计算可视区域边界（像素坐标）
    var xMin = cd0.x[0];
    var xMax = cd0.x[cd0.x.length - 1];
    var yMin = cd0.y[0];
    var yMax = cd0.y[cd0.y.length - 1];

    var x0 = Math.max(xa.c2p(xMin, true), 0);
    var x1 = Math.min(xa.c2p(xMax, true), xLen);
    var y0 = Math.max(ya.c2p(yMin, true), 0);
    var y1 = Math.min(ya.c2p(yMax, true), yLen);

    // 2. 创建边界对象（用于防碰撞）
    var bounds = {
        left: x0,
        right: x1,
        top: y0,
        bottom: y1,
        center: (x0 + x1) / 2,
        middle: (y0 + y1) / 2
    };

    // 3. 遍历每条等值线放置标注
    linegroup.each(function(d) {
        var textOpts = calcTextOpts(d.level, contourFormat, dummyText, gd);

        d3.select(this).selectAll('path').each(function() {
            var path = this;

            // 获取可见路径段（在缩放/平移后可能变化）
            var pathBounds = Lib.getVisibleSegment(path, bounds, textOpts.height / 2);

            if (!pathBounds) return;

            // 计算最大标注数
            var maxLabels = Math.min(
                Math.ceil(pathBounds.len / normLength),
                constants.LABELMAX
            );

            // 循环放置标注
            for (var i = 0; i < maxLabels; i++) {
                var loc = findBestTextLocation(path, pathBounds, textOpts, labelData, bounds);
                if (!loc) break;
                addLabelData(loc, textOpts, labelData, labelClipPathData);
            }
        });
    });

    // 4. 绘制所有标注
    drawLabels(labelGroup, labelData, gd, lineClip, labelClipPathData);
}
```

### 缩放/平移后标注重算

```javascript
// src/lib/geometry2d.js

// 获取路径在可见区域内的段落
exports.getVisibleSegment = function(path, bounds, padding) {
    var totalLen = path.getTotalLength();
    var min = null;
    var max = null;
    var accumulated = 0;

    // 查找第一个可见点
    for (var i = 0; i < path.length; i++) {
        var pt = getPointAtLength(path, i);
        if (isInside(pt, bounds, padding)) {
            min = accumulated;
            break;
        }
        accumulated += getSegmentLength(path, i);
    }

    // 查找最后一个可见点
    accumulated = 0;
    for (var i = path.length - 1; i >= 0; i--) {
        var pt = getPointAtLength(path, i);
        if (isInside(pt, bounds, padding)) {
            max = totalLen - accumulated;
            break;
        }
        accumulated += getSegmentLength(path, i);
    }

    return {
        min: min,
        max: max,
        len: max - min,
        total: totalLen
    };
};

function isInside(pt, bounds, padding) {
    return pt.x >= bounds.left - padding &&
           pt.x <= bounds.right + padding &&
           pt.y >= bounds.top - padding &&
           pt.y <= bounds.bottom + padding;
}
```

### 标注文本方向更新

```javascript
// 文本方向沿等值线的切线方向
function getTextLocation(path, totalPathLen, positionOnPath, textWidth) {
    var halfWidth = textWidth / 2;
    var p0 = path.getPointAtLength(positionOnPath - halfWidth);
    var p1 = path.getPointAtLength(positionOnPath + halfWidth);

    // 计算角度（沿切线方向）
    var theta = Math.atan2(p1.y - p0.y, p1.x - p0.x);

    // 计算中心位置
    var pCenter = path.getPointAtLength(positionOnPath);
    var x = (pCenter.x * 4 + p0.x + p1.x) / 6;
    var y = (pCenter.y * 4 + p0.y + p1.y) / 6;

    return { x: x, y: y, theta: theta };
}
```

---

## 坐标轴标尺更新

### 刻度重新计算

**核心文件**：`src/plots/cartesian/axes.js`

```javascript
// 缩放/平移后更新刻度
function ticksAndAnnotations(gd, activeAxIds) {
    for (var i = 0; i < activeAxIds.length; i++) {
        var ax = getFromId(gd, activeAxIds[i]);

        // 重新计算刻度位置
        Axes.prepTicks(ax);

        // 设置刻度线位置
        var ticks = ax._ticks;
        ax.tickpath = ticks.map(function(t) {
            return {
                x: ax.c2p(t, true),
                y: ax._offset
            };
        });

        // 重新绘制刻度线和标签
        Axes.drawOne(gd, ax, { skipTitle: true });
    }
}
```

### 轴范围变化检测

```javascript
// src/plots/cartesian/dragbox.js

// 收集轴范围变化
function collectAxUpdates(gd) {
    var updates = {};
    var axList = gd._fullLayout._axes;

    for (var axId in axList) {
        var ax = axList[axId];
        var oldRange = ax._rangeInitial || ax.range;
        var newRange = ax.range;

        if (oldRange[0] !== newRange[0] || oldRange[1] !== newRange[1]) {
            updates[ax._name] = [];
            updates[ax._name][0] = {};
            updates[ax._name][0].range = [newRange[0], newRange[1]];
        }
    }

    return updates;
}

function updateAxes(updates) {
    // 重新计算所有刻度
    for (var axName in updates) {
        var ax = getFromId(gd, axName);
        var tickOpts = getTickOpts(ax);

        // 自动刻度计算
        autoTicks(ax, tickOpts);
        calcTicks(ax);
    }
}
```

### 刻度标签格式化

```javascript
// src/plots/cartesian/tick_text.js

function formatTick(axis, value) {
    var tickFormat = axis.tickformat || '';
    var tickPrefix = axis.tickprefix || '';
    var tickSuffix = axis.ticksuffix || '';

    // 格式化数值
    var formatted = value;
    if (tickFormat) {
        formatted = d3.format(tickFormat)(value);
    } else {
        formatted = autoFormat(value, axis.type);
    }

    return tickPrefix + formatted + tickSuffix;
}
```

---

## 等值线重新渲染

### 触发重绘的条件

```javascript
// src/plot_api/subroutines.js

exports.doAutorange = function(gd) {
    // 自动调整颜色范围
};

exports.redrawReglTraces = function(gd) {
    // 重绘 WebGL traces (scattergl, etc.)
};

function shouldRedraw(gd) {
    var hasEdits = collectAxUpdates(gd);
    var hasContour = gd._fullLayout._has('contour');

    return hasEdits && hasContour;
}
```

### Canvas 坐标变换

```javascript
// src/components/drawing.js

// 设置子图的平移变换
exports.setTranslate = function(selection, x, y) {
    selection.attr('transform', 'translate(' + x + ',' + y + ')');
};

// 设置子图的缩放变换
exports.setScale = function(selection, x, y) {
    var kx = x || 1;
    var ky = y || 1;
    selection.attr('transform', 'scale(' + kx + ',' + ky + ')');
};

// 组合变换
function updateSubplotTransform(sp, dx, dy, sx, sy) {
    // 裁剪区域变换
    sp.clipRect
        .call(Drawing.setTranslate, dx, dy)
        .call(Drawing.setScale, sx, sy);

    // 绘图区域变换（反向缩放以保持内容大小一致）
    sp.plot
        .call(Drawing.setTranslate, dx, dy)
        .call(Drawing.setScale, 1/sx, 1/sy);
}
```

### SVG 路径更新

```javascript
// 缩放/平移后 SVG 元素更新
function updateSVGElements(gd) {
    var sp = gd._fullLayout._plots[subplot];

    // 更新 clipPath
    sp.clipRect.attr('transform',
        'translate(' + clipDx + ',' + clipDy + ')' +
        'scale(' + xScale + ',' + yScale + ')'
    );

    // 更新绘图区域
    sp.plot.attr('transform',
        'translate(' + plotDx + ',' + plotDy + ')' +
        'scale(' + (1/xScale) + ',' + (1/yScale) + ')'
    );

    // 更新标注位置
    d3.selectAll('.contourtext')
        .attr('x', function(d) { return xa.c2p(d.x, true); })
        .attr('y', function(d) { return ya.c2p(d.y, true); });
}
```

---

## 数据流与架构

### 完整交互数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户交互事件                              │
│                    (mousedown/mousemove/wheel)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     事件处理层 (dragbox.js)                      │
│  - 捕获鼠标事件                                                  │
│  - 计算拖拽距离/缩放比例                                          │
│  - 确定活动轴 (xActive, yActive)                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     坐标转换层 (axes.js)                         │
│  - 像素坐标 → 数据坐标 (p2c)                                     │
│  - 数据坐标 → 像素坐标 (c2p)                                     │
│  - 轴范围更新                                                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      轴约束处理 (scale_zoom.js)                    │
│  - 轴约束 (axis constraints)                                     │
│  - 子图约束 (subplot constraints)                               │
│  - 匹配约束 (match constraints)                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    状态更新 (relayout)                          │
│  - 收集所有轴的更新                                             │
│  - 处理关联轴                                                   │
│  - 触发重绘                                                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
┌───────────────┐  ┌──────────────┐  ┌──────────────┐
│  轴标尺更新    │  │  标注位置更新  │  │  等值线重绘  │
│  (axes.js)    │  │  (plot.js)    │  │  (plot.js)    │
└───────────────┘  └──────────────┘  └──────────────┘
```

### 核心文件职责

| 文件 | 职责 |
|------|------|
| `src/plots/cartesian/dragbox.js` | 事件监听、拖拽、缩放核心逻辑 |
| `src/plots/cartesian/graph_interact.js` | 交互初始化、hover 事件 |
| `src/plots/cartesian/scale_zoom.js` | 缩放约束、比例处理 |
| `src/plots/cartesian/axes.js` | 轴管理、刻度计算 |
| `src/traces/contour/plot.js` | 等值线渲染、标注放置 |
| `src/components/drawing.js` | 绘图工具、坐标变换 |
| `src/plot_api/plot.js` | API 入口、relayout |

### 性能优化策略

```javascript
// 1. 延迟重绘 (减少频繁渲染)
var REDRAWDELAY = 200;
var redrawTimer;

function scheduleRedraw(gd) {
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(function() {
        Plotly.relayout(gd, updates);
    }, REDRAWDELAY);
}

// 2. 变换缓存 (避免重复计算)
var transformCache = {};

function getCachedTransform(id) {
    if (!transformCache[id]) {
        transformCache[id] = computeTransform(id);
    }
    return transformCache[id];
}

// 3. 选择性更新 (只更新变化的部分)
var activeAxIds = getActiveAxes(gd);
for (var i = 0; i < activeAxIds.length; i++) {
    updateAxis(activeAxIds[i]);
}
```

---

## 总结

Plotly.js 的 contour 等值线交互系统具有以下特点：

1. **事件驱动** - 通过监听鼠标事件触发交互
2. **坐标转换** - 双向转换数据坐标和像素坐标
3. **状态同步** - 轴范围变化同步到所有相关组件
4. **智能重绘** - 只重绘必要的内容，优化性能
5. **约束系统** - 支持轴约束和子图约束

对于 contour-core 的重构，可以借鉴以下设计：

- 将交互层与计算层分离
- 使用统一的坐标转换系统
- 实现高效的防碰撞标注算法
- 支持增量更新而非全量重绘
