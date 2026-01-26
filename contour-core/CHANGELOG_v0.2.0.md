# Contour-Core v0.2.0 - Null Values & Simplified API

## 发布日期
2026-01-23

## 概述
v0.2.0 版本专注于**Null值支持**和**简化渲染API**，使库的使用更加接近 Plotly 的体验。

## 新增功能

### 1. Null 值支持 ⭐
完整支持缺失数据处理，无需用户手动预处理。

#### 支持的无效值类型
- `null`
- `undefined`
- `NaN`
- `Infinity` (会被视为无效)

#### 自动处理
```javascript
// 直接传入包含null值的数据
const result = ContourCore.computeContours({
    z: [
        [null, null, 12, 13],
        [null, 1, null, 11],
        [5, 2, 6, null]
    ]
});

// 结果包含null掩码和统计
console.log(result.nullCount);      // 5
console.log(result.validCount);     // 7
console.log(result.nullMask);       // 二维布尔数组
```

#### 计算层处理
- **层级计算**: 自动跳过无效值计算 zmin/zmax
- **Marching Squares**: 自动跳过包含null值的单元
- **路径查找**: 正确处理null边界，路径不穿过null区域

#### 渲染层处理
- **Canvas渲染**: null区域可配置显示（白色/透明/自定义颜色）
- **边界绘制**: null区域边界可配置

### 2. 简化渲染 API ⭐⭐
像 Plotly 一样简单的调用方式，无需手动处理坐标转换、颜色映射等复杂逻辑。

#### ContourCore.render() - 一步渲染
```javascript
// 之前：需要多步操作
const result = computeContours(grid, options);
const ctx = canvas.getContext('2d');
// 手动处理坐标转换...
// 手动处理颜色映射...
// 手动绘制...

// 现在：一行代码搞定！
ContourCore.render(canvas, {
    z: grid,              // 支持null值
    contours: { type: 'fill' },
    colorscale: 'Viridis',
    autocontour: true
});
```

#### 完整配置示例
```javascript
ContourCore.render(canvas, {
    // 数据输入
    z: [[null, 1, 2], [3, null, 5]],
    x: [0, 1, 2],  // 可选
    y: [0, 1, 2],  // 可选

    // 等值线配置
    contours: {
        type: 'fill',        // 'fill' | 'lines' | 'heatmap'
        start: 0,           // 手动模式：起始值
        end: 10,            // 手动模式：结束值
        size: 1             // 手动模式：步长
    },

    // 自动等值线
    autocontour: true,
    ncontours: 15,

    // 平滑
    smoothing: 0.5,

    // 颜色配置
    colorscale: 'Viridis',  // 预设名称或自定义数组
    zmin: 0,               // 可选：颜色范围
    zmax: 10,              // 可选：颜色范围
    reversescale: false,   // 反转颜色

    // 标尺配置
    colorbar: {
        show: true,
        title: 'Values'
    },

    // Null区域样式
    nullRegion: {
        visible: true,
        fill: '#ffffff',
        stroke: '#cccccc',
        strokeWidth: 1
    }
});
```

#### ContourCore.drawTo() - 分步渲染
```javascript
// 先计算，再渲染（适合需要缓存结果）
const result = ContourCore.computeContours({
    z: largeGrid,
    options: { ncontours: 20 }
});

// 多次渲染同一计算结果
ContourCore.drawTo(canvas1, result, { coloring: 'fill' });
ContourCore.drawTo(canvas2, result, { coloring: 'lines' });
```

### 3. 预设配色方案
内置 6 种常用配色方案：

```javascript
ContourCore.COLOR_SCALES.Viridis
ContourCore.COLOR_SCALES.Plasma
ContourCore.COLOR_SCALES.Hot
ContourCore.COLOR_SCALES.Jet
ContourCore.COLOR_SCALES.Earth
ContourCore.COLOR_SCALES.Electric
```

使用方式：
```javascript
ContourCore.render(canvas, {
    z: grid,
    colorscale: 'Viridis'  // 或自定义: ['#000', '#fff', ...]
});
```

### 4. Null 处理模块
新增 `nullHandling` 模块，提供底层的null值处理函数：

```javascript
const { nullHandling } = ContourCore;

// 标准化null值
const normalized = nullHandling.normalizeNullValues(grid);
// { cleanedGrid, nullMask, nullCount, validCount }

// 生成null掩码
const mask = nullHandling.generateNullMask(grid);

// 验证单个值
const isValid = nullHandling.isValidValue(value);
```

## API 变更

### 新增导出
```javascript
const ContourCore = require('./src/contour-core');

// 新增
ContourCore.render           // 简化渲染API
ContourCore.drawTo           // 分步渲染API
ContourCore.nullHandling     // Null处理模块
ContourCore.COLOR_SCALES     // 预设配色方案
```

### 返回值变更
`computeContours()` 的返回值新增字段：

```javascript
{
    levels: [...],
    paths: [...],

    // 新增
    nullMask: [[true, false, ...], ...],  // null掩码
    nullCount: 5,                         // null值数量
    validCount: 20                        // 有效值数量
}
```

## 兼容性
- ✅ 向后兼容 v0.1.0 的所有 API
- ✅ Node.js 环境完全支持
- ✅ 浏览器环境完全支持

## 使用示例

### 示例1: 基础使用（含null值）
```javascript
const canvas = document.getElementById('myCanvas');
const grid = [
    [null, 10, 12, 14],
    [8, null, 11, 13],
    [6, 8, 10, null]
];

ContourCore.render(canvas, {
    z: grid,
    contours: { type: 'fill' },
    colorscale: 'Plasma'
});
```

### 示例2: 完整配置
```javascript
ContourCore.render(canvas, {
    z: grid,
    contours: { type: 'fill' },
    autocontour: true,
    ncontours: 15,
    smoothing: 0.5,
    colorscale: 'Viridis',
    colorbar: {
        show: true,
        title: 'Temperature (°C)'
    },
    nullRegion: {
        visible: true,
        fill: '#ffffff',
        stroke: '#ddd'
    }
});
```

### 示例3: 分步渲染
```javascript
// 计算一次，渲染多次
const result = ContourCore.computeContours({
    z: largeDataset,
    autocontour: true,
    ncontours: 20
});

// 渲染到不同canvas
ContourCore.drawTo(canvas1, result, { coloring: 'fill' });
ContourCore.drawTo(canvas2, result, { coloring: 'lines' });
```

## 测试
运行测试验证功能：

```bash
cd src/contour-core
node test_new_api.js
```

预期输出：
```
=== Testing Contour-Core v0.2.0 Features ===

✓ Null handling works!
✓ Contour computation with nulls works!
✓ Null mask generation works!
✓ Pathfinding respects null values!
✓ Complete data works as expected!
✓ All-null data handled gracefully!
✓ All API exports available!

=== All Tests Passed! ===
```

## 浏览器演示
打开 `demo_v0.2.0.html` 查看交互式演示：
- 简化API使用
- Null值处理
- 不同配色方案
- 线条/填充模式对比

## 已知限制
1. Colorbar 样式较简单，后续版本增强
2. 标签功能尚未实现（计划 v0.3.0）
3. SVG 渲染器尚未实现（计划 v0.4.0）

## 下一步计划
### v0.3.0 - 标签版
- 标签位置计算
- 标签渲染（Canvas + SVG）
- 标签文本格式化

### v0.4.0 - 标尺增强版
- 完整的 colorbar 样式
- 自定义刻度位置
- 刻度标签格式化

## 贡献者
- 重构计划参考: `重构计划_完整版.md`
- 基于 Plotly.js 的 contour 模块提取

## 许可证
与 Plotly.js 保持一致
