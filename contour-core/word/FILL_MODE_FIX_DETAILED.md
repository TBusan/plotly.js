# Contour Fill 模式修复详细报告

## 问题总结

经过深入分析 Plotly.js 源码和 contour-core 实现，发现了导致 fill 模式填充混乱的 **3 个关键问题**。

---

## 问题 1：坐标系统不一致（最严重！）

### 问题描述
`renderers/canvas/paths.js` 中的 `scalePoint` 函数假设输入点是**网格索引空间**（0 到 n-1），但实际上 `pathfinding.js` 返回的点是**数据空间**（实际的 x/y 坐标值）。

### 根本原因
在 `pathfinding.js` 的 `getInterpPx` 函数中（第 314-373 行）：
```javascript
return [
    dataX,      // X in data space
    dataY,      // Y in data space
    locx + dx,  // Interpolated grid index X
    locy        // Grid index Y
];
```

然后在 `makePath` 函数中（第 129-131 行）移除了索引部分：
```javascript
// Remove index parts (3rd and 4th items) before storing
for (cnt = 0; cnt < simplifiedPts.length; cnt++) {
    simplifiedPts[cnt].length = 2;  // 只保留前两个元素（数据空间坐标）
}
```

但 `scalePoint` 函数（第 484-498 行）错误地假设：
```javascript
// 错误的实现！
function scalePoint(style, pt) {
    var m = style.z.length;  // 网格行数
    var n = style.z[0].length;  // 网格列数
    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    return [
        padding + pt[0] * scaleX,  // 假设 pt[0] 是 0 到 n-1
        padding + (m - 1 - pt[1]) * scaleY  // 假设 pt[1] 是 0 到 m-1
    ];
}
```

### 影响
这导致**完全错误的位置映射**，等值线会绘制在错误的位置，造成填充混乱。

### 修复方案
修改 `scalePoint` 函数以正确处理数据空间坐标：

```javascript
function scalePoint(style, pt) {
    var x = style.x || [];
    var y = style.y || [];
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    // Get data range
    var xMin = x.length > 0 ? Math.min.apply(Math, x) : 0;
    var xMax = x.length > 0 ? Math.max.apply(Math, x) : 1;
    var yMin = y.length > 0 ? Math.min.apply(Math, y) : 0;
    var yMax = y.length > 0 ? Math.max.apply(Math, y) : 1;

    // Avoid division by zero
    var xRange = xMax - xMin || 1;
    var yRange = yMax - yMin || 1;

    // Normalize to [0, 1] and scale to canvas
    var canvasX = padding + ((pt[0] - xMin) / xRange) * (width - 2 * padding);
    var canvasY = padding + ((pt[1] - yMin) / yRange) * (height - 2 * padding);

    // Flip Y axis (canvas Y increases downward, data Y increases upward)
    canvasY = height - padding - (canvasY - padding);

    return [canvasX, canvasY];
}
```

---

## 问题 2：自定义阈值的颜色映射错误

### 问题描述
对于自定义阈值（`thresholds` 参数），`getColorForLevel` 函数直接使用层级值来查找颜色，但这会导致颜色映射不正确。

### 根本原因
Plotly.js 的 fill 模式使用**区间颜色**，即每层的颜色应该代表两个层级之间的区域，而不是层级本身的颜色。

**正确的逻辑**：
- 对于自动生成的层级：使用 `level + 0.5 * step`（层级加上半个步长）
- 对于自定义阈值：使用相邻两个阈值的中点 `(level[i] + level[i+1]) / 2`

**原代码的问题**：
```javascript
if (hasCustomLevels) {
    value = level;  // ❌ 错误！直接使用层级值
} else {
    value = level + 0.5 * stepSize;  // ✅ 正确
}
```

### 影响
自定义阈值的颜色映射会不正确，相邻层级之间可能出现颜色跳变或重叠。

### 修复方案
```javascript
if (hasCustomLevels) {
    // For custom thresholds, use the midpoint between this level and the next
    if (levelIndex < levels.length - 1) {
        // Midpoint between this threshold and the next one
        value = (levels[levelIndex] + levels[levelIndex + 1]) / 2;
    } else {
        // For the highest threshold, use a value above it
        var lastStep = levels.length > 1 ?
            (levels[levels.length - 1] - levels[levels.length - 2]) : 1;
        value = levels[levelIndex] + lastStep / 2;
    }
} else {
    // For auto-generated levels, add half the step size
    value = level + 0.5 * stepSize;
}
```

---

## 问题 3：背景颜色计算错误

### 问题描述
对于自定义阈值，背景颜色（低于第一个阈值的区域）的计算不正确。

### 根本原因
原代码对于自定义阈值使用第一个阈值的颜色作为背景色：
```javascript
if (hasCustomLevels) {
    bgColor = getColorForLevel(levels[0], 0, levels, colorScale, true, stepSize);
    // ❌ 这会使背景色等于第一个填充层的颜色！
}
```

### 影响
背景色与第一层填充色相同，导致最低层级区域颜色不正确。

### 修复方案
使用第一个阈值区间的一半作为背景值：
```javascript
if (hasCustomLevels) {
    if (levels.length > 1) {
        var firstInterval = levels[1] - levels[0];
        var bgValue = levels[0] - firstInterval / 2;
        // Normalize and clamp
        var minVal = levels[0];
        var maxVal = levels[levels.length - 1];
        var range = maxVal - minVal;
        var normalizedBg = (bgValue - minVal) / range;
        normalizedBg = Math.max(0, Math.min(1, normalizedBg));
        bgColor = getColorForValue(normalizedBg, colorScale);
    } else {
        // Only one threshold - use a default color below it
        bgColor = getColorForLevel(levels[0], 0, levels, colorScale, true, stepSize);
    }
}
```

---

## 问题 4：缺少归一化边界检查

### 问题描述
颜色归一化时没有检查边界情况，可能导致归一化值超出 [0, 1] 范围。

### 修复方案
在所有归一化操作后添加 clamp：
```javascript
var normalizedValue = (value - minVal) / range;
normalizedValue = Math.max(0, Math.min(1, normalizedValue));  // ✅ Clamp to [0, 1]
```

---

## 修改文件清单

### `contour-core/renderers/canvas/paths.js`

1. **修改 `getColorForLevel` 函数**（第 228-258 行）
   - 为自定义阈值实现正确的中点计算
   - 添加归一化边界检查

2. **修改背景颜色计算逻辑**（第 307-337 行）
   - 修复自定义阈值的背景色计算
   - 添加 clamp 操作

3. **完全重写 `scalePoint` 函数**（第 491-516 行）
   - 从网格索引空间改为数据空间映射
   - 正确处理 Y 轴翻转

---

## 测试文件

### 1. `test_fill_fix_detailed.js`
Node.js 测试脚本，验证：
- 自动生成的层级
- 自定义阈值（非均匀间距）
- 坐标系统正确性
- 颜色映射逻辑

### 2. `test_fill_visual_fix.html`
浏览器可视化测试，包含：
- 4 个测试用例
- 交互式控制面板
- 实时结果验证
- 预期结果说明

---

## 运行测试

### Node.js 测试
```bash
cd contour-core
node test_fill_fix_detailed.js
```

### 浏览器测试
```bash
cd contour-core
# 启动简单的 HTTP 服务器
python -m http.server 8000
# 或
npx serve

# 然后在浏览器打开
# http://localhost:8000/test_fill_visual_fix.html
```

---

## 预期结果

如果修复成功，你应该看到：

### ✅ 视觉效果
- **颜色渐变平滑** - 从低值到高值颜色过渡自然
- **等值线对齐** - 等值线位置与颜色边界完全匹配
- **背景正确** - 最低等值线以下的区域颜色正确
- **无间隙或重叠** - 相邻颜色区域之间无缝隙或重叠

### ✅ 自定义阈值
- 非均匀间距的阈值显示正确的颜色
- 每个颜色区域对应正确的阈值区间
- 颜色映射符合预期

### ✅ 边界情况
- 少量阈值（如 2 个）正确显示
- 单个阈值正确显示
- 阈值超出数据范围时正确处理

---

## 关键要点总结

1. **坐标系统一致性至关重要** - 必须明确区分网格索引空间和数据空间
2. **Fill 模式使用区间颜色** - 颜色应代表层级之间的区域，而不是层级本身
3. **自定义阈值需要特殊处理** - 使用相邻阈值的中点，而不是阈值本身
4. **边界检查必不可少** - 归一化值必须 clamp 到 [0, 1]
5. **背景色是特殊情况** - 应该低于第一个阈值，而不是等于第一个阈值

---

## 参考

- Plotly.js 源码：`src/traces/contour/plot.js` (makeFills 函数)
- Plotly.js 源码：`src/traces/contour/style.js` (fill color 逻辑)
- 本项目的核心原理文档：`等值线实现核心原理.md`
