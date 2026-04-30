# _gridData 保存原始数据重构方案分析

## 结论

**说法正确。** `_gridData` 保存用户原始数据（带 null）是更干净的方案，可以彻底移除 `restoreNullInfo` 补丁。`computeContours` 内部会自行处理 null 值的识别、插值、levels 计算，三者互不干扰，无论 colorScale 长度怎么变都能正确工作。

## 改动点

只需要改 `createInteractiveRenderer` 中 `_gridData` 的初始化来源。

### 当前代码

```javascript
// drawContours 中：
var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
if (pathInfo) {
    style = Object.assign({
        x: pathInfo.x,
        y: pathInfo.y,
        z: pathInfo.z    // ← cleanedZ，已插值，无 null
    }, style);
}
// ...
return createInteractiveRenderer(ctx.canvas, contourResult, style, interactionConfig);

// createInteractiveRenderer 中：
var _gridData = {
    z: style.z,   // ← 拿到的是 cleanedZ
    x: style.x,
    y: style.y
};
```

### 重构后

```javascript
// createInteractiveRenderer 中：

// 从 contourResult 中提取用户的原始 z 数据
// computeContours 返回的 pathinfo[0].z 是 cleanedZ（已插值），
// 但 contourResult 本身没有保存原始 z。
// 因此需要在 computeContours 的返回值中增加 originalZ 字段，
// 或者从 drawContours 的调用链中另行传入。
```

## 需要注意的问题

### 1. 原始 z 数据从哪来？

这是最关键的问题。当前的调用链是：

```
用户代码:  result = computeContours(rawData, options)
用户代码:  drawContours(ctx, result, style)
内部:      createInteractiveRenderer(canvas, result, style)
```

`result`（contourResult）中没有保存原始的 rawData.z。`result.pathinfo[0].z` 是 cleanedZ。`style.z` 也是从 `pathInfo.z` 来的（在 `drawContours` 中被赋值）。

**解决方式有两种：**

**方式 A：在 `computeContours` 的返回值中增加 `originalZ` 字段**

```javascript
// compute.js 中：
return {
    levels: contourLevels,
    paths: ...,
    pathinfo: pathinfo,
    nullMask: nullMask,
    nullCount: normalization.nullCount,
    validCount: normalization.validCount,
    connectgaps: connectGaps,
    originalZ: z   // 新增：保存用户传入的原始 z（带 null）
};
```

然后在 `createInteractiveRenderer` 中：

```javascript
var _gridData = {
    z: contourResult.originalZ || style.z,  // 优先用原始数据
    x: style.x,
    y: style.y
};
```

优点：改动最小，向后兼容。
缺点：`contourResult` 会多持有一份原始 z 数据的引用，增加内存占用（但只是引用，不是拷贝）。

**方式 B：让用户在 style 中显式传入原始 z**

```javascript
drawContours(ctx, result, {
    z: rawData.z,   // 用户自己传原始数据
    x: rawData.x,
    y: rawData.y,
    interaction: { ... }
});
```

优点：不需要改 `computeContours`。
缺点：依赖用户正确传参，如果用户不传 z，`drawContours` 内部会从 `pathInfo.z` 取 cleanedZ，问题依旧。

**推荐方式 A。**

### 2. `currentStyle.z` 会变成带 null 的原始数据

`updateData` 和 `update` 方法中有这样的代码：

```javascript
currentStyle.z = _gridData.z;
```

如果 `_gridData.z` 是原始数据（带 null），那 `currentStyle.z` 也会带 null。`currentStyle` 会被传入 `renderContourLayer`，最终传到 `paths.js` 的 `scalePoint` 和 `createPerimeter` 中。

**影响分析：**

- **`createPerimeter`**：只读 `style.z.length` 和 `style.z[0].length` 来获取网格维度。原始数据和 cleanedZ 的维度完全一样，**无影响**。

- **`joinAllPaths`**：读 `style.z.length` 和 `style.z[0].length` 来生成 fallback 坐标数组。同上，**无影响**。

- **`scalePoint`**：不读 `style.z`，只读 `style.x`、`style.y`、`style.visibleRange`、`style.drawArea`。**无影响**。

- **`drawHeatmap.drawInterpolatedHeatmap`**：使用的是 `pathInfo.z`（来自 contourResult），不是 `style.z`。**无影响**。

- **`renderContourLayer`**：构建 `renderStyle` 时 `z: style.z || (pathInfo ? pathInfo.z : null)`。如果 `style.z` 是带 null 的原始数据，`renderStyle.z` 也会带 null。但实际消费 `renderStyle.z` 的只有上面列出的几个函数，都只读维度，**无影响**。

**结论：`currentStyle.z` 变成带 null 的数据不会产生副作用。** 所有实际需要数值的渲染逻辑（等值线路径、heatmap 像素）都从 `contourResult.pathinfo[0].z`（cleanedZ）中读取，不从 `style.z` 读取。

### 3. `getData()` 返回值语义变化

```javascript
getData: function() {
    return {
        z: _gridData.z,  // 重构后返回原始数据（带 null）
        x: _gridData.x,
        y: _gridData.y
    };
}
```

之前返回的是 cleanedZ（无 null），重构后返回原始数据（带 null）。如果有用户代码依赖 `getData().z` 是无 null 的，会出问题。

**建议**：这其实是更合理的行为——用户调用 `getData()` 期望拿回自己传入的数据，而不是被库内部处理过的数据。但需要在文档中说明这个变化。

### 4. `updateData` 传入新数据后的行为

```javascript
updateData: function(newData) {
    if (newData.z) _gridData.z = newData.z;  // 用户传入新的原始数据
    contourResult = compute.computeContours(_gridData, _computeOptions);
    // 不再需要 restoreNullInfo，因为 _gridData.z 带 null，
    // computeContours 会正确生成新的 nullMask
}
```

这是最自然的行为，**无副作用**。

### 5. 性能影响

每次 `updateColorScale` / `updateContours` 调用 `computeContours` 时，会多执行一次 `normalizeNullValues`（识别 null）和 `interp2d`（插值填充）。之前因为 `_gridData.z` 无 null，这两步基本是空操作。

**实际开销**：
- `normalizeNullValues`：遍历一次 z 矩阵，O(m×n)
- `findEmpties`：遍历一次 z 矩阵，O(m×n)
- `interp2d`：迭代求解，最多 100 次，每次 O(k)，k 为空值点数

对于典型的 50×50 网格，这些操作在毫秒级别，相比 marching squares + pathfinding 的开销可以忽略。对于 500×500 以上的大网格且空值比例高的场景，可能有可感知的额外开销，但仍然远小于路径计算。

**结论：性能影响可忽略。**

## 完整的重构步骤

1. **`compute.js`**：在 `computeContours` 返回值中增加 `originalZ: z`（用户传入的原始 z 引用）

2. **`renderers/canvas/index.js`**：
   - `_gridData.z` 改为从 `contourResult.originalZ` 获取
   - 移除 `_originalNullMask`、`_originalNullCount`、`_originalValidCount` 三个变量
   - 移除 `restoreNullInfo` 函数
   - 移除所有 `restoreNullInfo(contourResult)` 调用
   - 移除 `updateData` 和 `update` 中更新 `_originalNullMask` 的逻辑

3. **测试验证**：
   - `connectgaps: false` + `updateColorScale` → null 区域遮罩应保持
   - `connectgaps: false` + `updateData`（新数据有不同的 null 分布）→ 遮罩应更新
   - `connectgaps: true` + `updateColorScale` → 无遮罩，等值线连续
   - 不同长度的 `valueColorMap` → levels 数量应正确变化
   - `getData()` → 应返回带 null 的原始数据

## 总结

| 维度 | 当前方案（restoreNullInfo 补丁） | 重构方案（保存原始数据） |
|------|-------------------------------|----------------------|
| 代码复杂度 | 高：需要 3 个额外变量 + 1 个辅助函数 + 5 处调用 | 低：只改 1 处初始化 + 1 处 computeContours 返回值 |
| 正确性 | 脆弱：updateData 需要特殊处理，batch update 需要条件判断 | 自然：所有路径统一，computeContours 自行处理 |
| 性能 | 略优：重新计算时跳过 null 处理（因为数据无 null） | 略慢：重新计算时多一次 null 识别 + 插值（可忽略） |
| 副作用 | 无 | getData() 返回值语义变化（更合理） |
| 维护成本 | 高：新增 API 方法时容易忘记调用 restoreNullInfo | 低：无需额外处理 |
