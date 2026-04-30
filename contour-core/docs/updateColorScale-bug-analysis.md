# updateColorScale 方法覆盖 computeContours 参数的 Bug 分析

## 问题描述

调用 `updateColorScale(valueColorMap)` 方法后，之前通过 `computeContours` 设置的参数（如 `connectgaps: false`、`smoothing: 0.5`、`ncontours` 等）会被重置或丢失。具体表现为：初始设置 `connectgaps: false`，但执行 `updateColorScale` 后，`connectgaps` 变为 `true`（默认值）。

## 根因分析

问题的根本原因在于 **`_computeOptions` 对象在初始化时缺少 `connectgaps` 字段**，而 `computeContours` 函数内部对缺失的 `connectgaps` 使用了 `true` 作为默认值。

### 完整调用链路追踪

#### 第一步：初始渲染时的参数传递

用户首次调用 `computeContours` 时，直接传入完整的 options 对象：

```javascript
// 用户代码
var result = contourCore.computeContours(grid, {
    smoothing: 0.5,
    autocontour: true,
    ncontours: ncontours,
    valueColorMap: valueColorMap,
    connectgaps: false   // ← 用户明确设置为 false
});
```

在 `compute.js` 的 `computeContours` 函数中，`connectgaps` 被正确读取：

```javascript
// compute.js 第 62 行
var connectGaps = options.connectgaps !== undefined ? options.connectgaps : true;
```

此时 `options.connectgaps` 为 `false`，所以 `connectGaps = false`，行为正确。

计算结果中也正确携带了这个标志：

```javascript
// compute.js 第 117 行
return {
    levels: contourLevels,
    paths: ...,
    pathinfo: pathinfo,
    nullMask: nullMask,
    nullCount: normalization.nullCount,
    validCount: normalization.validCount,
    connectgaps: connectGaps  // ← false，正确
};
```

#### 第二步：交互式渲染器缓存参数（问题所在）

当通过 `drawContours` 进入交互模式（`style.interaction` 存在时），会调用 `createInteractiveRenderer`。在该函数中，为后续动态更新缓存了一份计算参数 `_computeOptions`：

```javascript
// renderers/canvas/index.js 第 311-320 行
var _computeOptions = {
    autocontour: style.autocontour !== false,
    ncontours: style.ncontours || 15,
    smoothing: style.smoothing !== undefined ? style.smoothing : 0.5,
    start: style.start,
    end: style.end,
    size: style.size,
    valueColorMap: style.valueColorMap
    // ❌ 注意：这里没有 connectgaps 字段！
};
```

**`_computeOptions` 中完全没有 `connectgaps` 属性。** 这是 Bug 的核心。

#### 第三步：updateColorScale 触发重新计算

当用户调用 `updateColorScale(newValueColorMap)` 时：

```javascript
// renderers/canvas/index.js 第 507-518 行
updateColorScale: function(valueColorMap) {
    if (!Array.isArray(valueColorMap)) return;

    _computeOptions.valueColorMap = valueColorMap;
    currentStyle.valueColorMap = valueColorMap;

    // 重新计算等值线（levels 会根据 valueColorMap 变化）
    contourResult = compute.computeContours(_gridData, _computeOptions);
    //                                                  ↑
    //                          此时 _computeOptions 中没有 connectgaps

    pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
    render();
},
```

此时传给 `computeContours` 的 `_computeOptions` 对象中 **不包含 `connectgaps`**。

#### 第四步：computeContours 使用默认值

在 `compute.js` 中：

```javascript
var connectGaps = options.connectgaps !== undefined ? options.connectgaps : true;
//                                                                          ↑
//                                          connectgaps 未定义，回退到默认值 true
```

由于 `_computeOptions.connectgaps` 是 `undefined`，三元表达式走到默认分支，`connectGaps` 被设为 `true`。

最终返回的 `contourResult.connectgaps` 变为 `true`，覆盖了用户最初设置的 `false`。

#### 第五步：渲染层读取被覆盖的值

在 `renderContourLayer` 中：

```javascript
// renderers/canvas/index.js 第 768 行
var connectGaps = contourResult.connectgaps !== undefined ? contourResult.connectgaps : true;
var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;
```

此时 `contourResult.connectgaps` 已经是 `true`，所以 `needsClip = false`，null 区域的裁剪遮罩不再生效——这就是用户观察到的行为变化。

## 受影响的参数汇总

| 参数 | `_computeOptions` 中的处理 | 是否受影响 | 说明 |
|------|---------------------------|-----------|------|
| `connectgaps` | **完全缺失** | ✅ 受影响 | 默认回退为 `true`，覆盖用户设置 |
| `smoothing` | `style.smoothing !== undefined ? style.smoothing : 0.5` | ⚠️ 部分 | 如果 style 中有值则正确保留 |
| `autocontour` | `style.autocontour !== false` | ⚠️ 部分 | 使用 `!== false` 判断，`undefined` 会被当作 `true` |
| `ncontours` | `style.ncontours \|\| 15` | ⚠️ 部分 | 如果 style 中有值则正确保留 |
| `valueColorMap` | 有 | ✅ 正确 | `updateColorScale` 会主动更新此字段 |

## 同类问题：updateData 和 updateColorbar

同样的问题也存在于 `updateData` 和 `updateColorbar` 方法中，它们都使用 `_computeOptions` 调用 `compute.computeContours`，因此都会丢失 `connectgaps` 设置：

```javascript
// updateData (第 484 行)
contourResult = compute.computeContours(_gridData, _computeOptions);

// updateColorbar (第 538 行)
contourResult = compute.computeContours(_gridData, _computeOptions);

// update (批量更新, 第 621 行)
contourResult = compute.computeContours(_gridData, _computeOptions);
```

## 修复方案

### 方案一：在 `_computeOptions` 初始化时补全 `connectgaps`（推荐）

```javascript
var _computeOptions = {
    autocontour: style.autocontour !== false,
    ncontours: style.ncontours || 15,
    smoothing: style.smoothing !== undefined ? style.smoothing : 0.5,
    start: style.start,
    end: style.end,
    size: style.size,
    valueColorMap: style.valueColorMap,
    connectgaps: style.connectgaps !== undefined ? style.connectgaps : 
                 (contourResult.connectgaps !== undefined ? contourResult.connectgaps : true)
};
```

这里需要注意：`connectgaps` 的值可能来自两个地方：
1. `style` 对象（用户通过交互式渲染器传入的配置）
2. 初始 `contourResult`（用户首次调用 `computeContours` 时的结果）

优先从 `style` 读取，其次从已有的 `contourResult` 读取，最后才使用默认值。

### 方案二：从初始 contourResult 中恢复

由于 `createInteractiveRenderer` 接收的 `contourResult` 参数是用户首次计算的结果，其中已经包含了正确的 `connectgaps` 值，可以直接引用：

```javascript
var _computeOptions = {
    autocontour: style.autocontour !== false,
    ncontours: style.ncontours || 15,
    smoothing: style.smoothing !== undefined ? style.smoothing : 0.5,
    start: style.start,
    end: style.end,
    size: style.size,
    valueColorMap: style.valueColorMap,
    connectgaps: contourResult.connectgaps  // 从初始计算结果中继承
};
```

### 方案三：在 `updateContours` 中也支持 `connectgaps`

当前 `updateContours` 方法不支持更新 `connectgaps`，应该补充：

```javascript
updateContours: function(options) {
    if (!options) return;

    if (options.smoothing !== undefined) _computeOptions.smoothing = options.smoothing;
    if (options.autocontour !== undefined) _computeOptions.autocontour = options.autocontour;
    if (options.ncontours !== undefined) _computeOptions.ncontours = options.ncontours;
    if (options.start !== undefined) _computeOptions.start = options.start;
    if (options.end !== undefined) _computeOptions.end = options.end;
    if (options.size !== undefined) _computeOptions.size = options.size;
    if (options.connectgaps !== undefined) _computeOptions.connectgaps = options.connectgaps; // 新增

    contourResult = compute.computeContours(_gridData, _computeOptions);
    // ...
},
```

## 总结

这是一个典型的 **状态缓存不完整** 问题。`createInteractiveRenderer` 在创建 `_computeOptions` 缓存对象时，遗漏了 `connectgaps` 字段。后续所有通过 `_computeOptions` 触发的重新计算（`updateColorScale`、`updateData`、`updateColorbar`、`update`）都会因为该字段缺失而回退到 `computeContours` 内部的默认值 `true`，从而覆盖用户最初设置的 `false`。

推荐采用方案二，从初始 `contourResult` 中继承 `connectgaps` 值，这样最简洁且不会引入额外的参数传递复杂度。同时建议在 `updateContours` 方法中也支持动态修改 `connectgaps`。
