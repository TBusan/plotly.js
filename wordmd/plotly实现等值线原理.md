# Plotly.js 实现等值线原理

本文档详细说明 Plotly.js 中等值线（contour）和等值面（contour fill）的实现原理，以及处理 null 空值的渲染逻辑。

---

## 一、整体架构

Plotly.js 的 contour 实现位于 `src/traces/contour/` 目录：

```
src/traces/contour/
├── calc.js              # 等值线计算入口
├── plot.js              # SVG/Canvas 渲染
├── make_crossings.js    # Marching Squares 算法
├── find_all_paths.js    # 路径跟踪
├── close_boundaries.js  # 边界闭合
├── set_contours.js      # 等值线层级设置
└── constants.js         # 算法常量
```

contour 计算基于 heatmap 模块，共享数据处理和空值插值逻辑：

```
src/traces/heatmap/
├── calc.js              # 数据处理和空值插值
├── interp2d.js          # 2D 插值算法
├── find_empties.js      # 查找空值点
└── clean_2d_array.js    # 数据清理
```

---

## 二、等值线计算流程

### 2.1 计算入口 (`contour/calc.js`)

contour 的计算复用了 heatmap 的计算逻辑：

```javascript
// contour/calc.js
module.exports = function calc(gd, trace) {
    // 1. 调用 heatmap calc 获取基础数据
    var cd = heatmapCalc(gd, trace);

    // 2. 设置等值线层级
    setContours(trace, zOut);

    // 3. 计算 colorscale
    Colorscale.calc(gd, trace, {vals: cVals, cLetter: 'z'});

    return cd;
};
```

### 2.2 热图计算 (`heatmap/calc.js`)

heatmap calc 负责数据预处理和空值插值：

```javascript
module.exports = function calc(gd, trace) {
    // 1. 准备 x, y 坐标数据
    // 2. 清理 z 数据 (clean2dArray)
    // 3. 查找空值点 (findEmpties)
    // 4. 插值填充 (interp2d) - contour 或 connectgaps=true 时
    // 5. 创建边界数组 (makeBoundArray)
    // 6. 计算坐标轴极值
    return [cd0];
};
```

关键点：**contour 总是进行插值**（第 82-84 行）：

```javascript
if(!isHist && (isContour || trace.connectgaps)) {
    trace._emptypoints = findEmpties(z);
    interp2d(z, trace._emptypoints);
}
```

---

## 三、Marching Squares 算法实现

### 3.1 算法入口 (`contour/make_crossings.js`)

Plotly.js 使用改进的 Marching Squares 算法：

```javascript
module.exports = function makeCrossings(pathinfo) {
    // 遍历所有单元格
    for(yi = 0; yi < m - 1; yi++) {
        for(xi = 0; xi < n - 1; xi++) {
            // 获取单元格四个角点的值
            corners = [[z[yi][xi], z[yi][xi + 1]],
                       [z[yi + 1][xi], z[yi + 1][xi + 1]]];

            // 为每个层级计算 marching index
            for(i = 0; i < pathinfo.length; i++) {
                pi = pathinfo[i];
                mi = getMarchingIndex(pi.level, corners);

                // 记录交叉点和起始点
                pi.crossings[label] = mi;
                if(startIndices.indexOf(mi) !== -1) {
                    pi.starts.push([xi, yi]);
                }
            }
        }
    }
};
```

### 3.2 Marching Index 计算

与标准 Marching Squares 不同，Plotly.js 对鞍点进行特殊处理：

```javascript
function getMarchingIndex(val, corners) {
    // 标准 marching index (0-15)
    var mi = (corners[0][0] > val ? 0 : 1) +
             (corners[0][1] > val ? 0 : 2) +
             (corners[1][1] > val ? 0 : 4) +
             (corners[1][0] > val ? 0 : 8);

    // 鞍点消歧 (mi=5 或 mi=10)
    if(mi === 5 || mi === 10) {
        var avg = (四个角点平均值);
        if(val > avg) return (mi === 5) ? 713 : 1114; // 两个峰之间的大山谷
        return (mi === 5) ? 104 : 208;  // 两个谷之间的大山脊
    }
    return (mi === 15) ? 0 : mi;
}
```

### 3.3 鞍点表示

鞍点用两位十进制数表示，编码两种可能的连接方式：

| 鞍点类型 | 编码 | 含义 |
|---------|------|------|
| 山谷型 (mi=5) | 713 | 组合 mi=7 和 mi=13 |
| 山谷型 (mi=5) | 104 | 组合 mi=1 和 mi=4 |
| 山脊型 (mi=10) | 1114 | 组合 mi=11 和 mi=14 |
| 山脊型 (mi=10) | 208 | 组合 mi=2 和 mi=8 |

在路径跟踪时，根据进入方向选择合适的连接方式。

---

## 四、路径查找与连接 (`contour/find_all_paths.js`)

### 4.1 路径跟踪主流程

```javascript
module.exports = function findAllPaths(pathinfo, xtol, ytol) {
    for(i = 0; i < pathinfo.length; i++) {
        pi = pathinfo[i];

        // 1. 处理所有边界起始路径
        for(j = 0; j < pi.starts.length; j++) {
            startLoc = pi.starts[j];
            makePath(pi, startLoc, 'edge', xtol, ytol);
        }

        // 2. 处理所有内部路径
        while(Object.keys(pi.crossings).length && cnt < 10000) {
            startLoc = Object.keys(pi.crossings)[0].split(',').map(Number);
            makePath(pi, startLoc, undefined, xtol, ytol);
        }
    }
};
```

### 4.2 单条路径生成

```javascript
function makePath(pi, loc, edgeflag, xtol, ytol) {
    // 1. 从起始点后退半步
    var pts = [getInterpPx(pi, loc, [-marchStep[0], -marchStep[1]])];

    // 2. 跟踪路径
    for(cnt = 0; cnt < 10000; cnt++) {
        // 处理鞍点选择
        if(mi > 20) {
            mi = constants.CHOOSESADDLE[mi][(marchStep[0] || marchStep[1]) < 0 ? 0 : 1];
            pi.crossings[locStr] = constants.SADDLEREMAINDER[mi];
        } else {
            delete pi.crossings[locStr];  // 标记为已访问
        }

        // 获取下一步方向
        marchStep = constants.NEWDELTA[mi];

        // 插值找到交叉点
        pts.push(getInterpPx(pi, loc, marchStep));

        // 移动到下一个单元格
        loc[0] += marchStep[0];
        loc[1] += marchStep[1];

        // 检查终止条件
        if(closedLoop || (edgeflag && atEdge)) break;
    }

    // 3. 路径简化和合并
}
```

### 4.3 线性插值（支持对数坐标轴）

```javascript
function getInterpPx(pi, loc, step) {
    var xa = pi.xaxis;  // x轴对象
    var ya = pi.yaxis;  // y轴对象

    if(step[1]) {
        // 水平边插值
        var dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);

        // 在线性空间插值，支持对数轴
        var dxl = (dx !== 1 ? (1 - dx) * xa.c2l(pi.x[locx]) : 0) +
                  (dx !== 0 ? dx * xa.c2l(pi.x[locx + 1]) : 0);

        return [xa.c2p(xa.l2c(dxl), true),  // 转换为像素坐标
                ya.c2p(pi.y[locy], true),
                locx + dx, locy];
    } else {
        // 垂直边插值
        var dy = (pi.level - zxy) / (pi.z[locy + 1][locx] - zxy);
        var dyl = (dy !== 1 ? (1 - dy) * ya.c2l(pi.y[locy]) : 0) +
                  (dy !== 0 ? dy * ya.c2l(pi.y[locy + 1]) : 0);

        return [xa.c2p(pi.x[locx], true),
                ya.c2p(ya.l2c(dyl), true),
                locx, locy + dy];
    }
}
```

关键点：
- `c2l()`: 像素坐标 → 线性坐标
- `l2c()`: 线性坐标 → 像素坐标
- `c2p()`: 像素坐标转换

这种设计支持对数坐标轴，插值在对数空间进行。

### 4.4 边界路径合并

```javascript
// 检查是否可以与现有边界路径连接
for(i = 0; i < pi.edgepaths.length; i++) {
    edgepathi = pi.edgepaths[i];
    if(equalPts(edgepathi[0], pts[pts.length - 1], xtol, ytol)) {
        pts.pop();
        merged = true;

        // 检查是否也连接到另一条路径的末端
        for(j = 0; j < pi.edgepaths.length; j++) {
            edgepathj = pi.edgepaths[j];
            if(equalPts(edgepathj[edgepathj.length - 1], pts[0], xtol, ytol)) {
                pts.shift();
                if(j === i) {
                    pi.paths.push(pts.concat(edgepathj));  // 形成闭合路径
                } else {
                    pi.edgepaths[j] = edgepathj.concat(pts, edgepathi);
                }
                break;
            }
        }
    }
}
```

---

## 五、Null 空值处理

### 5.1 设计理念

Plotly.js 中 contour 的空值处理有一个重要特点：

**contour 总是进行插值填充，`connectgaps` 只控制渲染时的遮罩行为**

```javascript
// heatmap/calc.js 第 82-84 行
if(!isHist && (isContour || trace.connectgaps)) {
    trace._emptypoints = findEmpties(z);
    interp2d(z, trace._emptypoints);
}
```

注意条件中 `isContour` 为 true 时总是执行插值。

### 5.2 查找空值点 (`heatmap/find_empties.js`)

```javascript
module.exports = function findEmpties(z) {
    var empties = [];
    var neighborHash = {};
    var noNeighborList = [];

    // 第一遍：找出所有 undefined 的点并计算邻居数
    for(i = 0; i < z.length; i++) {
        for(j = 0; j < rowLength; j++) {
            if(row[j] === undefined) {
                // 计算有效邻居数（上下左右）
                neighborCount = (row[j - 1] !== undefined ? 1 : 0) +
                    (row[j + 1] !== undefined ? 1 : 0) +
                    (prevRow[j] !== undefined ? 1 : 0) +
                    (nextRow[j] !== undefined ? 1 : 0);

                // 边界点特殊处理
                if(i === 0) neighborCount++;
                if(j === 0) neighborCount++;
                if(i === z.length - 1) neighborCount++;
                if(j === row.length - 1) neighborCount++;

                if(neighborCount) {
                    empties.push([i, j, neighborCount]);
                } else {
                    noNeighborList.push([i, j]);
                }
            }
        }
    }

    // 第二遍：为没有直接邻居的点查找间接邻居
    while(noNeighborList.length) {
        // 根据已找到邻居的点，计算新的邻居权重
        neighborCount = ((neighborHash[[i - 1, j]] || blank)[2] +
                         (neighborHash[[i + 1, j]] || blank)[2] +
                         (neighborHash[[i, j - 1]] || blank)[2] +
                         (neighborHash[[i, j + 1]] || blank)[2]) / 20;
        // ...
    }

    // 按邻居数降序排序（更多邻居优先）
    return empties.sort(function(a, b) { return b[2] - a[2]; });
};
```

### 5.3 2D 插值 (`heatmap/interp2d.js`)

使用迭代拉普拉斯方程求解器（泊松方程）：

```javascript
module.exports = function interp2d(z, emptyPoints) {
    var maxFractionalChange = 1;

    // 第一遍：填充初始值
    iterateInterp2d(z, emptyPoints);

    // 移除邻居数 < 4 的点（无需迭代）
    for(i = 0; i < emptyPoints.length; i++) {
        if(emptyPoints[i][2] < 4) break;
    }
    emptyPoints = emptyPoints.slice(i);

    // 迭代精化
    for(i = 0; i < 100 && maxFractionalChange > INTERPTHRESHOLD; i++) {
        maxFractionalChange = iterateInterp2d(z, emptyPoints,
            correctionOvershoot(maxFractionalChange));
    }

    return z;
};
```

核心迭代函数：

```javascript
function iterateInterp2d(z, emptyPoints, overshoot) {
    var maxFractionalChange = 0;

    for(p = 0; p < emptyPoints.length; p++) {
        thisPt = emptyPoints[p];
        i = thisPt[0];
        j = thisPt[1];
        initialVal = z[i][j];

        // 计算邻居总和
        for(q = 0; q < 4; q++) {
            neighborShift = NEIGHBORSHIFTS[q];  // [[-1,0], [1,0], [0,-1], [0,1]]
            neighborVal = z[i + neighborShift[0]][j + neighborShift[1]];
            if(neighborVal !== undefined) {
                neighborSum += neighborVal;
                neighborCount++;
            }
        }

        // 拉普拉斯方程：每个点 = 邻居平均值
        z[i][j] = neighborSum / neighborCount;

        // 使用超调加速收敛
        if(initialVal !== undefined) {
            z[i][j] = (1 + overshoot) * z[i][j] - overshoot * initialVal;
        }

        // 计算变化量
        if(maxNeighbor > minNeighbor) {
            fractionalChange = Math.abs(z[i][j] - initialVal) / (maxNeighbor - minNeighbor);
            maxFractionalChange = Math.max(maxFractionalChange, fractionalChange);
        }
    }

    return maxFractionalChange;
}
```

超调函数：

```javascript
function correctionOvershoot(maxFractionalChange) {
    // 随着收敛加速，逐渐增加超调量
    return 0.5 - 0.25 * Math.min(1, maxFractionalChange * 0.5);
}
```

### 5.4 渲染时的空值处理

在 `contour/plot.js` 中，根据 `connectgaps` 设置决定如何处理插值区域：

- `connectgaps: true`：正常渲染插值后的等值线
- `connectgaps: false`：在渲染时遮罩插值区域

---

## 六、数据流图

```
输入: trace { z: [[...]], x: [...], y: [...], contours: {...} }
    ↓
heatmap/calc.js
    ↓ clean2dArray (清理数据)
    ↓ findEmpties (查找空值点)
    ↓ interp2d (插值填充) - contour 总是执行
    ↓ makeBoundArray (创建边界数组)
contour/calc.js
    ↓ setContours (设置等值线层级)
    ↓ Colorscale.calc (计算颜色)
    ↓
makeCrossings (Marching Squares)
    ↓ crossings: { "x,y": marchingIndex, ... }
    ↓ starts: [[x, y], ...]
findAllPaths
    ↓ edgepaths: [[[x, y], ...], ...]
    ↓ paths: [[[x, y], ...], ...]
closeBoundaries
    ↓ prefixBoundary: boolean
contour/plot.js
    ↓ SVG/Canvas 渲染
最终输出
```

---

## 七、关键设计决策

### 7.1 插值 vs 遮罩分离

| 设置 | 计算阶段 | 渲染阶段 |
|------|---------|---------|
| contour, connectgaps=true | 插值 | 正常渲染 |
| contour, connectgaps=false | 插值 | 遮罩插值区域 |
| heatmap, connectgaps=true | 插值 | 正常渲染 |
| heatmap, connectgaps=false | 不插值 | 留空 |

这种设计确保：
1. 等值线始终连续（有利于路径跟踪）
2. 用户可以控制视觉呈现

### 7.2 坐标轴支持

插值在线性空间进行，但支持对数坐标轴：

```javascript
// 对数轴值转换
var dxl = (dx !== 1 ? (1 - dx) * xa.c2l(pi.x[locx]) : 0) +
          (dx !== 0 ? dx * xa.c2l(pi.x[locx + 1]) : 0);
```

### 7.3 路径简化基于索引距离

```javascript
// 使用网格索引距离而非像素距离
function ptDist(pt1, pt2) {
    var dx = pt1[2] - pt2[2];  // 第3个元素是 x 索引
    var dy = pt1[3] - pt2[3];  // 第4个元素是 y 索引
    return Math.sqrt(dx * dx + dy * dy);
}
```

这使得简化算法适用于各种坐标轴变换。

### 7.4 边界处理

对于边界路径：
- 从边界起始点开始跟踪
- 到达另一边界时停止
- 尝试与其他边界路径合并
- 如果两端都能连接，形成闭合路径

---

## 八、与 heatmap 的关系

| 功能 | heatmap | contour |
|------|---------|---------|
| 数据处理 | ✅ 自己处理 | ✅ 复用 heatmap calc |
| 空值插值 | connectgaps=true | 总是插值 |
| 颜色计算 | 直接用 z 值 | 用层级或 z 值 |
| 路径计算 | 不需要 | Marching Squares |
| 渲染 | 网格矩形 | 路径（线/填充） |

---

## 九、总结

Plotly.js 的 contour 实现是一个精心设计的系统：

1. **模块化**：与 heatmap 共享数据处理逻辑
2. **鲁棒性**：插值确保等值线连续
3. **灵活性**：支持对数轴、非均匀网格
4. **性能**：按邻居数排序优化插值顺序
5. **完整性**：自动处理边界路径合并

核心算法（Marching Squares + 拉普拉斯插值）是科学可视化的标准方法，Plotly.js 的实现细节（如鞍点处理、超调收敛）体现了对边缘情况的深入考虑。
