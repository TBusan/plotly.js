# 使用 zrender 的可行性分析

## 目录
1. [背景](#背景)
2. [zrender 概述](#zrender-概述)
3. [技术可行性分析](#技术可行性分析)
4. [架构集成方案](#架构集成方案)
5. [WebGL 扩展路径](#webgl-扩展路径)
6. [实施计划](#实施计划)
7. [风险评估](#风险评估)
8. [总结与建议](#总结与建议)

---

## 背景

### 当前状态

contour-core 目前实现了：

| 模块 | 状态 | 说明 |
|------|------|------|
| 计算层 | ✅ 完成 | 等值线计算、标注、坐标轴 |
| Canvas 渲染 | ✅ 完成 | 2D Canvas 绘制 |
| SVG 渲染 | ✅ 完成 | SVG 字符串生成 |
| 交互功能 | ❌ 缺失 | 无事件处理 |
| WebGL 渲染 | ❌ 缺失 | 未来需求 |

### 面临的挑战

1. **事件系统复杂**：需要自己实现完整的鼠标/触摸事件处理
2. **渲染器维护成本高**：Canvas 和 SVG 需要分别维护两套代码
3. **WebGL 扩展难度大**：从零实现 WebGL 渲染器工作量巨大

---

## zrender 概述

### 什么是 zrender

[zrender](https://github.com/ecomfe/zrender) 是 Apache ECharts 的**核心渲染引擎**，由百度 EFE 团队开发维护。

### 核心特性

#### 1. 多渲染模式统一 API

```javascript
// 统一的 API，支持多种渲染模式
const zr = zrender.init(dom, {
    renderer: 'canvas'  // 'canvas' | 'svg' | 'vml'
});
```

#### 2. 丰富的事件系统

```javascript
// 元素级事件绑定
element.on('click', (e) => { ... });
element.on('mousemove', (e) => { ... });
element.on('mouseover', (e) => { ... });

// 实例级事件
zr.on('click', (e) => { ... });
zr.on('mousewheel', (e) => { ... });
```

#### 3. 内置动画支持

```javascript
// 简洁的动画 API
element.animateTo({
    shape: { r: 50 },
    style: { fill: 'red' }
}, 300, 'cubicOut');
```

#### 4. 图形元素库

zrender 提供了将近 20 种内置图形类型：

- 基础图形：Circle, Rect, Line, Polygon, Path
- 复杂图形：BezierCurve, Ellipse, Sector, Star
- 扩展能力：通过 `Path.extend` 自定义图形

#### 5. 分层渲染优化

```javascript
// 通过 zlevel 控制 Canvas 分层
// 适合有动画的元素，避免全量重绘
element.zlevel = 1;
```

### ECharts-GL：WebGL 扩展

[ECharts-GL](https://github.com/ecomfe/echarts-gl) 是 ECharts 的 WebGL 扩展包，提供了：

- 3D 绘图能力（scatter3D, bar3D, surface 等）
- WebGL 加速的大数据渲染
- 地球可视化

**关键发现**：ECharts 使用 zrender 作为 2D 渲染引擎，使用 echarts-gl 作为 3D/WebGL 扩展，两者可以**无缝协作**。

---

## 技术可行性分析

### 1. 与 contour-core 的兼容性

#### 计算层复用

| contour-core 模块 | zrender 对应 | 复用可行性 |
|------------------|--------------|-----------|
| compute.js | - | ✅ 完全复用 |
| labels/ | - | ✅ 完全复用 |
| axes/ | - | ✅ 完全复用 |
| pathfinding.js | Path 元素 | ✅ 直接映射 |
| colorbar/ | 自定义元素 | ✅ 可实现 |

#### 数据转换

```javascript
// contour-core 的路径数据 → zrender Path 元素
function pathToZRender(pathData) {
    return new zrender.Path({
        shape: { pathData: pathData },
        style: { fill: ..., stroke: ... },
        zlevel: 0,
        z: 0
    });
}
```

### 2. 事件系统对比

| 功能 | contour-core（需要实现） | zrender（已有） |
|------|--------------------------|-----------------|
| 鼠标事件 | ❌ 需要实现 | ✅ 内置 |
| 触摸事件 | ❌ 需要实现 | ✅ 内置 |
| 悬停检测 | ❌ 需要碰撞检测 | ✅ 自动 |
| 拖拽 | ❌ 需要实现 | ✅ `draggable: true` |
| 元素高亮 | ❌ 需要实现 | ✅ `hoverStyle` |

### 3. 渲染器功能对比

| 功能 | 自建 Canvas/SVG | zrender |
|------|----------------|---------|
| 基础渲染 | ✅ | ✅ |
| 高性能渲染 | ⚠️ 需要优化 | ✅ 分层渲染 |
| 事件处理 | ❌ 需要实现 | ✅ 完整系统 |
| 动画支持 | ❌ 需要实现 | ✅ 内置动画 |
| Canvas/SVG 切换 | ⚠️ 两套代码 | ✅ 统一 API |
| HiDPI 支持 | ⚠️ 需要处理 | ✅ 自动处理 |

---

## 架构集成方案

### 方案 A：zrender 作为主要渲染引擎（推荐）

#### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      contour-core API                        │
│                   (统一对外接口)                             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   zrender Integration Layer                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │数据转换器     │  │样式适配器     │  │事件桥接器           │  │
│  │Data Converter│  │Style Adapter │  │Event Bridge         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       zrender Engine                          │
│  ┌──────────────┐           ┌──────────────┐               │
│  │Canvas Mode   │           │SVG Mode      │               │
│  │(默认)        │           │(可选)        │               │
│  └──────────────┘           └──────────────┘               │
│                                                               │
│  事件系统：click, mousemove, mousewheel, drag, etc.          │
│  动画系统：animateTo, animate, etc.                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Future: echarts-gl                        │
│                  (WebGL Extension)                            │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  WebGL Renderer (大数据集、3D 可视化)              │     │
│  └──────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

#### 实现代码示例

```javascript
// renderers/zrender/index.js
const zrender = require('zrender');
const compute = require('../../compute');

class ZRenderContourRenderer {
    constructor(container, options) {
        this.zr = zrender.init(container, {
            renderer: options.renderer || 'canvas',  // 'canvas' | 'svg'
            devicePixelRatio: options.devicePixelRatio || window.devicePixelRatio
        });

        this.group = new zrender.Group();
        this.zr.add(this.group);
    }

    render(contourResult, style) {
        // 清除旧元素
        this.group.removeAll();

        // 绘制填充多边形
        contourResult.smoothedPaths.forEach((pathData, index) => {
            const level = contourResult.levels[index];
            const color = this.getColor(level, style.colorScale);

            const polygon = new zrender.Path({
                shape: { pathData: pathData },
                style: {
                    fill: color,
                    stroke: null,
                    opacity: style.fillOpacity || 0.8
                },
                // zrender 事件绑定
                clickable: true,
                _contourLevel: level  // 自定义数据
            });

            // 绑定事件
            polygon.on('click', (e) => {
                this.handleClick(e.target._contourLevel);
            });

            polygon.on('mouseover', (e) => {
                this.handleHover(e.target._contourLevel, e);
            });

            this.group.add(polygon);
        });

        // 绘制等值线
        if (style.showLines) {
            // ... 类似逻辑
        }

        // 刷新
        this.zr.flush();
    }

    updateStyle(newStyle) {
        // 使用 zrender 的属性更新 API
        this.group.traverse((el) => {
            if (el.type === 'path') {
                el.attr({
                    style: newStyle
                });
            }
        });
    }

    // 缩放/平移（使用 zrender 变换）
    setTransform(transform) {
        this.group.attr({
            position: [transform.x, transform.y],
            scale: [transform.scale, transform.scale],
            rotation: transform.rotation || 0
        });
    }

    dispose() {
        this.zr.dispose();
    }
}

module.exports = ZRenderContourRenderer;
```

### 方案 B：混合模式（保留现有渲染器）

```
用户选择渲染器：
  - zrender（推荐，带交互）
  - 原生 Canvas（轻量，无交互）
  - 原生 SVG（导出友好，无交互）
  - 未来 WebGL（高性能）
```

---

## WebGL 扩展路径

### 路径 1：ECharts-GL 集成（推荐）

#### 优势

1. **成熟稳定**：ECharts-GL 已被广泛使用
2. **API 一致**：与 zrender 共享相同的设计理念
3. **渐进式**：可以根据数据规模动态切换

#### 实现方案

```javascript
// renderer 选择器
function createRenderer(container, data, options) {
    const pointCount = data.z.length * data.z[0].length;

    // 大数据集使用 WebGL
    if (pointCount > 10000 && hasWebGLSupport()) {
        return new WebGLRenderer(container, options);  // 基于 echarts-gl
    }

    // 默认使用 zrender
    return new ZRenderRenderer(container, options);
}
```

#### WebGL 渲染器实现（基于 echarts-gl）

```javascript
// renderers/webgl/index.js
const echarts = require('echarts');
const echartsGL = require('echarts-gl');

class WebGLContourRenderer {
    constructor(container, options) {
        this.chart = echarts.init(container, null, {
            renderer: 'canvas'  // echarts-gl 底层使用 WebGL
        });
    }

    render(contourResult, style) {
        // 将等值线转换为 echarts-gl 的 series 类型
        const option = {
            visualMap: {
                min: contourResult.levels[0],
                max: contourResult.levels[contourResult.levels.length - 1],
                inRange: {
                    color: style.colorScale.map(c => c[1])
                }
            },
            xAxis3D: { type: 'value' },
            yAxis3D: { type: 'value' },
            zAxis3D: { type: 'value' },
            grid3D: { viewControl: { autoRotate: false } },
            series: [{
                type: 'surface',
                wireframe: {
                    show: style.showLines
                },
                data: this.convertToSurfaceData(contourResult),
                shading: 'color'
            }]
        };

        this.chart.setOption(option);
    }
}
```

### 路径 2：原生 WebGL + regl

如果 echarts-gl 不能满足需求，可以考虑使用 [regl](https://github.com/regl-project/regl)：

```javascript
// renderers/webgl-regl/index.js
const createRegl = require('regl');

class ReglWebGLRenderer {
    constructor(container, options) {
        this.regl = createRegl(container);
        this.initShaders();
    }

    render(contourResult, style) {
        const drawContours = this.regl({
            vert: this.vertexShader,
            frag: this.fragmentShader,
            attributes: {
                position: this.convertToVertices(contourResult)
            },
            uniforms: {
                transform: this.getTransform(),
                color: style.color
            }
        });

        this.regl.frame(() => {
            this.regl.clear({ color: [1, 1, 1, 1] });
            drawContours();
        });
    }
}
```

---

## 实施计划

### 阶段 1：zrender 集成（2-3 周）

#### Week 1：基础设施

```
□ 安装 zrender 依赖
  npm install zrender

□ 创建 zrender 渲染器模块
  renderers/zrender/
    ├── index.js
    ├── paths.js
    ├── labels.js
    ├── axes.js
    └── interaction.js

□ 实现数据转换器
  - contour-core 路径 → zrender Path
  - 标注数据 → zrender Text
  - 坐标轴 → zrender 组件
```

#### Week 2：基础渲染

```
□ 实现 Canvas 模式渲染
  - 等值线绘制
  - 填充区域
  - 标注显示
  - 坐标轴

□ 实现渲染器切换
  - Canvas ↔ SVG 切换
  - 保留用户配置
```

#### Week 3：事件系统

```
□ 基础事件
  - click
  - mouseover/mouseout
  - mousemove

□ 交互功能
  - 悬停提示
  - 元素高亮
  - 拖拽（可选）
```

### 阶段 2：高级交互（1-2 周）

```
□ 缩放功能
  - 滚轮缩放
  - 框选缩放

□ 平移功能
  - 拖拽平移
  - 边界约束

□ 动画支持
  - 过渡动画
  - 使用 zrender.animateTo()
```

### 阶段 3：WebGL 扩展（2-3 周）

```
□ echarts-gl 集成评估
  - 性能测试
  - 功能对比
  - API 兼容性

□ WebGL 渲染器实现
  - 基础渲染
  - 大数据处理
  - 性能优化

□ 渲染器自动选择
  - 数据规模检测
  - 设备能力检测
  - 运行时切换
```

---

## 风险评估

### 技术风险

| 风险 | 级别 | 缓解措施 |
|------|------|---------|
| zrender API 变更 | 低 | 使用稳定版本，关注 changelog |
| echarts-gl 兼容性 | 中 | 充分测试，准备 fallback |
| WebGL 性能不如预期 | 中 | 分阶段优化，性能基准测试 |
| 包体积增加 | 低 | 按需加载，tree-shaking |

### 依赖风险

| 库 | 版本 | 维护状态 | 风险 |
|---|------|---------|------|
| zrender | 5.x+ | ✅ 活跃维护 | 低 |
| echarts-gl | 2.x+ | ⚠️ 更新较慢 | 中 |

### 兼容性风险

```
✅ 优势：
  - zrender 支持 IE9+
  - 移动端触摸支持完善
  - Canvas/SVG 自动降级

⚠️ 注意：
  - WebGL 需要检测支持
  - 旧设备性能可能不足
```

---

## 总结与建议

### 核心结论

**使用 zrender 是高度可行的**，主要理由：

1. ✅ **大幅降低开发成本**
   - 事件系统开箱即用
   - Canvas/SVG 统一 API
   - 动画系统内置

2. ✅ **与 WebGL 扩展路径清晰**
   - ECharts-GL 提供成熟方案
   - 生态完整，案例丰富

3. ✅ **减少长期维护成本**
   - 活跃的社区支持
   - 定期更新和 bug 修复

### 推荐方案

```
优先级 1（立即执行）：使用 zrender 替换现有 Canvas/SVG 渲染器
  - 时间：3-4 周
  - 收益：完整的交互能力，统一代码库

优先级 2（中期）：添加高级交互功能
  - 缩放、平移、框选
  - 时间：1-2 周
  - 收益：与 Plotly 对等的交互体验

优先级 3（长期）：WebGL 支持
  - 评估 echarts-gl
  - 实现高性能渲染器
  - 时间：2-3 周
  - 收益：大数据集性能提升
```

### API 设计建议

```javascript
// 用户友好的 API
const chart = contourCore.create('#container', {
    // 渲染器选择
    renderer: 'auto',  // 'auto' | 'zrender' | 'webgl'

    // zrender 特定配置
    zrender: {
        mode: 'canvas',  // 'canvas' | 'svg'
        enableInteraction: true,
        animation: true
    },

    // WebGL 特定配置（未来）
    webgl: {
        enable: 'auto',  // 'auto' | true | false
        threshold: 10000,  // 数据点阈值
        fallbackToZrender: true
    }
});

// 动态切换
chart.setRenderer('webgl');
```

### 下一步行动

1. **创建 POC**：用 zrender 重写一个简单的 contour demo
2. **性能对比**：与现有 Canvas 渲染器对比
3. **决策评估**：根据 POC 结果决定是否全面迁移

---

## 参考资料

### 官方文档

- [zrender 官方文档](https://ecomfe.github.io/zrender-doc/public/)
- [zrender GitHub](https://github.com/ecomfe/zrender)
- [ECharts-GL 文档](https://echarts.apache.org/gl/)
- [ECharts-GL GitHub](https://github.com/ecomfe/echarts-gl)

### 相关资源

- [Apache ECharts 官网](https://echarts.apache.org/)
- [regl - 函数式 WebGL](https://github.com/regl-project/regl)
- [Plotly.js 交互分析](./等值线交互机制详解.md)
- [WebGL 扩展需求](./等值线事件需求分析包括webgl.md)
