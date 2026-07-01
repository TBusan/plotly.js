# contour-core 等值线平滑与边界处理原理

> 本文档基于对 `contour-core/` 源码的深度解读，覆盖「grid → marching squares → 折线 → Catmull-Rom 平滑 → prefixBoundary 边界填充」的完整链路，逐层拆解数学原理、工程取舍与不变量。

---

## 目录

1. [全链路鸟瞰](#1-全链路鸟瞰)
2. [marching squares 怎么把 grid 变成折线](#2-marching-squares-怎么把-grid-变成折线)
   - 2.1 每个 cell 的 4-bit 标号
   - 2.2 鞍点决策
   - 2.3 交叉点的线性插值
   - 2.4 walking 表 NEWDELTA
3. [路径组装 makePath](#3-路径组装-makepath)
4. [simplifyPath：用 smoothing 算距离阈值](#4-simplifypath--用-smoothing-算距离阈值)
   - 4.1 距离阈值怎么来
   - 4.2 近段折叠算法
   - 4.3 equalPts 兜底
   - 4.4 边路径的合并 mergeEdgePath
5. [smooth.js：真正画出曲线的地方](#5-smoothjs--真正画出曲线的地方)
   - 5.1 Catmull-Rom 切线公式
   - 5.2 开口折线 smoothopen
   - 5.3 闭合折线 smoothclosed
   - 5.4 S 从 0 到 1 的视觉差异
   - 5.5 round 函数的精度控制
6. [close_boundaries.js：填充与边界的前置判断](#6-close_boundariesjs--填充与边界的前置判断)
   - 6.1 为什么需要 prefixBoundary
   - 6.2 判据三段式
   - 6.3 边角落空回退
   - 6.4 constraint mode
   - 6.5 渲染时怎么用 prefixBoundary
7. [geojson.js 的离散 Catmull-Rom](#7-geojsonjs-的离散-catmull-rom)
8. [不变量与 gotcha 总结](#8-不变量与-gotcha-总结)
9. [工程取舍：为什么不一步到位](#9-工程取舍为什么不一步到位)
10. [整体小结](#10-整体小结)

---

## 1. 全链路鸟瞰

```
grid (z[m][n])
   │
   ├─ normalizeNullValues + interp2d     ← 把 null/NaN/undefined 用拉普拉斯方程填成有限值
   │
   ├─ levels.setContours                 ← 算出 [c₀, c₁, …, cₖ] 的「等值线层级」
   │
   ├─ marchingSquares.makeCrossings      ← 每 (m-1)×(n-1) 个 cell，对每个 level 统计一种 4-bit 模式 + 鞍点
   │
   ├─ pathFinding.findAllPaths           ← 把 crossings 串成 polyline（分段线性折线）
   │      ├── makePath                    ← 沿 marching 方向走，每个 cell 边的交叉点用线性插值
   │      ├── simplifyPath                ← 用 smoothing 参数算「距离阈值」，合并过近的点
   │      └── mergeEdgePath                ← 把开口折线按起点/终点接起来
   │
   ├─ closeBoundaries                     ← 决定每个 level 是否加 prefixBoundary，让「全在边界以下」的等值面也能渲染
   │
   └─ 结果返回 paths[]：{ level, edgepaths[], paths[], prefixBoundary, smoothing }
            │
            │  到此处为止所有坐标都是「数据空间 (data space)」的折线，还没真的圆滑过
            │
            ▼
   renderer / geojson 层
   ├── smooth.smoothopen / smoothclosed   ← 这是「真的画曲线」的地方：折线 → Bezier SVG path
   └── geojs.smoothClosedCoords / smoothOpenCoords  ← 离散插值成多点的折线（GeoJSON 不能用 Bezier）
```

**重点：** `computeContours` 返回的是 **折线 (polyline)**；所有真正「平滑成曲线」的动作都发生在 renderer 或 geojson 层，由 `smoothing` 参数驱动。`simplifyPath` 里的 smoothing 只是参与计算**距离阈值**，并不是绘图意义上的平滑。

---

## 2. marching squares 怎么把 grid 变成折线

### 2.1 每个 cell 的 4-bit 标号 (`marchingsquares.js:70-85`)

设 cell 4 个角点为：

```
corners[0][0] = z00   corners[0][1] = z01     ← 上行（yi）
corners[1][0] = z10   corners[1][1] = z11     ← 下行（yi+1）
       ↑xi                ↑xi+1
```

对当前 level `val`，每个角点用「是否大于 val」产生一位权重：

```js
mi = (z00 > val ? 0 : 1)        // 位 1 (权重 1)
   + (z01 > val ? 0 : 2)        // 位 2 (权重 2)
   + (z11 > val ? 0 : 4)        // 位 3 (权重 4)
   + (z10 > val ? 0 : 8);       // 位 4 (权重 8)
```

> 方向约定：`mi>0` 表示该角点「低于」 level（即落在 val 以下），`mi=0` 表示「高于」，再用 `mi===15`（全角点在同侧）规约回 0（无穿越）。

得到 0–15 共 16 种 cell 样式（其中 5 与 10 是鞍点）。

### 2.2 鞍点决策 (`marchingsquares.js:76-83`)

`mi===5` 和 `mi===10` 是鞍点（两条对角线都被穿越，cell 形状取决于「水平平均 vs val」）：

```js
if (mi === 5 || mi === 10) {
    var avg = (z00 + z01 + z10 + z11) / 4;
    if (val > avg) return (mi === 5) ? 713 : 1114;  // two peaks 带大 valley
    return (mi === 5) ? 104 : 208;                  // two valleys 带大 ridge
}
```

返回值 >20 是「伪 marching index」，目的：**把 5/10 拆成非鞍点分支再加一个「次序码」**。

- `104` ≡ "5 (=1+4) 走 4 然后留 1 等会儿再走"
- `713` ≡ "5 (=1+4) 走 7 然后留 13 等会儿再走"
- `208` ≡ "10 (=2+8) 走 2 然后留 8"
- `1114` ≡ "10 走 11 然后留 14"

这些代码在 `constants.js`：

```js
CHOOSESADDLE: {                     // 进入鞍点 cell 时，按上一段方向选哪一支先走
    104: [4, 1],
    208: [2, 8],
    713: [7, 13],
    1114: [11, 14]
},
SADDLEREMAINDER: {                  // 选完一支后剩下存的「下次来这个 cell 走」
    1: 4, 2: 8, 4: 1, 7: 13, 8: 2, 11: 14, 13: 7, 14: 11
}
```

「因子」编码格式：`xx * 100 + (left|right)`，例如 `713 = 7×100 + 13`。

鞍点决策保证了 **同一 cell 的两条等值线不会在内部相交** —— 这是后面 `fixSelfIntersections` 不必处理 marching 自身的根因。

### 2.3 交叉点的线性插值 (`pathfinding.js:314-373`，`getInterpPx`)

```js
function getInterpPx(pi, loc, step) {
    var locx = loc[0] + Math.max(step[0], 0);
    var locy = loc[1] + Math.max(step[1], 0);
    var zxy  = pi.z[locy][locx];

    if (step[1]) {                                  // 水平边
        var dx = (pi.level - zxy) / (pi.z[locy][locx+1] - zxy);
        if (!isFinite(dx)) dx = 0.5;

        var dataX = (dx !== 0 && dx !== 1) ?
                      (1 - dx) * x[locx] + dx * x[locx+1]  :  // 非整点 → 线性插值
                    (dx === 1) ? x[locx+1] : x[locx];
        return [dataX, y[locy], locx + dx, locy];
    } else {                                        // 竖直边，对称
        ...
        return [x[locx], dataY, locx, locy + dy];
    }
}
```

**关键点：**

- 等值线下的交叉点参数 `dx` 或 `dy` 是 **z 值在 cell 边两端的线性比例**（不是弧长）。
- 横向穿越 → 返回 `[dataX, y[locy], locx + dx, locy]`：实际输出坐标取 **数据坐标**，但同时把「网格索引空间插值后的位置」 `(locx+dx, locy)` 作为后 2 位带在返回里 —— 这就是 `pathfinding.js` 里 `ptDist(pk, pt)` 用的是 `pt[2]/pt[3]`，因为相邻 grid 距离在索引空间是均匀的，更稳定。
- 非均匀网格（`x` 数组不是 `0,1,2,3` 的等差）因此被正确处理：`locx` 是整数索引，`dataX` 才是真正想要的坐标。

**不变性：** 交叉点的输出永远落在 cell 的边上（不进 cell 内部），只要是 marching squares，所有点都在网格边上。

### 2.4 walking 表 (`constants.js:17-22` 的 `NEWDELTA`)

```js
NEWDELTA: [
    null,     [-1, 0], [0, -1], [-1, 0],
    [1, 0],    null,    [0, -1], [-1, 0],
    [0, 1],    [0, 1],  null,    [0, 1],
    [1, 0],    [1, 0],  [0, -1]
]
```

按 `mi` 查「下一步往哪里走」。注意 5、10 在表中是 `null` —— 因为进入鞍点 cell 时被 `CHOOSESADDLE` 选了非鞍的子 index 替换（见 2.2 处的 `mi > 20` 分支：`pathfinding.js:83-88`）。

---

## 3. 路径组装 makePath

### 3.1 串线的过程 (`pathfinding.js:68-117`)

```js
function makePath(pi, loc, edgeflag, xtol, ytol) {
    var locStr = loc.join(',');
    var mi = pi.crossings[locStr];
    var marchStep = getStartStep(mi, edgeflag, loc);
    var pts = [getInterpPx(pi, loc, [-marchStep[0], -marchStep[1]])];  // 反向半步找入口点

    for (cnt = 0; cnt < 10000; cnt++) {
        if (mi > 20) {
            mi = CHOOSESADDLE[mi][(marchStep[0]||marchStep[1]) < 0 ? 0 : 1];
            pi.crossings[locStr] = SADDLEREMAINDER[mi];  // 把另一支留下次再来
        } else {
            delete pi.crossings[locStr];
        }

        marchStep = NEWDELTA[mi];
        pts.push(getInterpPx(pi, loc, marchStep));    // 当前方向半步落在出口上
        loc[0] += marchStep[0];
        loc[1] += marchStep[1];
        locStr = loc.join(',');

        // 去重相邻同坐标点
        if (equalPts(last2 pts, xtol, ytol)) pts.pop();

        var atEdge = (marchStep[0] && (loc[0] < 0 || loc[0] > n-2)) ||
                     (marchStep[1] && (loc[1] < 0 || loc[1] > m-2));

        var closedLoop = loc 与起点完全一致 && 步方向一致;
        if (closedLoop || (edgeflag && atEdge)) break;
        mi = pi.crossings[locStr];
    }
}
```

**洞察：**

1. `getInterpPx(pi, loc, [-marchStep])` 比 `loc` 倒退半步，找到 **进入 cell 的那条边上的交叉点**。再 `marchStep = NEWDELTA[mi]` 后取 `getInterpPx(pi, loc, marchStep)` 找到 **离开 cell 的那条边上的交叉点**。
2. 两个交叉点都在 cell 边上，意味着等值线在 cell 内部是按直连两点的折线段表示的。
3. 因为 marching squares 的几何保证 —— **等值线在 cell 内部不会自交、永远是线段** —— 所以整条 polyline 是 cell 的并集，**折线本身就唯一确定了等值线的拓扑形状**；后续「平滑」只是改变视觉表达，不改变拓扑。

---

## 4. simplifyPath：用 smoothing 算距离阈值

很多人误以为 `smoothing` 在这里就会把折线「揉圆」，**不是的**。`smoothing` 在这里只是个 **距离阈值因子**，目的是把 marching squares 产生的过近邻点合并，减少折线的碎点。

### 4.1 距离阈值怎么来 (`pathfinding.js:147-167`)

```js
var totaldist = 0;
var alldists = [];
for (cnt = 1; cnt < pts.length; cnt++) {
    thisdist = ptDist(pts[cnt], pts[cnt-1]);   // 在 grid 索引空间计算欧氏距离
    totaldist += thisdist;
    alldists.push(thisdist);
}
if (alldists.length === 0) return pts;

var distThresholdFactor = 0.2 * smoothing;   // smoothing 一般 0..1
var distThreshold = totaldist / alldists.length * distThresholdFactor;
```

- `smoothing = 0` → `distThresholdFactor = 0` → 阈值=0 → **不合并任何点**（Pure marching 输出原样保留）
- `smoothing = 1` → 阈值 = 平均段长度 × 0.2 → **能把 1/5 平均段长度以下的邻点合并**

距离 `ptDist` 用的是 **`pts[k][2]` 和 `pts[k][3]`**（也就是上面 2.3 提到的「索引空间坐标」），不是数据坐标，所以无论原始 grid 的 x/y 单位是纳米还是经度，阈值都不受影响。

### 4.2 近段折叠算法（一份「局部段平均」的窗口）

```js
for (cnt = pts.length - 2; cnt >= cropstart; cnt--) {
    distgroup = alldists[cnt];
    if (distgroup < distThreshold) {
        // 往前找一段连续的「短段组」，直到总长度超过阈值
        cnt3 = 0;
        for (cnt2 = cnt - 1; cnt2 >= cropstart; cnt2--) {
            if (distgroup + alldists[cnt2] < distThreshold) distgroup += alldists[cnt2];
            else break;
        }
        // 闭合情况：再尝试把折回起点的开头几段也算进来
        if (closedpath && cnt === pts.length - 2) {
            for (cnt3 = 0; cnt3 < cnt2; cnt3++) {
                if (distgroup + alldists[cnt3] < distThreshold) distgroup += alldists[cnt3];
                else break;
            }
        }
        // 计算保留点：
        //   奇数点 → 取中间点
        //   偶数点 → 取中间两点的算术平均
        if (ptcnt % 2) newpt = getpt(ptavg);
        else            newpt = [ 平均前两点的x, 平均前两点的y, getpt(ptavg)[2], getpt(ptavg)[3] ];

        pts.splice(cnt2 + 1, cnt - cnt2 + 1, newpt);   // 把 [cnt2+1 .. cnt] 这一坨替换成单个 newpt
        cnt = cnt2 + 1;
        if (cnt3) cropstart = cnt3;
        if (closedpath) { ... 让首末保持同步 ... }
    }
}
pts.splice(0, cropstart);
```

读后要点：

- 这是 **从末尾向起点的反向遍历**，目的是在修改 `pts` 数组时不会让循环索引错位。
- `alldists` 算完之后 **没有随 splice 同步更新** —— 一个已知的「陈旧但暂时无害」问题（见审查报告 #18）。无害的原因是合并完一段后直接跳到 `cnt2+1` 进入新区域，**不再读已陈旧位置的 `alldists`**。

### 4.3 equalPts 阈值的兜底 (`pathfinding.js:103`)

```js
if (equalPts(pts[pts.length - 1], pts[pts.length - 2], xtol, ytol)) pts.pop();
```

两个相邻 marching 边可能落在同一像素上（cell 在数据范围被压缩到一点的时候），去重以避免后面 `smoothopen/smoothclosed` 在退化段上算 NaN 切线。`xtol`、`ytol` 由 `compute.js:111-112` 设为 `Math.max(1e-10, range × 0.001)` —— 意思是 **0.1% 数据范围的最小相对容差**，目的是让经度数值也不会因为浮点误差把两个本应相同的点判成不一样。

### 4.4 边路径的合并 mergeEdgePath

闭合 contour 段放到 `pi.paths`，开口段（边缘端到边缘端）放到 `pi.edgepaths`。但同一个开口等值线可能被 marching squares 拆成两半（比如同一条等值线在左边界和右边界各有一个入口），`mergeEdgePath` 就负责按「端点是否一致」把它们重新粘起来：

- 末尾与下一条起点 coincide → 直接拼，然后看 `pts[0]` 能否接到现有链末尾 → 双合并 → 如果接到的是自己 → 升级成闭合多边形放进 `paths`。
- 非闭合 edgepath 保持独立 edgepath。

合并以后渲染时把它当作一条整体路径用 Catmull-Rom 平滑，看起来就连续了。

---

## 5. smooth.js：真正画出曲线的地方

这是 contour「平滑」的核心。文件实际上是把 polyline 转成 SVG path 的命令，背后是 **centripetal Catmull-Rom × Bezier 转换** 的公式化简版。

### 5.1 Catmull-Rom 切线公式 (`smooth.js:69-90`)

给定三个相邻折线点 `prevpt / thispt / nextpt`，要算出经过 `thispt` 在该处的切线方向，并准备两条 **控制点**（一条供上一段曲线的尾，一条供下一段曲线的头）。`smoothness` 决定切线长度（也就是控制点距 `thispt` 的距离）。

```js
var d1x = prevpt[0] - thispt[0];
var d1y = prevpt[1] - thispt[1];
var d2x = nextpt[0] - thispt[0];
var d2y = nextpt[1] - thispt[1];

// centripetal Catmull-Rom：用 α=0.5（centripetal）
var d1a = Math.pow(d1x*d1x + d1y*d1y, 0.5/2);   // |prev - this|^0.5
var d2a = Math.pow(d2x*d2x + d2y*d2y, 0.5/2);   // |next - this|^0.5

// 经过 this 的切线（控制点位移）按「前长 × 后向 - 后长 × 前向」做加权
var numx = (d2a * d2a * d1x - d1a * d1a * d2x) * smoothness;
var numy = (d2a * d2a * d1y - d1a * d1a * d2y) * smoothness;

var denom1 = 3 * d2a * (d1a + d2a);
var denom2 = 3 * d1a * (d1a + d2a);

return [
    [ thispt[0] + (denom1 && numx / denom1),         // 进入本点的 C1 控制点
      thispt[1] + (denom1 && numy / denom1) ],
    [ thispt[0] - (denom2 && numx / denom2),         // 离开本点的 C2 控制点
      thispt[1] - (denom2 && numy / denom2) ]
];
```

#### 数学含义

Catmull-Rom 簇把曲线泛化成：`T(t) = Σ B_k(t) P_k` 时切线权重带 α 指数。常见 α 取值三种：

| α | 名称 | 特征 |
|---|---|---|
| 0 | Uniform | 切线只跟相邻段平均方向，长段会「突然 acceleration」，曲线易尖 |
| 0.5 | **Centripetal（这里用 0.5）** | 依据「前后段长对切线影响减半」加权，**最小化 cusp 和自我相交** |
| 1 | Chordal | 与段长成正比，弱化短段作用 |

`Math.pow(len2, 0.5/2)` 等价于 `|len|^0.5`，`0.5/2` 是因为输入已经平方了，先 `d1x*d1x + d1y*d1y`（= `|len|²`），再开 0.25 次幂 = `(|len|²)^0.25 = |len|^0.5` —— **Centripetal 形式**。

把 `numx` 两项展开看 —— 切线方向是「前后向加权差」：

```
ctrl_offset ≈ smoothness × ( d2a² · d1 - d1a² · d2 ) / (3·(d1a+d2a)·d2a)
```

**直观解释：** 切线「偏向更短的那段距离」 —— 前段比后段短时，`d1a` 小、`d2a` 大 → `d2a²·d1` 项主导 → 切线偏向 `d1`（前段）快走完的位置。逆向（前段长后段短）对称。这就是 Centripetal 风格在急拐弯处 **不会一下子甩过头** 的根因，避免出现 cusp。

#### Bezier 系数

`denom1 = 3 d2a (d1a + d2a)`、`denom2 = 3 d1a (d1a + d2a)` 来自 Catmull-Rom 到 cubic Bezier 的标准变换（在均匀样条里其实就是 `1/6`，权重改为 `(α-related 距离的二次项) / 3 (α-related 距离和)`）。这两项乘 1/3 让最终顶点平滑经过 P_i（De Casteljau 等于 Catmull-Rom 的条件）：cubic Bezier `P₀, C₁, C₂, P₃` 过 P₀ 与 P₃ ⟺ `{C₁ = P₀ + (P₃-P₁)/6·smoothness, C₂ = P₃ − (P₄-P₂)/6·smoothness}`；centripetal 把分母 6 换成 `3 (d_a)(sum)` —— 长度归一化后的角点速度。

### 5.2 开口折线 smoothopen

```js
function smoothopen(pts, S) {
    if (pts.length < 3)  return 'M' + pts.join('L');  // 只两点 → 直线段
    var path = 'M' + pts[0];
    var tangents = [];
    for (i = 1; i < pts.length - 1; i++) {            // 首尾不动，剩下每个内部点算切线
        tangents.push(makeTangent(pts[i-1], pts[i], pts[i+1], S));
    }
    path += 'Q' + tangents[0][0] + ' ' + pts[1];       // 首段用二次 Bezier
    for (i = 2; i < pts.length - 1; i++) {
        path += 'C' + tangents[i-2][1] + ' ' + tangents[i-1][0] + ' ' + pts[i];  // 中间段三次 Bezier
    }
    path += 'Q' + tangents[last][1] + ' ' + pts[end]; // 末段也用二次 Bezier
    return path;
}
```

#### 关键细节

1. **端点处切线方向是在 `pts[1]` 内**，而不是 `pts[0]`：首段是二次 Bezier 直接到 `pts[1]`，所以「自然切线 = pts[0] → pts[1]」。「控制点在 `tangents[0][0]`」模仿 Catmull-Rom 进入第一段的曲率，让曲线从起点起步时不会「突然往一边偏」。
2. 中间段：`P_i ← C 上的 t=0 控制点 = tangents[i-1][1]`（前一段出去）和 `C_{i+1} 上的 t=1 控制点 = tangents[i][0]`（下一段进入），再下到 `pts[i]` —— **保证 C¹ 连续**（切线连续）。
3. 第 j 段 cubic Bezier 的两控制点是 `tangents[j-1][1]` 和 `tangents[j][0]`，首尾分别是相邻端点和 `pts[j+1]`。

### 5.3 闭合折线 smoothclosed

```js
var pLast = pts.length - 1;
var tangents = [makeTangent(pts[pLast], pts[0], pts[1], S)];     // 闭合：首端用「前一个」=末点
for (i = 1; i < pLast; i++) {
    tangents.push(makeTangent(pts[i-1], pts[i], pts[i+1], S));
}
tangents.push(makeTangent(pts[pLast - 1], pts[pLast], pts[0], S));   // 末端用「下一个」=起点

for (i = 1; i <= pLast; i++) {
    path += 'C' + tangents[i-1][1] + ' ' + tangents[i][0] + ' ' + pts[i];
}
path += 'C' + tangents[pLast][1] + ' ' + tangents[0][0] + ' ' + pts[0] + 'Z';
```

闭合情况下，所有段都用 cubic Bezier；首尾点当作周期相邻的，`tangents[0]` 知道「前面是 `pts[pLast]`、后面是 `pts[1]`」，因此切线方向跟闭合曲线一致。最后补一个 `Z` 收口，闭合曲线起始点是 C¹ 连续。

### 5.4 S 从 0 到 1 的视觉差异

- `S=0` ⇒ `numx/numy=0` ⇒ 控制点 = vertex ⇒ cubic Bezier **退化**为线段 ⇒ polyline 原样
- `S=0.3` ⇒ 控制点偏离 vertex 一小段 ⇒ 大体 polyline 但在拐角处微微倒角
- `S=1` ⇒ 控制点大幅偏离 ⇒ 强烈圆滑

**真正的「等值线圆嘟嘟」只在 `smooth.js` 这一步根据 `S` 值形状改变**；`simplifyPath` 在前一步根据 `S` 决定要不要预先合并碎点。

### 5.5 round 函数（精度控制）

```js
function round(v) { return Math.round(v * 100) / 100; }
```

控制点坐标的精度严格到 2 位小数 —— 目的：减小 SVG path 字符串长度并让相邻曲线 **输出字面一致**（用于 hashing / diff），同时也避免浮点累计差异在不同浏览器上产生像素抖动。

---

## 6. close_boundaries.js：填充与边界的前置判断

这是「等值线边界处理」的另一半 —— 决定 **填色模式下哪一层要铺满整张画布**。

### 6.1 为什么需要 prefixBoundary

**问题**：marching squares 在 cell 内每条等值线输出一条 polyline：

- 闭合等值线 → 进 `paths`，画一个圈
- 开口等值线 → 进 `edgepaths`，从数据边界一头进来一头出去

渲染「填色」`coloring: 'fill'` 时对相邻两条等值线之间的区域填色。**但有种情况：**

- **低 c₀ 等高线比所有数据边界点都低** ⇒ marching squares 找不出任何 crossings cell（因为整个边界都高于这个 level）⇒ `edgepaths` 是空、`paths` 也是空 ⇒ 默认全部不填。
- **高 cₖ 等高线比所有边界点都高** ⇒ 同上，最顶层那一块面积不被渲出来。

`prefixBoundary=true` 就在没 edgepaths 的情况下显式塞一个「数据范围矩形 perimeter」作为这段 polyline 的开头，告诉渲染器「沿着数据矩形周长走一圈再接下一段」。

### 6.2 判据三段式 (`close_boundaries.js:60-71`)

```js
for (i = 0; i < pathinfo.length; i++) {
    var pi = pathinfo[i];
    var allDataBelow = boundaryMax < pi.level;

    pi.prefixBoundary = !pi.edgepaths.length &&                    // 没有开口等值线
        (boundaryMin > pi.level ||                                 // 整个边界都比 level 高
         (allDataBelow && i === 0) ||                              // 所有边界都比 level 低且是最低层
         pi.starts.length && boundaryMin === pi.level);            // 边界最小值正好等于 level 且有 starts
}
```

#### 三个判据含义

| Condition | 几何含义 | 为什么 prefixBoundary |
|---|---|---|
| `boundaryMin > pi.level` | 边界点全在等值线上方 | 等值线绕在 grid 内部某处闭合，没 edgepaths ⇒ 该层无 polyline 输出；为了让该「圈外」区域也被涂，需要 perimeter 填满 |
| `allDataBelow && i === 0` | 所有边界点都低于 level 且这是最低层 | 最低 level 在 i=0：该层数据全在 boundary 之下，等值线在数据外，画布下方应填最低色 |
| `boundaryMin == level && starts` | 边界最小 z 正好等于 level | 起点就在边界上 → edgepaths 退化 → 需要「fill-all-but-perimeter」视觉 |

`boundaryMin`/`boundaryMax` 是 **grid 边缘四个边上非空点的极值**，不是全 z 极值 —— 这是专门为这个判定设计的语义：

```js
for (i = 0; i < nb; i++) {                       // 左/右两列
    if (z[i][0]    !== null) { 关进 boundaryMin/Max }
    if (z[i][na-1] !== null) { 关进 boundaryMin/Max }
}
for (i = 1; i < na - 1; i++) {                   // 顶/底两行（去角避免重复）
    if (z[0][i]    !== null) { ... }
    if (z[nb-1][i] !== null) { ... }
}
```

### 6.3 边角落空回退 (`close_boundaries.js:52-58`)

```js
if (boundaryMin === Infinity) {
    boundaryMin = Math.min(z[0][0] || Infinity, z[0][1] || Infinity);
}
if (boundaryMax === -Infinity) {
    boundaryMax = Math.max(z[0][0] || -Infinity, z[0][1] || -Infinity);
}
```

如果整周界都是 null（极端情况下），退化使用 `z[0][0]`, `z[0][1]`，这是个安全网。在上游 `interp2d` 之后 z 已经全有有限值。

### 6.4 constraint mode

约束模式（`'>'`, `'<'`, `'[]'`, `']['`，见 `close_boundaries.js:72-127`）跟 fill 模式语义类似但只是压在单边界一侧定义「满足条件就整面积」，与 contour 平滑问题不直接相关。

### 6.5 渲染时怎么用 prefixBoundary

`renderers/canvas/paths.js` 中的 `drawFilledPaths` 会优先在 `pi.prefixBoundary === true` 时 **先** 把数据范围矩形周长（4 个角 → 5 个点的 polyline）画出来，再衔接上该 level 的等值线 paths，这样 fill 时即便等值线内部没有边界也能完整覆盖。

---

## 7. geojson.js 的离散 Catmull-Rom

SVG 的 cubic Bezier 浏览器原生能渲染，但 GeoJSON 只支持 **离散坐标列表**。所以 `geojson.js:21-92` 提供了 **Catmull-Rom 离散化** 版本：

```js
function smoothClosedCoords(pts, smoothness) {
    ...
    for (var i = 0; i < n; i++) {
        var nextI = (i + 1) % n;
        var steps = Math.max(1, Math.round(smoothness * 4));   // 每段采样 1..4 子点
        for (var s = 0; s < steps; s++) {
            var t = s / steps;
            var t1 = tangents[i][1];
            var t2 = tangents[nextI][0];
            // 标准 cubic Bezier 公式：
            // B(t) = (1-t)³ P₀ + 3(1-t)²t C₁ + 3(1-t)t² C₂ + t³ P₃
            var x = (1-t)³ · pts[i][0]
                  + 3(1-t)²·t·t1[0]
                  + 3(1-t)·t² · t2[0]
                  + t³ · pts[nextI][0];
            ...
            result.push([round, round]);
        }
    }
}
```

**关键细节：**

1. `steps` 由 `Math.round(smoothness * 4)` → smoothness=0..1 → 1..4 个子点；**控制粒度（小则曲线粗糙、大则生长为 Bezier 实际点数）**。
2. 这和平滑路径数据 **不一样的语义**：SVG 的 Bezier 是格式上的省略（控制点能压缩数据，渲染时计算），但 GeoJSON 只支持点，所以 GeoJSON 路径永远更长（可达 4 倍）—— 需要权衡导出大小。
3. `round(x * 100) / 100`：把浮点精度限到 2 位小数，避免 GeoJSON 里出现 `12.000000000000002` 类似的提交。

---

## 8. 不变量与 gotcha 总结

### 8.1 marching 的折线节段形状

**不变量**：折线 vertex 永远落在 cell 的边上 —— cell 内部不可能有 vertex。这意味着仅看 polyline，整条 curve 在 cell 内是一直线段。

**后果**：所有平滑（smooth.js 或 geojson.js）的算弧长 / 算切线 / 算距离 都是基于 polyline vertex 而不是 cell 内部点，是 **近似** —— smoothness 越大、cell 越大，近似误差越大。如果 grid 极粗 + smoothing=1，会出现曲线「穿出 cell」而 marching 折线原本不会跨过的物理边界 —— 这是 marchingsquares × bezier 的固有限制，目前 renderer 里的 clip 用 drawArea 裁剪整张 canvas，不是按 cell 裁。

### 8.2 闭合检测是容差判断 (`position.js`, `density.js`)

```js
isClosed = closureDist < 1;                    // labels/position.js:155
                                                 // density.js 阈值默认也是 1
```

**这是 1 单位的容差**。如果 data 空间是 0..1 或经纬度（precision 在 1e-5 几级），阈值 (1) 会把所有开口折线都判成 closed —— 这是 label placement 的已知问题。目前渲染器调用时数据空间是 0..N（grid index），阈值 1 大致类似 1-cell 一致，可接受。

### 8.3 Catmull-Rom 在相邻段长悬殊时的退化

`smooth.js:78-79` 里分母 `3 d2a (d1a+d2a)`，若 `d2a=0`（即 nextpt==thispt 这种重复 vertex），分母=0 → 切线控制点 = vertex（被 `denom1 && numx/denom1` 兜住，因为 `0 && ...` 取 0）。所以即便 simplifyPath 没杀干净 duplicate，也不会 NaN，但会让这点的「看起来等价」。

### 8.4 prefixBoundary 与 polygon 方向

GeoJSON 的 `buildLevelBoundary` 走「顺时针 perimeter」（`perimeterParam` t ∈ [0, 4]）—— 永远是 CW。GeoJSON Cesium 需要 outer-ring CCW inner CW —— `sanitizeRingForCesium` 自动逆序处理。

---

## 9. 工程取舍：为什么不一步到位

理论上，可以用 RBF/Gaussian kernel smoothing 在 grid 上对 `z` 本身做 anti-alias，再提等值线。但 Plotly 选了现在这条 4 段链路的理由：

| 阶段 | 抽象层 | 输出 | 可逆？ | 副作用 |
|---|---|---|---|---|
| 1 grid anti-alias | grid → grid | 失真数据、丢失极值 | **不可逆** | 噪声/尖端被汇集或走向；可能升高人类不会看到的新量 |
| 2 marching squares | grid → polyline | 静态、可识别的顶点 | **形式不可逆** | vertex 与 cell 边一一映射 |
| 3 simplifyPath | polyline → polyline | 点数减少 | **不可逆** | distance threshold 决定折线 offset |
| 4 Bezier 平滑 | polyline → SVG path | 视觉变体 | **可逆**（同一折线可重跑 smooth） | 只影响视觉不影响拓扑 |

**关键洞察**：「折线 + 平滑」分离设计，smoothing 不是 grid 预处理（不可逆）的一部分，而是 **display 信息** —— 用户可以改 smoothing 重新画风，不必重新 `computeContours`。

`compute.js:94` 里：

```js
smoothing: options.smoothing || 0
```

`smoothing` 串到 `pathinfo` 是为了让 `simplifyPath` 也用这个值。但 `smooth.js` 的调用方拿到 smoothing 是从 `style.smoothing` 来的（render config），所以 smoothing **可以独立重新调用**：

```js
style.smoothing = 0.7
drawPaths.drawStrokePaths(ctx, contourResult, style);   // 比 0.3 更圆，不重新 computeContours
```

**这是最重要的工程取舍** —— 平滑渲染与数据计算解耦。在大 dataset 上调 plot smoothing 时不会等几乎不会慢。

`computeContours` 同时把 smoothing 影响到 simplifyPath，是因为 simplifyPath 是 **preprocess 不可逆** —— 不可以「之后」从已合并的 polyline 完全恢复原貌。所以 smoothing 在这里直接调阈值。但 `smoothing=0` → threshold=0 → simplifyPath 不合并任何点 → 路径就是 marching 原样。

**两层 smoothing 的分工：**

| 层 | 输入 | 作用 | 默认 0 时 |
|---|---|---|---|
| `compute.smoothing` | `options.smoothing` | 控制 simplifyPath 距离阈值，决定要不要合并短段 | 不合并任何点，marching 原样保留 |
| `render.smoothing` | `style.smoothing` | 控制 Catmull-Rom 控制点偏离 vertex 的距离 | cubic Bezier 退化为线段，polyline 不被圆滑 |

两者独立可调，但共享同一个数值时表现为「合并碎点 + 视觉圆滑」的协同效果。

---

## 10. 整体小结

`contour-core` 把「等值线平滑」分解成三层不背锅的责任：

1. **marching squares** 把 grid 切折线，把相邻 cell 的连续性归纳为「每个 cell 只能发生两 isotropic 边的穿越」；交叉点的坐标是 cell 边上的线性插值（不是弧长）。这是 **拓扑确定性** 层。

2. **simplifyPath** 用 `smoothing` 算了一个阈值合并短段，**轻度洗噪声**但不改变 curve 拓扑；接收 `smoothing` 不是为了 visual smooth，而是为了减少后续 bezier 的过度碎点。这是 **预处理层**。

3. **smooth.js / geojson.js 的 Catmull-Rom × Bezier** 是「视觉封装」层，真正生成曲线，其中 Catmull-Rom α=0.5（centripetal）最小化自我相交，smoothness × S 让用户控制圆润程度。这是 **渲染层**。

4. **close_boundaries.js prefixBoundary** 只控制「要不要把数据矩形周长补到 fill 路径前」—— 在没有 edgepaths 时让填色仍能完整覆盖画布。这是 **边界外延层**。

这套设计让 `computeContours`（贵的预处理）与 `render`（便宜的每帧重画）完全解耦：计算跑一次，渲染每帧跑；用户拉 smoothing 滑条不需要重新计算 contour。这就是 Plotly contour 在交互体验上流畅的工程根源。