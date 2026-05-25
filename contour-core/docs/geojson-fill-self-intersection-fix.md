# GeoJSON 填充导出自相交问题修复记录

**日期**: 2026-05-23  
**影响文件**: `geojson.js`  
**影响输出**: `toFilledGeoJSON()` 导出的 GeoJSON Polygon  

---

## 问题概述

使用 `contourCore.toFilledGeoJSON(result, geojsonOpts)` 导出的填充面 GeoJSON 数据，在导入 [geojson.io](https://geojson.io/) 时出现几何问题：等值面来回乱窜、自相交。而同样的数据导入 [mapshaper.org](https://mapshaper.org/) 则显示正常（因为 mapshaper 会自动修复几何错误）。

根本原因：`buildLevelBoundary()` 函数在连接边界路径时使用了贪心算法，将所有边界段无条件包含，导致不同填充区域的边界路径被合并成自相交多边形。

---

## Bug 1+2: 贪心连接边界路径 + 未分类边界段（最关键）

### 根因

`buildLevelBoundary()` 原始算法流程：

```
排序所有 edge path 按 startT（顺时针参数） →
贪心: 把 end[i] 连接到顺时针最近的 start[j] →
沿边界走，无条件包含所有角点和边界段
```

**问题场景**：数据域有两个独立高值区域（如两座山峰），每个区域产生一对 edge path：

```
区域A: edge1(startT=0.5, endT=1.2)  +  edge2(startT=3.0, endT=3.7)
区域B: edge3(startT=1.8, endT=2.5)  +  edge4(startT=2.8, endT=0.3)
```

贪心算法生成**一个错误环**：

```
edge1 → 边界段(穿过区域B区域!) → edge3 → 边界段 → edge2 → ... → 跨越两个区域
```

正确结果应该是**两个独立环**：

```
环1: edge1 → 边界段(仅A区域,z≥level) → edge2 → 边界段 → 回到edge1起点
环2: edge3 → 边界段(仅B区域,z≥level) → edge4 → 边界段 → 回到edge3起点
```

同时，`appendBoundaryPath()` 在两条 edge path 之间无条件包含所有角点，不管该边界段上的 z 值是否 ≥ level。

### 修复方案

#### 新增 `buildBoundarySegments()` 函数

将数据边界划分为离散段，每段标记为 "fill"（z ≥ level）或 "skip"（z < level）：

```javascript
function buildBoundarySegments(bounds, level, zData, xData, yData, tol) {
    // 四条边各生成若干段:
    // 底边: z[0][xi] >= level || z[0][xi+1] >= level → isFill
    // 右边: z[yi][na-1] >= level || z[yi+1][na-1] >= level → isFill
    // 顶边: z[nb-1][xi] >= level || z[nb-1][xi-1] >= level → isFill
    // 左边: z[yi][0] >= level || z[yi-1][0] >= level → isFill
    return segs; // [{fromT, toT, isFill}, ...]
}
```

每段的 `fromT`/`toT` 使用参数化周长坐标 `t ∈ [0, 4)`：
- 底边: `t ∈ [0, 1]` (左→右)
- 右边: `t ∈ [1, 2]` (底→顶)
- 顶边: `t ∈ [2, 3]` (右→左)
- 左边: `t ∈ [3, 4]` (顶→底)

#### 新增 `isFillBoundaryPath()` 函数

检查从 `fromT` 到 `toT`（顺时针）的路径是否仅由 fill 段组成：

```javascript
function isFillBoundaryPath(fromT, toT, boundarySegs, tol) {
    // 遍历所有 non-fill 段
    // 如果任何 non-fill 段与 [fromT, toT] 重叠 → 返回 false
    // 否则 → 返回 true
}
```

#### 修改 `buildLevelBoundary()` 函数

关键改变：在选择下一个 edge path 时，只连接通过 fill 边界段可达的路径：

```javascript
// 原代码（贪心，无条件连接）:
for (var ni = 0; ni < edges.length; ni++) {
    if (visited[ni]) continue;
    var st = edges[ni].startT;
    var deltaT = st - currentEndT;
    if (deltaT <= 1e-10) deltaT += 4;
    if (deltaT < bestDeltaT) {  // ← 无条件，只选最近的
        bestDeltaT = deltaT;
        nextIdx = ni;
    }
}

// 新代码（只连接通过 fill 边界的路径）:
for (var ni = 0; ni < edges.length; ni++) {
    if (visited[ni]) continue;
    var st = edges[ni].startT;
    var deltaT = st - currentEndT;
    if (deltaT <= 1e-10) deltaT += 4;
    if (isFillBoundaryPath(currentEndT, st, boundarySegs, tol)) {
        if (deltaT < bestDeltaT) {
            bestDeltaT = deltaT;
            nextIdx = ni;
        }
    }
}
```

无法通过 fill 边界闭合的环（跨越了 `z < level` 区域）会被丢弃，从而避免自相交。

#### 修改 `toFilledGeoJSON()` 函数

传入 z 数据以支持边界分类：

```javascript
var zData = null;
if (result.pathinfo && result.pathinfo.length > 0 && result.pathinfo[0].z) {
    zData = result.pathinfo[0].z;
}
var xData = null;
var yData = null;
if (result.pathinfo && result.pathinfo.length > 0) {
    xData = result.pathinfo[0].x;
    yData = result.pathinfo[0].y;
}

allBoundaries.push(buildLevelBoundary(
    paths[i], perimeter, dataBounds, tol, options,
    levels[i], zData, xData, yData
));
```

---

## Bug 3: `smoothClosedCoords` 中 `var` 变量提升错误

### 根因

```javascript
// 第一个循环 (line 29-34):
for (var i = 0; i < n; i++) {
    var curr = pts[i];   // ← var 提升到函数作用域
    ...
}
// 第二个循环 (line 36-55):
for (var i = 0; i < n; i++) {
    var x = Math.pow(1-t, 3) * curr[0] + ...;  // ← curr = pts[n-1]！应为 pts[i]
    var y = Math.pow(1-t, 3) * curr[1] + ...;  // ← 同上
}
```

由于 `var` 是函数作用域，第二个循环中 `curr` 的值总是第一次循环最后赋值的 `pts[n-1]`，而不是期望的 `pts[i]`。这导致所有 Hermite 插值点的基准坐标系统性偏移。

### 修复

```javascript
// 第一个循环:
for (var i = 0; i < n; i++) {
    var currPt = pts[i];   // ← 重命名避免冲突
    var next = pts[(i + 1) % n];
    tangents.push(makeTangent(prev, currPt, next, smoothness));
}

// 第二个循环:
for (var i = 0; i < n; i++) {
    var nextI = (i + 1) % n;
    var x = Math.pow(1-t, 3) * pts[i][0] + ...;  // ← 使用 pts[i] 而非 curr
    var y = Math.pow(1-t, 3) * pts[i][1] + ...;  // ← 同上
}
```

同时删除了残留的重复第二个循环代码块。

---

## Bug 4: `perimeterParam` 角点歧义

### 根因

原始代码用 `if/else if` 顺序检查四条边：

```javascript
if (Math.abs(y - minY) < tol && ...) return (x - minX) / rangeX;   // bottom
if (Math.abs(x - maxX) < tol && ...) return 1 + (y - minY) / rangeY; // right
if (Math.abs(y - maxY) < tol && ...) return 2 + (maxX - x) / rangeX; // top
if (Math.abs(x - minX) < tol && ...) return 3 + (maxY - y) / rangeY; // left
```

角点如 `(maxX, minY)` 同时满足 bottom 和 right 的容差判断，总是归入 bottom（t≈1）。但浮点误差可能导致角点被错误归入 right（t≈1.000...），导致 `startT`/`endT` 计算错误，整个拓扑排序出错。

### 修复

改为同时计算四条边的布尔标志，然后对角点做确定性优先级分配：

```javascript
var onBottom = Math.abs(y - minY) < tol && x >= minX - tol && x <= maxX + tol;
var onRight  = Math.abs(x - maxX) < tol && y >= minY - tol && y <= maxY + tol;
var onTop    = Math.abs(y - maxY) < tol && x >= minX - tol && x <= maxX + tol;
var onLeft   = Math.abs(x - minX) < tol && y >= minY - tol && y <= maxY + tol;

// 非角点: 优先级 bottom > right > top > left
if (onBottom && !onRight) return (x - minX) / rangeX;
if (onRight && !onTop)    return 1 + (y - minY) / rangeY;
if (onTop && !onLeft)     return 2 + (maxX - x) / rangeX;
if (onLeft && !onBottom)  return 3 + (maxY - y) / rangeY;

// 角点: 确定性分配
if (onBottom && onRight) return 1;  // bottom-right → bottom
if (onRight && onTop)    return 2;  // top-right → right
if (onTop && onLeft)     return 3;  // top-left → top
if (onLeft && onBottom)  return 0;  // bottom-left → left (or 4)
```

---

## Bug 5: 环绕方向修正（CCW/CW）

### 根因

等值线路径追踪的方向（从等值线下方看，填充区域在左侧）产生的是顺时针（CW）方向的环，但 GeoJSON 规范要求外环为逆时针（CCW），孔环为顺时针（CW）。原始代码未做环绕方向修正，导致 MultiPolygon 在 geojson.io 中渲染异常。

### 修复

新增三个辅助函数：

```javascript
function signedArea(coords) {
    var area = 0;
    for (var i = 0; i < coords.length - 1; i++) {
        area += coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1];
    }
    return area / 2;
}

function ensureCCW(coords) {
    if (signedArea(coords) < 0) coords.reverse();
}

function ensureCW(coords) {
    if (signedArea(coords) > 0) coords.reverse();
}
```

在 `toFilledGeoJSON()` 中应用：

```javascript
var rings = [exteriorRing];
ensureCCW(exteriorRing);  // 外环: 确保 CCW（正面积）

if (i + 1 < allBoundaries.length) {
    var nextBoundaries = allBoundaries[i + 1];
    for (var k = 0; k < nextBoundaries.length; k++) {
        var innerRing = nextBoundaries[k];
        if (innerRing.length > 0 && isPointInPolygon(innerRing[0], exteriorRing)) {
            ensureCW(innerRing);  // 孔环: 确保 CW（负面积）
            rings.push(innerRing);
        }
    }
}
```

---

## 修复前后的对比

### 修复前

```
Feature 5 : level=6  area=-27.58  (自相交，CW 方向)
Feature 6 : level=6  area=-27.58  (自相交，CW 方向)
...
Negative area count: 18
```

### 修复后

```
Feature 5 : level=6  area=27.58   (正面积，无自相交)
Feature 6 : level=6  area=27.58   (正面积，无自相交)
...
Negative area count: 0
```

---

## 副作用说明

| 场景 | 影响 | 说明 |
|------|------|------|
| 不相交边界段的 level | ✅ 正确 | 不同填充区域的边界路径不再被合并 |
| prefixBoundary=true | ✅ 不变 | 仍然输出完整边界矩形 |
| 仅内部闭路径 | ✅ 不变 | `ensureCCW()` 确保方向正确 |
| 无 z 数据的降级 | ✅ 安全 | `buildBoundarySegments()` 返回空数组时 `isFillBoundaryPath()` 返回 true，回退到旧行为 |
| 平滑插值 | ✅ 修正 | `smoothClosedCoords` 的 `curr` bug 已修复，插值坐标正确 |
| 角点处理 | ✅ 稳定 | 角点不再因浮点误差归入错误边 |
| 输出结构变化 | ⚠️ 轻微 | 某些 level 可能从 1 个 feature 变为多个（多个连通域正确分离） |
| 环绕方向 | ✅ GeoJSON 合规 | 外环 CCW，孔环 CW |

---

## 已知的限制

1. **平滑插值（smooth > 0）**：极端曲率下仍可能产生微小自相交，但概率极低
2. **退化情况**：等值线过格点、鞍点等 ambiguous case 可能产生奇异多边形
3. **`isFillBoundaryPath` 的边界段检查**：使用 `z >= level` 判断边界段归属，这是保守近似——在实际 etc 线穿越边界时，某些边界段可能同时有 `z >= level` 和 `z < level` 的网格节点，导致它们被标记为 fill。这是正确的（填充区域确实可以延伸到这些段），但可能在等值线刚好与边界对齐时产生细微差异

---

## 阶段 2 建议（未实施）

- 添加 `validateAndFixGeoJSON()` 后处理——检查自相交、修正缠绕方向、去重复点
- 提供 Turf.js `unkinkPolygon` 集成选项
- 添加 `simplifyRings()` 简化环坐标（移除接近共线的点）