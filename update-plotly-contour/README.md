# Contour Generator

一个高性能的等值线和等值面生成库，基于 Plotly.js 的 Marching Squares 算法实现，但进行了性能优化和功能扩展。

## 项目背景

本项目从 Plotly.js 的等值线渲染模块中提取了核心算法，并进行了以下改进：

1. **使用 Web Worker 进行计算**：将计算密集型任务移至后台线程，避免阻塞主线程
2. **提供几何数据导出**：允许获取等值线和等值面的几何数据，方便用户自定义渲染
3. **优化性能**：针对大型数据集进行了算法优化
4. **改进的平滑算法**：实现了基于改进Chaikin算法的曲线平滑，生成更自然的等值线
5. **优化的边界处理**：改进了等值面边界连接算法，确保正确的拓扑关系
6. **简化 API**：提供更简洁、更直观的 API

## 与 Plotly.js 的关系

本项目是 Plotly.js 中等值线渲染模块的独立实现，主要参考了以下源码：

- `/src/traces/contour/constants.js`：常量定义
- `/src/traces/contour/make_crossings.js`：计算交点
- `/src/traces/contour/find_all_paths.js`：查找路径
- `/src/traces/contour/close_boundaries.js`：闭合边界
- `/src/traces/contour/plot.js`：主渲染逻辑

我们保留了 Plotly.js 的核心算法（如 Marching Squares 和鞍点处理），但进行了代码重构和性能优化。

## 主要改进

### 1. 改进的曲线平滑算法

我们实现了一种结合Chaikin平滑算法与张力控制的平滑方法，相比原始的移动平均平滑，能够生成更加自然和美观的等值线：

- **自适应平滑度**：根据平滑参数自动调整张力因子
- **特殊处理闭合曲线**：对于闭合曲线进行特殊处理，确保连续性
- **点集优化**：预处理过于密集的点，减少锯齿并提高性能

### 2. 优化的边界处理

我们改进了等值面边界连接算法，确保正确的拓扑关系和更准确的渲染结果：

- **优化的路径合并**：使用更智能的策略合并相关联的路径
- **改进的边界连接**：使用位置标记系统，确保边界连接点选择最短路径
- **正确处理内部孔洞**：确保内部孔洞与外部边界的正确区分
- **路径分隔标记**：使用null标记分隔不同的路径片段

### 3. 比较模式

添加了算法比较功能，可以在原始算法和改进算法之间切换，直观对比效果差异：

- **实时切换**：在界面中直接切换两种算法的渲染结果
- **可视化对比**：直观比较平滑效果和边界处理的差异
- **性能监控**：显示每种算法的性能数据

## 特点

- **高性能**：使用 Web Worker 进行后台计算
- **完整的几何数据**：提供等值线和等值面的完整几何数据
- **多种渲染模式**：支持 fill、lines 和 heatmap 三种模式
- **高质量曲线平滑**：改进的Chaikin平滑算法生成自然美观的曲线
- **正确的拓扑处理**：优化的边界连接确保等值面正确闭合
- **简单易用的 API**：简化了 Plotly.js 的复杂配置
- **兼容性好**：可与任何渲染库（如 Three.js、Canvas、SVG）配合使用

## 安装

直接复制 `contour-worker.js` 和 `contour-generator.js` 到你的项目中即可使用。

## 基本用法

```html
<script src="contour-generator.js"></script>
<script>
  // 创建等值线生成器
  const generator = new ContourGenerator({
    workerUrl: 'contour-worker.js'
  });
  
  // 生成等值线
  generator.generateContours(data, width, height, {
    coloring: 'fill',
    ncontours: 10,
    smoothing: 0.5,  // 0-1之间，0表示无平滑，1表示最大平滑
    showLines: true,
    useImprovedPathHandling: true  // 使用改进的路径处理算法
  }).then(result => {
    // 使用结果进行渲染
    console.log(result);
  });
</script>
```

## API 文档

### ContourGenerator 类

#### 构造函数

```js
new ContourGenerator(options)
```

- **options**：配置选项
  - `workerUrl`：Web Worker 文件的 URL（默认：'./contour-worker.js'）
  - `smoothing`：平滑程度，0-1（默认：0）
  - `coloring`：填充模式，'fill'、'lines' 或 'heatmap'（默认：'fill'）
  - `showLines`：是否显示线条（默认：true）
  - `connectGaps`：是否连接缺口（默认：false）
  - `useImprovedPathHandling`：是否使用改进的路径处理算法（默认：true）

#### 方法

##### generateContours(data, width, height, options)

生成等值线和等值面数据。

- **参数**：
  - `data`：二维数据数组或一维展平的数据
  - `width`：数据宽度
  - `height`：数据高度
  - `options`：配置选项
    - `coloring`：填充模式，'fill'、'lines' 或 'heatmap'
    - `ncontours`：等值线数量
    - `smoothing`：平滑程度，0-1
    - `showLines`：是否显示线条
    - `start`：起始级别（可选）
    - `end`：结束级别（可选）
    - `size`：级别间隔（可选）
    - `levels`：自定义级别数组（可选）
    - `colorScale`：颜色映射（可选）
    - `useImprovedPathHandling`：是否使用改进的路径处理（可选）
    - `includeOriginalAlgorithm`：是否包含原始算法结果（可选，用于比较）

- **返回值**：Promise，解析为等值线数据对象
  - `levels`：等值线级别数组
    - `level`：级别值
    - `color`：颜色
    - `edgepaths`：开口线数组
    - `paths`：闭合线数组
    - `fillpath`：填充路径
    - `prefixBoundary`：是否需要前缀边界
  - `perimeter`：边界点数组
  - `algorithmType`：使用的算法类型（'improved'或'original'）
  - `stats`：统计信息（路径数量、点数等）

##### createColorScale(colors)

创建自定义颜色映射。

- **参数**：
  - `colors`：颜色数组
- **返回值**：颜色映射数组

##### createValueColorScale(values, colors)

创建基于特定值的颜色映射。

- **参数**：
  - `values`：值数组
  - `colors`：对应的颜色数组
- **返回值**：颜色映射数组

##### createDefaultOptions(options)

生成默认等值线配置。

- **参数**：
  - `options`：要覆盖的选项
- **返回值**：完整配置对象

##### dispose()

销毁实例，终止 Web Worker。

## 数据格式

### 输入数据

- 二维数组：`data[y][x]`
- 一维数组：`data[y * width + x]`

### 输出数据

```js
{
  levels: [
    {
      level: 0.5,                // 等值线级别
      color: 'rgb(0, 255, 0)',   // 颜色
      edgepaths: [               // 开口线
        [[x1, y1], [x2, y2], ...],
        ...
      ],
      paths: [                   // 闭合线
        [[x1, y1], [x2, y2], ...],
        ...
      ],
      fillpath: [[x1, y1], null, [x2, y2], ...], // 填充路径，null表示分隔不同路径段
      prefixBoundary: false      // 是否需要前缀边界
    },
    ...
  ],
  perimeter: [                   // 边界点
    [0, 0],
    [width-1, 0],
    [width-1, height-1],
    [0, height-1]
  ],
  algorithmType: 'improved',     // 使用的算法类型
  stats: {                       // 统计信息
    levelCount: 10,
    totalPaths: 25,
    totalEdgePaths: 15,
    totalPoints: 1250
  }
}
```

## 示例

查看 `demo.html` 文件，了解如何使用 ContourGenerator 生成等值线和等值面，并使用 Canvas 进行渲染。该演示包含了算法对比功能，可以直观比较原始算法和改进算法的效果差异。

## 性能优化

1. **Web Worker**：将计算密集型任务移至后台线程
2. **数据结构优化**：减少对象创建和内存分配
3. **算法优化**：优化了路径查找和拼接算法
4. **路径合并优化**：改进了路径合并策略，减少不必要的边界连接
5. **点集过滤**：去除过于接近的点，减少数据量
6. **缓存机制**：缓存中间结果，避免重复计算

## 浏览器兼容性

支持所有现代浏览器（Chrome、Firefox、Safari、Edge），需要 Web Worker 支持。

## 许可证

MIT 