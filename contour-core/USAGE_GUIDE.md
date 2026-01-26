# Contour-Core v0.3.0 - 使用指南

## 📦 快速开始

### 安装

```bash
# 复制整个 contour-core 文件夹到你的项目
cp -r contour-core /path/to/your/project/
```

### Node.js 中使用

```javascript
const contourCore = require('./contour-core');

// 准备数据
const grid = {
    z: [[10, 20, 30], [20, 30, 40], [30, 40, 50]], // 2D 数组
    x: [0, 1, 2],  // X 坐标（可选）
    y: [0, 1, 2]   // Y 坐标（可选）
};

// 计算等值线
const result = contourCore.computeContours(grid, {
    autocontour: true,
    ncontours: 10,
    smoothing: 0.3
});

console.log('生成的级别:', result.levels);
console.log('路径数量:', result.paths.length);
```

### 浏览器中使用

```html
<!DOCTYPE html>
<html>
<head>
    <script type="module">
        import contourCore from './contour-core/index.js';

        const grid = { /* ... */ };
        const result = contourCore.computeContours(grid, {
            autocontour: true,
            ncontours: 10
        });

        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');

        contourCore.renderers.canvas.drawContours(ctx, result, {
            width: 500,
            height: 400,
            coloring: 'fill',
            colorscale: 'Viridis'
        });
    </script>
</head>
<body>
    <canvas id="canvas" width="500" height="400"></canvas>
</body>
</html>
```

---

## 🧪 运行测试

### 运行所有测试

```bash
cd contour-core

# 运行完整测试套件
npm test

# 或运行所有优化测试
npm run test:all
```

### 运行单个测试

```bash
# 测试智能刻度算法
npm run test:levels

# 测试刻度格式化
npm run test:ticks

# 测试颜色映射
npm run test:colors
```

---

## 🎨 使用 Demo

### 方法 1: 使用本地服务器

```bash
# 使用 Python 启动简单 HTTP 服务器
cd contour-core
python -m http.server 8080

# 然后在浏览器访问
# http://localhost:8080/demo.html
```

### 方法 2: 使用 Node.js 服务器

```bash
# 安装 http-server（如果没有）
npm install -g http-server

# 启动服务器
cd contour-core
http-server -p 8080

# 访问 http://localhost:8080/demo.html
```

---

## 📚 API 文档

### computeContours(grid, options)

计算等值线数据。

**参数**:
- `grid.z`: 2D 数组，z 值
- `grid.x`: X 坐标数组（可选，默认为索引）
- `grid.y`: Y 坐标数组（可选，默认为索引）
- `options.autocontour`: 自动生成级别（默认: true）
- `options.ncontours`: 级别数量（默认: 15）
- `options.thresholds`: 自定义阈值数组
- `options.start`: 手动指定起始值
- `options.end`: 手动指定结束值
- `options.size`: 手动指定步长
- `options.smoothing`: 平滑系数（0-1）

**返回值**:
```javascript
{
    levels: [0, 10, 20, ...],      // 等值线级别
    paths: [{                       // 每个级别的路径信息
        level: 0,
        edgepaths: [[...]],          // 边缘路径（开放）
        paths: [[...]],              // 内部路径（闭合）
        prefixBoundary: true/false
    }],
    pathinfo: [...],                // 原始路径信息
    nullMask: [...],                 // NaN 值掩码
    nullCount: 5,                   // NaN 值数量
    validCount: 395                 // 有效值数量
}
```

### renderers.canvas.drawContours(ctx, result, style)

在 Canvas 上绘制等值线。

**样式参数**:
- `width`: Canvas 宽度
- `height`: Canvas 高度
- `padding`: 边距
- `coloring`: 'fill', 'lines', 'heatmap'
- `colorscale`: 'Viridis', 'Plasma', 'Hot', etc.
- `smoothing`: 平滑系数
- `showLines`: 是否显示线条
- `lineWidth`: 线条宽度

---

## ✨ 新特性 (v0.3.0)

### 1. 智能刻度算法

```javascript
const result = contourCore.computeContours(grid, {
    autocontour: true,
    ncontours: 10
});

// 生成的级别是"友好数字"
// 例如: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
// 而不是: [0, 9.1, 18.2, 27.3, ...]
```

### 2. 自定义阈值 + 高级颜色映射

```javascript
const result = contourCore.computeContours(grid, {
    thresholds: [1, 5, 10, 50, 100, 500, 1000]
});

// 使用高级颜色映射
const colors = require('./colorbar/colors');
const colorScale = colors.buildColorScale(result.levels, 'Hot', {
    extend: true,    // 扩展到数据范围
    dataMin: 0,
    dataMax: 1200
});
```

### 3. 智能刻度格式化

```javascript
const ticks = require('./colorbar/ticks');

// 自动格式化
ticks.autoFormatValue(0.00123);    // => '1.23e-3'
ticks.autoFormatValue(123.456);    // => '123.5'
ticks.autoFormatValue(12345);      // => '1.23e+4'

// 显式格式化
ticks.formatTickValue(123.456, '.2f');  // => '123.46'
ticks.formatTickValue(0.1234, '.1%');   // => '12.3%'
ticks.formatTickValue(12345, '.2e');    // => '1.23e+4'
```

### 4. 热力图模式

```javascript
contourCore.renderers.canvas.drawContours(ctx, result, {
    coloring: 'heatmap',  // 热力图模式
    colorscale: 'Hot'
});
```

### 5. 非均匀网格支持

```javascript
const grid = {
    z: [[10, 20, 30], [15, 25, 35], [20, 30, 40]],
    x: [0, 1, 5, 10],    // 非均匀 X
    y: [0, 2, 10]        // 非均匀 Y
};

// 插值会在数据空间进行（而非网格索引空间）
const result = contourCore.computeContours(grid, {
    autocontour: true
});
```

---

## 📊 性能基准

### 测试结果

| 数据大小 | 单元格数 | 级别数 | 路径数 | 点数 | 时间 |
|---------|---------|--------|--------|------|------|
| 20x20 | 400 | 10 | ~15 | ~300 | ~3ms |
| 50x50 | 2500 | 15 | ~25 | ~800 | ~8ms |
| 100x100 | 10000 | 20 | ~40 | ~3000 | ~10ms |

**性能**: ~280 点/毫秒

---

## 🎯 示例

### 示例 1: 基本使用

```javascript
const contourCore = require('./contour-core');

// 创建测试数据
const grid = {
    z: [],
    x: [],
    y: []
};

for (let i = 0; i < 20; i++) {
    grid.z[i] = [];
    grid.y.push(i);

    for (let j = 0; j < 20; j++) {
        if (i === 0) grid.x.push(j);

        const dx = j - 10;
        const dy = i - 10;
        grid.z[i][j] = 100 * Math.exp(-(dx * dx + dy * dy) / 50);
    }
}

// 计算等值线
const result = contourCore.computeContours(grid, {
    autocontour: true,
    ncontours: 10
});

console.log('生成的级别:', result.levels);
```

### 示例 2: 自定义阈值

```javascript
const result = contourCore.computeContours(grid, {
    thresholds: [20, 40, 60, 80, 100],
    smoothing: 0.5
});

// 在 Canvas 上绘制
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

contourCore.renderers.canvas.drawContours(ctx, result, {
    width: 600,
    height: 500,
    coloring: 'fill',
    colorscale: 'Viridis',
    padding: 40,
    showLines: true,
    lineWidth: 1.5
});

document.body.appendChild(canvas);
```

### 示例 3: 热力图模式

```javascript
const result = contourCore.computeContours(grid, {
    autocontour: true,
    ncontours: 20
});

contourCore.renderers.canvas.drawContours(ctx, result, {
    width: 800,
    height: 600,
    coloring: 'heatmap',
    colorscale: 'Hot',
    padding: 50,
    showLines: true
});
```

---

## 🔧 高级功能

### 颜色映射

```javascript
const colors = require('./colorbar/colors');

// 创建颜色映射函数
const mapper = colors.createColorMapper(
    [0, 25, 50, 75, 100],
    'Viridis'
);

// 获取颜色
const color1 = mapper(0);    // 最低值颜色
const color2 = mapper(50);   // 中间值颜色
const color3 = mapper(100);  // 最高值颜色
```

### 刻度计算

```javascript
const levels = require('./levels');
const ticks = require('./colorbar/ticks');

// 智能刻度
const smartTicks = levels.computeNiceTicks(0, 100, 5);
// => { start: 0, end: 100, step: 20 }

// 刻度格式化
const formatted = ticks.formatTickValue(123.456, '.2f');
// => '123.46'
```

---

## 📝 注意事项

### 浏览器环境

需要使用 ES6 模块导入：

```html
<script type="module">
    import contourCore from './contour-core/index.js';
    // 使用代码...
</script>
```

### Node.js 环境

```javascript
const contourCore = require('./contour-core/index.js');
// 使用代码...
```

---

## 🐛 故障排除

### 问题 1: 模块导入错误

**错误**: `Cannot use import statement outside a module`

**解决**:
- 浏览器: 使用 `<script type="module">`
- Node.js: 使用 `require()` 或将文件扩展名改为 `.mjs`

### 问题 2: Canvas 渲染问题

**错误**: `Cannot read property 'getContext' of null`

**解决**: 确保 canvas 元素已加载到 DOM

```javascript
window.addEventListener('load', () => {
    const canvas = document.getElementById('canvas');
    // 现在可以安全使用 canvas
});
```

### 问题 3: 空白数据

**错误**: 生成的级别为空数组

**解决**: 检查输入数据是否包含有效值

```javascript
const flatVals = grid.z.flat().filter(v =>
    typeof v === 'number' && !isNaN(v) && isFinite(v)
);

if (flatVals.length === 0) {
    console.error('数据不包含有效值！');
}
```

---

## 📄 文件说明

### 核心文件
- `index.js` - 主入口文件
- `compute.js` - 等值线计算
- `marchingsquares.js` - Marching Squares 算法
- `pathfinding.js` - 路径查找
- `levels.js` - 智能刻度算法（v0.3.0 新增）
- `smooth.js` - 平滑算法

### 渲染器
- `renderers/canvas/index.js` - Canvas 渲染器
- `renderers/canvas/paths.js` - 路径绘制
- `renderers/canvas/heatmap.js` - 热力图渲染（v0.3.0 新增）

### 颜色和刻度
- `colorbar/colors.js` - 颜色映射（v0.3.0 增强）
- `colorbar/ticks.js` - 刻度格式化（v0.3.0 新增）

### 测试和 Demo
- `test/` - 单元测试
- `test_node.js` - Node.js 测试
- `test_all_optimizations.js` - 完整优化测试（v0.3.0 新增）
- `demo.html` - 交互式 Demo（v0.3.0 新增）
- `demo_simple.html` - 简单 Demo（v0.3.0 新增）

---

## 🚀 下一步

### 生产环境使用

1. **优化打包**: 使用 Webpack/Rollup 打包
2. **CDN 部署**: 将库部署到 CDN
3. **Tree Shaking**: 支持按需导入

### 性能优化

1. **WebWorker**: 在后台线程中计算
2. **WASM**: 使用 WebAssembly 加速
3. **增量渲染**: 大数据集分块渲染

---

## 📞 支持

- **文档**: 查看 `OPTIMIZATION_COMPLETE.md`
- **示例**: 运行 `demo.html`
- **测试**: 运行 `npm test`

---

**Contour-Core v0.3.0** - Advanced Contour Generation Library

完整的等值线生成和渲染解决方案，支持 Node.js 和浏览器环境。
