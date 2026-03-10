# Overlay 绘图功能设计文档

## 概述

为 contour-core 新增独立的 Overlay 绘图模块，支持在等值线图上叠加绘制文字、点、线、面等图形元素。

## 需求总结

| 项目 | 内容 |
|------|------|
| **使用场景** | 叠加在等值线上 |
| **坐标系统** | 数据坐标系（随缩放平移自动重绘） |
| **API 风格** | 命令式 API |
| **交互支持** | 仅显示 |

---

## 模块结构

```
renderers/canvas/overlay/
├── index.js          # Overlay 管理器
├── text.js           # 文字绘制
├── point.js          # 点绘制
├── line.js           # 线绘制
├── polygon.js        # 面绘制
├── shapes.js         # 形状绘制器
└── patterns.js       # 填充图案生成器
```

---

## API 设计

### 1. 文字 API

```javascript
overlay.drawText(x, y, text, options)

// options:
{
    fontSize: 12,           // 字号
    fontFamily: 'Arial',    // 字体
    fontWeight: 'normal',   // 粗细：'normal' | 'bold'
    color: '#000000',       // 颜色
    rotation: 0,            // 旋转角度（弧度）
    align: 'center',        // 水平对齐：'left' | 'center' | 'right'
    baseline: 'middle',     // 垂直对齐：'top' | 'middle' | 'bottom'
    background: null        // 背景色（可选）
}
```

### 2. 点 API

```javascript
overlay.drawPoint(x, y, options)

// options:
{
    size: 8,                // 大小（直径）
    color: '#ff0000',       // 颜色
    strokeColor: null,      // 边框颜色（可选）
    strokeWidth: 0,         // 边框宽度
    shape: 'circle',        // 形状：'circle' | 'square' | 'triangle' | 'diamond' | { svg: 'url' } | { image: 'url' }

    // 文字标注
    text: {
        content: 'A1',          // 文字内容
        offset: [0, -15],       // 偏移量
        fontSize: 12,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        background: null
    }
}
```

### 3. 线 API

```javascript
overlay.drawLine(points, options)

// points: [[x1, y1], [x2, y2], ...]

// options:
{
    color: '#000000',       // 颜色
    width: 1,               // 宽度
    style: 'solid',         // 线形：'solid' | 'dashed' | 'dotted'
    cap: 'round',           // 端点：'butt' | 'round' | 'square'
    join: 'round',          // 连接：'miter' | 'round' | 'bevel'

    // 文字标注
    text: {
        content: '边界线',       // 文字内容
        position: 'middle',     // 位置：'start' | 'middle' | 'end' | 索引
        offset: [0, -10],       // 偏移量
        repeat: false,          // 是否沿线重复
        repeatInterval: 100,    // 重复间隔（像素）
        fontSize: 12,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        rotation: 'auto'        // 'auto' | 固定角度
    }
}
```

### 4. 面 API

```javascript
overlay.drawPolygon(points, options)

// points: [[x1, y1], [x2, y2], ...]

// options:
{
    stroke: {               // 边线
        color: '#000000',
        width: 1,
        style: 'solid'
    },
    fill: {                 // 填充
        type: 'color',      // 'color' | 'pattern'
        color: 'rgba(255,0,0,0.5)',

        // 当 type='pattern' 时：
        pattern: 'grid',    // 'grid' | 'hash' | 'diagonal' | 'dots' | { svg: 'url' }
        patternColor: '#000000',
        patternSize: 10
    },

    // 文字标注
    text: {
        content: '区域A',        // 文字内容
        position: 'center',     // 'center' | [x, y]
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        background: null
    }
}
```

---

## 文字标注通用参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `content` | string | - | 文字内容 |
| `fontSize` | number | 12 | 字号 |
| `fontFamily` | string | 'Arial' | 字体 |
| `color` | string | '#000000' | 颜色 |
| `fontWeight` | string | 'normal' | 字重：'normal' \| 'bold' |
| `background` | string \| null | null | 背景色 |
| `offset` | [number, number] | [0, 0] | 偏移量 |

---

## 填充图案

### 内置图案

| 图案 | 名称 | 说明 |
|------|------|------|
| 网格 | `grid` | 横竖交叉线 |
| 井号 | `hash` | 斜交叉线 |
| 双斜线 | `diagonal` | 平行斜线 |
| 圆点 | `dots` | 规则排列的圆点 |

### 自定义图案

```javascript
fill: {
    type: 'pattern',
    pattern: {
        svg: 'data:image/svg+xml;base64,...'  // SVG data URL
    },
    patternSize: 20
}
```

---

## 与渲染器集成

### 获取 Overlay

```javascript
const renderer = contourCore.renderers.canvas.drawContours(ctx, result, options);
const overlay = renderer.getOverlay();
```

### 渲染时机

- 初始化渲染：添加图形后自动渲染
- 缩放/平移：自动随等值线重绘
- 手动刷新：`overlay.refresh()`

### 清除操作

```javascript
overlay.clear();           // 清除所有
overlay.clear('points');   // 清除所有点
overlay.clear('lines');    // 清除所有线
overlay.clear('polygons'); // 清除所有面
overlay.clear('texts');    // 清除所有独立文字
```

---

## 完整使用示例

```javascript
// 1. 创建等值线渲染
const renderer = contourCore.renderers.canvas.drawContours(ctx, contourResult, {
    width: 800,
    height: 600,
    interaction: { zoom: true, pan: true }
});

// 2. 获取 overlay
const overlay = renderer.getOverlay();

// 3. 绘制带标注的点
overlay.drawPoint(10.5, 20.3, {
    size: 10,
    color: 'red',
    shape: 'triangle',
    text: {
        content: '监测点1',
        offset: [0, -15],
        fontSize: 12,
        color: '#000000'
    }
});

// 4. 绘制带标注的线
overlay.drawLine([[0, 0], [10, 10]], {
    color: 'blue',
    width: 2,
    style: 'dashed',
    text: {
        content: '边界',
        position: 'middle',
        rotation: 'auto'
    }
});

// 5. 绘制带标注和图案填充的面
overlay.drawPolygon([[5, 5], [15, 5], [15, 15], [5, 15]], {
    fill: {
        type: 'pattern',
        pattern: 'grid',
        patternColor: '#00ff00',
        patternSize: 10
    },
    stroke: {
        color: 'green',
        width: 2,
        style: 'solid'
    },
    text: {
        content: '采样区',
        position: 'center',
        fontSize: 14
    }
});

// 6. 绘制独立文字
overlay.drawText(10, 10, '等值线图', {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333'
});
```

---

## 文件清单与代码量估算

| 模块 | 文件 | 预估代码量 |
|------|------|------------|
| Overlay 管理器 | `index.js` | ~150 行 |
| 文字绘制 | `text.js` | ~80 行 |
| 点绘制 | `point.js` | ~100 行 |
| 线绘制 | `line.js` | ~80 行 |
| 面绘制 | `polygon.js` | ~100 行 |
| 形状绘制 | `shapes.js` | ~120 行 |
| 填充图案 | `patterns.js` | ~150 行 |
| **总计** | | **~780 行** |

### 需修改的文件

| 文件 | 修改内容 |
|------|----------|
| `renderers/canvas/index.js` | 添加 `getOverlay()` 方法，在渲染流程中调用 overlay.render() |

---

## 实施计划

### 阶段 1：基础框架
1. 创建 overlay 目录结构
2. 实现 Overlay 管理器（index.js）
3. 集成到 Canvas 渲染器

### 阶段 2：核心绘制功能
4. 实现文字绘制（text.js）
5. 实现点绘制 + 形状（point.js + shapes.js）
6. 实现线绘制（line.js）
7. 实现面绘制（polygon.js）

### 阶段 3：高级功能
8. 实现填充图案（patterns.js）
9. 实现自定义 SVG/图片形状
10. 实现自定义 SVG 填充图案

### 阶段 4：测试与文档
11. 编写测试用例
12. 创建 Demo 示例
13. 更新 README 文档

---

*设计日期：2026-03-09*
