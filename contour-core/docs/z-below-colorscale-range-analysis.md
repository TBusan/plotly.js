# z 值全部低于 colorScale 最小阈值时的渲染行为分析

## 场景

- z 值范围：全部 < 100（例如 0 ~ 90）
- valueColorMap：最小阈值从 200 开始，例如 `[[200, '#0000ff'], [300, '#00ff00'], [400, '#ff0000']]`

## 结论

**整个画布会被填充为 valueColorMap 第一个颜色（`#0000ff`），没有任何等值线，视觉上是一块纯色。**

## 逐步分析

### 第一步：levels 计算（levels.js → setContours）

当 `valueColorMap` 存在时，`setContours` 走最高优先级分支，直接从 valueColorMap 中提取阈值作为 levels：

```javascript
levels = options.valueColorMap.map(function(item) {
    return item[0];
}).sort(function(a, b) { return a - b; });
```

结果：`levels = [200, 300, 400]`

注意：**这里完全不看 z 值的实际范围**。不管 z 是 0~90 还是 0~9000，只要传了 valueColorMap，levels 就是 `[200, 300, 400]`。

### 第二步：marching squares（marchingsquares.js → makeCrossings）

对每个网格单元，`getMarchingIndex` 判断四个角的 z 值与 level 的大小关系：

```javascript
var mi = (corners[0][0] > val ? 0 : 1) +
         (corners[0][1] > val ? 0 : 2) +
         (corners[1][1] > val ? 0 : 4) +
         (corners[1][0] > val ? 0 : 8);
```

当 z 全部 < 100，而 level = 200 时，所有角都满足 `corners[i][j] > val` 为 `false`，所以：

```
mi = 1 + 2 + 4 + 8 = 15
```

代码中：

```javascript
return (mi === 15) ? 0 : mi;
```

`mi = 15` 返回 `0`，表示**没有等值线穿过这个单元格**。

对 level = 300、400 同理，所有单元格的 marching index 都是 0。

结果：**所有 level 的 `crossings` 为空，`starts` 为空。没有任何等值线路径被生成。**

### 第三步：pathfinding（pathfinding.js → findAllPaths）

因为没有 crossings 和 starts，`findAllPaths` 对每个 level 都直接跳过。

结果：每个 pathinfo 的 `edgepaths = []`，`paths = []`。

### 第四步：close_boundaries（close_boundaries.js）

```javascript
for(i = 0; i < pathinfo.length; i++) {
    var pi = pathinfo[i];
    pi.prefixBoundary = !pi.edgepaths.length &&
        (boundaryMin > pi.level || pi.starts.length && boundaryMin === pi.level);
}
```

- `pi.edgepaths.length` = 0，所以 `!pi.edgepaths.length` = `true`
- `boundaryMin` 是 z 数据边界上的最小值（< 100）
- `pi.level` 分别是 200、300、400
- `boundaryMin > pi.level` → `false`（例如 5 > 200 为 false）
- `pi.starts.length` = 0

所以 `prefixBoundary = true && (false || false)` = **`false`**

结果：**所有 level 的 `prefixBoundary` 都是 `false`。**

### 第五步：填充渲染（paths.js → drawFilledPaths）

遍历每个 level 的 paths：

```javascript
for (var i = 0; i < paths.length; i++) {
    var pathInfo = paths[i];
    var fillColor = getColorForLevel(pathInfo.level, i, levels, colorScale, ...);
    
    var joinedPaths = joinAllPaths(pathInfo, perimeter, style);
    var fullpath = pathInfo.prefixBoundary ? (boundaryPath + joinedPaths) : joinedPaths;
    
    if (fullpath) {
        ctx.beginPath();
        drawSVGPath(ctx, fullpath);
        ctx.fill();
    }
}
```

- `joinAllPaths` 返回空字符串（因为没有 edgepaths 和 paths）
- `prefixBoundary` 是 `false`
- `fullpath` = 空字符串
- `if (fullpath)` 为 `false`，**不执行任何填充**

结果：**drawFilledPaths 没有画任何东西。**

### 第六步：背景色

`drawFilledPaths` 中计算了 `bgColor` 但注释说明背景在上层处理：

```javascript
// NOTE: Background layer is now handled at a higher level (in renderContourLayer)
```

查看 `renderContourLayer`，它在调用 `drawFilledPaths` 之前没有显式绘制背景色矩形。背景色依赖于 `style.backgroundColor`（如果用户设置了的话）或 Canvas 的默认透明背景。

但实际上，`drawFilledPaths` 的分层填充逻辑中，**第一层（level 0）如果 `prefixBoundary = true`，会用 boundaryPath 填充整个绘图区域**。在我们的场景中 `prefixBoundary = false`，所以这一步也不会执行。

### 最终渲染结果

取决于用户是否设置了 `backgroundColor`：

**情况 A：设置了 backgroundColor（例如 `'#ffffff'`）**
- Canvas 被清空后填充 backgroundColor
- 没有任何等值线或填充色被绘制
- 结果：**纯白色画布**（或用户设置的背景色）

**情况 B：没有设置 backgroundColor**
- Canvas 被 `clearRect` 清空为透明
- 没有任何等值线或填充色被绘制
- 结果：**透明画布**（如果 Canvas 下面有其他 DOM 元素，会透出来）

**两种情况下都没有等值线，也没有 valueColorMap 中的任何颜色出现。**

## 与预期的差异

用户可能期望的是：既然所有 z 值都低于 200，那整个区域应该被填充为 valueColorMap 的第一个颜色（`#0000ff`，代表"低于最小阈值"的区域）。但实际上什么都没画。

这是因为 `prefixBoundary` 的计算逻辑：它判断的是"数据边界上的最小值是否大于当前 level"。当 z 全部 < 100 而 level = 200 时，`boundaryMin (< 100) > level (200)` 为 false，所以不会用边界路径填充。

## 对比：如果 z 值范围覆盖了 colorScale

假设 z 范围是 0 ~ 500，valueColorMap 是 `[[200, '#0000ff'], [300, '#00ff00'], [400, '#ff0000']]`：

- level 200 的等值线会穿过 z = 200 的位置
- `boundaryMin`（边界上的最小 z，假设为 0）< level 200，但 `edgepaths` 不为空（等值线会到达边界）
- 填充正常工作：< 200 区域填 `#0000ff`，200~300 填 `#00ff00`，> 400 填 `#ff0000`

## 根本原因

这个行为源自 Plotly.js 的等值线填充算法设计：**填充是通过等值线路径和边界路径的组合来实现的，而不是通过对每个像素点查表着色**。当没有等值线路径时（所有数据都在同一个色阶区间内），填充算法没有路径可以工作，就什么都不画。

这是一个设计上的边界情况——算法假设等值线 levels 会落在数据范围内，当 levels 完全在数据范围之外时，行为不符合直觉。

## 可能的改进方向

如果希望在这种场景下正确显示，需要在 `drawFilledPaths` 中增加一个判断：当所有 z 值都低于最小 level 时，用 valueColorMap 的第一个颜色填充整个绘图区域；当所有 z 值都高于最大 level 时，用最后一个颜色填充。这本质上是补全 `prefixBoundary` 逻辑没有覆盖到的边界情况。
