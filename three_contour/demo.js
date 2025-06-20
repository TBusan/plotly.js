/**
 * ThreeContour演示
 * 展示如何使用ThreeContour类渲染等值线
 */

import ThreeContour from './index.js';

// 创建示例数据
function createSampleData(rows, cols) {
  const data = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      // 创建一些有趣的数据模式
      const x = j / cols * 4 - 2;
      const y = i / rows * 4 - 2;
      const value = Math.sin(Math.sqrt(x * x + y * y)) * 50 + 
                   Math.cos(x * 2) * Math.sin(y * 2) * 25;
      row.push(value);
    }
    data.push(row);
  }
  return data;
}

// 初始化应用
function initApp() {
  // 创建容器
  const container = document.createElement('div');
  container.style.position = 'relative';
  document.body.appendChild(container);
  
  // 创建控制面板
  const controlPanel = document.createElement('div');
  controlPanel.style.position = 'absolute';
  controlPanel.style.top = '10px';
  controlPanel.style.left = '10px';
  controlPanel.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
  controlPanel.style.padding = '10px';
  controlPanel.style.borderRadius = '5px';
  container.appendChild(controlPanel);
  
  // 创建ThreeContour实例
  const contourPlot = new ThreeContour({
    width: window.innerWidth,
    height: window.innerHeight,
    antialias: true,
    backgroundColor: 0xf8f8f8
  });
  
  // 将渲染器添加到DOM
  container.appendChild(contourPlot.getDomElement());
  
  // 创建示例数据
  const data = createSampleData(50, 50);
  
  // 配置选项
  const options = {
    start: -75,
    end: 75,
    size: 10,
    coloring: 'fill',
    colorscale: [
      [0, 'rgb(0,0,255)'],
      [0.5, 'rgb(0,255,0)'],
      [1, 'rgb(255,0,0)']
    ],
    useRealValue: false,
    showLines: true,
    lineWidth: 1,
    lineColor: 'rgb(0,0,0)',
    opacity: 1
  };
  
  // 设置数据
  contourPlot.setData(data, options);
  
  // 渲染
  contourPlot.render();
  
  // 添加控制选项
  addControls(controlPanel, contourPlot, data, options);
  
  // 处理窗口大小变化
  window.addEventListener('resize', () => {
    contourPlot.resize(window.innerWidth, window.innerHeight);
    contourPlot.render();
  });
}

// 添加控制选项
function addControls(panel, contourPlot, data, options) {
  // 颜色模式选择
  addSelect(panel, '颜色模式:', ['fill', 'lines', 'heatmap'], options.coloring, (value) => {
    options.coloring = value;
    contourPlot.setData(data, options);
    contourPlot.render();
  });
  
  // 使用真实值切换
  addCheckbox(panel, '使用真实值:', options.useRealValue, (checked) => {
    options.useRealValue = checked;
    
    // 如果使用真实值，更新colorscale
    if (checked) {
      options.colorscale = [
        [-75, 'rgb(0,0,255)'],
        [0, 'rgb(0,255,0)'],
        [75, 'rgb(255,0,0)']
      ];
    } else {
      options.colorscale = [
        [0, 'rgb(0,0,255)'],
        [0.5, 'rgb(0,255,0)'],
        [1, 'rgb(255,0,0)']
      ];
    }
    
    contourPlot.setData(data, options);
    contourPlot.render();
  });
  
  // 显示线条切换
  addCheckbox(panel, '显示线条:', options.showLines, (checked) => {
    options.showLines = checked;
    contourPlot.setData(data, options);
    contourPlot.render();
  });
  
  // 等值线大小滑块
  addSlider(panel, '等值线间距:', 5, 20, options.size, (value) => {
    options.size = parseInt(value);
    contourPlot.setData(data, options);
    contourPlot.render();
  });
  
  // 不透明度滑块
  addSlider(panel, '不透明度:', 0.1, 1, options.opacity, (value) => {
    options.opacity = parseFloat(value);
    contourPlot.setData(data, options);
    contourPlot.render();
  });
}

// 添加选择框
function addSelect(panel, label, options, defaultValue, onChange) {
  const container = document.createElement('div');
  container.style.marginBottom = '10px';
  
  const labelElement = document.createElement('label');
  labelElement.textContent = label;
  labelElement.style.marginRight = '10px';
  container.appendChild(labelElement);
  
  const select = document.createElement('select');
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    if (option === defaultValue) {
      optionElement.selected = true;
    }
    select.appendChild(optionElement);
  });
  
  select.addEventListener('change', (e) => {
    onChange(e.target.value);
  });
  
  container.appendChild(select);
  panel.appendChild(container);
}

// 添加复选框
function addCheckbox(panel, label, defaultValue, onChange) {
  const container = document.createElement('div');
  container.style.marginBottom = '10px';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = defaultValue;
  checkbox.id = 'checkbox-' + Math.random().toString(36).substr(2, 9);
  
  checkbox.addEventListener('change', (e) => {
    onChange(e.target.checked);
  });
  
  const labelElement = document.createElement('label');
  labelElement.textContent = label;
  labelElement.htmlFor = checkbox.id;
  labelElement.style.marginRight = '10px';
  
  container.appendChild(labelElement);
  container.appendChild(checkbox);
  panel.appendChild(container);
}

// 添加滑块
function addSlider(panel, label, min, max, defaultValue, onChange) {
  const container = document.createElement('div');
  container.style.marginBottom = '10px';
  
  const labelElement = document.createElement('label');
  labelElement.textContent = label;
  labelElement.style.marginRight = '10px';
  container.appendChild(labelElement);
  
  const valueDisplay = document.createElement('span');
  valueDisplay.textContent = defaultValue;
  valueDisplay.style.marginLeft = '10px';
  
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.step = (max - min) / 100;
  slider.value = defaultValue;
  
  slider.addEventListener('input', (e) => {
    const value = e.target.value;
    valueDisplay.textContent = value;
    onChange(value);
  });
  
  container.appendChild(slider);
  container.appendChild(valueDisplay);
  panel.appendChild(container);
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);

/**
 * 演示如何获取等值线和等值面的几何数据
 */
function demoGetContourGeometryData() {
  // 创建一个简单的数据集
  const size = 20;
  const data = [];
  
  for (let i = 0; i < size; i++) {
    data[i] = [];
    for (let j = 0; j < size; j++) {
      // 创建一个简单的波浪形状
      const x = j / size * 4 - 2;
      const y = i / size * 4 - 2;
      const r = Math.sqrt(x * x + y * y);
      data[i][j] = Math.sin(r * 3) / (r + 0.2) * 5;
    }
  }
  
  // 创建ThreeContour实例
  const contour = new ThreeContour({
    width: 600,
    height: 600
  });
  
  // 设置数据
  contour.setData(data, {
    start: -2,
    end: 2,
    size: 0.5,
    coloring: 'fill',
    showLines: true,
    lineWidth: 2,
    lineColor: 'black',
    opacity: 0.8
  });
  
  // 获取等值线/等值面的几何数据
  const geometryData = contour.getContourGeometryData();
  
  // 打印几何数据
  console.log('等值线/等值面几何数据:', geometryData);
  
  // 显示一些统计信息
  let totalEdgePaths = 0;
  let totalClosedPaths = 0;
  let totalFullPaths = 0;
  
  Object.keys(geometryData).forEach(level => {
    const levelData = geometryData[level];
    totalEdgePaths += levelData.edgepaths.length;
    totalClosedPaths += levelData.paths.length;
    totalFullPaths += levelData.fullpath.length;
  });
  
  console.log(`总计:
    - 等值线级别: ${Object.keys(geometryData).length}
    - 开口路径: ${totalEdgePaths}
    - 闭合路径: ${totalClosedPaths}
    - 填充路径点数: ${totalFullPaths}
  `);
  
  // 将渲染器添加到DOM
  document.getElementById('container').appendChild(contour.getDomElement());
  
  // 渲染场景
  contour.render();
}

// 导出演示函数
export {
  demoSimpleContour,
  demoCustomColorScale,
  demoHeatmapMode,
  demoLinesMode,
  demoGetContourGeometryData
}; 