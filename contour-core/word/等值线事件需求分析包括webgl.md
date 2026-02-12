# contour-core 等值线事件需求分析（含 WebGL 支持）

## 目录
1. [背景与目标](#背景与目标)
2. [当前状态分析](#当前状态分析)
3. [渲染器对比分析](#渲染器对比分析)
4. [功能需求定义](#功能需求定义)
5. [统一架构设计](#统一架构设计)
6. [WebGL 实现方案](#webgl-实现方案)
7. [第三方库选型](#第三方库选型)
8. [实现路线图](#实现路线图)
9. [API 设计](#api-设计)
10. [性能优化策略](#性能优化策略)

---

## 背景与目标

### 背景

Plotly.js 原生提供丰富的等值线交互功能，当前 `contour-core` 已实现：

| 模块 | 状态 | 说明 |
|------|------|------|
| 计算层 | ✅ 完成 | 从 grid 到 path 的完整计算 |
| Canvas 渲染 | ✅ 完成 | 2D Canvas 渲染器 |
| SVG 渲染 | ✅ 完成 | SVG 字符串生成和 DOM 操作 |
| 交互层 | ❌ 缺失 | 无任何交互功能 |
| WebGL 渲染 | ❌ 缺失 | 高性能渲染器待开发 |

### 目标

构建一个**统一的交互层架构**，同时支持：

1. **Canvas 渲染器** - 通用、兼容性好
2. **SVG 渲染器** - 矢量、打印友好
3. **WebGL 渲染器** - 高性能、适合大数据集
4. **统一的交互 API** - 跨渲染器一致的交互体验

---

## 当前状态分析

### contour-core 现有架构

```
contour-core/
├── compute.js              # 计算层（已完成）
├── api.js                  # 简化渲染 API
├── renderers/
│   ├── canvas/             # Canvas 渲染器
│   │   ├── index.js         # 主入口
│   │   ├── paths.js         # 路径绘制
│   │   ├── labels.js        # 标注绘制
│   │   ├── colorbar.js      # 颜色条
│   │   ├── heatmap.js       # 热力图
│   │   ├── nulls.js         # 空值处理
│   │   └── axes.js          # 坐标轴
│   └── svg/                 # SVG 渲染器
│       ├── index.js         # 主入口
│       ├── paths.js         # 路径生成
│       ├── labels.js        # 标注生成
│       ├── colorbar.js      # 颜色条
│       └── nulls.js         # 空值处理
├── labels/                 # 标注计算（独立）
├── axes/                   # 坐标轴计算（独立）
├── colorbar/               # 颜色条计算（独立）
└── null_handling/          # 空值处理（独立）
```

### 现有能力矩阵

| 模块 | Canvas | SVG | WebGL | 说明 |
|------|--------|-----|-------|------|
| 等值线计算 | ✅ | ✅ | 🔄 | 可复用 |
| 路径渲染 | ✅ | ✅ | ❌ | WebGL 待实现 |
| 填充渲染 | ✅ | ✅ | ❌ | WebGL 待实现 |
| 热力图 | ✅ | ❌ | 🔄 | WebGL 可加速 |
| 标注 | ✅ | ✅ | 🔄 | WebGL 需特殊处理 |
| 坐标轴 | ✅ | ❌ | 🔄 | WebGL 需实现 |
| 颜色条 | ✅ | ✅ | 🔄 | WebGL 可复用 Canvas |
| 空值处理 | ✅ | ✅ | 🔄 | WebGL 待实现 |
| 事件监听 | ❌ | ❌ | ❌ | 交互层待实现 |
| 坐标转换 | ⚠️ | ⚠️ | ❌ | 需统一 |

---

## 渲染器对比分析

### 性能对比

| 场景 | Canvas | SVG | WebGL |
|------|--------|-----|-------|
| 小数据集 (<1000 点) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 中等数据 (1000-10000) | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 大数据 (>10000) | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| 复杂路径 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 高频更新 | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

### 交互对比

| 功能 | Canvas | SVG | WebGL | 说明 |
|------|--------|-----|-------|------|
| 基本缩放平移 | 🔄 | 🔄 | 🔄 | 统一处理 |
| 悬停检测 | ⚠️ | ✅ | ⚠️ | SVG 天然支持 |
| 元素高亮 | ⚠️ | ✅ | 🔄 | WebGL 需特殊实现 |
| 文本渲染 | ✅ | ✅ | ⚠️ | WebGL 文本复杂 |
| 矢量导出 | ⚠️ | ✅ | ⚠️ | SVG 最优 |

### 适用场景建议

```
选择 Canvas：
  ✓ 中等数据集
  ✓ 需要打印/导出
  ✓ 浏览器兼容性优先

选择 SVG：
  ✓ 小数据集
  ✓ 需要精细样式控制
  ✓ 需要矢量编辑
  ✓ SEO/可访问性

选择 WebGL：
  ✓ 大数据集 (>10k 点)
  ✓ 复杂路径计算
  ✓ 实时更新 (>30fps)
  ✓ GPU 加速需求
```

---

## 功能需求定义

### 1. 核心交互功能

#### 1.1 缩放（Zoom）

```javascript
/**
 * 需求描述
 * - 滚轮缩放：以鼠标位置为中心的定点缩放
 * - 框选缩放：拖拽矩形区域进行缩放
 * - 轴向缩放：拖拽坐标轴端点进行单向缩放
 * - 缩放约束：支持比例锁定（等比缩放）
 *
 * 渲染器差异：
 * - Canvas/SVG: 使用 transform/viewBox
 * - WebGL: 使用 shader uniform 变换矩阵
 */

// 事件类型
interface ZoomEvents {
    wheel: (event: WheelEvent) => void;      // 滚轮缩放
    mousedown: (event: MouseEvent) => void;   // 开始框选/轴缩放
    mousemove: (event: MouseEvent) => void;   // 更新框选
    mouseup: (event: MouseEvent) => void;     // 完成缩放
}
```

#### 1.2 平移（Pan）

```javascript
/**
 * 需求描述
 * - 主区域平移：拖拽绘图区域移动视图
 * - 轴向平移：沿坐标轴方向平移
 * - 边界约束：限制平移范围在数据边界内
 * - 惯性平移（可选）：拖拽后的惯性效果
 *
 * 渲染器差异：
 * - Canvas/SVG: 使用 translate 变换
 * - WebGL: 更新视图矩阵 uniform
 */
```

#### 1.3 悬停提示（Hover）

```javascript
/**
 * 需求描述
 * - 数据点查询：鼠标位置对应的数据值
 * - 最近等值线：高亮最近的等值线
 * - 坐标显示：实时显示当前坐标
 *
 * 渲染器差异：
 * - SVG: 天然支持（DOM 事件）
 * - Canvas: 需要路径碰撞检测
 * - WebGL: 需要颜色拾取或 raycasting
 */
```

#### 1.4 双击重置（Reset）

```javascript
/**
 * 需求描述
 * - 恢复初始视图范围
 * - 可选动画过渡效果
 *
 * 渲染器差异：
 * - Canvas: 需要手动动画
 * - SVG: 可用 CSS transition
 * - WebGL: 需要手动插值动画
 */
```

### 2. WebGL 特有需求

#### 2.1 拾取系统（Picking）

```javascript
/**
 * WebGL 悬停检测需要特殊实现
 *
 * 方案 1: 颜色拾取 (Color Picking)
 * - 每个元素绘制唯一颜色到离屏 framebuffer
 * - 读取鼠标位置像素颜色
 * - 反查元素 ID
 *
 * 方案 2: GPU 拾取 (GPU Picking)
 * - 类似颜色拾取，但用多采样
 * - 更精确，但性能开销大
 *
 * 方案 3: 几何查询 (Raycasting)
 * - 数学计算鼠标射线与几何体交点
 * - CPU 计算，适合简单几何
 *
 * 推荐方案：颜色拾取（平衡性能和精度）
 */
```

#### 2.2 文本渲染

```javascript
/**
 * WebGL 文本渲染难点：
 * - 不能直接使用系统字体
 * - 需要使用纹理图集或 SDF
 *
 * 推荐方案：
 * 1. 使用 Canvas 2D 渲染文本为纹理
 * 2. 将纹理贴到 WebGL quad 上
 * 3. 或使用 SDF (Signed Distance Field) 字体
 */
```

#### 2.3 Shader 管理

```javascript
/**
 * WebGL 渲染需要 shader 系统
 *
 * 顶点着色器：处理位置变换
 * - 等值线路径
 * - 填充多边形
 * - 标注 quad
 *
 * 片元着色器：处理颜色和样式
 * - 颜色映射
 * - 抗锯齿
 * - 混合模式
 */
```

---

## 统一架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Layer                          │
│              (用户代码 / Demo / 第三方集成)                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      High-Level API (NEW)                          │
│                    createContourChart(options)                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Renderer Selector  (自动选择或指定渲染器)                   │  │
│  │  - Canvas: 默认，兼容性好                                     │  │
│  │  - SVG: 矢量导出、打印友好                                    │  │
│  │  - WebGL: 大数据、高性能                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Interaction Layer (NEW)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │EventManager  │  │StateManager  │  │CoordinateConverter   │     │
│  └──────────────┘  └──────────────┘  └──────────────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │Zoom Handler  │  │Pan Handler   │  │Hover Handler         │     │
│  └──────────────┘  └──────────────┘  └──────────────────────┘     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │             Renderer-Agnostic Event Processing             │     │
│  │  (渲染器无关的事件处理，生成统一的变换指令)                │     │
│  └────────────────────────────────────────────────────────────┘     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
    ┌───────────────┐ ┌──────────────┐ ┌───────────────┐
    │Canvas Renderer│ │SVG Renderer  │ │WebGL Renderer │
    │(已有 + 增强)   │ │(已有 + 增强)  │ │(NEW)          │
    ├───────────────┤ ├──────────────┤ ├───────────────┤
    │transform()    │ │viewBox       │ │uniform matrix  │
    │hitTest()      │ │DOM events    │ │picking buffer │
    │labels via ctx │ │SVG <text>    │ │text texture   │
    └───────────────┘ └──────────────┘ └───────────────┘
                └──────────────┬──────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Computation Layer                              │
│                    (compute.js - 已有)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐       │
│  │contour calc │  │label compute│  │color scale compute  │       │
│  └─────────────┘  └─────────────┘  └─────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

### 统一接口设计

```javascript
/**
 * 所有渲染器必须实现的接口
 */
interface IContourRenderer {
    // 初始化
    init(container: HTMLElement, options: RenderOptions): void;

    // 渲染等值线
    render(result: ContourResult, transform: Transform): void;

    // 应用变换（缩放/平移）
    setTransform(transform: Transform): void;

    // 悬停检测
    hitTest(x: number, y: number): HitTestResult | null;

    // 高亮元素
    highlight(element: string | null): void;

    // 更新标注
    updateLabels(labels: LabelData[]): void;

    // 清理资源
    destroy(): void;
}

/**
 * 统一的变换表示
 */
interface Transform {
    // 视图范围（数据坐标）
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;

    // 像素变换（用于 WebGL）
    translateX: number;
    translateY: number;
    scale: number;

    // 是否已变化（用于优化）
    dirty: boolean;
}
```

---

## WebGL 实现方案

### 架构设计

```
renderers/webgl/
├── index.js                 # 主入口，实现 IContourRenderer
├── core/
│   ├── context.js           # WebGL 上下文管理
│   ├── shader.js            # Shader 编译和管理
│   ├── program.js           # Program 链接和管理
│   └── buffer.js            # Buffer 数据管理
├── shaders/
│   ├── vertex.glsl          # 顶点着色器
│   ├── fragment.glsl        # 片元着色器
│   ├── line.vert           # 线条渲染着色器
│   ├── line.frag
│   ├── fill.vert           # 填充渲染着色器
│   └── fill.frag
├── objects/
│   ├── lines.js            # 等值线渲染
│   ├── fills.js            # 填充渲染
│   ├── heatmap.js          # 热力图渲染
│   └── labels.js           # 标注渲染
├── picking/
│   ├── color-picking.js    # 颜色拾取实现
│   └── picker.js           # 拾取器
└── utils/
    ├── text-texture.js     # 文本纹理生成
    └── mesh-builder.js     # 网格构建
```

### 核心实现

#### 1. WebGL 上下文管理

```javascript
/**
 * core/context.js
 * WebGL 上下文管理器
 */
class WebGLContext {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.gl = this.getContext(options);
        this.extensions = this.initExtensions();
        this.state = new WebGLState(this.gl);
    }

    getContext(options) {
        // 获取 WebGL2 上下文（首选）
        let gl = this.canvas.getContext('webgl2', options);

        // 回退到 WebGL1
        if (!gl) {
            gl = this.canvas.getContext('webgl', options) ||
                 this.canvas.getContext('experimental-webgl', options);
        }

        if (!gl) {
            throw new Error('WebGL not supported');
        }

        return gl;
    }

    initExtensions() {
        const gl = this.gl;
        return {
            // 浮点纹理（用于精确渲染）
            OES_texture_float: gl.getExtension('OES_texture_float'),
            OES_texture_float_linear: gl.getExtension('OES_texture_float_linear'),

            // 标准导数（用于法线计算）
            OES_standard_derivatives: gl.getExtension('OES_standard_derivatives'),

            // 融合混合（用于抗锯齿）
            EXT_blend_minmax: gl.getExtension('EXT_blend_minmax')
        };
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }
}

/**
 * WebGL 状态管理
 */
class WebGLState {
    constructor(gl) {
        this.gl = gl;
        this.currentProgram = null;
        this.currentBuffer = null;
        this.currentState = {};
    }

    useProgram(program) {
        if (this.currentProgram !== program) {
            this.gl.useProgram(program);
            this.currentProgram = program;
        }
    }

    bindBuffer(target, buffer) {
        const key = `${target}_buffer`;
        if (this.currentState[key] !== buffer) {
            this.gl.bindBuffer(target, buffer);
            this.currentState[key] = buffer;
        }
    }
}
```

#### 2. Shader 管理

```javascript
/**
 * core/shader.js
 * Shader 编译和管理
 */
class ShaderManager {
    constructor(gl) {
        this.gl = gl;
        this.shaders = new Map();
        this.programs = new Map();
    }

    // 编译着色器
    compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compile error: ${error}`);
        }

        return shader;
    }

    // 创建程序
    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        const vertexShader = this.compileShader(vertexSource, gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentSource, gl.FRAGMENT_SHADER);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Program link error: ${error}`);
        }

        // 清理着色器（已链接到程序）
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        return program;
    }

    // 获取 uniform 位置
    getUniforms(program, names) {
        const uniforms = {};
        const gl = this.gl;

        names.forEach(name => {
            uniforms[name] = gl.getUniformLocation(program, name);
        });

        return uniforms;
    }

    // 获取属性位置
    getAttributes(program, names) {
        const attributes = {};
        const gl = this.gl;

        names.forEach(name => {
            attributes[name] = gl.getAttribLocation(program, name);
        });

        return attributes;
    }
}
```

#### 3. 颜色拾取实现

```javascript
/**
 * picking/color-picking.js
 * 颜色拾取实现
 */
class ColorPicking {
    constructor(gl, width, height) {
        this.gl = gl;
        this.width = width;
        this.height = height;

        // 创建离屏 framebuffer
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

        // 创建纹理
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA,
            width, height, 0,
            gl.RGBA, gl.UNSIGNED_BYTE, null
        );
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D, this.texture, 0
        );

        // 创建深度缓冲
        this.depthBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
        gl.renderbufferStorage(
            gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
            width, height
        );
        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER, this.depthBuffer
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * 拾取指定位置的元素
     * @param {number} x - 鼠标 X 坐标
     * @param {number} y - 鼠标 Y 坐标
     * @param {Map} idMap - ID 到元素的映射
     * @returns {Object|null} 被拾取的元素
     */
    pick(x, y, idMap) {
        const gl = this.gl;

        // 读取像素（注意 WebGL 坐标系：原点在左下角）
        const pixels = new Uint8Array(4);
        gl.readPixels(
            x, this.height - y,
            1, 1,
            gl.RGBA, gl.UNSIGNED_BYTE, pixels
        );

        // 解析 ID（从 RGB）
        const id = (pixels[0] << 16) | (pixels[1] << 8) | pixels[2];

        // 白色 (255,255,255) 表示没有拾取到元素
        if (id === 0xFFFFFF) {
            return null;
        }

        return idMap.get(id) || null;
    }

    /**
     * 为元素生成拾取颜色
     * @param {number} id - 元素 ID
     * @returns {Array} RGB 颜色 [r, g, b]
     */
    idToColor(id) {
        return [
            (id >> 16) & 0xFF,
            (id >> 8) & 0xFF,
            id & 0xFF
        ];
    }

    destroy() {
        const gl = this.gl;
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.texture);
        gl.deleteRenderbuffer(this.depthBuffer);
    }
}
```

#### 4. 文本纹理生成

```javascript
/**
 * utils/text-texture.js
 * 使用 Canvas 2D 生成文本纹理
 */
class TextTextureGenerator {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.cache = new Map();
    }

    /**
     * 生成文本纹理
     * @param {string} text - 文本内容
     * @param {Object} options - 样式选项
     * @returns {Object} 纹理信息
     */
    generate(text, options = {}) {
        const cacheKey = JSON.stringify({ text, options });

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const {
            font = '12px Arial',
            color = '#000000',
            backgroundColor = 'rgba(255,255,255,0.8)',
            padding = 4
        } = options;

        // 设置字体以测量
        this.ctx.font = font;
        const metrics = this.ctx.measureText(text);

        // 计算尺寸
        const width = Math.ceil(metrics.width + padding * 2);
        const height = Math.ceil(parseFloat(font) + padding * 2);

        // 设置画布尺寸
        this.canvas.width = width;
        this.canvas.height = height;

        // 绘制背景
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, width, height);

        // 绘制文本
        this.ctx.font = font;
        this.ctx.fillStyle = color;
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(text, padding, padding);

        // 获取图像数据
        const imageData = this.ctx.getImageData(0, 0, width, height);

        const result = {
            width,
            height,
            data: imageData,
            aspect: width / height
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    clearCache() {
        this.cache.clear();
    }
}
```

---

## 第三方库选型

### WebGL 库对比

| 库 | 推荐指数 | 特点 | 适用场景 |
|---|---------|------|---------|
| **regl** | ⭐⭐⭐⭐⭐ | 函数式 WebGL，简洁强大 | 首选 |
| **pixi.js** | ⭐⭐⭐⭐ | 2D 渲染引擎，功能全面 | 快速开发 |
| **three.js** | ⭐⭐⭐ | 3D 引擎，功能过剩 | 简单场景 |
| **luma.gl** | ⭐⭐⭐⭐ | 可视化框架，模块化 | 复杂可视化 |
| **原生 WebGL** | ⭐⭐⭐ | 零依赖，完全控制 | 定制需求 |

### 推荐：regl

**优势：**

1. **函数式 API**：简洁、可组合
```javascript
const drawLine = regl({
    vert: `...`,
    frag: `...`,
    uniforms: {
        transform: regl.prop('transform'),
        color: regl.prop('color')
    },
    attributes: {
        position: regl.prop('positions')
    },
    count: regl.prop('count')
});

// 使用
drawLine({
    transform: matrix,
    color: [1, 0, 0, 1],
    positions: [...],
    count: 100
});
```

2. **自动状态管理**：避免 WebGL 状态混乱
3. **模块化**：shader、buffer、uniform 独立管理
4. **轻量级**：~50KB gzipped

**安装：**
```bash
npm install regl
```

**基础示例：**
```javascript
const regl = createRegl(canvas);

// 绘制等值线
const drawContour = regl({
    vert: `
        precision mediump float;
        uniform mat4 transform;
        attribute vec2 position;
        void main() {
            gl_Position = transform * vec4(position, 0, 1);
        }`,

    frag: `
        precision mediump float;
        uniform vec4 color;
        void main() {
            gl_FragColor = color;
        }`,

    uniforms: {
        transform: regl.prop('transform'),
        color: regl.prop('color')
    },

    attributes: {
        position: regl.prop('positions')
    },

    count: regl.prop('count'),

    primitive: 'line strip'
});

// 渲染
regl.frame(({ time }) => {
    regl.clear({ color: [1, 1, 1, 1] });

    contours.forEach(contour => {
        drawContour({
            transform: getTransform(),
            color: [0, 0, 0, 1],
            positions: contour.points,
            count: contour.points.length / 2
        });
    });
});
```

### 备选：luma.gl

**优势：**
1. 由 Uber 开发，用于大数据可视化
2. 内置多种着色器（线、填充、热力图）
3. 与 deck.gl 集成良好

```javascript
import { PolygonLayer } from '@deck.gl/layers';
import { GL } from '@luma.gl/constants';

const layer = new PolygonLayer({
    id: 'contour-fills',
    data: contourPolygons,
    getPolygon: d => d.polygon,
    getFillColor: d => d.color,
    stroked: true
});
```

### 交互库选择

| 功能 | 推荐库 | 说明 |
|------|--------|------|
| 缩放/平移 | d3-zoom | 与渲染器无关 |
| 触摸支持 | hammer.js | 统一触摸/鼠标 |
| WebGL 交互 | luma.gl 交互系统 | 内置拾取 |

---

## 实现路线图

### 阶段 1：基础交互层（Canvas/SVG）（2-3 周）

**目标：** 建立 Canvas 和 SVG 的统一交互层

```
Week 1: 架构搭建
├── 创建 interaction 模块
│   ├── EventManager.js
│   ├── StateManager.js
│   └── CoordinateConverter.js
├── 集成 d3-zoom
└── 实现基础事件处理

Week 2: Canvas 交互
├── 缩放功能（滚轮、框选）
├── 平移功能（拖拽）
├── 悬停检测
└── 坐标轴更新

Week 3: SVG 交互
├── 利用 SVG DOM 事件
├── CSS transform 动画
├── 元素高亮
└── 与 Canvas 行为对齐
```

**验收标准：**
- [ ] Canvas 和 SVG 交互体验一致
- [ ] 滚轮缩放流畅
- [ ] 拖拽平移正常
- [ ] 悬停提示显示正确

### 阶段 2：交互功能完善（1 周）

**目标：** 添加额外交互功能

```
├── 双击重置
├── 缩放动画
├── 惯性平移（可选）
├── 状态保存/恢复
└── 事件 API 完善
```

### 阶段 3：WebGL 渲染器基础（2-3 周）

**目标：** 实现 WebGL 基础渲染能力

```
Week 1: WebGL 基础设施
├── 选择并集成 regl
├── 实现 WebGLContext
├── 实现 ShaderManager
├── 实现基本 shader

Week 2: 等值线渲染
├── 路径转 WebGL 几何
├── 线条渲染
├── 填充渲染
└── 颜色映射

Week 3: 高级渲染
├── 热力图渲染（shader）
├── 坐标轴渲染
├── 标注渲染
└── 颜色条渲染（复用 Canvas）
```

**验收标准：**
- [ ] WebGL 能正确渲染等值线
- [ ] 性能优于 Canvas（大数据集）
- [ ] 渲染结果与 Canvas 一致

### 阶段 4：WebGL 交互（2 周）

**目标：** 实现 WebGL 特有的交互功能

```
Week 1: 拾取系统
├── 实现颜色拾取
├── 离屏 framebuffer
├── ID 映射系统
└── 悬停检测

Week 2: 交互集成
├── 与统一交互层集成
├── 变换矩阵更新
├── 高亮功能
└── 文本纹理优化
```

**验收标准：**
- [ ] 悬停检测准确
- [ ] 高亮显示正确
- [ ] 与 Canvas/SVG 交互体验一致

### 阶段 5：优化与测试（1-2 周）

**目标：** 性能优化和全面测试

```
├── 性能对比测试
│   ├── Canvas vs WebGL (小数据)
│   ├── Canvas vs WebGL (大数据)
│   └── 内存使用对比
├── 兼容性测试
│   ├── 不同浏览器
│   ├── 移动端
│   └── WebGL 支持检测
├── 文档完善
└── 示例代码
```

---

## API 设计

### 高级 API（推荐使用）

```javascript
/**
 * 创建交互式等值线图
 * 自动选择最佳渲染器或手动指定
 */
function createContourChart(container, config) {
    // container: 选择器或 DOM 元素
    // config: 配置对象

    return {
        // ============================================
        // 方法
        // ============================================

        // 更新数据
        update(newData),

        // 设置视图范围
        setView(xMin, xMax, yMin, yMax),

        // 获取当前视图
        getView(),

        // 重置视图
        resetView(),

        // 缩放到指定区域
        zoomTo(x1, y1, x2, y2, options),

        // 平移到指定位置
        panTo(dx, dy, options),

        // 切换渲染器
        switchRenderer(rendererType),

        // 启用/禁用交互
        enableInteraction(enabled),

        // 导出图像
        exportImage(format, options),

        // 销毁实例
        destroy(),

        // ============================================
        // 事件回调
        // ============================================

        // 视图变化
        onViewChange: (view) => {},

        // 悬停
        onHover: (point) => {},

        // 点击
        onClick: (point) => {},

        // 渲染器切换
        onRendererChange: (renderer) => {},

        // 缩放开始/结束
        onZoomStart: () => {},
        onZoomEnd: () => {}
    };
}
```

### 使用示例

```javascript
// 基本用法（自动选择渲染器）
const chart = contourCore.createContourChart('#container', {
    // 数据配置
    z: gridData,
    x: xCoords,
    y: yCoords,

    // 渲染器配置
    renderer: 'auto',  // 'auto' | 'canvas' | 'svg' | 'webgl'

    // 等值线配置
    contours: { type: 'fill' },
    colorscale: 'Viridis',

    // 交互配置
    interaction: {
        // 启用的功能
        zoom: true,
        pan: true,
        hover: true,

        // 缩放配置
        zoom: {
            wheel: true,
            box: true,
            scaleExtent: [0.5, 10],
            duration: 300  // 动画时长
        },

        // 平移配置
        pan: {
            drag: true,
            inertia: false  // 惯性效果
        },

        // 悬停配置
        hover: {
            tooltip: true,
            highlightLine: true,
            format: (point) => `x: ${point.x.toFixed(2)}, y: ${point.y.toFixed(2)}, z: ${point.z.toFixed(2)}`
        }
    }
});

// 监听事件
chart.onViewChange((view) => {
    console.log('当前视图范围:', view);
});

chart.onHover((point) => {
    console.log('悬停数据:', point);
});

chart.onRendererChange((renderer) => {
    console.log('当前渲染器:', renderer);
});

// 程序化操作
chart.zoomTo(10, 20, 30, 40, { duration: 500 });

// 切换渲染器
chart.switchRenderer('webgl');

// 更新数据
chart.update({ z: newGridData });

// 导出图像
const imageData = chart.exportImage('png', { scale: 2 });
```

### 配置项详细说明

```javascript
{
    // ============================================
    // 数据配置
    // ============================================
    z: Array2D,           // 2D 数据数组
    x: Array1D,           // X 坐标（可选）
    y: Array1D,           // Y 坐标（可选）

    // ============================================
    // 渲染器配置
    // ============================================
    renderer: {
        // 渲染器选择
        type: 'auto' | 'canvas' | 'svg' | 'webgl',

        // 自动选择策略
        autoStrategy: {
            // 数据点阈值
            webglThreshold: 10000,    // 超过此点数使用 WebGL

            // 性能检测
            enablePerformanceTest: true,  // 运行时性能检测

            // 降级策略
            fallback: ['webgl', 'canvas', 'svg']  // WebGL 失败后的回退顺序
        },

        // WebGL 特定配置
        webgl: {
            // 上下文属性
            contextAttributes: {
                antialias: true,
                preserveDrawingBuffer: true,  // 允许导出图像
                powerPreference: 'high-performance'
            },

            // 性能配置
            enablePicking: true,        // 启用颜色拾取
            enableBatching: true,        // 批量渲染优化
            maxTextureSize: 4096,        // 最大纹理尺寸

            // 文本渲染
            textRendering: 'texture',    // 'texture' | 'sdf' | 'html'
            textureCacheSize: 100        // 文本纹理缓存大小
        },

        // Canvas 特定配置
        canvas: {
            enableHiDPI: true,           // 高 DPI 支持
            pixelRatio: window.devicePixelRatio || 1
        },

        // SVG 特定配置
        svg: {
            useCSSAnimation: true,        // 使用 CSS 动画
            enableInteraction: true       // 启用 SVG DOM 交互
        }
    },

    // ============================================
    // 交互配置
    // ============================================
    interaction: {
        // 全局开关
        enabled: true,

        // 缩放配置
        zoom: {
            enabled: true,
            wheel: true,
            box: true,
            scaleExtent: [0.1, 100],
            duration: 250,
            ease: 'cubicOut'
        },

        // 平移配置
        pan: {
            enabled: true,
            drag: true,
            inertia: false,
            inertiaDuration: 500
        },

        // 悬停配置
        hover: {
            enabled: true,
            tooltip: true,
            highlight: true,
            threshold: 10,  // 拾取阈值（像素）
            debounce: 16    // 防抖延迟（毫秒）
        },

        // 触摸配置
        touch: {
            enabled: true,
            pinch: true,    // 双指缩放
            rotate: false   // 双指旋转（暂不支持）
        }
    },

    // ============================================
    // 性能配置
    // ============================================
    performance: {
        // 增量更新
        enableIncrementalRender: true,

        // 渲染节流
        renderThrottle: 16,  // 约 60fps

        // 缓存
        enableCache: true,

        // Web Worker
        enableWorker: true,  // 大数据计算使用 Worker
        workerThreshold: 50000
    }
}
```

---

## 性能优化策略

### 1. 渲染器级优化

```javascript
/**
 * Canvas 优化
 */
class CanvasRenderer {
    constructor() {
        // 离屏缓存静态内容
        this.staticCanvas = document.createElement('canvas');
        this.staticCtx = this.staticCanvas.getContext('2d');

        // 脏区域标记
        this.dirtyRegions = [];
    }

    render(result, transform) {
        // 只重绘脏区域
        if (this.dirtyRegions.length > 0) {
            this.dirtyRegions.forEach(region => {
                this.renderRegion(region);
            });
            this.dirtyRegions = [];
        } else {
            this.renderFull(result, transform);
        }
    }
}

/**
 * SVG 优化
 */
class SVGRenderer {
    constructor() {
        // 使用 CSS transform 而非重绘
        this.useTransform = true;
    }

    setTransform(transform) {
        if (this.useTransform) {
            // 更新 transform 属性（硬件加速）
            this.contentGroup.setAttribute(
                'transform',
                `translate(${transform.x}, ${transform.y}) scale(${transform.k})`
            );
        }
    }
}

/**
 * WebGL 优化
 */
class WebGLRenderer {
    constructor() {
        // 批量渲染
        this.batches = [];

        // 纹理图集
        this.textureAtlas = new TextureAtlas();

        // 实例化渲染
        this.useInstancing = true;
    }

    render(result, transform) {
        // 批量渲染相同类型的元素
        const batches = this.groupByType(result);

        batches.forEach(batch => {
            this.renderBatch(batch, transform);
        });
    }
}
```

### 2. 内存管理

```javascript
/**
 * 纹理缓存管理
 */
class TextureCache {
    constructor(maxSize = 10) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.lru = [];
    }

    get(key) {
        if (this.cache.has(key)) {
            // 更新 LRU
            const index = this.lru.indexOf(key);
            this.lru.splice(index, 1);
            this.lru.push(key);
            return this.cache.get(key);
        }
        return null;
    }

    set(key, texture) {
        // 缓存已满，删除最旧的
        if (this.cache.size >= this.maxSize) {
            const oldest = this.lru.shift();
            this.cache.get(oldest).dispose();
            this.cache.delete(oldest);
        }

        this.cache.set(key, texture);
        this.lru.push(key);
    }
}

/**
 * Buffer 池
 */
class BufferPool {
    constructor(gl) {
        this.gl = gl;
        this.pools = {};
    }

    get(size, usage) {
        const key = `${size}_${usage}`;

        if (!this.pools[key]) {
            this.pools[key] = [];
        }

        if (this.pools[key].length > 0) {
            return this.pools[key].pop();
        }

        return this.gl.createBuffer();
    }

    release(buffer, size, usage) {
        const key = `${size}_${usage}`;

        if (!this.pools[key]) {
            this.pools[key] = [];
        }

        this.pools[key].push(buffer);
    }
}
```

### 3. 自适应渲染

```javascript
/**
 * 自适应渲染器选择
 */
class AdaptiveRenderer {
    constructor(container) {
        this.container = container;
        this.renderers = {
            canvas: new CanvasRenderer(),
            svg: new SVGRenderer(),
            webgl: new WebGLRenderer()
        };
        this.currentRenderer = null;
    }

    // 根据数据规模自动选择
    selectRenderer(data) {
        const pointCount = data.z.length * data.z[0].length;

        // 检测 WebGL 支持
        const hasWebGL = this.detectWebGL();

        if (hasWebGL && pointCount > 10000) {
            return this.renderers.webgl;
        } else if (pointCount > 5000) {
            return this.renderers.canvas;
        } else {
            return this.renderers.svg;
        }
    }

    // 性能检测
    detectPerformance() {
        const testData = this.generateTestData();

        const renderers = ['canvas', 'webgl'];
        const results = {};

        renderers.forEach(type => {
            const start = performance.now();
            this.renderers[type].render(testData);
            const end = performance.now();
            results[type] = end - start;
        });

        return results;
    }
}
```

### 4. 多线程支持

```javascript
/**
 * Web Worker 等值线计算
 */
// contour-worker.js
self.importScripts('./contour-core.js');

self.onmessage = function(e) {
    const { type, data } = e.data;

    if (type === 'compute') {
        const result = contourCore.computeContours(data.grid, data.options);
        self.postMessage({ type: 'result', result });
    }
};

// 主线程使用
class WorkerManager {
    constructor() {
        this.workers = [];
        this.activeJobs = new Map();
    }

    compute(grid, options) {
        return new Promise((resolve, reject) => {
            const worker = this.getWorker();
            const jobId = Date.now();

            worker.onmessage = (e) => {
                if (e.data.type === 'result') {
                    this.activeJobs.delete(jobId);
                    this.releaseWorker(worker);
                    resolve(e.data.result);
                }
            };

            worker.postMessage({
                type: 'compute',
                data: { grid, options }
            });

            this.activeJobs.set(jobId, worker);
        });
    }
}
```

---

## 附录：完整目录结构

### 新增目录结构

```
contour-core/
├── interaction/                 # 交互层（新增）
│   ├── index.js                # 入口
│   ├── EventManager.js         # 事件管理器
│   ├── StateManager.js         # 状态管理器
│   ├── CoordinateConverter.js  # 坐标转换器
│   └── handlers/               # 交互处理器
│       ├── Zoom.js
│       ├── Pan.js
│       ├── Hover.js
│       └── index.js
├── ui/                         # UI 组件（新增）
│   ├── Tooltip.js              # 悬停提示
│   ├── SelectionBox.js         # 框选框
│   └── index.js
├── renderers/
│   ├── canvas/                 # Canvas 渲染器
│   │   ├── index.js
│   │   ├── paths.js
│   │   ├── labels.js
│   │   ├── colorbar.js
│   │   ├── heatmap.js
│   │   ├── nulls.js
│   │   ├── axes.js
│   │   └── interaction.js      # 交互支持（新增）
│   ├── svg/                    # SVG 渲染器
│   │   ├── index.js
│   │   ├── paths.js
│   │   ├── labels.js
│   │   ├── colorbar.js
│   │   ├── nulls.js
│   │   └── interaction.js      # 交互支持（新增）
│   ├── webgl/                  # WebGL 渲染器（新增）
│   │   ├── index.js
│   │   ├── core/
│   │   │   ├── context.js      # WebGL 上下文
│   │   │   ├── shader.js       # Shader 管理
│   │   │   ├── program.js      # Program 管理
│   │   │   └── buffer.js       # Buffer 管理
│   │   ├── shaders/            # Shader 源码
│   │   │   ├── common.glsl     # 通用定义
│   │   │   ├── line.vert       # 线条顶点着色器
│   │   │   ├── line.frag       # 线条片元着色器
│   │   │   ├── fill.vert       # 填充顶点着色器
│   │   │   ├── fill.frag       # 填充片元着色器
│   │   │   └── heatmap.frag    # 热力图着色器
│   │   ├── objects/            # 渲染对象
│   │   │   ├── lines.js        # 等值线
│   │   │   ├── fills.js        # 填充区域
│   │   │   ├── heatmap.js      # 热力图
│   │   │   └── labels.js       # 标注
│   │   ├── picking/            # 拾取系统
│   │   │   ├── color-picking.js
│   │   │   └── picker.js
│   │   └── utils/
│   │       ├── text-texture.js # 文本纹理
│   │       ├── mesh-builder.js # 网格构建
│   │       └── color-scale.js  # 颜色映射
│   └── index.js               # 渲染器入口
├── api.js                      # 高级 API（修改）
├── chart.js                    # 图表类（新增）
├── demo/
│   ├── interactive-canvas.html
│   ├── interactive-svg.html
│   ├── interactive-webgl.html
│   ├── renderer-comparison.html
│   └── benchmark.html
└── package.json                # 依赖更新
```

### package.json 更新

```json
{
  "name": "contour-core",
  "version": "0.3.0",
  "description": "Standalone contour calculation library with WebGL support",
  "main": "index.js",
  "dependencies": {
    "d3-zoom": "^3.0.0",
    "d3-selection": "^3.0.0",
    "d3-ease": "^3.0.0",
    "regl": "^2.1.0"
  },
  "devDependencies": {
    "hammerjs": "^2.0.8",
    "hammer-timeout": "^1.0.0"
  },
  "peerDependencies": {
    "d3-zoom": ">=3.0.0"
  },
  "browser": {
    "contour-core": "./browser.js"
  },
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack --mode development --watch",
    "test": "jest",
    "benchmark": "node demo/benchmark.js"
  }
}
```

---

## 总结

### 核心要点

1. **统一架构**：交互层与渲染层解耦，支持 Canvas/SVG/WebGL
2. **渲染器选择**：根据数据规模自动选择最佳渲染器
3. **WebGL 方案**：推荐使用 regl，简洁强大
4. **交互一致性**：跨渲染器提供统一的交互体验
5. **性能优先**：自适应、缓存、多线程、批量渲染

### 预期成果

完成后，`contour-core` 将具备：

| 功能 | Canvas | SVG | WebGL |
|------|--------|-----|-------|
| 基础渲染 | ✅ | ✅ | ✅ |
| 缩放平移 | ✅ | ✅ | ✅ |
| 悬停提示 | ✅ | ✅ | ✅ |
| 大数据性能 | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| 矢量导出 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| 移动端支持 | ✅ | ✅ | ✅ |

### 下一步建议

1. **优先实现 Canvas/SVG 交互**（阶段 1-2）
   - 验证统一交互层架构
   - 确保良好的用户体验

2. **验证 regl 可行性**（阶段 3 前）
   - 创建简单的 WebGL demo
   - 测试性能提升

3. **渐进式开发**
   - 先 Canvas，再 SVG，最后 WebGL
   - 每个阶段都有可用的产品

4. **性能基准**
   - 建立性能测试套件
   - 定期对比各渲染器性能
