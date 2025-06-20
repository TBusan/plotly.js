/**
 * contour-worker.js
 * 
 * Web Worker 实现的等值线和等值面计算
 * 基于 Plotly.js 的 Marching Squares 算法，但优化为更高性能的实现
 */

// 常量定义，参考自 Plotly.js 的 constants.js
const CONSTANTS = {
  // 路径起点位置
  BOTTOMSTART: [1, 9, 13, 104, 713],
  TOPSTART: [4, 6, 7, 104, 713],
  LEFTSTART: [8, 12, 14, 208, 1114],
  RIGHTSTART: [2, 3, 11, 208, 1114],

  // 行进方向 [dx, dy]
  NEWDELTA: [
    null, [-1, 0], [0, -1], [-1, 0],
    [1, 0], null, [0, -1], [-1, 0],
    [0, 1], [0, 1], null, [0, 1],
    [1, 0], [1, 0], [0, -1]
  ],

  // 鞍点处理
  CHOOSESADDLE: {
    104: [4, 1],
    208: [2, 8],
    713: [7, 13],
    1114: [11, 14]
  },

  // 鞍点处理后的剩余部分
  SADDLEREMAINDER: {
    1: 4, 2: 8, 4: 1, 7: 13, 8: 2, 11: 14, 13: 7, 14: 11
  }
};

/**
 * Web Worker 消息处理
 */
self.onmessage = function(e) {
  const { data, width, height, levels, colorScale, options } = e.data;
  
  try {
    // 计算等值线
    const result = computeContours(data, width, height, levels, colorScale, options);
    
    // 返回结果
    self.postMessage({
      status: 'success',
      result: result
    });
  } catch (error) {
    self.postMessage({
      status: 'error',
      error: error.message
    });
  }
};

/**
 * 计算等值线和等值面
 * @param {Array<Array<number>>|Float32Array} data 二维数据数组或一维展平的数据
 * @param {number} width 数据宽度
 * @param {number} height 数据高度
 * @param {Array<number>} levels 等值线级别
 * @param {Array<Array<number|string>>} colorScale 颜色映射
 * @param {Object} options 配置选项
 * @returns {Object} 等值线和等值面几何数据
 */
function computeContours(data, width, height, levels, colorScale, options = {}) {
  // 确保数据是二维数组格式
  const z = ensureDataFormat(data, width, height);
  
  // 默认选项
  options = Object.assign({
    smoothing: 0, // 平滑程度
    coloring: 'fill', // 填充模式
    showLines: true, // 显示线条
    connectGaps: false // 连接缺口
  }, options);
  
  // 计算结果
  const result = {
    levels: [],
    perimeter: [
      [0, 0],
      [width - 1, 0],
      [width - 1, height - 1],
      [0, height - 1]
    ]
  };
  
  // 为每个级别计算等值线
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    
    // 创建 pathinfo 对象，类似于 Plotly.js 的 emptyPathinfo
    const pathinfo = {
      level,
      crossings: {},
      starts: [],
      edgepaths: [],
      paths: [],
      z: z,
      smoothing: options.smoothing
    };
    
    // 计算交点
    makeCrossings(pathinfo, width, height);
    
    // 查找所有路径
    findAllPaths(pathinfo, width, height);
    
    // 处理边界闭合
    if (options.coloring === 'fill') {
      closeBoundaries(pathinfo, z);
    }
    
    // 处理填充路径
    let fillpath = null;
    if (options.coloring === 'fill') {
      fillpath = joinAllPaths(pathinfo, result.perimeter);
    }
    
    // 添加到结果
    result.levels.push({
      level,
      color: getColorForLevel(level, levels, colorScale),
      edgepaths: pathinfo.edgepaths,
      paths: pathinfo.paths,
      prefixBoundary: pathinfo.prefixBoundary,
      fillpath: fillpath
    });
  }
  
  return result;
}

/**
 * 确保数据是二维数组格式
 * @param {Array<Array<number>>|Float32Array} data 数据
 * @param {number} width 宽度
 * @param {number} height 高度
 * @returns {Array<Array<number>>} 二维数组格式的数据
 */
function ensureDataFormat(data, width, height) {
  // 如果已经是二维数组，直接返回
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data;
  }
  
  // 将一维数组转换为二维数组
  const result = new Array(height);
  for (let i = 0; i < height; i++) {
    result[i] = new Array(width);
    for (let j = 0; j < width; j++) {
      result[i][j] = data[i * width + j];
    }
  }
  
  return result;
}

/**
 * 计算等值线交点
 * 参考 Plotly.js 的 make_crossings.js
 * @param {Object} pathinfo 路径信息
 * @param {number} width 数据宽度
 * @param {number} height 数据高度
 */
function makeCrossings(pathinfo, width, height) {
  const z = pathinfo.z;
  const n = width;
  const m = height;
  
  // 是否只有两行或两列
  const twoWide = n === 2 || m === 2;
  
  // 遍历每个单元格
  for (let yi = 0; yi < m - 1; yi++) {
    // 确定起始点
    let ystartIndices = [];
    if (yi === 0) ystartIndices = ystartIndices.concat(CONSTANTS.TOPSTART);
    if (yi === m - 2) ystartIndices = ystartIndices.concat(CONSTANTS.BOTTOMSTART);
    
    for (let xi = 0; xi < n - 1; xi++) {
      let startIndices = ystartIndices.slice();
      if (xi === 0) startIndices = startIndices.concat(CONSTANTS.LEFTSTART);
      if (xi === n - 2) startIndices = startIndices.concat(CONSTANTS.RIGHTSTART);
      
      const label = xi + ',' + yi;
      const corners = [
        [z[yi][xi], z[yi][xi + 1]],
        [z[yi + 1][xi], z[yi + 1][xi + 1]]
      ];
      
      // 计算 marching index
      const mi = getMarchingIndex(pathinfo.level, corners);
      if (!mi) continue;
      
      pathinfo.crossings[label] = mi;
      if (startIndices.indexOf(mi) !== -1) {
        pathinfo.starts.push([xi, yi]);
        if (twoWide && startIndices.indexOf(mi, startIndices.indexOf(mi) + 1) !== -1) {
          // 同一个单元格有来自相对边的起点
          pathinfo.starts.push([xi, yi]);
        }
      }
    }
  }
}

/**
 * 获取 marching index
 * @param {number} val 等值线级别
 * @param {Array<Array<number>>} corners 四个角点值
 * @returns {number} marching index
 */
function getMarchingIndex(val, corners) {
  let mi = (corners[0][0] > val ? 0 : 1) +
           (corners[0][1] > val ? 0 : 2) +
           (corners[1][1] > val ? 0 : 4) +
           (corners[1][0] > val ? 0 : 8);
           
  if (mi === 5 || mi === 10) {
    const avg = (corners[0][0] + corners[0][1] + corners[1][0] + corners[1][1]) / 4;
    // 两个峰与一个大山谷
    if (val > avg) return (mi === 5) ? 713 : 1114;
    // 两个山谷与一个大山脊
    return (mi === 5) ? 104 : 208;
  }
  
  return (mi === 15) ? 0 : mi;
}

/**
 * 查找所有路径
 * 参考 Plotly.js 的 find_all_paths.js
 * @param {Object} pathinfo 路径信息
 * @param {number} width 数据宽度
 * @param {number} height 数据高度
 */
function findAllPaths(pathinfo, width, height) {
  // 容差
  const xtol = 0.01;
  const ytol = 0.01;
  
  // 处理所有起点
  for (let i = 0; i < pathinfo.starts.length; i++) {
    const startLoc = pathinfo.starts[i];
    makePath(pathinfo, startLoc.slice(), 'edge', xtol, ytol, width, height);
  }
  
  // 处理所有交点
  let cnt = 0;
  while (Object.keys(pathinfo.crossings).length && cnt < 10000) {
    cnt++;
    const startLoc = Object.keys(pathinfo.crossings)[0].split(',').map(Number);
    makePath(pathinfo, startLoc, undefined, xtol, ytol, width, height);
  }
  
  if (cnt === 10000) {
    console.warn('Infinite loop in contour?');
  }
}

/**
 * 生成路径
 * @param {Object} pi 路径信息
 * @param {Array<number>} loc 位置 [x, y]
 * @param {string} edgeflag 边缘标志
 * @param {number} xtol x容差
 * @param {number} ytol y容差
 * @param {number} width 数据宽度
 * @param {number} height 数据高度
 */
function makePath(pi, loc, edgeflag, xtol, ytol, width, height) {
  const locStr = loc.join(',');
  let mi = pi.crossings[locStr];
  let marchStep = getStartStep(mi, edgeflag, loc);
  
  // 向后半步找到交点
  const pts = [getInterpPx(pi, loc, [-marchStep[0], -marchStep[1]])];
  const m = height;
  const n = width;
  const startLoc = loc.slice();
  const startStep = marchStep.slice();
  let cnt;
  
  // 跟踪路径
  for (cnt = 0; cnt < 10000; cnt++) {
    if (mi > 20) {
      mi = CONSTANTS.CHOOSESADDLE[mi][(marchStep[0] || marchStep[1]) < 0 ? 0 : 1];
      pi.crossings[locStr] = CONSTANTS.SADDLEREMAINDER[mi];
    } else {
      delete pi.crossings[locStr];
    }
    
    marchStep = CONSTANTS.NEWDELTA[mi];
    if (!marchStep) {
      console.warn('Found bad marching index:', mi, loc, pi.level);
      break;
    }
    
    // 向前半步找到交点，然后完成整步
    pts.push(getInterpPx(pi, loc, marchStep));
    loc[0] += marchStep[0];
    loc[1] += marchStep[1];
    locStr = loc.join(',');
    
    // 避免重复点
    if (equalPts(pts[pts.length - 1], pts[pts.length - 2], xtol, ytol)) {
      pts.pop();
    }
    
    const atEdge = (marchStep[0] && (loc[0] < 0 || loc[0] > n - 2)) ||
                  (marchStep[1] && (loc[1] < 0 || loc[1] > m - 2));
                  
    const closedLoop = loc[0] === startLoc[0] && loc[1] === startLoc[1] &&
                      marchStep[0] === startStep[0] && marchStep[1] === startStep[1];
                      
    // 完成循环或到达边缘
    if (closedLoop || (edgeflag && atEdge)) break;
    
    mi = pi.crossings[locStr];
  }
  
  if (cnt === 10000) {
    console.warn('Infinite loop in contour?');
  }
  
  // 检查是否闭合路径
  const closedpath = equalPts(pts[0], pts[pts.length - 1], xtol, ytol);
  
  // 应用平滑
  smoothPath(pts, pi.smoothing);
  
  // 添加到路径集合
  if (pts.length < 2) return;
  else if (closedpath) {
    pts.pop(); // 移除重复的最后一点
    pi.paths.push(pts);
  } else {
    if (edgeflag) {
      pi.edgepaths.push(pts);
    } else {
      console.warn('Unclosed interior contour?', pi.level, startLoc.join(','));
      pi.edgepaths.push(pts);
    }
  }
}

/**
 * 获取起始步骤
 * @param {number} mi marching index
 * @param {string} edgeflag 边缘标志
 * @param {Array<number>} loc 位置
 * @returns {Array<number>} [dx, dy]
 */
function getStartStep(mi, edgeflag, loc) {
  let dx = 0;
  let dy = 0;
  
  if (mi > 20 && edgeflag) {
    // 这些鞍点从 +/- x 开始
    if (mi === 208 || mi === 1114) {
      // 如果从左侧开始，必须向右
      dx = loc[0] === 0 ? 1 : -1;
    } else {
      // 如果从底部开始，必须向上
      dy = loc[1] === 0 ? 1 : -1;
    }
  } else if (CONSTANTS.BOTTOMSTART.indexOf(mi) !== -1) dy = 1;
  else if (CONSTANTS.LEFTSTART.indexOf(mi) !== -1) dx = 1;
  else if (CONSTANTS.TOPSTART.indexOf(mi) !== -1) dy = -1;
  else dx = -1;
  
  return [dx, dy];
}

/**
 * 获取插值点
 * @param {Object} pi 路径信息
 * @param {Array<number>} loc 位置
 * @param {Array<number>} step 步骤
 * @returns {Array<number>} 插值点
 */
function getInterpPx(pi, loc, step) {
  // 计算插值点
  const x0 = loc[0];
  const y0 = loc[1];
  const z00 = pi.z[y0][x0];
  let dx = step[0];
  let dy = step[1];
  
  if (dx && dy) {
    // 对角线情况，不应该发生
    console.warn('Diagonal step not implemented');
    return [x0 + dx / 2, y0 + dy / 2];
  }
  
  let val = pi.level;
  let px, py;
  
  if (dx) {
    // 水平步骤
    const z01 = pi.z[y0][x0 + 1];
    if (isNaN(z00) || isNaN(z01)) {
      px = x0 + 0.5;
    } else {
      px = x0 + (val - z00) / (z01 - z00);
      if (px < x0) px = x0;
      else if (px > x0 + 1) px = x0 + 1;
    }
    py = y0;
  } else {
    // 垂直步骤
    const z10 = pi.z[y0 + 1][x0];
    if (isNaN(z00) || isNaN(z10)) {
      py = y0 + 0.5;
    } else {
      py = y0 + (val - z00) / (z10 - z00);
      if (py < y0) py = y0;
      else if (py > y0 + 1) py = y0 + 1;
    }
    px = x0;
  }
  
  return [px, py];
}

/**
 * 判断两点是否相等
 * @param {Array<number>} pt1 点1
 * @param {Array<number>} pt2 点2
 * @param {number} xtol x容差
 * @param {number} ytol y容差
 * @returns {boolean} 是否相等
 */
function equalPts(pt1, pt2, xtol, ytol) {
  return Math.abs(pt1[0] - pt2[0]) < xtol && 
         Math.abs(pt1[1] - pt2[1]) < ytol;
}

/**
 * 平滑路径
 * @param {Array<Array<number>>} pts 路径点
 * @param {number} smoothing 平滑程度
 */
function smoothPath(pts, smoothing) {
  if (!smoothing || smoothing <= 0) return;
  
  // 简单的移动平均平滑
  const n = pts.length;
  if (n < 3) return;
  
  const window = Math.max(2, Math.floor(smoothing * 3));
  const halfWindow = Math.floor(window / 2);
  const smoothed = new Array(n);
  
  for (let i = 0; i < n; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(n - 1, i + halfWindow); j++) {
      sumX += pts[j][0];
      sumY += pts[j][1];
      count++;
    }
    
    smoothed[i] = [sumX / count, sumY / count];
  }
  
  // 替换原始点
  for (let i = 0; i < n; i++) {
    pts[i][0] = smoothed[i][0];
    pts[i][1] = smoothed[i][1];
  }
}

/**
 * 处理边界闭合
 * 参考 Plotly.js 的 close_boundaries.js
 * @param {Object} pathinfo 路径信息
 * @param {Array<Array<number>>} z 数据
 */
function closeBoundaries(pathinfo, z) {
  // 简化版本，只处理 levels 类型
  const level = pathinfo.level;
  
  // 使用第一行的前两个点判断
  const edgeVal2 = Math.min(z[0][0], z[0][1]);
  
  // 设置 prefixBoundary
  pathinfo.prefixBoundary = !pathinfo.edgepaths.length && 
                           (edgeVal2 > level || (pathinfo.starts.length && edgeVal2 === level));
}

/**
 * 拼接所有路径
 * 参考 Plotly.js 的 joinAllPaths 函数
 * @param {Object} pi 路径信息
 * @param {Array<Array<number>>} perimeter 边界点
 * @returns {Array<Array<number>>} 完整路径
 */
function joinAllPaths(pi, perimeter) {
  const fullpath = [];
  let i = 0;
  const startsleft = pi.edgepaths.map((_, i) => i);
  let newloop = true;
  let endpt, newendpt, nexti;
  
  // 判断点是否在边界上的辅助函数
  const epsilon = 0.01;
  const istop = (pt) => Math.abs(pt[1] - perimeter[0][1]) < epsilon;
  const isbottom = (pt) => Math.abs(pt[1] - perimeter[2][1]) < epsilon;
  const isleft = (pt) => Math.abs(pt[0] - perimeter[0][0]) < epsilon;
  const isright = (pt) => Math.abs(pt[0] - perimeter[2][0]) < epsilon;
  
  // 拼接所有 edgepaths（开口线）
  while (startsleft.length) {
    // 添加当前路径
    const currentPath = pi.edgepaths[i];
    if (newloop) {
      // 新的循环，直接添加整个路径
      fullpath.push(...currentPath);
    } else {
      // 继续现有循环，添加除第一点外的所有点（避免重复）
      fullpath.push(...currentPath.slice(1));
    }
    
    // 从待处理列表中移除当前路径
    startsleft.splice(startsleft.indexOf(i), 1);
    
    // 获取当前路径的终点
    endpt = currentPath[currentPath.length - 1];
    nexti = -1;
    
    // 沿着边界移动，直到找到下一条路径的起点
    for (let cnt = 0; cnt < 4; cnt++) { // 防止无限循环
      if (!endpt) break;
      
      // 根据终点位置确定下一个边界点
      if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1]; // 右上
      else if (isleft(endpt)) newendpt = perimeter[0]; // 左上
      else if (isbottom(endpt)) newendpt = perimeter[3]; // 右下
      else if (isright(endpt)) newendpt = perimeter[2]; // 左下
      else break; // 不在边界上
      
      // 查找所有可能的下一条路径
      for (let possiblei = 0; possiblei < pi.edgepaths.length; possiblei++) {
        const ptNew = pi.edgepaths[possiblei][0];
        
        // 检查是否在同一水平或垂直线上
        if (Math.abs(endpt[0] - newendpt[0]) < epsilon) {
          if (Math.abs(endpt[0] - ptNew[0]) < epsilon &&
              (ptNew[1] - endpt[1]) * (newendpt[1] - ptNew[1]) >= 0) {
            newendpt = ptNew;
            nexti = possiblei;
          }
        } else if (Math.abs(endpt[1] - newendpt[1]) < epsilon) {
          if (Math.abs(endpt[1] - ptNew[1]) < epsilon &&
              (ptNew[0] - endpt[0]) * (newendpt[0] - ptNew[0]) >= 0) {
            newendpt = ptNew;
            nexti = possiblei;
          }
        }
      }
      
      endpt = newendpt;
      
      if (nexti >= 0) break;
      
      // 添加边界点
      fullpath.push(newendpt);
    }
    
    // 确定下一条路径
    i = nexti;
    
    // 如果闭合或没有下一条路径，开始新的循环
    newloop = (nexti < 0 || startsleft.indexOf(i) === -1);
    if (newloop && startsleft.length) {
      i = startsleft[0];
    }
  }
  
  // 添加所有闭合路径
  for (i = 0; i < pi.paths.length; i++) {
    fullpath.push(...pi.paths[i]);
  }
  
  return fullpath;
}

/**
 * 根据级别获取颜色
 * @param {number} level 等值线级别
 * @param {Array<number>} levels 所有级别
 * @param {Array<Array<number|string>>} colorScale 颜色映射
 * @returns {string} 颜色
 */
function getColorForLevel(level, levels, colorScale) {
  if (!colorScale || !colorScale.length) {
    return '#000000';
  }
  
  // 找到级别在所有级别中的归一化位置
  const min = levels[0];
  const max = levels[levels.length - 1];
  const normalized = (level - min) / (max - min);
  
  // 在颜色映射中查找对应颜色
  for (let i = 0; i < colorScale.length - 1; i++) {
    const curr = colorScale[i];
    const next = colorScale[i + 1];
    
    if (normalized >= curr[0] && normalized <= next[0]) {
      // 线性插值颜色
      const t = (normalized - curr[0]) / (next[0] - curr[0]);
      return interpolateColor(curr[1], next[1], t);
    }
  }
  
  // 默认返回最后一个颜色
  return colorScale[colorScale.length - 1][1];
}

/**
 * 颜色插值
 * @param {string} color1 颜色1
 * @param {string} color2 颜色2
 * @param {number} t 插值因子 [0,1]
 * @returns {string} 插值后的颜色
 */
function interpolateColor(color1, color2, t) {
  // 解析颜色
  const rgb1 = parseColor(color1);
  const rgb2 = parseColor(color2);
  
  // 线性插值
  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
  
  return `rgb(${r},${g},${b})`;
}

/**
 * 解析颜色字符串为RGB对象
 * @param {string} color 颜色字符串
 * @returns {Object} RGB对象 {r,g,b}
 */
function parseColor(color) {
  // 处理rgb格式
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      return {
        r: parseInt(match[0]),
        g: parseInt(match[1]),
        b: parseInt(match[2])
      };
    }
  }
  
  // 处理十六进制格式
  if (color.startsWith('#')) {
    const hex = color.substring(1);
    const bigint = parseInt(hex, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }
  
  // 默认黑色
  return { r: 0, g: 0, b: 0 };
} 