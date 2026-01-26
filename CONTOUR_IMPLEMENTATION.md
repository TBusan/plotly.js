# Plotly.js Contour 等值线实现详解

## 目录
1. [整体架构](#整体架构)
2. [核心文件说明](#核心文件说明)
3. [等值线生成流程](#等值线生成流程)
4. [Line 模式实现](#line-模式实现)
5. [Fill 模式实现](#fill-模式实现)
6. [Label（标签）创建](#label标签创建)
7. [标尺（Colorbar）创建](#标尺colorbar创建)
8. [核心算法：Marching Squares](#核心算法marching-squares)
9. [关键代码片段](#关键代码片段)

---

## 整体架构

Plotly.js 的 contour 实现分为三个主要层次：

```
数据层
    ↓ calc.js
计算层
    ↓ plot.js
渲染层
```

### 核心组件

1. **calc.js** - 计算入口，负责处理数据并设置等值线级别
2. **set_contours.js** - 设置等值线的 start、end、size 或自定义 thresholds
3. **make_crossings.js** - 计算所有交叉点（Marching Squares 第一步）
4. **find_all_paths.js** - 连接交叉点形成路径（Marching Squares 第二步）
5. **plot.js** - 绘制渲染，包括 lines、fills、labels
6. **make_color_map.js** - 创建颜色映射
7. **colorbar.js** - 标尺配置

---

## 核心文件说明

### 1. calc.js - 计算入口

**位置**: `src/traces/contour/calc.js`

**主要功能**:
- 调用 heatmap 的计算逻辑获取网格数据
- 设置等值线级别（调用 setContours）
- 计算颜色映射（调用 Colorscale.calc）

**关键代码**:
```javascript
module.exports = function calc(gd, trace) {
    // 1. 使用 heatmap calc 获取网格数据
    var cd = heatmapCalc(gd, trace);
    var zOut = cd[0].z;

    // 2. 设置等值线级别
    setContours(trace, zOut);

    // 3. 提取颜色配置并计算颜色映射
    var cOpts = Colorscale.extractOpts(trace);
    var cVals = /* 根据模式选择合适的值 */;
    Colorscale.calc(gd, trace, {vals: cVals, cLetter: 'z'});

    return cd;
};
```

### 2. set_contours.js - 等值线级别设置

**位置**: `src/traces/contour/set_contours.js`

**三种模式**:

#### 模式 1: 自定义阈值（优先级最高）
```javascript
if(contours.thresholds && Lib.isArrayOrTypedArray(contours.thresholds)) {
    var thresholds = contours.thresholds.slice().sort(function(a, b) {
        return a - b;
    });

    // 直接使用自定义阈值
    contours.start = thresholds[0];
    contours.end = thresholds[thresholds.length - 1];
    contours.size = null; // 不使用固定步长
    contours._levels = thresholds; // 保存所有自定义级别
}
```

#### 模式 2: 自动计算
```javascript
if(trace.autocontour) {
    var zmin = trace.zmin;
    var zmax = trace.zmax;

    // 使用轴刻度算法自动计算合适的级别
    var dummyAx = autoContours(zmin, zmax, trace.ncontours);
    contours.size = dummyAx.dtick;
    contours.start = Axes.tickFirst(dummyAx);
    contours.end = /* 反转后的第一个刻度 */;
}
```

#### 模式 3: 手动指定
```javascript
// 使用用户指定的 start, end, size
// 进行合理性检查和修正
```

### 3. make_crossings.js - 交叉点计算

**位置**: `src/traces/contour/make_crossings.js`

**核心算法**: Modified Marching Squares

```javascript
module.exports = function makeCrossings(pathinfo) {
    var z = pathinfo[0].z;
    var m = z.length;    // 行数
    var n = z[0].length; // 列数

    // 遍历每个网格单元
    for(yi = 0; yi < m - 1; yi++) {
        for(xi = 0; xi < n - 1; xi++) {
            // 获取四个角的值
            corners = [
                [z[yi][xi], z[yi][xi + 1]],
                [z[yi + 1][xi], z[yi + 1][xi + 1]]
            ];

            // 为每个级别计算 marching index
            for(i = 0; i < pathinfo.length; i++) {
                pi = pathinfo[i];
                mi = getMarchingIndex(pi.level, corners);
                if(mi) {
                    pi.crossings[label] = mi;
                    // 如果是边界起点，记录到 starts
                    if(startIndices.indexOf(mi) !== -1) {
                        pi.starts.push([xi, yi]);
                    }
                }
            }
        }
    }
}
```

**Marching Index 计算**:
```javascript
function getMarchingIndex(val, corners) {
    // 根据 4 个角与等值线值的关系生成 0-15 的索引
    var mi = (corners[0][0] > val ? 0 : 1) +
             (corners[0][1] > val ? 0 : 2) +
             (corners[1][1] > val ? 0 : 4) +
             (corners[1][0] > val ? 0 : 8);

    // 处理鞍点（saddle points）
    if(mi === 5 || mi === 10) {
        var avg = (corners[0][0] + corners[0][1] +
                   corners[1][0] + corners[1][1]) / 4;
        if(val > avg) return (mi === 5) ? 713 : 1114;
        else return (mi === 5) ? 104 : 208;
    }
    return (mi === 15) ? 0 : mi;
}
```

### 4. find_all_paths.js - 路径追踪

**位置**: `src/traces/contour/find_all_paths.js`

**主要逻辑**:
```javascript
module.exports = function findAllPaths(pathinfo) {
    for(i = 0; i < pathinfo.length; i++) {
        pi = pathinfo[i];

        // 处理所有边界起点
        for(j = 0; j < pi.starts.length; j++) {
            startLoc = pi.starts[j];
            makePath(pi, startLoc, 'edge', xtol, ytol);
        }

        // 处理所有内部路径
        while(Object.keys(pi.crossings).length && cnt < 10000) {
            startLoc = Object.keys(pi.crossings)[0].split(',').map(Number);
            makePath(pi, startLoc, undefined, xtol, ytol);
        }
    }
}
```

**路径追踪核心函数**:
```javascript
function makePath(pi, loc, edgeflag, xtol, ytol) {
    var pts = [getInterpPx(pi, loc, [-marchStep[0], -marchStep[1]])];
    var startLoc = loc.slice();
    var startStep = marchStep.slice();

    // 沿着路径追踪
    for(cnt = 0; cnt < 10000; cnt++) {
        // 1. 获取下一步方向
        marchStep = constants.NEWDELTA[mi];

        // 2. 插值计算精确像素位置
        pts.push(getInterpPx(pi, loc, marchStep));

        // 3. 移动到下一个网格位置
        loc[0] += marchStep[0];
        loc[1] += marchStep[1];

        // 4. 检查是否闭合或到达边界
        if(closedLoop || (edgeflag && atEdge)) break;

        mi = pi.crossings[locStr];
    }

    // 5. 根据路径类型分类存储
    if(closedpath) {
        pi.paths.push(pts);
    } else {
        pi.edgepaths.push(pts);
    }
}
```

**插值计算**:
```javascript
function getInterpPx(pi, loc, step) {
    var locx = loc[0] + Math.max(step[0], 0);
    var locy = loc[1] + Math.max(step[1], 0);
    var zxy = pi.z[locy][locx];

    // 水平插值
    if(step[1]) {
        var dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);
        var dxl = (1 - dx) * xa.c2l(pi.x[locx]) + dx * xa.c2l(pi.x[locx + 1]);
        return [xa.c2p(xa.l2c(dxl), true), ya.c2p(pi.y[locy], true)];
    }
    // 垂直插值
    else {
        var dy = (pi.level - zxy) / (pi.z[locy + 1][locx] - zxy);
        var dyl = (1 - dy) * ya.c2l(pi.y[locy]) + dy * ya.c2l(pi.y[locy + 1]);
        return [xa.c2p(pi.x[locx], true), ya.c2p(ya.l2c(dyl), true)];
    }
}
```

---

## 等值线生成流程

```
1. 输入数据 (z 矩阵, x 数组, y 数组)
         ↓
2. calc.js - 计算入口
   ├─ heatmapCalc - 生成网格数据
   ├─ setContours - 设置等值线级别
   └─ Colorscale.calc - 计算颜色映射
         ↓
3. makeCrossings - 计算所有交叉点
   └─ 为每个网格单元生成 marching index
         ↓
4. findAllPaths - 追踪路径
   ├─ 从边界起点追踪 (edgepaths)
   └─ 从内部交叉点追踪 (paths)
         ↓
5. plot.js - 绘制
   ├─ makeLines - 绘制线条
   ├─ makeFills - 绘制填充
   └─ makeLabels - 添加标签
```

---

## Line 模式实现

### 配置
```javascript
{
    type: 'contour',
    z: [[...]], // 数据网格
    contours: {
        coloring: 'lines',  // 线条模式
        showlines: true,
        start: 0,
        end: 10,
        size: 1
    },
    line: {
        color: '#000000',
        width: 1,
        dash: 'solid'
    }
}
```

### 实现流程

**1. 创建路径数据** (plot.js:322-365)
```javascript
exports.createLines = function(lineContainer, makeLines, pathinfo, isStatic) {
    var smoothing = pathinfo[0].smoothing;

    var linegroup = lineContainer.selectAll('g.contourlevel')
        .data(makeLines ? pathinfo : []);

    // 开放路径（边缘路径）
    var opencontourlines = linegroup.selectAll('path.openline')
        .data(function(d) { return d.pedgepaths || d.edgepaths; });

    opencontourlines
        .attr('d', function(d) {
            return Drawing.smoothopen(d, smoothing); // 应用平滑
        });

    // 闭合路径（内部路径）
    var closedcontourlines = linegroup.selectAll('path.closedline')
        .data(function(d) { return d.ppaths || d.paths; });

    closedcontourlines
        .attr('d', function(d) {
            return Drawing.smoothclosed(d, smoothing); // 应用平滑
        });
};
```

**2. 颜色映射** (make_color_map.js:88-143)
```javascript
if(customLevels && customLevels.length > 0) {
    // 为每个自定义级别分配颜色
    var levels = customLevels;
    var minLevel = levels[0];
    var maxLevel = levels[levels.length - 1];

    // 将颜色位置映射到值范围
    for(i = 0; i < len; i++) {
        si = scl[i];
        domain[i] = effectiveMin + si[0] * (effectiveMax - effectiveMin);
        range[i] = si[1];
    }
}
```

**3. SVG 输出**
```svg
<g class="contourlevel">
    <path class="openline" d="M..." stroke="..." />
    <path class="closedline" d="M..." stroke="..." />
</g>
```

### 关键特性

1. **平滑处理**: 使用 `Drawing.smoothopen` 和 `Drawing.smoothclosed` 对路径进行平滑
2. **颜色映射**: 根据等值线级别从 colorscale 中获取对应颜色
3. **向量效果**: 使用 `vector-effect: non-scaling-stroke` 保持线条宽度一致

---

## Fill 模式实现

### 配置
```javascript
{
    type: 'contour',
    z: [[...]],
    contours: {
        coloring: 'fill',  // 填充模式
        showlines: true    // 可选：显示轮廓线
    }
}
```

### 实现流程

**1. 关闭边界** (plot.js:82-89)
```javascript
function makeFills(plotgroup, pathinfo, perimeter, contours) {
    var hasFills = contours.coloring === 'fill';

    // 为 pathinfo 添加 prefixBoundary 标记
    if(hasFills) {
        closeBoundaries(pathinfo, contours);
    }

    // closeBoundaries 决定是否需要在路径前添加边界
    // 例如：如果整个区域都在等值线上方，需要先绘制边界
}
```

**close_boundaries.js 逻辑**:
```javascript
module.exports = function(pathinfo, contours) {
    switch(contours.type) {
        case 'levels':
            // 检查边界值是否大于等值线级别
            var edgeVal2 = Math.min(z[0][0], z[0][1]);

            for(i = 0; i < pathinfo.length; i++) {
                var pi = pathinfo[i];
                // 如果没有边缘路径且边界值大于级别，需要添加前缀边界
                pi.prefixBoundary = !pi.edgepaths.length &&
                    (edgeVal2 > pi.level || pi.starts.length && edgeVal2 === pi.level);
            }
            break;
    }
}
```

**2. 路径连接** (plot.js:115-200)
```javascript
function joinAllPaths(pi, perimeter) {
    var fullpath = '';

    // 1. 如果需要，先添加边界
    if(pi.prefixBoundary) {
        fullpath += 'M' + perimeter.join('L') + 'Z';
    }

    // 2. 连接所有边缘路径
    while(startsleft.length) {
        addpath = Drawing.smoothopen(pi.edgepaths[i], pi.smoothing);
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');

        // 沿着边界移动，寻找下一个路径起点
        for(cnt = 0; cnt < 4; cnt++) {
            if(istop(endpt)) newendpt = perimeter[1];
            else if(isleft(endpt)) newendpt = perimeter[0];
            else if(isbottom(endpt)) newendpt = perimeter[3];
            else if(isright(endpt)) newendpt = perimeter[2];

            // 检查是否有新路径在当前边上
            for(possiblei = 0; possiblei < pi.edgepaths.length; possiblei++) {
                if(/* 新路径在当前边上 */) {
                    nexti = possiblei;
                }
            }

            if(nexti >= 0) break;
            fullpath += 'L' + newendpt;
        }

        i = nexti;
        if(newloop) {
            i = startsleft[0];
            fullpath += 'Z'; // 闭合当前循环
        }
    }

    // 3. 添加所有内部闭合路径
    for(i = 0; i < pi.paths.length; i++) {
        fullpath += Drawing.smoothclosed(pi.paths[i], pi.smoothing);
    }

    return fullpath;
}
```

**3. 填充渲染** (plot.js:82-113)
```javascript
function makeFills(plotgroup, pathinfo, perimeter, contours) {
    var fillgroup = Lib.ensureSingle(plotgroup, 'g', 'contourfill');

    var fillitems = fillgroup.selectAll('path').data(pathinfo);

    fillitems.each(function(pi) {
        var fullpath = (pi.prefixBoundary ? boundaryPath : '') +
            joinAllPaths(pi, perimeter);

        d3.select(this)
            .attr('d', fullpath)
            .style('stroke', 'none')
            .style('fill', function() {
                // 根据级别返回对应的颜色
                return colorScale(pi.level);
            });
    });
}
```

### 填充策略

**使用奇偶规则（Even-Odd Rule）**:
- 外部边界：顺时针方向
- 内部等值线：独立闭合路径
- 填充算法会根据路径的嵌套关系自动处理重叠区域

### 边界处理

```javascript
// 计算四个边界角点
var leftedge = xa.c2p(x[0], true);
var rightedge = xa.c2p(x[x.length - 1], true);
var bottomedge = ya.c2p(y[0], true);
var topedge = ya.c2p(y[y.length - 1], true);

var perimeter = [
    [leftedge, topedge],     // 左上
    [rightedge, topedge],    // 右上
    [rightedge, bottomedge], // 右下
    [leftedge, bottomedge]   // 左下
];
```

---

## Label（标签）创建

### 配置
```javascript
{
    contours: {
        showlabels: true,
        labelformat: '.2f',
        labelfont: {
            family: 'Arial',
            size: 12,
            color: '#000000'
        }
    }
}
```

### 实现流程

**1. 标签格式化器** (plot.js:384-427)
```javascript
exports.labelFormatter = function(gd, cd0) {
    var fullLayout = gd._fullLayout;
    var trace = cd0.trace;
    var contours = trace.contours;

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
            // 默认格式化
            formatAxis.range = [contours.start, contours.end];
            formatAxis.nticks = (contours.end - contours.start) / contours.size;
            setConvert(formatAxis, fullLayout);
            Axes.prepTicks(formatAxis);
        }
    }

    return function(v) {
        return Axes.tickText(formatAxis, v).text;
    };
};
```

**2. 计算文本尺寸** (plot.js:429-445)
```javascript
exports.calcTextOpts = function(level, contourFormat, dummyText, gd) {
    var text = contourFormat(level);
    dummyText.text(text)
        .call(svgTextUtils.convertToTspans, gd);

    var el = dummyText.node();
    var bBox = Drawing.bBox(el, true);

    return {
        text: text,
        width: bBox.width,
        height: bBox.height,
        fontSize: +(el.style['font-size'].replace('px', '')),
        level: level,
        dy: (bBox.top + bBox.bottom) / 2
    };
};
```

**3. 寻找最佳标签位置** (plot.js:447-481)
```javascript
exports.findBestTextLocation = function(path, pathBounds, textOpts, labelData, plotBounds) {
    var cost = Infinity;

    // 多次迭代搜索最佳位置
    for(var j = 0; j < costConstants.ITERATIONS; j++) {
        for(var p = p0; p < pMax; p += dp) {
            var newLocation = Lib.getTextLocation(path, pathBounds.total, p, textWidth);
            var newCost = locationCost(newLocation, textOpts, labelData, plotBounds);

            if(newCost < cost) {
                cost = newCost;
                loc = newLocation;
                pMin = p;
            }
        }

        // 后续迭代在最佳位置附近精细搜索
        if(j) dp /= 2;
        p0 = pMin - dp / 2;
        pMax = p0 + dp * 1.5;
    }

    if(cost <= costConstants.MAXCOST) return loc;
};
```

**4. 位置代价函数** (plot.js:490-538)
```javascript
function locationCost(loc, textOpts, labelData, bounds) {
    var cost = 0;

    // 1. 边缘距离惩罚
    var normX = ((x > bounds.center) ? (bounds.right - x) : (x - bounds.left)) / dx;
    var normY = ((y > bounds.middle) ? (bounds.bottom - y) : (y - bounds.top)) / dy;
    if(normX < 1 || normY < 1) return Infinity;
    cost += costConstants.EDGECOST * (1 / (normX - 1) + 1 / (normY - 1));

    // 2. 角度惩罚（偏好水平）
    cost += costConstants.ANGLECOST * theta * theta;

    // 3. 与其他标签的距离惩罚
    for(var i = 0; i < labelData.length; i++) {
        var labeli = labelData[i];
        var dist = Lib.segmentDistance(/* 计算距离 */);

        var sameLevel = labeli.level === textOpts.level;
        if(dist <= distOffset) return Infinity;

        var distFactor = costConstants.NEIGHBORCOST *
            (sameLevel ? costConstants.SAMELEVELFACTOR : 1);
        cost += distFactor / (dist - distOffset);
    }

    return cost;
}
```

**5. 添加标签数据** (plot.js:540-578)
```javascript
exports.addLabelData = function(loc, textOpts, labelData, labelClipPathData) {
    var fontSize = textOpts.fontSize;
    var w = textOpts.width + fontSize / 3;
    var h = Math.max(0, textOpts.height - fontSize / 3);

    var x = loc.x;
    var y = loc.y;
    var theta = loc.theta;

    // 计算旋转后的边界框
    var bBoxPts = [
        rotateXY(-w / 2, -h / 2),
        rotateXY(-w / 2, h / 2),
        rotateXY(w / 2, h / 2),
        rotateXY(w / 2, -h / 2)
    ];

    labelData.push({
        text: textOpts.text,
        x: x,
        y: y,
        dy: textOpts.dy,
        theta: theta,
        level: textOpts.level,
        width: w,
        height: h
    });

    labelClipPathData.push(bBoxPts);
};
```

**6. 绘制标签** (plot.js:580-615)
```javascript
exports.drawLabels = function(labelGroup, labelData, gd, lineClip, labelClipPathData) {
    var labels = labelGroup.selectAll('text')
        .data(labelData, function(d) {
            return d.text + ',' + d.x + ',' + d.y + ',' + d.theta;
        });

    labels.enter().append('text')
        .attr({
            'data-notex': 1,
            'text-anchor': 'middle'
        })
        .each(function(d) {
            var x = d.x + Math.sin(d.theta) * d.dy;
            var y = d.y - Math.cos(d.theta) * d.dy;
            d3.select(this)
                .text(d.text)
                .attr({
                    x: x,
                    y: y,
                    transform: 'rotate(' + (180 * d.theta / Math.PI) + ' ' + x + ' ' + y + ')'
                });
        });
};
```

### 标签优化常量

```javascript
// constants.js
LABELOPTIMIZER: {
    EDGECOST: 1,           // 边缘距离权重
    ANGLECOST: 1,          // 角度权重
    NEIGHBORCOST: 5,       // 邻近标签权重
    SAMELEVELFACTOR: 10,   // 同级别标签因子
    SAMELEVELDISTANCE: 5,  // 同级别最小距离
    MAXCOST: 100,          // 最大允许代价
    INITIALSEARCHPOINTS: 10, // 初始搜索点数
    ITERATIONS: 5          // 迭代次数
}

LABELDISTANCE: 2,         // 每个标签的路径长度（对角线的倍数）
LABELINCREASE: 10,        // 超过这个级别数后增加标签
LABELMIN: 3,              // 最小路径长度（标签尺寸的倍数）
LABELMAX: 10              // 每条路径的最大标签数
```

---

## 标尺（Colorbar）创建

### 配置
```javascript
{
    contours: {
        coloring: 'fill' // 或 'lines'
    },
    colorscale: [[0, 'blue'], [0.5, 'green'], [1, 'red']],
    colorbar: {
        title: 'Value',
        thickness: 20,
        len: 0.8,
        x: 1.02,
        y: 0.5
    }
}
```

### 实现

**colorbar.js** (src/traces/contour/colorbar.js)

```javascript
function calc(gd, trace, opts) {
    var contours = trace.contours;
    var line = trace.line;
    var cs = contours.size || 1;
    var coloring = contours.coloring;
    var colorMap = makeColorMap(trace, {isColorbar: true});

    // 1. 根据 coloring 模式设置颜色
    if(coloring === 'heatmap') {
        var cOpts = Colorscale.extractOpts(trace);
        opts._fillgradient = cOpts.reversescale ?
            Colorscale.flipScale(cOpts.colorscale) :
            cOpts.colorscale;
        opts._zrange = [cOpts.min, cOpts.max];
    } else if(coloring === 'fill') {
        opts._fillcolor = colorMap;
    }

    // 2. 设置线条属性
    opts._line = {
        color: coloring === 'lines' ? colorMap : line.color,
        width: contours.showlines !== false ? line.width : 0,
        dash: line.dash
    };

    // 3. 设置级别范围
    opts._levels = {
        start: contours.start,
        end: endPlus(contours),
        size: cs
    };
}

module.exports = {
    min: 'zmin',
    max: 'zmax',
    calc: calc
};
```

### 颜色映射生成

**make_color_map.js** (src/traces/contour/make_color_map.js)

```javascript
module.exports = function makeColorMap(trace) {
    var contours = trace.contours;
    var start = contours.start;
    var end = endPlus(contours);
    var cs = contours.size || 1;
    var nc = Math.floor((end - start) / cs) + 1;
    var cOpts = Colorscale.extractOpts(trace);

    // 1. 获取颜色比例尺
    var scl = cOpts.reversescale ?
        Colorscale.flipScale(cOpts.colorscale) :
        cOpts.colorscale;

    var domain = new Array(scl.length);
    var range = new Array(scl.length);

    // 2. 映射颜色到等值线级别
    if(customLevels && customLevels.length > 0) {
        // 自定义阈值模式
        var levels = customLevels;
        var minLevel = levels[0];
        var maxLevel = levels[levels.length - 1];

        for(i = 0; i < scl.length; i++) {
            si = scl[i];
            domain[i] = minLevel + si[0] * (maxLevel - minLevel);
            range[i] = si[1];
        }
    } else {
        // 标准模式
        var extra = contours.coloring === 'lines' ? 0 : 1;

        for(i = 0; i < scl.length; i++) {
            si = scl[i];
            domain[i] = (si[0] * (nc + extra - 1) - (extra / 2)) * cs + start;
            range[i] = si[1];
        }
    }

    // 3. 创建颜色映射函数
    return Colorscale.makeColorScaleFunc(
        {domain: domain, range: range},
        {noNumericCheck: true}
    );
};
```

### 标尺显示

Plotly 会自动调用通用的 Colorbar 组件来显示标尺。标尺的配置通过 `colorbar.js` 的 `calc` 函数传递给颜色条组件。

---

## 核心算法：Marching Squares

### 算法概述

Marching Squares 是一种用于从二维标量场提取等值线的算法。Plotly.js 使用了改进版本，特别处理了鞍点（saddle points）。

### 算法步骤

#### 步骤 1: 网格划分
将二维网格划分为多个单元格（每个单元格由 4 个点组成）

```
(x,y) --- (x+1,y)
  |         |
  |   cell  |
  |         |
(x,y+1) -(x+1,y+1)
```

#### 步骤 2: 计算 marching index
对每个单元格，根据 4 个顶点与等值线值的关系生成索引：

```javascript
var mi = (corners[0][0] > val ? 0 : 1) +   // 左上
         (corners[0][1] > val ? 0 : 2) +   // 右上
         (corners[1][1] > val ? 0 : 4) +   // 右下
         (corners[1][0] > val ? 0 : 8);    // 左下
```

#### 步骤 3: 鞍点处理
对于模棱两可的情况（mi = 5 或 10），计算平均值来决定连接方式：

```javascript
if(mi === 5 || mi === 10) {
    var avg = (corners[0][0] + corners[0][1] +
               corners[1][0] + corners[1][1]) / 4;
    if(val > avg) return (mi === 5) ? 713 : 1114;  // 双峰
    else return (mi === 5) ? 104 : 208;            // 双谷
}
```

#### 步骤 4: 路径连接
根据 marching index 确定连接方式，使用查找表获取下一步方向：

```javascript
NEWDELTA: [
    null, [-1, 0], [0, -1], [-1, 0],  // 0, 1, 2, 3
    [1, 0], null, [0, -1], [-1, 0],   // 4, 5, 6, 7
    [0, 1], [0, 1], null, [0, 1],     // 8, 9, 10, 11
    [1, 0], [1, 0], [0, -1]           // 12, 13, 14
]
```

#### 步骤 5: 线性插值
在单元格边上进行精确插值，找到等值线的精确位置：

```javascript
// 水平边插值
var dx = (level - zxy) / (pi.z[locy][locx + 1] - zxy);
var xPos = (1 - dx) * x[locx] + dx * x[locx + 1];

// 垂直边插值
var dy = (level - zxy) / (pi.z[locy + 1][locx] - zxy);
var yPos = (1 - dy) * y[locy] + dy * y[locy + 1];
```

### Marching Index 图例

```
情况 0:  全部低于等值线   (无等值线)
情况 1:  仅左下高于       |       (连接上边和右边)
情况 2:  仅右下高于       |       (连接左边和上边)
情况 3:  左下、右下高于   --      (连接左边和右边)
情况 4:  仅右上高于       |       (连接左边和下边)
情况 5:  左上、右下高于   +-      (鞍点，需特殊处理)
情况 6:  右上、右下高于   |¯      (连接左边和上边)
情况 7:  仅左上低于       |       (连接上边和右边)
情况 8:  仅左上高于       |       (连接右边和下边)
情况 9:  左上、左下高于   ¯|      (连接右边和下边)
情况 10: 右上、左下高于   -+      (鞍点，需特殊处理)
情况 11: 仅右下低于       |       (连接左边和下边)
情况 12: 左上、右上高于   --      (连接下边和上边)
情况 13: 仅右下低于       |       (连接右边和下边)
情况 14: 左上、右下高于   |¯      (连接右边和下边)
情况 15: 全部高于等值线   (无等值线)
```

### 鞍点处理详解

鞍点（saddle point）是指两个峰之间或两个谷之间的区域。在这种情况下，等值线的连接方式不唯一。

**Plotly.js 的解决方案**:

```javascript
// 计算四个顶点的平均值
var avg = (corners[0][0] + corners[0][1] +
           corners[1][0] + corners[1][1]) / 4;

// 如果等值线值高于平均值，说明是两个峰之间的谷
if(val > avg) {
    return (mi === 5) ? 713 : 1114;
}
// 如果等值线值低于平均值，说明是两个谷之间的峰
else {
    return (mi === 5) ? 104 : 208;
}
```

这样可以确保等值线连续且拓扑正确。

---

## 关键代码片段

### 1. 完整的绘制流程

```javascript
// plot.js:21-68
exports.plot = function plot(gd, plotinfo, cdcontours, contourLayer) {
    var xa = plotinfo.xaxis;
    var ya = plotinfo.yaxis;

    Lib.makeTraceGroups(contourLayer, cdcontours, 'contour').each(function(cd) {
        var plotGroup = d3.select(this);
        var cd0 = cd[0];
        var trace = cd0.trace;
        var contours = trace.contours;
        var pathinfo = emptyPathinfo(contours, plotinfo, cd0);

        // 1. 绘制热图背景（如果需要）
        if(contours.coloring === 'heatmap') {
            heatmapPlot(gd, plotinfo, [cd], heatmapColoringLayer);
        }

        // 2. 计算交叉点和路径
        makeCrossings(pathinfo);
        findAllPaths(pathinfo);

        // 3. 计算边界
        var perimeter = [
            [xa.c2p(x[0], true), ya.c2p(y[0], true)],
            [xa.c2p(x[x.length - 1], true), ya.c2p(y[0], true)],
            [xa.c2p(x[x.length - 1], true), ya.c2p(y[y.length - 1], true)],
            [xa.c2p(x[0], true), ya.c2p(y[y.length - 1], true)]
        ];

        // 4. 绘制各层
        makeBackground(plotGroup, perimeter, contours);
        makeFills(plotGroup, fillPathinfo, perimeter, contours);
        makeLinesAndLabels(plotGroup, pathinfo, gd, cd0, contours);
        clipGaps(plotGroup, plotinfo, gd, cd0, perimeter);
    });
};
```

### 2. 自定义阈值支持

```javascript
// set_contours.js:10-53
if(contours.thresholds && Lib.isArrayOrTypedArray(contours.thresholds) &&
   contours.thresholds.length > 0) {
    // 排序并验证阈值
    var thresholds = contours.thresholds.slice().sort(function(a, b) {
        return a - b;
    });

    thresholds = thresholds.filter(function(val) {
        return typeof val === 'number' && !isNaN(val) && isFinite(val);
    });

    if(thresholds.length > 0) {
        // 设置自定义级别
        contours.start = thresholds[0];
        contours.end = thresholds[thresholds.length - 1];
        contours.size = null;
        contours._levels = thresholds; // 存储完整级别列表

        // 同步到输入
        if(!trace._input.contours) trace._input.contours = {};
        trace._input.contours.thresholds = thresholds;
        trace._input.autocontour = false;

        return; // 跳过自动/手动级别生成
    }
}
```

### 3. 平滑处理

```javascript
// plot.js:333-361
// 开放路径平滑
opencontourlines
    .attr('d', function(d) {
        return Drawing.smoothopen(d, smoothing);
    });

// 闭合路径平滑
closedcontourlines
    .attr('d', function(d) {
        return Drawing.smoothclosed(d, smoothing);
    });
```

平滑算法基于 Catmull-Rom 样条，`smoothing` 参数控制平滑程度（0-1）。

### 4. 路径点简化

```javascript
// find_all_paths.js:106-166
// 删除过于密集的点
var distThreshold = totaldist / alldists.length * (0.2 * pi.smoothing);

for(cnt = pts.length - 2; cnt >= cropstart; cnt--) {
    distgroup = alldists[cnt];
    if(distgroup < distThreshold) {
        // 合并接近的点
        // ...
        pts.splice(cnt2 + 1, cnt - cnt2 + 1, newpt);
    }
}
```

这可以减少 SVG 路径的复杂度，提高渲染性能。

### 5. 缺失值处理

```javascript
// plot.js:617-681
function makeClipMask(cd0) {
    var empties = cd0.trace._emptypoints;
    var z = [];
    var m = cd0.z.length;
    var n = cd0.z[0].length;

    // 创建掩码矩阵（1 = 有数据，0 = 无数据）
    for(i = 0; i < n; i++) row.push(1);
    for(i = 0; i < m; i++) z.push(row.slice());

    for(i = 0; i < empties.length; i++) {
        emptyPoint = empties[i];
        z[emptyPoint[0]][emptyPoint[1]] = 0;
    }

    cd0.zmask = z;
    return z;
}
```

---

## 总结

Plotly.js 的 contour 实现是一个完整的等值线生成和渲染系统，主要包括：

1. **灵活的级别设置**: 支持自动计算、手动指定和自定义阈值
2. **改进的 Marching Squares**: 正确处理鞍点，确保拓扑正确
3. **多种渲染模式**: lines、fill、heatmap
4. **智能标签放置**: 基于代价函数的优化算法
5. **完整的颜色映射**: 支持多种颜色比例尺
6. **性能优化**: 路径简化、平滑处理

### 核心优势

- **鲁棒性**: 正确处理各种边界情况
- **灵活性**: 支持自定义级别和多种渲染模式
- **性能**: 优化的路径计算和渲染
- **可扩展性**: 清晰的模块化设计

### 重构建议

基于 Plotly.js 的实现，重构时应保留：

1. Marching Squares 核心算法
2. 鞍点处理逻辑
3. 标签优化算法
4. 颜色映射系统

可以改进的部分：

1. 解耦渲染层（支持 Canvas、WebGL）
2. 简化 API（隐藏内部复杂性）
3. 优化性能（使用 TypedArray、Worker）
4. 添加更多自定义选项
