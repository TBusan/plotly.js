# contour-core 事件需求分析 - 使用 zrender 实现

## 目录
1. [概述](#概述)
2. [当前架构分析](#当前架构分析)
3. [zrender 架构优势](#zrender-架构优势)
4. [渲染器替换方案](#渲染器替换方案)
5. [事件系统集成](#事件系统集成)
6. [详细实现步骤](#详细实现步骤)
7. [代码示例](#代码示例)
8. [API 迁移指南](#api-迁移指南)
9. [测试验证](#测试验证)
10. [未来扩展](#未来扩展)

---

## 概述

### 背景

当前 `contour-core` 具备完整的计算层和独立的 Canvas/SVG 渲染器，但缺乏交互能力。传统方案需要自行实现完整的事件系统，开发成本高且维护困难。

### 解决方案

使用 **zrender** 作为渲染引擎，它可以：
- 替代现有的 Canvas 和 SVG 渲染器
- 提供开箱即用的事件系统
- 统一 Canvas/SVG 的 API
- 为未来 WebGL 扩展（通过 echarts-gl）预留接口

### 核心目标

```
┌─────────────────────────────────────────────────────────────┐
│                     目标架构                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   contour-core API (不变)                                   │
│         ↓                                                   │
│   zrender Integration Layer (新增)                          │
│         ↓                                                   │
│   zrender Engine (替代 Canvas/SVG 原生渲染)                 │
│         ↓                                                   │
│   内置事件系统 (无需自己实现)                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 当前架构分析

### 现有渲染器结构

```
contour-core/
├── renderers/
│   ├── canvas/
│   │   └── index.js          # 原生 Canvas API 绘制
│   │                          - ctx.beginPath()
│   │                          - ctx.moveTo()
│   │                          - ctx.stroke()
│   │
│   └── svg/
│       └── index.js          # SVG 字符串拼接
│                                  - '<path d="..." />'
│                                  - 手动构建 SVG DOM
│
├── api.js                      # 统一渲染入口
│                                - render(canvas, config)
│                                - drawTo(canvas, result, options)
```

### 现有代码模式

```javascript
// 当前 Canvas 渲染器（简化示例）
function drawContours(ctx, result, style) {
    // 遍历路径
    for (var i = 0; i < result.smoothedPaths.length; i++) {
        ctx.beginPath();
        // 手动解析路径命令
        parseAndDrawPath(ctx, result.smoothedPaths[i]);
        ctx.fillStyle = getColor(i);
        ctx.fill();
    }
    // ❌ 无事件绑定能力
}
```

### 问题分析

| 问题 | 当前状态 | 影响 |
|------|----------|------|
| 渲染代码冗余 | Canvas 和 SVG 分别实现 | 维护成本高 |
| 无事件系统 | 需要自己实现 | 开发工作量大 |
| 无动画支持 | 需要自己实现 | 用户体验差 |
| HiDPI 适配 | 需手动处理 | 兼容性问题 |

---

## zrender 架构优势

### 核心特性

#### 1. 多渲染模式统一 API

```javascript
// 一套代码，两种渲染模式
const zr = zrender.init(container, {
    renderer: 'canvas'  // 或 'svg'，API 完全相同
});

// 创建元素
const path = new zrender.Path({
    shape: { pathData: 'M10 10 L20 20' },
    style: { stroke: '#ff0000' }
});

zr.add(path);
```

#### 2. 内置事件系统

```javascript
// 元素级事件
path.on('click', (e) => {
    console.log('Clicked at:', e.offsetX, e.offsetY);
});

path.on('mouseover', (e) => {
    e.target.attr({
        style: { stroke: '#00ff00' }
    });
});

path.on('mouseout', (e) => {
    e.target.attr({
        style: { stroke: '#ff0000' }
    });
});
```

#### 3. 分层渲染优化

```javascript
// 通过 zlevel 控制 Canvas 分层
path.zlevel = 1;  // 动画层，独立 Canvas
staticPath.zlevel = 0;  // 静态层

// 只有动画层重绘，性能优化
```

#### 4. 内置动画

```javascript
// 简洁的动画 API
path.animateTo({
    shape: { x: 100 },
    style: { opacity: 0.5 }
}, 300, 'cubicOut');
```

### zrender 图形类型

| 图形类型 | 用途 | contour 应用 |
|---------|------|--------------|
| Path | 任意路径 | ✅ 等值线路径 |
| Polygon | 多边形 | ✅ 填充区域 |
| Text | 文本 | ✅ 标注 |
| Line | 直线 | ✅ 坐标轴、网格线 |
| Rect | 矩形 | ✅ 色块、边框 |
| Circle | 圆形 | ✅ 数据点标记 |
| Group | 组合 | ✅ 整体变换 |

---

## 渲染器替换方案

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      contour-core API                           │
│                    (api.js - 保持兼容)                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   zrender Integration Layer                     │
│                  (新增：renderers/zrender/)                     │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │数据转换器     │  │样式适配器     │  │事件处理器             │  │
│  │DataConverter│  │StyleAdapter │  │EventHandler         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       zrender Engine                           │
│  ┌──────────────┐           ┌──────────────┐               │
│  │Canvas Mode   │           │SVG Mode      │               │
│  │(默认)        │           │(可选)        │               │
│  └──────────────┘           └──────────────┘               │
│                                                               │
│  - 事件系统（内置）                                          │
│  - 动画系统（内置）                                          │
│  - 分层渲染（内置）                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 文件结构

```
contour-core/
├── renderers/
│   ├── canvas/               # 保留但标记为 deprecated
│   │   └── index.js
│   ├── svg/                  # 保留但标记为 deprecated
│   │   └── index.js
│   │
│   └── zrender/              # 新增：zrender 渲染器
│       ├── index.js          # 主入口
│       ├── paths.js          # 路径绘制
│       ├── labels.js         # 标注绘制
│       ├── axes.js           # 坐标轴绘制
│       ├── colorbar.js       # 颜色条绘制
│       ├── interaction.js    # 事件处理
│       └── utils.js          # 工具函数
│
├── interaction/              # 新增：交互层（基于 zrender 事件）
│   ├── index.js
│   ├── ZoomHandler.js
│   ├── PanHandler.js
│   ├── HoverHandler.js
│   └── StateManager.js
│
└── api.js                    # 修改：支持 zrender 选项
```

---

## 事件系统集成

### zrender 事件 vs 原生事件

| 特性 | 原生实现 | zrender 实现 |
|------|----------|--------------|
| 事件绑定 | 手动 addEventListener | `element.on(event, handler)` |
| 坐标获取 | `e.clientX, e.clientY` | `e.offsetX, e.offsetY` |
| 目标识别 | 需碰撞检测 | 自动识别图形元素 |
| 冒泡控制 | 手动实现 | 内置冒泡/捕获 |
| 拖拽 | 手动计算 | `draggable: true` |
| 触摸事件 | 需单独处理 | 自动适配触摸 |

### contour-core 需要的事件

```javascript
// zrender 支持的所有 contour 需要的事件

const CONTOUR_EVENTS = {
    // 鼠标事件
    'click': true,          // 点击等值线
    'dblclick': true,       // 双击重置
    'mousedown': true,      // 开始拖拽/框选
    'mousemove': true,      // 悬停提示
    'mouseup': true,        // 结束拖拽
    'mouseover': true,      // 高亮开始
    'mouseout': true,       // 高亮结束
    'mousewheel': true,     // 滚轮缩放

    // 触摸事件
    'touchstart': true,     // 触摸开始
    'touchmove': true,      // 触摸移动
    'touchend': true,       // 触摸结束

    // zrender 特有
    'drag': true,           // 拖拽中（设置 draggable 后）
    'dragstart': true,
    'dragend': true
};
```

### 事件架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        Event Flow                              │
└─────────────────────────────────────────────────────────────────┘

用户操作
   │
   ▼
zrender 事件系统
   │
   ├─► Path 元素事件  ──►  HoverHandler (等值线高亮)
   │
   ├─► Container 事件  ──►  ZoomHandler (缩放)
   │                        PanHandler (平移)
   │
   └─► 自定义事件     ──►  用户回调
```

---

## 详细实现步骤

### 阶段 1：zrender 集成基础（第 1 周）

#### 步骤 1.1：安装依赖

```bash
npm install zrender@5.x
```

#### 步骤 1.2：创建 zrender 渲染器模块

```javascript
// renderers/zrender/index.js

const zrender = require('zrender');

/**
 * zrender 等值线渲染器
 */
class ZRenderContourRenderer {
    constructor(container, options) {
        // 初始化 zrender 实例
        this.zr = zrender.init(container, {
            renderer: options.renderer || 'canvas',  // 'canvas' | 'svg'
            width: options.width || 600,
            height: options.height || 500,
            devicePixelRatio: options.devicePixelRatio || window.devicePixelRatio
        });

        // 创建主容器组
        this.mainGroup = new zrender.Group();
        this.zr.add(this.mainGroup);

        // 分层管理
        this.layers = {
            background: new zrender.Group(),  // 背景色块
            fills: new zrender.Group(),       // 填充区域
            lines: new zrender.Group(),       // 等值线
            labels: new zrender.Group(),      // 标注
            axes: new zrender.Group(),        // 坐标轴
            grid: new zrender.Group(),        // 网格线
            overlay: new zrender.Group()      // 交互层（高亮、框选）
        };

        // 添加层级
        Object.values(this.layers).forEach(layer => {
            this.mainGroup.add(layer);
        });

        // 存储配置
        this.options = options;
        this.contourResult = null;
        this.style = null;

        // 事件处理器映射
        this.eventHandlers = new Map();
    }

    // ... 更多方法
}

module.exports = ZRenderContourRenderer;
```

#### 步骤 1.3：实现路径数据转换

```javascript
// renderers/zrender/paths.js

/**
 * 将 contour-core 路径数据转换为 zrender Path 元素
 */
function createPathElement(pathData, level, color, style, options) {
    return new zrender.Path({
        shape: {
            pathData: pathData  // zrender 支持 SVG path 数据格式
        },
        style: {
            fill: style.coloring === 'fill' ? color : 'none',
            stroke: style.coloring === 'lines' ? color : null,
            lineWidth: style.lineWidth || 1.5,
            opacity: style.opacity || 1,
            lineJoin: 'round'
        },
        zlevel: 0,
        z: style.z || 0,
        // 可拖拽（用于平移）
        draggable: false,
        // 自定义数据
        _contourLevel: level,
        _pathData: pathData
    });
}

/**
 * 批量创建等值线元素
 */
function createContourPaths(result, style, options) {
    const elements = [];
    const paths = result.smoothedPaths || result.paths;
    const levels = result.levels;

    for (let i = 0; i < paths.length; i++) {
        const color = getColorForLevel(levels[i], style.colorScale, style.valueColorMap);

        const pathEl = createPathElement(
            paths[i],
            levels[i],
            color,
            style,
            options
        );

        elements.push({
            element: pathEl,
            level: levels[i],
            index: i
        });
    }

    return elements;
}

/**
 * 更新路径样式（用于高亮等交互）
 */
function updatePathStyle(element, newStyle) {
    element.attr({
        style: {
            ...element.style,
            ...newStyle
        }
    });
}

module.exports = {
    createPathElement,
    createContourPaths,
    updatePathStyle
};
```

### 阶段 2：基础渲染实现（第 1-2 周）

#### 步骤 2.1：实现等值线渲染

```javascript
// renderers/zrender/index.js (继续)

const pathUtils = require('./paths');

ZRenderContourRenderer.prototype.renderContours = function(result, style) {
    // 清除旧元素
    this.layers.fills.removeAll();
    this.layers.lines.removeAll();

    this.contourResult = result;
    this.style = style;

    // 创建路径元素
    const contourElements = pathUtils.createContourPaths(result, style, this.options);

    // 分离填充和线条
    const fillElements = [];
    const lineElements = [];

    contourElements.forEach(({ element, level, index }) => {
        if (style.coloring === 'fill' || style.coloring === 'heatmap') {
            element.zlevel = 'fills';
            fillElements.push(element);
        }

        if (style.showLines) {
            const lineEl = element.clone();
            lineEl.attr({
                style: {
                    fill: 'none',
                    stroke: style.lineColor || '#666',
                    lineWidth: style.lineWidth || 1
                },
                zlevel: 'lines'
            });
            lineElements.push(lineEl);
        }
    });

    // 添加到对应层级
    fillElements.forEach(el => this.layers.fills.add(el));
    lineElements.forEach(el => this.layers.lines.add(el));

    // 绑定事件
    this.attachContourEvents(contourElements);
};
```

#### 步骤 2.2：实现坐标轴渲染

```javascript
// renderers/zrender/axes.js

const zrender = require('zrender');

/**
 * 绘制 X 轴
 */
function drawXAxis(container, config) {
    const { width, height, xRange, tickPositions, tickLabels } = config;

    const axisGroup = new zrender.Group();

    // 主轴线
    const yAxis = height - config.padding;
    const line = new zrender.Line({
        shape: {
            x1: config.padding,
            y1: yAxis,
            x2: width - config.padding,
            y2: yAxis
        },
        style: {
            stroke: config.tickColor || '#666',
            lineWidth: config.tickWidth || 1
        }
    });
    axisGroup.add(line);

    // 刻度线和标签
    tickPositions.forEach((pos, i) => {
        const tick = new zrender.Line({
            shape: {
                x1: pos,
                y1: yAxis,
                x2: pos,
                y2: yAxis + config.ticklen
            },
            style: {
                stroke: config.tickColor || '#666',
                lineWidth: 1
            }
        });
        axisGroup.add(tick);

        const text = new zrender.Text({
            style: {
                text: tickLabels[i],
                x: pos,
                y: yAxis + config.ticklen + 5,
                textAlign: 'center',
                textBaseline: 'top',
                fill: config.textColor || '#333',
                fontSize: 12
            }
        });
        axisGroup.add(text);
    });

    container.add(axisGroup);
    return axisGroup;
}

/**
 * 绘制 Y 轴
 */
function drawYAxis(container, config) {
    const { width, height, yRange, tickPositions, tickLabels } = config;

    const axisGroup = new zrender.Group();

    // 主轴线
    const xAxis = config.padding;
    const line = new zrender.Line({
        shape: {
            x1: xAxis,
            y1: config.padding,
            x2: xAxis,
            y2: height - config.padding
        },
        style: {
            stroke: config.tickColor || '#666',
            lineWidth: config.tickWidth || 1
        }
    });
    axisGroup.add(line);

    // 刻度线和标签
    tickPositions.forEach((pos, i) => {
        const tick = new zrender.Line({
            shape: {
                x1: xAxis - config.ticklen,
                y1: pos,
                x2: xAxis,
                y2: pos
            },
            style: {
                stroke: config.tickColor || '#666',
                lineWidth: 1
            }
        });
        axisGroup.add(tick);

        const text = new zrender.Text({
            style: {
                text: tickLabels[i],
                x: xAxis - config.ticklen - 5,
                y: pos,
                textAlign: 'right',
                textBaseline: 'middle',
                fill: config.textColor || '#333',
                fontSize: 12
            }
        });
        axisGroup.add(text);
    });

    container.add(axisGroup);
    return axisGroup;
}

module.exports = {
    drawXAxis,
    drawYAxis
};
```

#### 步骤 2.3：实现标注渲染

```javascript
// renderers/zrender/labels.js

const zrender = require('zrender');

/**
 * 创建标注元素
 */
function createLabel(labelData, style) {
    const { x, y, text, level } = labelData;

    const group = new zrender.Group();

    // 背景矩形（提高可读性）
    const bgRect = new zrender.Rect({
        shape: {
            x: x - 20,
            y: y - 10,
            width: 40,
            height: 20,
            r: 3
        },
        style: {
            fill: 'rgba(255, 255, 255, 0.8)',
            stroke: '#ccc',
            lineWidth: 1
        },
        zlevel: 'labels',
        z: 1
    });
    group.add(bgRect);

    // 文本
    const textEl = new zrender.Text({
        style: {
            text: text,
            x: x,
            y: y,
            textAlign: 'center',
            textBaseline: 'middle',
            fill: style.labelColor || '#333',
            fontSize: style.fontSize || 11,
            fontWeight: 'bold'
        },
        zlevel: 'labels',
        z: 2,
        _labelLevel: level
    });
    group.add(textEl);

    return group;
}

/**
 * 绘制所有标注
 */
function drawLabels(container, labels, style) {
    const labelGroup = new zrender.Group();

    labels.forEach(labelData => {
        const label = createLabel(labelData, style);
        labelGroup.add(label);
    });

    container.add(labelGroup);
    return labelGroup;
}

module.exports = {
    createLabel,
    drawLabels
};
```

### 阶段 3：事件系统实现（第 2-3 周）

#### 步骤 3.1：等值线悬停高亮

```javascript
// renderers/zrender/interaction.js

/**
 * 等值线悬停处理器
 */
class HoverHandler {
    constructor(renderer) {
        this.renderer = renderer;
        this.hoveredElement = null;
        this.tooltipElement = null;
        this.highlightElement = null;
    }

    /**
     * 绑定等值线悬停事件
     */
    attach(pathElements) {
        pathElements.forEach(({ element, level, index }) => {
            // mouseover 事件
            element.on('mouseover', (e) => {
                this.handleMouseOver(e, element, level);
            });

            // mouseout 事件
            element.on('mouseout', (e) => {
                this.handleMouseOut(e);
            });

            // mousemove 事件（用于 tooltip）
            element.on('mousemove', (e) => {
                this.handleMouseMove(e, level);
            });

            // click 事件
            element.on('click', (e) => {
                this.handleClick(e, level);
            });
        });
    }

    /**
     * 处理鼠标悬停
     */
    handleMouseOver(e, element, level) {
        // 记录当前悬停元素
        this.hoveredElement = element;

        // 创建高亮效果
        this.highlightElement = element.clone();
        this.highlightElement.attr({
            style: {
                ...element.style,
                stroke: '#ff0',
                lineWidth: (element.style.lineWidth || 1) + 2,
                opacity: 1
            },
            zlevel: 'overlay',
            z: 100,
            ignore: false  // 确保可交互
        });

        this.renderer.layers.overlay.add(this.highlightElement);

        // 触发回调
        if (this.renderer.options.onHoverStart) {
            this.renderer.options.onHoverStart({
                level: level,
                event: e
            });
        }
    }

    /**
     * 处理鼠标移出
     */
    handleMouseOut(e) {
        // 移除高亮
        if (this.highlightElement) {
            this.renderer.layers.overlay.remove(this.highlightElement);
            this.highlightElement = null;
        }

        // 隐藏 tooltip
        this.hideTooltip();

        this.hoveredElement = null;

        // 触发回调
        if (this.renderer.options.onHoverEnd) {
            this.renderer.options.onHoverEnd(e);
        }
    }

    /**
     * 处理鼠标移动（显示 tooltip）
     */
    handleMouseMove(e, level) {
        const { offsetX, offsetY } = e;

        // 显示/更新 tooltip
        this.showTooltip(offsetX, offsetY, level, e);
    }

    /**
     * 显示 tooltip
     */
    showTooltip(x, y, level, e) {
        if (!this.tooltipElement) {
            // 创建 tooltip 容器
            this.tooltipElement = new zrender.Group();
            this.renderer.layers.overlay.add(this.tooltipElement);
        }

        this.tooltipElement.removeAll();

        // 背景
        const bgRect = new zrender.Rect({
            shape: {
                x: x + 10,
                y: y + 10,
                width: 120,
                height: 40,
                r: 4
            },
            style: {
                fill: 'rgba(0, 0, 0, 0.8)',
                shadowColor: 'rgba(0, 0, 0, 0.3)',
                shadowBlur: 10,
                shadowOffsetX: 2,
                shadowOffsetY: 2
            }
        });
        this.tooltipElement.add(bgRect);

        // 文本
        const text = new zrender.Text({
            style: {
                text: `Level: ${level.toFixed(2)}`,
                x: x + 20,
                y: y + 20,
                fill: '#fff',
                fontSize: 12
            }
        });
        this.tooltipElement.add(text);

        this.renderer.zr.flush();
    }

    /**
     * 隐藏 tooltip
     */
    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.removeAll();
        }
    }

    /**
     * 处理点击
     */
    handleClick(e, level) {
        if (this.renderer.options.onContourClick) {
            this.renderer.options.onContourClick({
                level: level,
                event: e
            });
        }
    }
}

module.exports = HoverHandler;
```

#### 步骤 3.2：缩放功能实现

```javascript
// interaction/ZoomHandler.js

const zrender = require('zrender');

/**
 * 缩放处理器
 */
class ZoomHandler {
    constructor(renderer, options) {
        this.renderer = renderer;
        this.options = options || {};
        this.state = {
            isZooming: false,
            zoomCenter: null,
            lastScale: 1
        };

        // 绑定事件
        this.bindEvents();
    }

    /**
     * 绑定缩放事件
     */
    bindEvents() {
        const zr = this.renderer.zr;

        // 滚轮缩放
        zr.on('mousewheel', (e) => {
            if (this.options.enableWheel !== false) {
                this.handleWheel(e);
            }
        });

        // 双指缩放（触摸）
        zr.on('pinch', (e) => {
            if (this.options.enablePinch !== false) {
                this.handlePinch(e);
            }
        });
    }

    /**
     * 处理滚轮缩放
     */
    handleWheel(e) {
        e.stop();

        const { offsetX, offsetY, deltaY } = e;
        const zoomFactor = this.options.zoomFactor || 0.001;

        // 计算缩放比例
        const scaleDelta = 1 - deltaY * zoomFactor;
        const newScale = this.state.lastScale * scaleDelta;

        // 限制缩放范围
        const minScale = this.options.minScale || 0.1;
        const maxScale = this.options.maxScale || 10;
        const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));

        // 计算缩放中心偏移
        const containerWidth = this.renderer.zr.getWidth();
        const containerHeight = this.renderer.zr.getHeight();

        const centerX = offsetX;
        const centerY = offsetY;

        // 应用缩放（使用 zrender 变换）
        this.applyZoom(clampedScale, centerX, centerY);

        // 触发回调
        if (this.options.onZoom) {
            this.options.onZoom({
                scale: clampedScale,
                centerX: offsetX,
                centerY: offsetY
            });
        }

        this.state.lastScale = clampedScale;
    }

    /**
     * 应用缩放变换
     */
    applyZoom(scale, centerX, centerY) {
        // 使用 zrender 的 group 变换
        const group = this.renderer.mainGroup;

        // 计算平移量（保持缩放中心点不变）
        const currentScale = group.scale[0] || 1;
        const scaleChange = scale / currentScale;

        const newPosX = centerX - (centerX - group.position[0]) * scaleChange;
        const newPosY = centerY - (centerY - group.position[1]) * scaleChange;

        group.attr({
            position: [newPosX, newPosY],
            scale: [scale, scale]
        });

        this.renderer.zr.flush();
    }

    /**
     * 重置缩放
     */
    reset() {
        const group = this.renderer.mainGroup;
        group.attr({
            position: [0, 0],
            scale: [1, 1]
        });

        this.state.lastScale = 1;

        // 使用动画过渡
        if (this.options.animateReset !== false) {
            group.animateTo({
                position: [0, 0],
                scale: [1, 1]
            }, 300, 'cubicOut');
        }

        this.renderer.zr.flush();

        if (this.options.onReset) {
            this.options.onReset();
        }
    }
}

module.exports = ZoomHandler;
```

#### 步骤 3.3：平移功能实现

```javascript
// interaction/PanHandler.js

/**
 * 平移处理器
 */
class PanHandler {
    constructor(renderer, options) {
        this.renderer = renderer;
        this.options = options || {};
        this.state = {
            isDragging: false,
            startPos: null,
            lastPos: null
        };

        this.bindEvents();
    }

    /**
     * 绑定平移事件
     */
    bindEvents() {
        const zr = this.renderer.zr;

        // 鼠标按下
        zr.on('mousedown', (e) => {
            if (this.options.enableDrag !== false && e.target === zr) {
                this.startDrag(e);
            }
        });

        // 鼠标移动
        zr.on('mousemove', (e) => {
            if (this.state.isDragging) {
                this.drag(e);
            }
        });

        // 鼠标释放
        zr.on('mouseup', () => {
            this.endDrag();
        });

        zr.on('globalout', () => {
            this.endDrag();
        });
    }

    /**
     * 开始拖拽
     */
    startDrag(e) {
        this.state.isDragging = true;
        this.state.startPos = [e.offsetX, e.offsetY];
        this.state.lastPos = [e.offsetX, e.offsetY];

        // 改变光标
        this.renderer.zr.setCursor('grabbing');

        if (this.options.onPanStart) {
            this.options.onPanStart(e);
        }
    }

    /**
     * 拖拽中
     */
    drag(e) {
        if (!this.state.isDragging) return;

        const dx = e.offsetX - this.state.lastPos[0];
        const dy = e.offsetY - this.state.lastPos[1];

        // 更新 group 位置
        const group = this.renderer.mainGroup;
        const currentPos = group.position;

        group.attr({
            position: [currentPos[0] + dx, currentPos[1] + dy]
        });

        this.state.lastPos = [e.offsetX, e.offsetY];
        this.renderer.zr.flush();

        if (this.options.onPan) {
            this.options.onPan({
                dx: dx,
                dy: dy,
                totalDx: e.offsetX - this.state.startPos[0],
                totalDy: e.offsetY - this.state.startPos[1]
            });
        }
    }

    /**
     * 结束拖拽
     */
    endDrag() {
        if (this.state.isDragging) {
            this.state.isDragging = false;
            this.renderer.zr.setCursor('default');

            if (this.options.onPanEnd) {
                this.options.onPanEnd();
            }
        }
    }

    /**
     * 程序化平移
     */
    panTo(dx, dy, animate = false) {
        const group = this.renderer.mainGroup;
        const currentPos = group.position;
        const newPos = [currentPos[0] + dx, currentPos[1] + dy];

        if (animate) {
            group.animateTo({
                position: newPos
            }, 300, 'cubicOut');
        } else {
            group.attr({
                position: newPos
            });
        }

        this.renderer.zr.flush();
    }
}

module.exports = PanHandler;
```

#### 步骤 3.4：集成所有交互处理器

```javascript
// renderers/zrender/index.js (整合)

const HoverHandler = require('../interaction/HoverHandler');
const ZoomHandler = require('../interaction/ZoomHandler');
const PanHandler = require('../interaction/PanHandler');

/**
 * 初始化交互系统
 */
ZRenderContourRenderer.prototype.initInteraction = function() {
    // 悬停处理
    if (this.options.interaction?.hover !== false) {
        this.hoverHandler = new HoverHandler(this, this.options.interaction?.hover);
    }

    // 缩放处理
    if (this.options.interaction?.zoom !== false) {
        this.zoomHandler = new ZoomHandler(this, this.options.interaction?.zoom);
    }

    // 平移处理
    if (this.options.interaction?.pan !== false) {
        this.panHandler = new PanHandler(this, this.options.interaction?.pan);
    }

    // 双击重置
    this.zr.on('dblclick', () => {
        if (this.options.interaction?.dblclickReset !== false) {
            this.resetView();
        }
    });
};

/**
 * 重置视图
 */
ZRenderContourRenderer.prototype.resetView = function() {
    if (this.zoomHandler) {
        this.zoomHandler.reset();
    }
    if (this.panHandler) {
        const group = this.mainGroup;
        group.attr({
            position: [0, 0]
        });
    }
    this.zr.flush();
};

/**
 * 绑定等值线事件
 */
ZRenderContourRenderer.prototype.attachContourEvents = function(elements) {
    if (this.hoverHandler) {
        this.hoverHandler.attach(elements);
    }
};
```

### 阶段 4：API 层集成（第 3 周）

#### 修改 api.js 支持 zrender

```javascript
// api.js (修改)

var compute = require('./compute');
var canvasRenderer = require('./renderers/canvas');
var zrenderRenderer = require('./renderers/zrender');

/**
 * 渲染等值线（支持 zrender）
 */
function render(canvas, config) {
    // ... 前面的代码保持不变 ...

    // 计算等值线
    var result = compute.computeContours(grid, options);

    // 根据配置选择渲染器
    var rendererMode = config.renderer || 'canvas';  // 'canvas' | 'svg' | 'zrender'

    if (rendererMode === 'zrender') {
        // 使用 zrender 渲染器
        return renderWithZrender(canvas, result, config);
    } else {
        // 使用原生渲染器（向后兼容）
        return renderWithNative(canvas, result, config);
    }
}

/**
 * 使用 zrender 渲染
 */
function renderWithZrender(container, result, config) {
    var ZRenderRenderer = zrenderRenderer.ZRenderRenderer;

    var renderer = new ZRenderRenderer(container, {
        renderer: config.zrenderRenderer || 'canvas',  // zrender 内部模式
        width: config.width,
        height: config.height,
        devicePixelRatio: config.devicePixelRatio,
        interaction: config.interaction
    });

    // 构建样式
    var colors = getColors(config.colorscale, result.levels, config.zmin, config.zmax, config.reversescale);
    var colorScale = buildColorScale(result.levels, colors);
    var valueColorMap = config.valueColorMap;

    var style = {
        width: config.width || 600,
        height: config.height || 500,
        x: config.x,
        y: config.y,
        z: config.z,
        coloring: (config.contours && config.contours.type) || 'fill',
        showLines: config.contours?.type === 'lines' || config.contours?.type === 'heatmap',
        lineWidth: config.lineWidth || 1.5,
        lineColor: config.lineColor || '#666',
        colorScale: colorScale,
        valueColorMap: valueColorMap,
        opacity: config.opacity || 1
    };

    // 渲染等值线
    renderer.renderContours(result, style);

    // 渲染标注
    if (config.contours?.showlabels && result.labels) {
        renderer.renderLabels(result.labels, style);
    }

    // 渲染坐标轴
    if (config.axes) {
        renderer.renderAxes(config.axes, style);
    }

    // 渲染色条
    if (config.colorbar?.show !== false && style.coloring !== 'lines') {
        renderer.renderColorbar(result, colors, config.colorbar);
    }

    // 初始化交互
    renderer.initInteraction();

    return {
        renderer: renderer,
        result: result,
        // 暴露控制方法
        api: {
            // 更新数据
            update: function(newConfig) {
                return render(container, Object.assign({}, config, newConfig));
            },
            // 重置视图
            resetView: function() {
                renderer.resetView();
            },
            // 获取当前状态
            getState: function() {
                return renderer.getState();
            },
            // 销毁
            destroy: function() {
                renderer.dispose();
            },
            // 事件绑定
            on: function(event, handler) {
                renderer.on(event, handler);
            },
            off: function(event, handler) {
                renderer.off(event, handler);
            }
        }
    };
}

/**
 * 使用原生渲染器（保持向后兼容）
 */
function renderWithNative(canvas, result, config) {
    // 原有代码
    var ctx = canvas.getContext('2d');
    // ... 原有实现 ...

    return result;
}

// 导出
module.exports = {
    render: render,
    drawTo: drawTo,
    COLOR_SCALES: COLOR_SCALES,
    // 新增：创建 zrender 实例的快捷方法
    createInteractive: function(container, config) {
        return render(container, Object.assign({}, config, { renderer: 'zrender' }));
    }
};
```

---

## 代码示例

### 完整使用示例

```html
<!DOCTYPE html>
<html>
<head>
    <title>contour-core with zrender</title>
    <style>
        #container {
            width: 800px;
            height: 600px;
            border: 1px solid #ccc;
        }
    </style>
</head>
<body>
    <div id="container"></div>

    <script src="dist/contour-core.js"></script>
    <script>
        // 生成测试数据
        const size = 50;
        const grid = [];
        for (let i = 0; i < size; i++) {
            grid[i] = [];
            for (let j = 0; j < size; j++) {
                const x = (i - size/2) / 10;
                const y = (j - size/2) / 10;
                grid[i][j] = Math.sin(x) * Math.cos(y) * 10 + 20;
            }
        }

        // 创建交互式等值线图
        const chart = contourCore.createInteractive('#container', {
            // 数据
            z: grid,

            // 等值线配置
            contours: {
                type: 'fill',      // 'fill' | 'lines' | 'heatmap'
                showlabels: true
            },
            ncontours: 15,
            smoothing: 0.5,

            // 颜色配置
            colorscale: 'Viridis',

            // 交互配置
            interaction: {
                hover: {
                    tooltip: true,
                    highlightLine: true
                },
                zoom: {
                    wheel: true,
                    minScale: 0.5,
                    maxScale: 5
                },
                pan: {
                    drag: true
                },
                dblclickReset: true
            },

            // 坐标轴
            axes: {
                x: { show: true, title: 'X Axis' },
                y: { show: true, title: 'Y Axis' }
            },

            // 色条
            colorbar: {
                show: true,
                title: 'Value'
            }
        });

        // 监听事件
        chart.api.on('hover', (data) => {
            console.log('Hovering at level:', data.level);
        });

        chart.api.on('click', (data) => {
            console.log('Clicked at level:', data.level);
        });

        chart.api.on('zoom', (data) => {
            console.log('Zoomed to scale:', data.scale);
        });
    </script>
</body>
</html>
```

### 程序化控制示例

```javascript
// 获取图表实例
const chart = contourCore.createInteractive('#container', config);

// 重置视图
chart.api.resetView();

// 手动触发缩放
chart.api.zoomTo(2, {  // scale: 2
    centerX: 400,
    centerY: 300,
    animate: true
});

// 手动触发平移
chart.api.panTo(50, 30, true);  // dx: 50, dy: 30, with animation

// 更新数据
chart.api.update({
    z: newGridData
});

// 销毁实例
chart.api.destroy();
```

---

## API 迁移指南

### 从原生 Canvas 迁移到 zrender

#### 变更对比

| 原生 Canvas API | zrender API | 说明 |
|-----------------|-------------|------|
| `ctx.beginPath()` | `new zrender.Path()` | 创建路径对象 |
| `ctx.moveTo(x,y)` | `shape: { pathData: 'M... }` | 使用 SVG 路径数据 |
| `ctx.fillStyle = color` | `style: { fill: color }` | 设置样式 |
| `canvas.addEventListener()` | `element.on(event, handler)` | 事件绑定 |

#### 渐进式迁移策略

```javascript
// 阶段 1：保留原有 API，内部使用 zrender
function render(canvas, config) {
    if (config.useZrender) {
        return renderWithZrender(canvas, config);
    } else {
        return renderWithNative(canvas, config);
    }
}

// 阶段 2：默认使用 zrender，保留 fallback
function render(canvas, config) {
    config.renderer = config.renderer || 'zrender';  // 默认 zrender

    if (config.renderer === 'zrender') {
        return renderWithZrender(canvas, config);
    } else {
        console.warn('Native renderer is deprecated, consider using zrender');
        return renderWithNative(canvas, config);
    }
}

// 阶段 3：完全迁移到 zrender
// 移除原生渲染器代码
```

---

## 测试验证

### 功能测试清单

```javascript
// tests/zrender-renderer.test.js

describe('ZRender Contour Renderer', () => {
    let container, chart;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (chart) chart.api.destroy();
        document.body.removeChild(container);
    });

    test('should render contours', () => {
        chart = contourCore.createInteractive(container, {
            z: testGrid,
            contours: { type: 'fill' }
        });

        const paths = chart.renderer.layers.fails.children();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('should handle hover events', () => {
        let hoveredLevel = null;
        chart = contourCore.createInteractive(container, {
            z: testGrid,
            interaction: { hover: true }
        });

        chart.api.on('hover', (data) => {
            hoveredLevel = data.level;
        });

        // 模拟悬停事件
        // ...

        expect(hoveredLevel).not.toBeNull();
    });

    test('should handle zoom', () => {
        let zoomed = false;
        chart = contourCore.createInteractive(container, {
            z: testGrid,
            interaction: { zoom: { wheel: true } }
        });

        chart.api.on('zoom', () => { zoomed = true; });

        // 模拟滚轮事件
        // ...

        expect(zoomed).toBe(true);
    });

    test('should handle pan', () => {
        let panned = false;
        chart = contourCore.createInteractive(container, {
            z: testGrid,
            interaction: { pan: { drag: true } }
        });

        chart.api.on('pan', () => { panned = true; });

        // 模拟拖拽
        // ...

        expect(panned).toBe(true);
    });

    test('should reset view on double click', () => {
        chart = contourCore.createInteractive(container, {
            z: testGrid,
            interaction: { dblclickReset: true }
        });

        // 先缩放
        chart.renderer.mainGroup.scale = [2, 2];

        // 双击
        // ...

        // 验证重置
        expect(chart.renderer.mainGroup.scale).toEqual([1, 1]);
    });
});
```

### 性能对比测试

```javascript
// benchmarks/rendering-benchmark.js

const Benchmark = require('benchmark');
const suite = new Benchmark.Suite();

const testGrid = generateLargeGrid(200, 200);

suite
    .add('Native Canvas', () => {
        contourCore.render(canvas, {
            z: testGrid,
            renderer: 'canvas'
        });
    })
    .add('zrender Canvas', () => {
        contourCore.render(container, {
            z: testGrid,
            renderer: 'zrender',
            zrenderRenderer: 'canvas'
        });
    })
    .add('zrender SVG', () => {
        contourCore.render(container, {
            z: testGrid,
            renderer: 'zrender',
            zrenderRenderer: 'svg'
        });
    })
    .on('cycle', (event) => {
        console.log(String(event.target));
    })
    .on('complete', function() {
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run({ async: true });
```

---

## 未来扩展

### WebGL 支持（通过 echarts-gl）

```javascript
// 未来扩展：WebGL 渲染器

function createRenderer(container, data, options) {
    const pointCount = data.z.length * data.z[0].length;

    // 根据数据规模选择渲染器
    if (options.forceWebGL || (pointCount > 10000 && hasWebGLSupport())) {
        return new WebGLRenderer(container, options);  // 基于 echarts-gl
    }

    // 默认使用 zrender
    return new ZRenderRenderer(container, options);
}

class WebGLRenderer {
    constructor(container, options) {
        // 使用 echarts-gl
        this.chart = echarts.init(container, null, { renderer: 'canvas' });
    }

    render(result, style) {
        const option = {
            visualMap: {
                min: result.levels[0],
                max: result.levels[result.levels.length - 1],
                inRange: { color: style.colors }
            },
            xAxis3D: { type: 'value' },
            yAxis3D: { type: 'value' },
            grid3D: { viewControl: { autoRotate: false } },
            series: [{
                type: 'surface',
                data: this.convertToSurfaceData(result),
                shading: 'color'
            }]
        };

        this.chart.setOption(option);
    }
}
```

### 高级功能扩展

```javascript
// 1. 框选缩放
class BoxSelectHandler {
    startBoxSelect(e) {
        this.selectionBox = new zrender.Rect({
            shape: {
                x: e.offsetX,
                y: e.offsetY,
                width: 0,
                height: 0
            },
            style: {
                fill: 'rgba(0, 100, 255, 0.1)',
                stroke: '#0064ff',
                lineWidth: 1
            },
            zlevel: 'overlay'
        });
        this.renderer.layers.overlay.add(this.selectionBox);
    }

    updateBoxSelect(e) {
        if (this.selectionBox) {
            const start = this.selectionBox.shape;
            this.selectionBox.attr({
                shape: {
                    width: e.offsetX - start.x,
                    height: e.offsetY - start.y
                }
            });
        }
    }

    endBoxSelect(e) {
        if (this.selectionBox) {
            // 计算框选范围并缩放
            const box = this.selectionBox.shape;
            this.zoomTo(box.x, box.y, box.x + box.width, box.y + box.height);

            this.renderer.layers.overlay.remove(this.selectionBox);
            this.selectionBox = null;
        }
    }
}

// 2. 动画过渡
function animateViewTransition(from, to, duration) {
    this.renderer.mainGroup.animateTo({
        position: [to.x, to.y],
        scale: [to.scale, to.scale]
    }, duration, 'cubicOut');
}

// 3. 状态持久化
function saveState() {
    return {
        position: this.renderer.mainGroup.position,
        scale: this.renderer.mainGroup.scale,
        rotation: this.renderer.mainGroup.rotation
    };
}

function restoreState(state) {
    this.renderer.mainGroup.attr({
        position: state.position,
        scale: state.scale,
        rotation: state.rotation
    });
}
```

---

## 总结

### 实施路线图

```
Week 1: 基础设施
  □ 安装 zrender 依赖
  □ 创建 zrender 渲染器模块结构
  □ 实现路径数据转换
  □ 基础渲染（等值线）

Week 2: 完善渲染
  □ 坐标轴绘制
  □ 标注绘制
  □ 色条绘制
  □ 样式适配

Week 3: 事件系统
  □ 悬停高亮
  □ 滚轮缩放
  □ 拖拽平移
  □ 双击重置

Week 4: 集成与测试
  □ API 层集成
  □ 向后兼容
  □ 功能测试
  □ 性能优化
```

### 关键收益

| 方面 | 原生实现 | zrender 实现 |
|------|----------|--------------|
| 开发时间 | 4-6 周 | 3-4 周 |
| 代码量 | ~2000 行 | ~1000 行 |
| 事件系统 | 手动实现 | 开箱即用 |
| 维护成本 | 高 | 低（社区维护） |
| 性能 | 需优化 | 内置分层优化 |
| 动画 | 手动实现 | 内置动画 |
| WebGL 扩展 | 困难 | echarts-gl 集成 |

### 下一步行动

1. **创建 POC**：实现最小可用的 zrender 渲染 demo
2. **性能验证**：与现有 Canvas 渲染器对比
3. **API 设计**：确定最终的 API 接口
4. **全面迁移**：按阶段替换现有渲染器
