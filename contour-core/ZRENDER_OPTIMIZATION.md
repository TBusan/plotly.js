# ZRender 优化总结 (2024)

## 优化概述

本次优化针对 zrender 渲染器进行了全面改进，专注于 canvas 渲染模式，提升了渲染质量、交互体验和代码一致性。

## 优化内容

### 1. 路径渲染坐标系统优化 (renderers/zrender/paths.js)

#### 改进点
- **颜色插值函数**：新增 `interpolateColor` 和 `getColorForValue` 函数，与 canvas 渲染器保持一致
- **颜色获取逻辑**：重构 `getColorForLevel` 函数，支持 valueColorMap 分段颜色映射
- **坐标缩放**：改进 `scalePoint` 函数返回数组格式 `[x, y]`，与 canvas 渲染器保持一致
- **路径转换**：优化 `pathDataToSVGString` 函数，正确处理缩放后的坐标
- **元素创建**：改进 `createPathElement` 函数，添加 `_contourLevel` 和 `_contourType` 属性用于事件处理

#### 关键变更
```javascript
// 之前：返回对象格式
return { x: canvasX, y: canvasY };

// 之后：返回数组格式（与 canvas 一致）
return [canvasX, canvasY];
```

### 2. 交互体验改进 (renderers/zrender/index.js)

#### 缩放功能优化
- **中心点缩放**：改进 `applyZoom` 函数，实现以鼠标位置为中心的缩放
- **缩放因子**：支持自定义 `zoomFactor` 配置，默认 0.001
- **触控支持**：新增 `handlePinch` 方法支持双指缩放
- **边界限制**：支持 `minScale` 和 `maxScale` 限制缩放范围

#### 平移功能优化
- **边界约束**：新增 `bounds` 配置支持，限制平移范围
- **光标管理**：改进拖拽时的光标反馈（grabbing 样式）
- **状态跟踪**：添加 `startX`、`startY` 跟踪拖拽起始位置
- **回调增强**：`onPan` 回调新增 `totalDx`、`totalDy` 参数

#### 重置功能优化
- **动画支持**：新增 `animate` 参数，支持平滑的重置动画
- **自动动画**：通过 `animateReset` 配置自动启用动画

#### 悬停效果优化
- **高亮效果**：改进高亮颜色和线宽配置
- **光标反馈**：悬停时显示 pointer 光标
- **样式管理**：正确保存和恢复原始样式

### 3. 标注渲染优化 (renderers/zrender/labels.js)

#### 改进点
- **背景尺寸**：根据文本内容动态计算背景大小
- **样式增强**：支持 `labelPadding`、`labelRadius`、`labelBorderWidth` 等配置
- **颜色优化**：默认使用更柔和的背景色 `rgba(255, 255, 255, 0.85)`
- **边框改进**：使用更清晰的边框颜色 `#999`

### 4. API 层改进 (api.js)

#### 交互配置优化
- **配置结构**：改进交互配置的层级结构，更清晰地组织 zoom、pan、hover、click 配置
- **回调合并**：正确合并 hover 和 click 回调到 renderer.options
- **高亮颜色**：支持 `highlightColor` 配置自定义高亮颜色
- **动画重置**：支持 `animateReset` 配置控制是否使用动画重置

### 5. Demo 页面改进 (demo/zrender-interactive.html)

#### 改进点
- **样式优化**：更现代的 UI 设计，使用渐变色和阴影效果
- **交互说明**：更清晰的交互说明
- **事件日志**：改进事件日志显示，使用颜色区分
- **数据生成**：更复杂的测试数据生成，展示多峰效果
- **配置增强**：使用优化后的配置选项（highlightColor、animateReset 等）

## API 变更

### 新增配置项

```javascript
// 交互配置
{
    interaction: {
        zoom: {
            zoomFactor: 0.002,        // 新增：缩放因子
            pinchEnabled: true,          // 新增：触控缩放
            minScale: 0.5,
            maxScale: 8
        },
        pan: {
            bounds: {                   // 新增：平移边界约束
                minX: -100,
                maxX: 100,
                minY: -100,
                maxY: 100
            }
        },
        highlightColor: '#ffff00',    // 新增：高亮颜色
        animateReset: true,            // 新增：启用动画重置
    }
}
```

### 回调增强

```javascript
// Zoom 回调
onZoom: function(data) {
    // data.scale - 当前缩放比例
    // data.centerX, data.centerY - 缩放中心点
    // data.pinch - 是否为触控缩放
}

// Pan 回调
onPan: function(data) {
    // data.dx, data.dy - 本次移动距离
    // data.totalDx, data.totalDy - 总移动距离
}
```

## 技术细节

### 坐标系统一致性

zrender 和 canvas 渲染器现在使用相同的坐标转换逻辑：

1. **数据空间** → **归一化空间 [0, 1]**：基于数据范围
2. **归一化空间** → **画布坐标**：基于画布尺寸和 padding
3. **Y 轴翻转**：画布 Y 轴向下增加，需要翻转

### 颜色系统

支持两种颜色映射模式：

1. **valueColorMap（分段映射）**：`[[threshold, color], ...]`
   - 值低于第一个阈值使用第一种颜色
   - 值在两个阈值之间使用较低阈值对应的颜色
   - 值高于最后阈值使用最后一种颜色

2. **colorScale（渐变映射）**：`[[level, color], ...]` 或 `[[0, color], ...]`
   - 插值计算中间颜色
   - 支持归一化格式 `[0, color]`

### 事件系统

zrender 事件系统特点：

- **元素级事件**：直接在 Path 元素上绑定
- **冒泡控制**：通过 `silent` 属性控制
- **悬停高亮**：使用 overlay 层独立管理高亮元素
- **光标管理**：通过 DOM 操作改变光标样式

## 测试验证

运行以下命令测试优化：

```bash
# 进入目录
cd contour-core

# 构建浏览器版本
npm run build

# 启动 demo 服务器
npm run demo

# 在浏览器中打开
http://localhost:8080/demo/zrender-interactive.html
```

### 验证点

1. ✅ 等值线渲染正确
2. ✅ 颜色映射准确
3. ✅ 缩放以鼠标为中心
4. ✅ 平移流畅无卡顿
5. ✅ 悬停高亮明显
6. ✅ 标注清晰可读
7. ✅ 坐标轴显示正确
8. ✅ 色条渐变平滑

## 性能优化

- **减少重绘**：使用 overlay 层独立管理高亮，避免全量重绘
- **事件节流**：缩放和平移事件高效处理
- **按需渲染**：只在交互发生时更新显示

## 后续工作

1. **框选缩放**：添加框选区域后缩放功能
2. **动画过渡**：添加数据更新时的平滑过渡动画
3. **触摸优化**：改进移动端触摸交互体验
4. **无障碍**：添加键盘导航支持
5. **测试覆盖**：完善单元测试和集成测试

## 兼容性

- **浏览器**：支持现代浏览器（Chrome、Firefox、Safari、Edge）
- **Node.js**：zrender 依赖浏览器环境，不支持 Node.js
- **触控**：基本支持触控设备，可进一步优化

## 相关文件

- `renderers/zrender/index.js` - 主渲染器
- `renderers/zrender/paths.js` - 路径渲染
- `renderers/zrender/labels.js` - 标注渲染
- `renderers/zrender/axes.js` - 坐标轴渲染
- `renderers/zrender/colorbar.js` - 色条渲染
- `api.js` - API 入口
- `demo/zrender-interactive.html` - 交互式 demo
