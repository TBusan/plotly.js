# 颜色标尺与标注优化设计文档

## 概述

本文档描述了 `mockdata-demo.html` 中三个问题的解决方案：
1. 颜色标尺显示/隐藏控制
2. 离散色块颜色标尺
3. 非封闭等值线标注

## 需求分析

| 编号 | 需求 | 描述 | 优先级 |
|------|------|------|--------|
| 1 | 显示/隐藏控制 | 点击复选框能够控制颜色标尺的显示与隐藏 | 高 |
| 2 | 离散色块 | 颜色标尺改为离散色块，每个色块有对应数值标注 | 高 |
| 3 | 位置配置 | 支持左侧、右侧、上边、下边四种位置 | 高 |
| 4 | 非封闭标注 | 非封闭等值线只要路径长度足够就显示标注 | 中 |

## 设计详情

### 1. 颜色标尺显示/隐藏控制

#### 问题分析
当前 `showColorbar` 参数已传递到渲染选项中，但渲染器可能未正确响应该参数。

#### 解决方案
在渲染主函数中添加条件判断：

```javascript
// 在渲染主函数中添加条件判断
if (options.colorbar !== false && options.colorbar?.show !== false) {
    drawColorbar(ctx, contourResult, colorbarStyle);
}
```

#### 涉及文件
- `contour-core/renderers/canvas/index.js`
- `contour-core/renderers/svg/index.js`

---

### 2. 离散色块颜色标尺

#### 数据格式
色块数据使用简洁的数组格式：

```javascript
var colorBlocks = [
    ['#440154', 0],
    ['#482878', 0.11],
    ['#3e4a89', 0.22],
    ['#31688e', 0.33],
    ['#26838f', 0.44],
    ['#1f9d8a', 0.56],
    ['#35b779', 0.67],
    ['#6dcd59', 0.78],
    ['#b4de2c', 0.89],
    ['#fde725', 1.0]
];
```

#### API 配置

```javascript
var colorbarOptions = {
    // 色块数据（必需）
    blocks: colorBlocks,

    // 位置配置
    position: 'right',    // 'left' | 'right' | 'top' | 'bottom'

    // 标注配置
    tickInterval: 2,      // 每隔N个色块显示一个标注（0表示全部显示）

    // 尺寸配置
    thickness: 25,        // 色块厚度（像素）
    padding: 10           // 与绘图区域的间距（像素）
};
```

#### 渲染效果示意

**右侧竖直示例：**
```
┌──────────────┐ ┌──┐
│              │ │██│ 1.0
│   等值线图    │ │██│
│              │ │██│ 0.78
│              │ │██│
│              │ │██│ 0.56
│              │ │██│
│              │ │██│ 0.33
│              │ │██│
│              │ │██│ 0.11
│              │ │██│ 0
└──────────────┘ └──┘
```

**下边水平示例：**
```
┌────────────────────────┐
│                        │
│       等值线图          │
│                        │
└────────────────────────┘
┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
│██│██│██│██│██│██│██│██│██│██│
└──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
 0  0.11  0.33  0.56  0.78  1.0
```

#### 涉及文件
- `contour-core/colorbar/index.js` - 新增离散色块支持
- `contour-core/colorbar/discrete.js` - 新增离散色块计算模块
- `contour-core/renderers/canvas/colorbar.js` - Canvas 绘制
- `contour-core/renderers/svg/colorbar.js` - SVG 绘制

---

### 3. 非封闭等值线标注优化

#### 问题分析
当前 `labels/position.js` 中对非封闭路径的处理：
- 非封闭路径的搜索范围限制在 `[textWidth, totalPathLen - textWidth]`
- 如果路径长度不足 `textWidth * 2`，则无法找到合适位置

#### 解决方案
1. 放宽搜索条件：对于非封闭路径，只要路径长度大于 `textWidth` 就尝试放置标注
2. 边界处理：标注可以略微超出路径边界，但需要确保可读性
3. 优化搜索算法：对于短路径，使用更精细的搜索

#### 代码修改

```javascript
// labels/position.js 中的搜索范围计算
if (isClosed) {
    // 封闭路径：可搜索整个路径
    dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
    p0 = dp / 2;
    pMax = totalPathLen;
} else if (totalPathLen > textWidth * 1.2) {
    // 非封闭路径（较长）：允许标注更靠近边界
    dp = (totalPathLen - textWidth) / (COST_CONSTANTS.INITIALSEARCHPOINTS - 1);
    p0 = textWidth / 2;
    pMax = totalPathLen - textWidth / 2;
} else if (totalPathLen > textWidth * 0.5) {
    // 非封闭路径（较短）：标注放在路径中间
    dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
    p0 = totalPathLen / 4;
    pMax = totalPathLen * 3 / 4;
} else {
    // 极短路径：不显示标注
    return null;
}
```

#### 涉及文件
- `contour-core/labels/position.js` - 标注位置计算
- `contour-core/labels/density.js` - 标注密度控制

---

## 实施计划

### 阶段 1：颜色标尺显示/隐藏控制
1. 修改 Canvas 渲染器主入口
2. 修改 SVG 渲染器主入口
3. 测试验证

### 阶段 2：离散色块颜色标尺
1. 创建离散色块计算模块
2. 修改 Canvas colorbar 绘制
3. 修改 SVG colorbar 绘制
4. 更新 API 接口
5. 测试验证

### 阶段 3：非封闭等值线标注
1. 修改标注位置计算逻辑
2. 优化短路径处理
3. 测试验证

---

## 验收标准

1. **显示/隐藏控制**：点击复选框能够正确控制颜色标尺的显示与隐藏
2. **离散色块**：颜色标尺显示为离散色块，每个色块有对应数值
3. **位置配置**：支持 left/right/top/bottom 四种位置
4. **非封闭标注**：非封闭等值线只要路径长度足够就显示标注
5. **兼容性**：不影响现有功能

---

## 参考文件

- `contour-core/demo/mockdata-demo.html` - 示例页面
- `contour-core/renderers/canvas/colorbar.js` - 当前 Canvas 颜色标尺实现
- `contour-core/labels/position.js` - 当前标注位置计算
