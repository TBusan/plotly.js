# ThreeContour

基于Three.js的等值线渲染实现，参考Plotly.js的等值线渲染方式。

## 功能特点

- 支持多种等值线渲染模式：填充、线条和热图
- 支持自定义颜色映射（colorscale）
- 支持使用真实值或归一化值的颜色映射
- 使用Marching Squares算法生成等值线
- 提供简单易用的API

## 安装

确保已安装Three.js:

```bash
npm install three
```

然后将`ThreeContour`文件复制到你的项目中。

## 使用方法

### 基本用法

```javascript
import ThreeContour from './ThreeContour';

// 创建实例
const contourPlot = new ThreeContour({
  width: 800,
  height: 600,
  antialias: true
});

// 添加到DOM
document.body.appendChild(contourPlot.getDomElement());

// 准备数据 (二维数组)
const data = [
  [10, 20, 30, 40],
  [15, 25, 35, 45],
  [20, 30, 40, 50],
  [25, 35, 45, 55]
];

// 设置数据和配置
contourPlot.setData(data, {
  start: 15,        // 起始等值线值
  end: 50,          // 结束等值线值
  size: 5,          // 等值线间距
  coloring: 'fill', // 渲染模式: 'fill', 'lines', 'heatmap'
  colorscale: [     // 颜色映射
    [0, 'rgb(0,0,255)'],
    [0.5, 'rgb(0,255,0)'],
    [1, 'rgb(255,0,0)']
  ],
  useRealValue: false, // 是否使用真实值
  showLines: true,     // 是否显示线条
  lineWidth: 1,        // 线条宽度
  lineColor: 'rgb(0,0,0)', // 线条颜色
  opacity: 1           // 不透明度
});

// 渲染
contourPlot.render();

// 响应窗口大小变化
window.addEventListener('resize', () => {
  contourPlot.resize(window.innerWidth, window.innerHeight);
  contourPlot.render();
});
```

### 使用真实值的颜色映射

```javascript
contourPlot.setData(data, {
  // ... 其他配置
  useRealValue: true,
  colorscale: [
    [10, 'rgb(0,0,255)'], // 直接使用数据值
    [30, 'rgb(0,255,0)'],
    [50, 'rgb(255,0,0)']
  ]
});
```

## API参考

### `constructor(options)`

创建一个新的ThreeContour实例。

**参数:**
- `options` (Object): 配置选项
  - `width` (Number): 渲染器宽度，默认为500
  - `height` (Number): 渲染器高度，默认为500
  - `antialias` (Boolean): 是否启用抗锯齿，默认为true
  - `backgroundColor` (Number): 背景颜色，默认为0xf0f0f0

### `setData(data, options)`

设置数据和渲染选项。

**参数:**
- `data` (Array): 二维数组数据
- `options` (Object): 渲染选项
  - `start` (Number): 起始等值线值，默认为数据最小值
  - `end` (Number): 结束等值线值，默认为数据最大值
  - `size` (Number): 等值线间距，默认为(end-start)/10
  - `coloring` (String): 渲染模式，可选值：'fill', 'lines', 'heatmap'，默认为'fill'
  - `colorscale` (Array): 颜色映射数组，格式为[[值, 颜色], ...]
  - `useRealValue` (Boolean): 是否使用真实值，默认为false
  - `showLines` (Boolean): 是否显示线条，默认为true
  - `lineWidth` (Number): 线条宽度，默认为2
  - `lineColor` (String): 线条颜色，默认为'rgb(0,0,0)'
  - `opacity` (Number): 不透明度，默认为1

### `render()`

渲染等值线。

### `getDomElement()`

获取渲染器的DOM元素。

**返回:** HTMLElement

### `resize(width, height)`

调整渲染器大小。

**参数:**
- `width` (Number): 新宽度
- `height` (Number): 新高度

### `dispose()`

销毁实例，释放资源。

## 示例

查看[demo.js](./demo.js)和[index.html](./index.html)获取完整示例。

## 算法说明

ThreeContour使用Marching Squares算法生成等值线。该算法通过以下步骤工作：

1. 将数据网格划分为单元格
2. 对于每个单元格，确定其四个角点相对于等值线级别的状态（高于或低于）
3. 根据角点状态确定等值线如何穿过单元格
4. 通过线性插值计算等值线与单元格边的交点
5. 连接这些交点形成等值线

## 参考

- [Plotly.js Contour](https://plotly.com/javascript/contour-plots/)
- [Marching Squares算法](https://en.wikipedia.org/wiki/Marching_squares)
- [Three.js文档](https://threejs.org/docs/) 