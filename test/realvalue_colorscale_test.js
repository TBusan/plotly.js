'use strict';

// This file tests the useRealValue parameter for colorscales
// It verifies that numeric domains in colorscales are used directly when useRealValue is true

// Example usage:
/*
var data = [{
  type: 'contour',
  z: [[10, 20, 30], [20, 30, 40], [30, 40, 50]],
  colorscale: [
    [10, 'blue'],
    [30, 'green'],
    [50, 'red']
  ],
  useRealValue: true  // Use the actual values 10, 30, 50 as domain points
}];
*/

// 定义测试用的色阶 - 使用明显的数值层级和对应的不同颜色
var test_colorscale = [
  [0, 'rgb(0,0,255)'],      // 蓝色 - 0
  [50, 'rgb(0,255,0)'],     // 绿色 - 50
  [100, 'rgb(255,255,0)'],  // 黄色 - 100
  [150, 'rgb(255,0,0)'],    // 红色 - 150
  [200, 'rgb(128,0,128)'],  // 紫色 - 200
];

// 测试数据 - 简单的递增矩阵
var z_data = [
  [10, 30, 50, 70, 90, 110, 130, 150, 170, 190],
  [20, 40, 60, 80, 100, 120, 140, 160, 180, 200],
  [30, 50, 70, 90, 110, 130, 150, 170, 190, 210],
  [40, 60, 80, 100, 120, 140, 160, 180, 200, 220],
  [50, 70, 90, 110, 130, 150, 170, 190, 210, 230]
];

// 场景1：使用 useRealValue: true - 应该直接使用色阶中的实际数值 (0, 50, 100, 150, 200)
var contour_with_realvalue = {
  type: 'contour',
  z: z_data,
  colorscale: test_colorscale,
  useRealValue: true,
  contours: {
    start: 0,
    end: 200,
    size: 20,
    coloring: 'lines'  // 使用线条着色以便清楚地看到效果
  },
  line: {
    width: 2
  },
  xaxis: 'x',
  yaxis: 'y'
};

// 场景2：不使用 useRealValue (默认行为) - 应该把色阶归一化为0~1区间
var contour_without_realvalue = {
  type: 'contour',
  z: z_data,
  colorscale: test_colorscale,
  // useRealValue: false 是默认值，所以不显式设置
  contours: {
    start: 0,
    end: 200, 
    size: 20,
    coloring: 'lines'  // 使用线条着色以便清楚地看到效果
  },
  line: {
    width: 2
  },
  xaxis: 'x2',
  yaxis: 'y2'
};

// 场景3：使用 useRealValue: true 但改变数值范围 - 测试范围适应性
var contour_with_realvalue_different_range = {
  type: 'contour',
  z: z_data.map(row => row.map(v => v + 100)),  // 所有值加100，范围变为110-330
  colorscale: test_colorscale,
  useRealValue: true,
  contours: {
    start: 100,
    end: 300,
    size: 20,
    coloring: 'lines'
  },
  line: {
    width: 2
  },
  xaxis: 'x3',
  yaxis: 'y3'
};

// 场景4：使用 useRealValue: true 且使用填充模式 - 测试填充也能正确使用真实值
var contour_with_realvalue_fill = {
  type: 'contour',
  z: z_data,
  colorscale: test_colorscale,
  useRealValue: true,
  contours: {
    start: 0,
    end: 200,
    size: 20,
    coloring: 'fill'  // 使用填充模式
  },
  xaxis: 'x4',
  yaxis: 'y4'
};

// 布局配置
var layout = {
  title: '测试 useRealValue 参数在等值线渲染中的效果',
  grid: {
    rows: 2,
    columns: 2,
    pattern: 'independent'
  },
  annotations: [
    {
      text: 'useRealValue: true (线模式)<br>应使用真实数值:0,50,100,150,200',
      showarrow: false,
      x: 0.5,
      y: 1.1,
      xref: 'x domain',
      yref: 'y domain'
    },
    {
      text: 'useRealValue: false (线模式)<br>应将色阶归一化为0-1',
      showarrow: false,
      x: 0.5,
      y: 1.1,
      xref: 'x2 domain',
      yref: 'y2 domain'
    },
    {
      text: 'useRealValue: true (线模式)<br>数据范围偏移+100',
      showarrow: false,
      x: 0.5,
      y: 1.1,
      xref: 'x3 domain',
      yref: 'y3 domain'
    },
    {
      text: 'useRealValue: true (填充模式)<br>应使用真实数值',
      showarrow: false,
      x: 0.5,
      y: 1.1,
      xref: 'x4 domain',
      yref: 'y4 domain'
    }
  ],
  width: 1000,
  height: 800
};

// 组合数据
var data = [
  contour_with_realvalue,
  contour_without_realvalue,
  contour_with_realvalue_different_range,
  contour_with_realvalue_fill
];

// 创建测试说明
var instructions = `
测试useRealValue参数的影响:

1. 左上图: useRealValue=true，线条模式
   - 等值线应精确地在0,50,100,150,200处显示对应颜色
   - 蓝色应对应0附近，绿色应对应50附近，黄色应对应100附近，红色应对应150附近，紫色应对应200附近

2. 右上图: useRealValue=false (默认)，线条模式
   - 等值线颜色应被归一化，出现渐变
   - 蓝色应对应最低值，紫色应对应最高值

3. 左下图: useRealValue=true，但数据范围偏移+100
   - 即使数据范围变化，仍应精确使用色阶中的实际值
   - 绿色线应接近150(50+100)，黄色线应接近200(100+100)

4. 右下图: useRealValue=true，填充模式
   - 填充区域也应根据真实数值着色
   - 应清晰看到蓝、绿、黄、红、紫的区域边界

如果useRealValue参数正确实现，四张图应显示明显不同的颜色模式。
`;

// 创建HTML测试页面
console.log("<html><head><title>useRealValue 参数测试</title>");
console.log("<script src='../dist/plotly.js'></script>");
console.log("<style>body{font-family:Arial; margin:20px;} pre{background:#f5f5f5; padding:10px; border-radius:5px;}</style>");
console.log("</head><body>");
console.log("<h1>useRealValue 参数测试</h1>");
console.log("<div id='plot' style='width:1000px;height:800px;'></div>");
console.log("<h2>测试说明</h2>");
console.log("<pre>" + instructions + "</pre>");
console.log("<script>");
console.log("var data = " + JSON.stringify(data) + ";");
console.log("var layout = " + JSON.stringify(layout) + ";");
console.log("Plotly.newPlot('plot', data, layout);");
console.log("</script></body></html>"); 