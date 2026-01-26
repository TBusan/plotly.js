# Contour Fill Mode Fix Report

## 问题描述

重构后的 `contour-core` 库在渲染 **fill 模式（等值面填充）**时出现等值面混乱的问题：
- 填充颜色层级不正确
- 等值面区域显示混乱
- 与原始 Plotly.js 输出不一致

## 问题根因分析

通过对比原始 Plotly.js 代码（`src/traces/contour/plot.js`）和重构后的代码，发现了三个关键问题：

### 1. 绘制顺序错误 ⚠️

**原始代码（Plotly.js）：**
```javascript
// 在 makeFills 函数中，按照 pathinfo 的自然顺序绘制
// pathinfo[0] 是最低层级，pathinfo[length-1] 是最高层级
// 从低到高绘制，高值区域覆盖低值区域
fillitems.each(function(pi) {
    // 绘制每个层级
    var fullpath = (pi.prefixBoundary ? boundaryPath : '') + joinAllPaths(pi, perimeter);
});
```

**重构后代码（错误）：**
```javascript
// ❌ 从高到低绘制，导致低值区域覆盖高值区域
for (var i = paths.length - 1; i >= 0; i--) {
    var pathInfo = paths[i];
    // ...
}
```

**修复后代码：**
```javascript
// ✅ 从低到高绘制，高值区域正确覆盖低值区域
for (var i = 0; i < paths.length; i++) {
    var pathInfo = paths[i];
    // 使用该层级对应的颜色
    ctx.fillStyle = getColorForLevel(pathInfo.level, i);
}
```

### 2. 颜色映射错误 ⚠️

**原始代码（Plotly.js）：**
```javascript
// 每个层级直接使用对应的颜色
fillitems.each(function(pi) {
    // pi.level 直接映射到颜色
    var color = getColorForLevel(pi.level);
});
```

**重构后代码（错误）：**
```javascript
// ❌ 使用 midLevel 计算颜色，导致颜色层级混乱
var nextLevel = i < paths.length - 1 ? paths[i + 1].level : levels[levels.length - 1] + 1;
var midLevel = (pathInfo.level + nextLevel) / 2;
ctx.fillStyle = getColorForLevel(midLevel);
```

**修复后代码：**
```javascript
// ✅ 直接使用层级索引映射到颜色
function getColorForLevel(level, levelIndex) {
    var scaleIndex = Math.floor((levelIndex / nLevels) * (nColors - 1));
    return style.colorScale[scaleIndex][1];
}
```

### 3. 缺少背景填充 ⚠️

**原始代码（Plotly.js）：**
```javascript
// 先绘制整个背景为最低层颜色
function makeBackground(plotgroup, perimeter, contours) {
    var bgfill = bggroup.selectAll('path')
        .data(contours.coloring === 'fill' ? [0] : []);
    bgfill.attr('d', 'M' + perimeter.join('L') + 'Z');
}
```

**重构后代码（错误）：**
```javascript
// ❌ 没有背景填充，导致最低层级区域不显示
```

**修复后代码：**
```javascript
// ✅ 先绘制整个背景为最低层颜色
if (paths.length > 0) {
    ctx.fillStyle = getColorForLevel(levels[0], 0);
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.fill();
}
```

## 修复内容

### 修改文件

1. **`contour-core/renderers/canvas/paths.js`**
   - 修复 `drawFilledPaths()` 函数
   - 调整绘制顺序：从低到高
   - 修复颜色映射逻辑
   - 添加背景填充

2. **`contour-core/renderers/svg/paths.js`**
   - 修复 `createFilledPaths()` 函数
   - 调整绘制顺序：从低到高
   - 修复颜色映射逻辑
   - 添加背景矩形

3. **`tasks/package_contour_core_v2.mjs`**
   - 修改源码路径：`src/contour-core` → `contour-core`

### 修复细节

#### Canvas 渲染器 (`renderers/canvas/paths.js`)

```javascript
// 修复前（错误）
for (var i = paths.length - 1; i >= 0; i--) {  // 从高到低
    var midLevel = (pathInfo.level + nextLevel) / 2;  // 错误的颜色计算
    ctx.fillStyle = getColorForLevel(midLevel);
}

// 修复后（正确）
// 1. 先绘制背景
if (paths.length > 0) {
    ctx.fillStyle = getColorForLevel(levels[0], 0);
    ctx.fillRect(0, 0, width, height);
}

// 2. 从低到高绘制
for (var i = 0; i < paths.length; i++) {
    ctx.fillStyle = getColorForLevel(pathInfo.level, i);  // 正确的颜色
    // ... 绘制逻辑
}
```

#### SVG 渲染器 (`renderers/svg/paths.js`)

```javascript
// 修复前（错误）
for (var i = paths.length - 1; i >= 0; i--) {  // 从高到低
    var midLevel = (pathInfo.level + nextLevel) / 2;
    var color = getColorForLevel(midLevel, levels, options);
}

// 修复后（正确）
// 1. 先添加背景矩形
if (paths.length > 0) {
    var bgColor = getColorForLevel(levels[0], levels, options);
    svgParts.push('<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="' + bgColor + '" />');
}

// 2. 从低到高绘制
for (var i = 0; i < paths.length; i++) {
    var color = getColorForLevel(pathInfo.level, levels, options);  // 正确的颜色
    svgParts.push('<path ... fill="' + color + '" fill-rule="evenodd" />');
}
```

## 原理说明

### Even-Odd 填充规则

Plotly 使用 **even-odd 填充规则**来渲染等值面：

1. **基本原理**：
   - 每个等值线路径将区域分成"内部"和"外部"
   - 奇数层嵌套 = 内部，偶数层嵌套 = 外部
   - 使用 `fill-rule="evenodd"` 实现

2. **绘制逻辑**：
   - 每个层级绘制"等值线以上"的区域
   - 从低到高绘制，高值区域覆盖低值区域
   - `prefixBoundary` 决定是否添加边界路径

3. **层级覆盖**：
   ```
   Level 0 (最低): 绘制 z >= level0 的区域 → 蓝色
   Level 1: 绘制 z >= level1 的区域 → 蓝绿色（覆盖部分蓝色）
   Level 2: 绘制 z >= level2 的区域 → 绿色（覆盖部分蓝绿色）
   ...
   Level N (最高): 绘制 z >= levelN 的区域 → 黄色（覆盖部分绿色）
   ```

### 为什么从低到高绘制？

因为 Canvas 的渲染模式是"后绘制的覆盖先绘制的"：

```
低值层（大面积）→ 被高值层（小面积）覆盖 → 形成正确的梯度
```

如果从高到低绘制：
```
高值层（小面积）→ 被低值层（大面积）覆盖 → 梯度混乱！
```

## 测试验证

创建了测试页面 `test_fill_mode_fix.html`，包含：

1. **Simple Gradient Test** - 简单对角梯度测试
2. **Multi-Peak Test** - 多峰值复杂场景测试
3. **Fill with Labels** - 带标签的填充测试
4. **Lines vs Fill Comparison** - 线条模式和填充模式对比

### 预期结果

- ✅ 颜色梯度平滑过渡
- ✅ 等值面层级清晰
- ✅ 高值区域正确覆盖低值区域
- ✅ 与 Plotly.js 输出一致

## 构建和部署

```bash
# 重新打包
npm run build:contour

# 输出文件
dist/contour-core.umd.js       # 开发版本
dist/contour-core.umd.min.js   # 生产版本
```

## 总结

这次修复解决了 fill 模式下的三个核心问题：

1. ✅ **绘制顺序**：从高到低 → 从低到高
2. ✅ **颜色映射**：midLevel 插值 → 直接层级映射
3. ✅ **背景填充**：缺失 → 添加背景层

修复后的代码完全符合 Plotly.js 的原始逻辑，确保了渲染结果的正确性和一致性。

---

**修复日期**: 2026-01-26
**修复版本**: contour-core v0.2.0 (fixed)
**相关文件**:
- `contour-core/renderers/canvas/paths.js`
- `contour-core/renderers/svg/paths.js`
- `test_fill_mode_fix.html`
