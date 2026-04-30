# prefixBoundary 补全"数据全部低于色阶"场景

## 问题

当 z 值全部低于 valueColorMap 的最小阈值时（例如 z 范围 0~90，colorScale 最小值 200），整个画布为空白，没有任何颜色填充。期望行为是用 colorScale 的第一个颜色填充整个区域。

## 根因

`close_boundaries.js` 中 `prefixBoundary` 的判断条件只覆盖了"数据全部高于 level"的情况，没有覆盖"数据全部低于 level"的对称情况：

```javascript
pi.prefixBoundary = !pi.edgepaths.length &&
    (boundaryMin > pi.level || pi.starts.length && boundaryMin === pi.level);
```

- `boundaryMin > pi.level`：数据最小值 > level → 数据全部高于 level → ✅ 正确填充
- 缺少：数据最大值 < level → 数据全部低于 level → ❌ 不填充

## 修复方案

增加 `boundaryMax` 的计算，在"数据全部低于 level 且为第一个 level"时设置 `prefixBoundary = true`。

只让第一个 level（i === 0）触发，因为填充是从低到高逐层覆盖的。如果所有 level 都触发，最终会显示最后一个颜色（最高阈值），而正确行为应该是显示第一个颜色（最低阈值，代表"低于所有阈值"）。

## 影响分析

### 场景一：正常情况（数据范围覆盖 levels）

z 范围 0~500，levels = [100, 200, 300, 400]

- `boundaryMax ≈ 500`
- 对每个 level：`boundaryMax < level` 为 false
- 新增条件不触发
- **无影响**

### 场景二：数据全部高于所有 levels

z 范围 1000~2000，levels = [200, 300, 400]

- 原有条件 `boundaryMin > pi.level` 已正确处理
- `allDataBelow` 为 false（boundaryMax ≥ 1000，不小于任何 level）
- 新增条件不触发
- **无影响**

### 场景三：数据部分覆盖 levels

z 范围 0~250，levels = [100, 200, 300, 400]

- level 100、200 有等值线穿过，有 edgepaths → `!edgepaths.length` 为 false → prefixBoundary = false（由路径本身控制填充）
- level 300（i=2）：`allDataBelow = true`，但 `i !== 0` → 新增条件为 false
- level 400（i=3）：同理 → 新增条件为 false
- 这些高位 level 不需要填充，因为 level 200 的等值线填充已经覆盖了 z > 200 的区域
- **无影响**

### 场景四：数据全部低于所有 levels（修复目标）

z 范围 0~90，levels = [200, 300, 400]

- 所有 level 都没有等值线
- level 200（i=0）：`allDataBelow = true`，`i === 0` → prefixBoundary = true → 用 200 对应的颜色填充整个区域
- level 300（i=1）：`i !== 0` → prefixBoundary = false → 不填充
- level 400（i=2）：同理 → 不填充
- 最终显示 valueColorMap 第一个颜色
- **正确修复**

### 颜色正确性验证

`getColorForSegmentedValue(200, [[200, 'blue'], [300, 'green'], [400, 'red']])` 的逻辑：

```javascript
// value = 200, valueColorMap[0][0] = 200
// value < 200 → false，不走 "below first threshold" 分支
// value >= 200 && value < 300 → true，返回 'blue'
```

返回 `blue`，即 valueColorMap 的第一个颜色。这正是"低于最小阈值"应该显示的颜色，因为 valueColorMap 的语义是 `[[200, 'blue']]` 表示"从 200 开始用 blue"，而低于 200 的值也用第一个颜色 blue。

## 结论

修改只在一个极端边界条件下生效（所有边界数据低于当前 level 且为第一个 level），正常数据范围下新增条件永远为 false，不影响任何已有渲染逻辑。
