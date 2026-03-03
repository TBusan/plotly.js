# ZRender 迁移总结 (2024 更新)

## 已完成的变更

### 1. 移除 d3 依赖
- 从 `package.json` 中移除了以下依赖：
  - `d3-zoom`
  - `d3-selection`
  - `d3-ease`
- 新增 `zrender` 作为主要依赖

### 2. 删除旧的 interaction 目录
- 完全删除了 `contour-core/interaction` 目录及其所有文件
- 移除的文件：
  - `interaction/index.js`
  - `interaction/createInteraction.js`
  - `interaction/EventManager.js`
  - `interaction/StateManager.js`
  - `interaction/CoordinateConverter.js`
  - `interaction/handlers/` 目录及其所有处理器

### 3. 创建新的 ZRender 渲染器
新增 `renderers/zrender/` 目录，包含以下文件：

#### `index.js`
- `ZRenderContourRenderer` 类：核心渲染器
- 支持图层管理（background, grid, fills, lines, labels, axes, overlay）
- 内置事件系统
- **优化的缩放功能**：支持以鼠标位置为中心的缩放、触控缩放
- **优化的平移功能**：支持边界约束、更好的光标反馈
- **优化的重置功能**：支持动画过渡

#### `paths.js`
- 路径元素创建
- 颜色映射处理（支持分段颜色映射和渐变映射）
- **改进的坐标缩放**：与 canvas 渲染器保持一致
- **改进的颜色插值**：新增 interpolateColor 和 getColorForValue 函数
- 等值线路径批量创建

#### `labels.js`
- 标注元素创建
- **动态背景尺寸**：根据文本内容计算背景大小
- **样式增强**：支持 padding、radius、borderWidth 配置
- 改进的可读性

#### `axes.js`
- X/Y 轴绘制
- 网格线绘制
- 刻度标签生成

#### `colorbar.js`
- 色条绘制
- 渐变色生成
- 刻度标签

### 4. 更新 API 接口

#### `renderers/index.js`
- 添加 `zrender` 渲染器导出

#### `index.js`
- 移除 `interaction` 相关导出
- 添加 `createInteractive` 新接口
- 添加 `zrender` 渲染器导出

#### `api.js`
- 添加 `createInteractive()` 函数
- 支持完整的 zrender 交互配置
- **改进的交互配置结构**：更清晰的层级组织

### 5. 优化改进（2024 年新增）

#### 路径渲染优化
- 坐标缩放与 canvas 渲染器保持一致
- 颜色映射支持分段和渐变两种模式
- 路径数据转换改进

#### 交互体验优化
- **中心点缩放**：缩放以鼠标位置为中心
- **边界约束**：平移支持边界限制
- **动画重置**：支持平滑的视图重置动画
- **悬停高亮**：改进的高亮效果和光标反馈
- **触控支持**：基本支持双指缩放

#### 标注渲染优化
- 动态背景尺寸计算
- 更好的样式配置支持
- 改进的可读性

### 6. 创建 Demo
新增 `demo/zrender-interactive.html` 演示文件，展示：
- 基础等值线渲染
- 鼠标滚轮缩放（以中心点缩放）
- 拖拽平移（支持边界约束）
- 悬停高亮（改进的高亮效果）
- 双击重置（支持动画）
- 事件回调（增强的回调参数）

### 7. 测试文件
新增 `test/zrender-optimization.test.js` 验证优化效果：
- 坐标缩放测试
- 颜色插值测试
- 渲染器初始化测试
- 缩放/平移状态管理测试
- 交互功能测试

## 使用方法

### 安装依赖
```bash
cd contour-core
npm install
```

### 构建浏览器版本
```bash
npm run build
```

### 运行测试
```bash
# 原有测试
npm run test:zrender

# 优化验证测试
npm run test:zrender-opt
```

### 使用示例
```javascript
// 创建交互式等值线图
var chart = contourCore.createInteractive('#container', {
    z: gridData,
    contours: {
        type: 'fill',
        showlabels: true
    },
    colorscale: 'Viridis',

    interaction: {
        zoom: {
            wheelEnabled: true,
            zoomFactor: 0.002,
            minScale: 0.5,
            maxScale: 8,
            onZoom: function(data) {
                console.log('Zoom:', data.scale);
            }
        },
        pan: {
            dragEnabled: true,
            bounds: {
                minX: -100,
                maxX: 100,
                minY: -100,
                maxY: 100
            }
        },
        hover: {
            onHoverStart: function(data) {
                console.log('Hover level:', data.level);
            }
        },
        highlightColor: '#ffff00',
        animateReset: true,
        onReset: function() {
            console.log('View reset');
        }
    },

    axes: {
        x: { show: true, title: 'X Axis' },
        y: { show: true, title: 'Y Axis' }
    },

    colorbar: {
        show: true,
        title: 'Value'
    }
});

// 控制方法
chart.resetView();
chart.zoomTo(2, 400, 300);
chart.panTo(50, 30);
chart.enableInteraction(false);
chart.resize(800, 600);
chart.destroy();
```

## API 变更

### 新增方法

#### `contourCore.createInteractive(container, config)`
创建交互式等值线图实例

**返回对象方法：**
- `update(newConfig)` - 更新数据
- `setView(xMin, xMax, yMin, yMax)` - 设置视图范围
- `getView()` - 获取当前视图状态
- `resetView()` - 重置视图（支持动画）
- `zoomTo(scale, centerX, centerY)` - 缩放到指定比例
- `panTo(dx, dy)` - 平移指定偏移
- `enableInteraction(enabled)` - 启用/禁用交互
- `on(event, handler)` - 绑定事件
- `off(event)` - 解绑事件
- `resize(width, height)` - 调整大小
- `destroy()` - 销毁实例
- `getRenderer()` - 获取底层渲染器

### 新增配置项

#### 交互配置
```javascript
interaction: {
    // 缩放配置
    zoom: {
        wheelEnabled: true,    // 启用滚轮缩放
        zoomFactor: 0.002,     // 缩放因子（新增）
        pinchEnabled: true,      // 启用触控缩放（新增）
        minScale: 0.5,        // 最小缩放比例
        maxScale: 10,         // 最大缩放比例
        onZoom: function(data) { } // 缩放回调
    },

    // 平移配置
    pan: {
        dragEnabled: true,      // 启用拖拽平移
        bounds: {              // 平移边界约束（新增）
            minX: -100,
            maxX: 100,
            minY: -100,
            maxY: 100
        },
        onPan: function(data) { }  // 平移回调（增强：totalDx, totalDy）
    },

    // 悬停配置
    hover: {
        onHoverStart: function(data) { }, // 悬停开始回调
        onHoverEnd: function() { }      // 悬停结束回调
    },

    // 点击配置
    click: {
        onContourClick: function(data) { } // 点击回调
    },

    // 高亮颜色（新增）
    highlightColor: '#ffff00',

    // 双击重置
    dblclickReset: true,
    animateReset: true,      // 启用动画重置（新增）
    onReset: function() { }  // 重置回调
}
```

## 注意事项

1. **只支持 Canvas 模式**：按需求实现，不考虑 SVG
2. **需要先安装依赖**：运行 `npm install` 安装 zrender
3. **zrender 作为 window 全局变量**：HTML 中需要先加载 zrender 库

## 相关文档

- `ZRENDER_OPTIMIZATION.md` - 本次优化详细说明
- `word/等值线事件需求分析使用zrender实现.md` - 需求分析
- `word/使用zrender的可行性分析.md` - 可行性分析

## 后续工作

1. 运行 `npm install` 安装 zrender
2. 运行 `npm run build` 重新构建
3. 运行 `npm run test:zrender-opt` 验证优化
4. 运行 `npm run demo` 启动本地服务器测试
5. 在浏览器中访问 `demo/zrender-interactive.html`
