# contour-core 实现原理

本文档详细说明 `contour-core` 模块中等值线（contour lines）和等值面（contour fills）的实现原理，以及处理 null 空值的渲染逻辑。

---

## 一、整体架构

contour-core 是从 Plotly.js 中抽取的独立等值线计算库，其核心架构如下：

```
contour-core/
├── compute.js           # 计算入口，整合所有步骤
├── levels.js            # 等值线层级计算
├── marchingsquares.js   # Marching Squares 算法核心
├── pathfinding.js       # 路径跟踪与连接
├── close_boundaries.js  # 边界闭合处理
├── null_handling/       # 空值处理模块
└── renderers/           # 渲染器（Canvas/SVG）
```

---

## 二、等值线计算流程

### 2.1 计算入口 (`compute.js`)

等值线计算的主函数 `computeContours(grid, options)` 执行以下步骤：

```javascript
// compute.js 核心流程
function computeContours(grid, options) {
    // 1. 验证和提取输入数据
    // 2. 规范化 null 值
    // 3. 插值填充空值
    // 4. 计算等值线层级
    // 5. 执行 Marching Squares
    // 6. 查找并连接路径
    // 7. 闭合边界（用于填充渲染）
    return result;
}
```

### 2.2 等值线层级计算 (`levels.js`)

层级计算支持三种模式：

1. **自定义阈值（thresholds）**：用户直接指定等值线的数值
2. **自动模式（autocontour）**：根据数据范围自动生成"美观"的层级
3. **手动模式**：通过 start、end、size 参数指定

自动模式使用"智能刻度算法"，生成如 1、2、5、10 这样的美观数值：

```javascript
// 选择"美观"的分数
if (fraction < 1.5) niceFraction = 1;
else if (fraction < 3) niceFraction = 2;
else if (fraction < 7) niceFraction = 5;
else niceFraction = 10;
```

---

## 三、Marching Squares 算法

### 3.1 算法概述

Marching Squares 是等值线生成的核心算法，用于在二维网格上找到等值线的位置。该算法：

1. 将网格分割成小正方形（单元格）
2. 对每个单元格，检查四个角点的值与等值线层级的关系
3. 根据角点状态确定等值线如何穿过该单元格
4. 通过线性插值找到精确的交叉点位置

### 3.2 Marching Index 计算 (`marchingsquares.js`)

每个单元格根据四个角点与等值线层级的关系，计算一个 marching index：

```javascript
// 角点布局：
//     01
//     23
// 位权分配：左上=1, 右上=2, 右下=4, 左下=8

var mi = (corners[0][0] > val ? 0 : 1) +   // 左上
         (corners[0][1] > val ? 0 : 2) +   // 右上
         (corners[1][1] > val ? 0 : 4) +   // 右下
         (corners[1][0] > val ? 0 : 8);    // 左下
```

### 3.3 鞍点消歧

当 `mi = 5` 或 `mi = 10` 时，出现鞍点（saddle point）情况，需要特殊处理：

```javascript
if (mi === 5 || mi === 10) {
    var avg = (四个角点值的平均值);
    // 两个峰之间的大山谷
    if (val > avg) return (mi === 5) ? 713 : 1114;
    // 两个谷之间的大山脊
    return (mi === 5) ? 104 : 208;
}
```

鞍点用两位十进制数表示，如 104、208、713、1114，表示两种可能的连接方式。

### 3.4 交叉点生成

`makeCrossings()` 函数遍历所有单元格，为每个层级记录：

- `crossings`: 坐标 → marching index 的映射
- `starts`: 边界起始点列表

---

## 四、路径查找与连接 (`pathfinding.js`)

### 4.1 路径跟踪算法

路径跟踪从一个起始点开始，沿着交叉点前进，直到：

1. 回到起点（形成闭合路径）
2. 到达网格边界（形成开放路径）

```javascript
function makePath(pi, loc, edgeflag, xtol, ytol) {
    // 从起始点后退半步，找到交叉点
    var pts = [getInterpPx(pi, loc, [-marchStep[0], -marchStep[1]])];

    // 跟踪路径
    for (cnt = 0; cnt < 10000; cnt++) {
        // 处理鞍点
        // 计算下一步方向
        // 找到交叉点位置
        // 检查是否闭合或到达边界
    }

    // 路径简化
    var simplifiedPts = simplifyPath(pts, pi.smoothing, closedpath);
}
```

### 4.2 线性插值

精确的交叉点位置通过线性插值计算：

```javascript
// 水平边插值
if (step[1]) {
    var dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);
    dataX = (1 - dx) * x[locx] + dx * x[locx + 1];
    dataY = y[locy];
}
// 垂直边插值
else {
    var dy = (pi.level - zxy) / (pi.z[locy + 1][locx] - zxy);
    dataX = x[locx];
    dataY = (1 - dy) * y[locy] + dy * y[locy + 1];
}
```

### 4.3 路径简化

路径简化移除过于接近的点（基于平滑参数）：

```javascript
var distThreshold = totaldist / alldists.length * (0.2 * smoothing);
// 移除间距小于阈值的点，保留中心点或中心两点的平均值
```

### 4.4 边界路径合并

开放的边界路径会被合并：

- 检查新路径端点是否与现有边界路径端点重合
- 如果重合，连接两条路径
- 如果两端都重合，形成闭合路径

---

## 五、边界闭合处理 (`close_boundaries.js`)

对于等值面填充（`coloring: 'fill'`），需要处理边界情况：

```javascript
// fill 模式下的边界处理
var edgeVal2 = Math.min(z[0][0], z[0][1]);
pi.prefixBoundary = !pi.edgepaths.length &&
    (edgeVal2 > pi.level || pi.starts.length && edgeVal2 === pi.level);
```

当 `prefixBoundary` 为 true 时，渲染器会在填充路径前添加整个边界框作为路径前缀。

---

## 六、Null 空值处理

### 6.1 概述

contour-core 中 null 值的处理遵循 Plotly.js 的设计理念：

1. **计算阶段总是进行插值**：无论 `connectgaps` 设置如何，等值线计算都会插值填充空值
2. **渲染阶段决定是否遮罩**：`connectgaps` 控制是否在渲染时遮罩插值区域

```javascript
// compute.js 中的关键注释：
// IMPORTANT: In plotly.js, contours ALWAYS interpolate, regardless of connectgaps setting
// The connectgaps option only controls whether to MASK the interpolated regions in rendering
```

### 6.2 Null 值规范化 (`null_handling/normalize.js`)

将各种无效值统一转换为 NaN：

```javascript
function normalizeNullValues(grid) {
    // 检测：null, undefined, NaN
    var isNull = val === null ||
                val === undefined ||
                (typeof val === 'number' && isNaN(val));

    // 返回：
    // - cleanedGrid: 所有无效值转为 NaN
    // - nullMask: 布尔掩码数组（true = 原始为空）
    // - nullCount: 空值数量
    // - validCount: 有效值数量
}
```

### 6.3 查找空值点 (`null_handling/find_empties.js`)

找到所有空值点并按邻居数量排序：

```javascript
function findEmpties(z) {
    // 1. 遍历网格，找出 undefined 的点
    // 2. 计算每个空值点的有效邻居数量（上下左右）
    // 3. 对没有直接邻居的点，递归查找有邻居的邻居
    // 4. 按邻居数量降序排序（更多邻居优先）
    return [[i, j, neighborCount], ...];
}
```

排序的目的是先处理有更多邻居的点，这样可以更快地收敛。

### 6.4 2D 插值填充 (`null_handling/interp2d.js`)

使用迭代拉普拉斯方程求解器（泊松方程）填充空值：

```javascript
function interp2d(z, emptyPoints) {
    // 第一遍：用邻居平均值填充初始值
    iterateInterp2d(z, emptyPoints);

    // 移除邻居数 < 4 的点（无需迭代）
    emptyPoints = emptyPoints.slice(i);

    // 迭代精化（最多100次，直到收敛）
    for (i = 0; i < 100 && maxFractionalChange > 1e-2; i++) {
        maxFractionalChange = iterateInterp2d(z, emptyPoints, overshoot);
    }
}
```

核心迭代过程：

```javascript
// 拉普拉斯方程：每个点 = 邻居平均值
z[i][j] = neighborSum / neighborCount;

// 使用超调加速收敛
z[i][j] = (1 + overshoot) * z[i][j] - overshoot * initialVal;
```

### 6.5 Null 渲染 (`renderers/canvas/nulls.js`)

在渲染阶段处理 null 区域：

```javascript
function drawNulls(ctx, contourResult, style) {
    // 1. 如果 connectgaps=false，用背景色填充 null 区域
    // 2. 或者使用 destination-out 使 null 区域透明
    // 3. 可选：绘制 null 区域边框
}
```

---

## 七、数据流图

```
输入: grid { z: [[...]], x: [...], y: [...] }
    ↓
normalizeNullValues()
    ↓ cleanedGrid, nullMask
findEmpties() + interp2d()
    ↓ 插值后的 z
setContours()
    ↓ 层级数组 [level1, level2, ...]
makeCrossings()
    ↓ pathinfo[] (每个层级有 crossings, starts)
findAllPaths()
    ↓ pathinfo[] (每个层级有 edgepaths, paths)
closeBoundaries()
    ↓ pathinfo[] (添加 prefixBoundary)
输出: { levels, paths, pathinfo, nullMask, ... }
    ↓
renderers (Canvas/SVG)
    ↓
最终渲染
```

---

## 八、关键设计决策

1. **插值 vs 遮罩分离**
   - 计算总是插值（保证等值线连续性）
   - 渲染决定遮罩（满足用户视觉需求）

2. **网格索引空间计算**
   - 计算在网格索引空间进行
   - 支持非均匀网格和坐标轴变换

3. **路径简化基于索引距离**
   - 使用网格索引距离而非像素距离
   - 适用于各种缩放和变换

4. **边界路径自动合并**
   - 开放的边界路径会被智能合并
   - 尽可能形成闭合的填充区域

---

## 九、与 Plotly.js 的关系

contour-core 是 Plotly.js contour 实现的提取和简化：

| 方面 | Plotly.js | contour-core |
|------|-----------|--------------|
| 依赖 | 依赖整个 Plotly 库 | 零外部依赖 |
| DOM | 需要浏览器环境 | 可在 Node.js 运行 |
| API | 通过 trace 配置 | 纯函数 API |
| 渲染 | SVG/Canvas 集成 | 可选渲染器 |

核心算法（Marching Squares、路径查找、插值）保持一致，确保结果兼容。
