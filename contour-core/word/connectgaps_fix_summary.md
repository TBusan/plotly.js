# connectgaps 参数实现总结

## 问题描述

在 contour-core 库中，`connectgaps` 参数没有正确实现，导致：
- 当 `connectgaps=true` 时，空值区域仍被遮罩，等值线无法穿过
- 当 `connectgaps=false` 时，空值区域没有被正确遮罩

## plotly.js 的参考实现

在 plotly.js 中（`src/traces/contour/plot.js`）：

```javascript
// 当 connectgaps=false 时，创建裁剪路径
var clipPath = clips.selectAll('#' + clipId)
    .data(trace.connectgaps ? [] : [0]);  // connectgaps=true: 空数组; false: [0]

if(trace.connectgaps === false) {
    var clipPathInfo = {
        level: 0.9,
        crossings: {},
        starts: [],
        edgepaths: [],
        paths: [],
        x: cd0.x,
        y: cd0.y,
        // 0 = 无数据, 1 = 有数据
        z: makeClipMask(cd0),  // 创建遮罩网格
        smoothing: 0
    };

    makeCrossings([clipPathInfo]);
    findAllPaths([clipPathInfo]);
    closeBoundaries([clipPathInfo], {type: 'levels'});

    // 生成 SVG clipPath 遮罩空值区域
}
```

**关键逻辑**：
- `connectgaps=true`: 不创建裁剪路径，空值被插值填充，等值线可以穿过
- `connectgaps=false`: 创建裁剪路径遮罩空值区域，等值线不会进入空值区

## 修复内容

### 1. compute.js (contour-core/compute.js:110)

**修复前**：
```javascript
return {
    levels: contourLevels,
    paths: [...],
    pathinfo: pathinfo,
    nullMask: nullMask,  // ❌ 总是返回 nullMask
    nullCount: normalization.nullCount,
    validCount: normalization.validCount
};
```

**修复后**：
```javascript
return {
    levels: contourLevels,
    paths: [...],
    pathinfo: pathinfo,
    nullMask: connectGaps ? null : nullMask,  // ✅ 只有 connectgaps=false 时返回
    nullCount: normalization.nullCount,
    validCount: normalization.validCount,
    connectgaps: connectGaps  // ✅ 包含标志供渲染器参考
};
```

### 2. demo 页面 (contour-core/demo/data-samples.html)

添加了 `connectgaps` 控制选项：

```javascript
<div class="control-group">
    <label for="connectgaps">空值处理 (仅数据2)</label>
    <select id="connectgaps">
        <option value="true" selected>连接空值 (connectgaps=true)</option>
        <option value="false">遮罩空值 (connectgaps=false)</option>
    </select>
</div>
```

在 `updateAll()` 函数中：
```javascript
var connectGaps = document.getElementById('connectgaps').value === 'true';

var options = {
    autocontour: true,
    ncontours: ncontours,
    smoothing: 0.3,
    mode: mode,
    colorscale: colorscale,
    connectgaps: connectGaps  // ✅ 传递 connectgaps 参数
};
```

## 渲染逻辑

在 `renderers/canvas/index.js` 中：

```javascript
// 绘制空值区域（仅在 nullMask 存在时）
if (contourResult.nullMask && contourResult.nullCount > 0) {
    drawNulls(ctx, contourResult, style);  // 遮罩空值区域
}
```

**工作流程**：
1. `computeContours()` 根据 `connectgaps` 决定是否返回 `nullMask`
2. 渲染器检查 `nullMask` 是否存在
3. 如果 `nullMask` 存在（`connectgaps=false`），绘制空值区域遮罩
4. 如果 `nullMask` 为 null（`connectgaps=true`），不绘制遮罩，等值线可以穿过

## 效果对比

### connectgaps = true（连接空值）
- 空值被二维插值填充
- 等值线可以穿过原空值区域
- 等值面连续平滑

### connectgaps = false（遮罩空值）
- 空值区域被白色（或自定义颜色）遮罩
- 等值线不会进入空值区域
- 等值面在空值边界处停止

## 测试方法

1. 启动 demo 服务器：
   ```bash
   cd contour-core
   npm run serve
   ```

2. 访问页面：
   ```
   http://localhost:8888/demo/data-samples.html
   ```

3. 测试数据 2（包含 null 值）：
   - 切换"空值处理"下拉菜单
   - 观察 `connectgaps=true` 和 `connectgaps=false` 的渲染差异

## 技术要点

### 插值算法（interp2d）
- 使用迭代求解泊松方程
- 通过反复平均最近邻居值填充空值
- 最多迭代 100 次，直到收敛或达到阈值

### 空值识别（findEmpties）
- 查找所有 `null` 或 `undefined` 的值
- 计算每个空值点的邻居数量
- 按邻居数量从多到少排序

### 默认值策略
- plotly.js: 当 `z` 是一维数组时，默认 `connectgaps=true`
- contour-core: 默认 `connectgaps=true`（通过第 47 行逻辑）

## 相关文件

- `contour-core/compute.js` - 核心计算逻辑
- `contour-core/null_handling/interp2d.js` - 插值算法
- `contour-core/null_handling/find_empties.js` - 空值识别
- `contour-core/renderers/canvas/nulls.js` - 空值区域渲染
- `contour-core/demo/data-samples.html` - 测试 demo
