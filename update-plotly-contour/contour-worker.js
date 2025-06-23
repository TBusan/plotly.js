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
  // 验证消息数据
  if (!e || !e.data) {
    console.error('[Worker] Received invalid message');
    self.postMessage({
      id: 'unknown',
      status: 'error',
      error: 'Invalid message format'
    });
    return;
  }

  const { id, data, width, height, levels, colorScale, options } = e.data;
  
  // 验证必要的参数
  if (!data) {
    console.error('[Worker] Missing data parameter');
    self.postMessage({
      id: id || 'unknown',
      status: 'error',
      error: 'Missing data parameter'
    });
    return;
  }
  
  if (!width || typeof width !== 'number' || width <= 0) {
    console.error('[Worker] Invalid width parameter:', width);
    self.postMessage({
      id: id || 'unknown',
      status: 'error',
      error: 'Invalid width parameter'
    });
    return;
  }
  
  if (!height || typeof height !== 'number' || height <= 0) {
    console.error('[Worker] Invalid height parameter:', height);
    self.postMessage({
      id: id || 'unknown',
      status: 'error',
      error: 'Invalid height parameter'
    });
    return;
  }
  
  console.log('[Worker] Received message:', { 
    id, 
    width, 
    height, 
    levelsCount: levels?.length,
    dataSize: Array.isArray(data) ? `${data.length}x${Array.isArray(data[0]) ? data[0].length : 'unknown'}` : data.length,
    options 
  });
  
  try {
    console.log('[Worker] Starting contour computation');
    
    // 验证数据格式
    let validData = data;
    if (!Array.isArray(data) && !(data instanceof Float32Array || data instanceof Float64Array)) {
      throw new Error('Data must be an array or typed array');
    }
    
    // 验证数据大小
    if (Array.isArray(data)) {
      if (data.length !== height) {
        console.warn(`[Worker] Data height (${data.length}) doesn't match specified height (${height}), using data length`);
      }
      
      if (Array.isArray(data[0]) && data[0].length !== width) {
        console.warn(`[Worker] Data width (${data[0].length}) doesn't match specified width (${width}), using data width`);
      }
    } else {
      // 一维数组
      if (data.length !== width * height) {
        console.warn(`[Worker] Data length (${data.length}) doesn't match width*height (${width*height}), data may be truncated`);
      }
    }
    
    // 计算等值线
    const result = computeContours(validData, width, height, levels, colorScale, options);
    console.log('[Worker] Computation completed');
    
    // 返回结果
    self.postMessage({
      id: id,
      status: 'success',
      result: result
    });
    console.log('[Worker] Result sent back');
  } catch (error) {
    console.error('[Worker] Error during computation:', error);
    self.postMessage({
      id: id || 'unknown',
      status: 'error',
      error: error.message || 'Unknown error'
    });
  }
};

/**
 * 计算等值线和等值面
 * @param {Array<Array<number>>|Float32Array} data 二维数据数组或一维数据数组
 * @param {number} width 数据宽度
 * @param {number} height 数据高度
 * @param {Array<number>} levels 等值线级别数组
 * @param {Array} colorScale 颜色比例尺
 * @param {Object} options 选项
 * @returns {Object} 等值线结果
 */
function computeContours(data, width, height, levels, colorScale, options = {}) {
  try {
    console.log('[Worker] Processing data:', { width, height, levelsCount: levels?.length });
    
    // 验证基本参数
    if (!data || (!Array.isArray(data) && !(data instanceof Float32Array || data instanceof Float64Array))) {
      console.error('[Worker] Invalid data format');
      throw new Error('Invalid data format');
    }
    
    if (!width || typeof width !== 'number' || width <= 0 || !height || typeof height !== 'number' || height <= 0) {
      console.error('[Worker] Invalid dimensions:', width, height);
      throw new Error('Invalid dimensions');
    }
    
    // 确保数据是二维数组格式
    const z = ensureDataFormat(data, width, height);
    
    // 验证转换后的数据
    if (!Array.isArray(z) || z.length === 0 || !Array.isArray(z[0])) {
      console.error('[Worker] Failed to convert data to 2D array');
      throw new Error('Failed to convert data to 2D array');
    }
    
    // 检查数据维度
    const actualHeight = z.length;
    const actualWidth = z[0].length;
    if (actualHeight !== height || actualWidth !== width) {
      console.warn(`[Worker] Data dimensions (${actualWidth}x${actualHeight}) don't match specified dimensions (${width}x${height}), using actual dimensions`);
      width = actualWidth;
      height = actualHeight;
    }
    
    // 默认选项
    options = Object.assign({
      smoothing: 0,
      coloring: 'fill',
      showLines: true,
      connectGaps: false,
      useImprovedPathHandling: true,
      zsmooth: true,  // 是否平滑处理数据
      lineGenerationMode: 'improved' // 线条生成模式
    }, options);
    
    console.log('[Worker] Using options:', options);
    
    // 创建周边边界点
    const perimeter = [
      [0, 0],
      [width - 1, 0],
      [width - 1, height - 1],
      [0, height - 1]
    ];
    
    // 计算数据范围
    let min = Infinity;
    let max = -Infinity;
    let validValues = 0;
    let sum = 0;
    
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (i < z.length && j < z[i].length) {
          const val = z[i][j];
          if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
            min = Math.min(min, val);
            max = Math.max(max, val);
            sum += val;
            validValues++;
          }
        }
      }
    }
    
    // 计算结果
    const result = {
      levels: [],
      perimeter: perimeter,
      algorithmType: options.useImprovedPathHandling ? 'improved' : 'original',
      stats: {
        levelCount: 0,
        totalPaths: 0,
        totalEdgePaths: 0,
        totalPoints: 0,
        minValue: min,
        maxValue: max,
        meanValue: validValues > 0 ? sum / validValues : 0
      }
    };
    
    // 检查是否有足够的有效值
    if (validValues < 4 || min === Infinity || max === -Infinity || min === max) {
      console.error('[Worker] Insufficient valid data points for contour generation');
      throw new Error('Insufficient valid data points for contour generation');
    }
    
    // 如果未提供有效的级别数组，生成默认级别
    if (!levels || !Array.isArray(levels) || levels.length === 0) {
      // 计算更好的等值线分布 - 使用分位数而不是线性分布
      const mean = sum / validValues;
      const variance = calculateVariance(z, mean);
      const stdDev = Math.sqrt(variance);
      
      console.log(`[Worker] Data statistics: min=${min}, max=${max}, mean=${mean}, stdDev=${stdDev}`);
      
      // 使用从标准差生成的级别
      const ncontours = options.ncontours || 10;
      levels = [];
      
      // 如果数据分布极度不均匀，使用对数分布
      if (max / min > 100 && min > 0) {
        // 对数分布
        const logMin = Math.log(min);
        const logMax = Math.log(max);
        const logStep = (logMax - logMin) / ncontours;
        
        for (let i = 0; i < ncontours; i++) {
          const logVal = logMin + logStep * (i + 0.5);
          levels.push(Math.exp(logVal));
        }
        
        console.log(`[Worker] Using logarithmic distribution for levels: ${levels.join(', ')}`);
      }
      // 否则使用基于数据分布的分位数
      else {
        // 线性分布 - 但使用距离mean的距离来创建更均匀的视觉效果
        // 使用少量级别在mean附近，更多级别在极值附近
        const range = max - min;
        const step = range / ncontours;
        
        for (let i = 0; i < ncontours; i++) {
          // 使用分位数分布，在均值附近有更多等值线
          // 在接近极值的地方，等值线更稀疏
          const t = i / (ncontours - 1);
          const factor = Math.pow(t, 0.7); // 调整分布曲线
          levels.push(min + factor * range);
        }
        
        console.log(`[Worker] Using quantile distribution for levels: ${levels.join(', ')}`);
      }
    }
    
    // 验证levels
    if (!Array.isArray(levels) || levels.length === 0) {
      console.error('[Worker] Invalid levels array');
      throw new Error('Invalid levels array');
    }
    
    // 过滤无效的级别并确保级别有序
    const validLevels = levels
      .filter(level => typeof level === 'number' && !isNaN(level) && isFinite(level))
      .sort((a, b) => a - b);
    
    if (validLevels.length === 0) {
      console.error('[Worker] No valid levels found after filtering');
      throw new Error('No valid levels found after filtering');
    }
    
    if (validLevels.length !== levels.length) {
      console.warn(`[Worker] Filtered out ${levels.length - validLevels.length} invalid levels`);
      levels = validLevels;
    }
    
    // 确保颜色比例尺有效且长度与levels匹配
    const validColorScale = getValidColorScale(colorScale, levels.length);
    console.log(`[Worker] Using color scale with ${validColorScale.length} colors for ${levels.length} levels`);
    
    // 设置统计信息
    result.stats.levelCount = levels.length;
    
    // 对于线条模式，使用更密集的等值线以获得更好的视觉效果
    if (options.coloring === 'lines' && options.lineGenerationMode === 'improved' && levels.length < 20) {
      console.log('[Worker] Using enhanced line generation for lines mode');
      // 使用更精细的级别生成线条
      const originalLevels = [...levels];
      
      // 在相邻级别之间插入额外的级别
      const enhancedLevels = [];
      for (let i = 0; i < originalLevels.length - 1; i++) {
        enhancedLevels.push(originalLevels[i]);
        
        // 每对级别之间添加额外的中间级别
        const diff = originalLevels[i + 1] - originalLevels[i];
        if (diff > 0) {
          for (let j = 1; j <= 2; j++) {
            enhancedLevels.push(originalLevels[i] + diff * (j / 3));
          }
        }
      }
      enhancedLevels.push(originalLevels[originalLevels.length - 1]);
      
      levels = enhancedLevels;
      console.log(`[Worker] Enhanced levels for line mode: ${levels.length} levels`);
    }
    
    // 为每个级别计算等值线
    for (let i = 0; i < levels.length; i++) {
      try {
        const level = levels[i];
        const isOriginalLevel = options.coloring === 'lines' && i % 3 === 0;
        
        console.log(`[Worker] Processing level ${i+1}/${levels.length}: ${level}`);
        
        // 创建 pathinfo 对象
        const pathinfo = {
          level,
          crossings: {},
          starts: [],
          edgepaths: [],
          paths: [],
          z: z,
          smoothing: options.smoothing,
          prefixBoundary: false
        };
        
        // 计算交点
        makeCrossings(pathinfo, width, height);
        
        // 如果没有找到任何交点或起点，创建一个空结果
        if (Object.keys(pathinfo.crossings).length === 0 && pathinfo.starts.length === 0) {
          console.log(`[Worker] No crossings found for level ${level}, skipping`);
          
          // 只为原始级别（每3个级别）添加结果
          if (options.coloring === 'lines' && !isOriginalLevel) {
            continue;
          }
          
          result.levels.push({
            level,
            color: i < validColorScale.length ? validColorScale[i][1] : 'rgb(200,200,200)',
            edgepaths: [],
            paths: [],
            prefixBoundary: false,
            fillpath: [],
            fillPolygons: []
          });
          continue;
        }
        
        // 找到所有路径
        findAllPaths(pathinfo, width, height);
        
        // 确保路径数组存在
        if (!Array.isArray(pathinfo.paths)) {
          pathinfo.paths = [];
        }
        
        if (!Array.isArray(pathinfo.edgepaths)) {
          pathinfo.edgepaths = [];
        }
        
        // 闭合边界
        closeBoundaries(pathinfo, z);
        
        console.log(`[Worker] Paths found: ${pathinfo.paths.length}, Edge paths: ${pathinfo.edgepaths.length}, prefixBoundary: ${pathinfo.prefixBoundary}`);
        
        // 线条模式，跳过中间级别（只保留原始级别）
        if (options.coloring === 'lines' && !isOriginalLevel) {
          // 更新统计信息
          result.stats.totalPaths += pathinfo.paths.length;
          result.stats.totalEdgePaths += pathinfo.edgepaths.length;
          continue;
        }
        
        // 更新统计信息
        result.stats.totalPaths += pathinfo.paths.length;
        result.stats.totalEdgePaths += pathinfo.edgepaths.length;
        
        // 处理填充路径
        let fillpath = [];
        let fillPolygons = [];
        
        if (options.coloring === 'fill') {
          try {
            // 生成填充路径 - 确保与plotly.js的实现一致
            fillpath = joinAllPaths(pathinfo, perimeter);
            
            // 将填充路径转换为多边形数组
            if (fillpath && Array.isArray(fillpath) && fillpath.length > 0) {
              fillPolygons = convertPathToPolygons(fillpath);
              
              // 计算点数
              let pointCount = 0;
              for (const poly of fillPolygons) {
                if (Array.isArray(poly)) {
                  pointCount += poly.length;
                }
              }
              result.stats.totalPoints += pointCount;
            } else {
              fillPolygons = [];
            }
          } catch (error) {
            console.error(`[Worker] Error generating fill for level ${level}:`, error.message);
            fillpath = [];
            fillPolygons = [];
          }
        }
        
        // 获取此级别的颜色 - 直接使用validColorScale中对应索引的颜色
        let color;
        if (i < validColorScale.length) {
          color = validColorScale[i][1];
        } else {
          // 如果索引超出范围（不应该发生，因为我们已经确保长度匹配）
          const t = i / Math.max(1, levels.length - 1);
          color = getColorForLevel(level, levels, validColorScale, t);
        }
        
        // 添加到结果
        const item = {
          level,
          color: color,
          edgepaths: Array.isArray(pathinfo.edgepaths) ? pathinfo.edgepaths : [],
          paths: Array.isArray(pathinfo.paths) ? pathinfo.paths : [],
          prefixBoundary: !!pathinfo.prefixBoundary,
          fillpath: Array.isArray(fillpath) ? fillpath : [],
          fillPolygons: Array.isArray(fillPolygons) ? fillPolygons : []
        }

        console.log('------item-----',item);

        result.levels.push(item);
      } catch (error) {
        console.error(`[Worker] Error processing level ${levels[i]}:`, error);
        // 添加一个空的结果，这样结果数组的长度仍然与levels长度一致
        result.levels.push({
          level: levels[i],
          color: i < validColorScale.length ? validColorScale[i][1] : 'rgb(200,200,200)',
          edgepaths: [],
          paths: [],
          prefixBoundary: false,
          fillpath: [],
          fillPolygons: []
        });
      }
    }
    
    console.log('[Worker] All levels processed');
    return result;
  } catch (error) {
    console.error('[Worker] Error in computeContours:', error);
    // 返回一个有效的但空的结果，避免主线程崩溃
    return {
      levels: [],
      perimeter: [[0, 0], [1, 0], [1, 1], [0, 1]],
      error: error.message
    };
  }
}

/**
 * 计算数据的方差
 * @param {Array<Array<number>>} data 数据数组
 * @param {number} mean 均值
 * @returns {number} 方差
 */
function calculateVariance(data, mean) {
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      const val = data[i][j];
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        sum += (val - mean) * (val - mean);
        count++;
      }
    }
  }
  
  return count > 0 ? sum / count : 0;
}

/**
 * 确保数据是二维数组格式
 * @param {Array<Array<number>>|Float32Array} data 数据
 * @param {number} width 宽度
 * @param {number} height 高度
 * @returns {Array<Array<number>>} 二维数组格式的数据
 */
function ensureDataFormat(data, width, height) {
  // 参数验证
  if (!data) {
    console.error('Invalid data provided to ensureDataFormat');
    return createEmptyArray(height, width);
  }
  
  // 如果已经是二维数组，进行验证和修复
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.warn('Empty data array provided');
      return createEmptyArray(height, width);
    }
    
    if (Array.isArray(data[0])) {
      // 已经是二维数组，验证维度
      const actualHeight = data.length;
      const actualWidth = data[0].length;
      
      // 如果维度不匹配，尝试调整
      if (actualHeight !== height || actualWidth !== width) {
        console.warn(`Data dimensions (${actualWidth}x${actualHeight}) don't match specified dimensions (${width}x${height})`);
      }
      
      // 确保所有行都是数组且长度一致
      const result = new Array(data.length);
      for (let i = 0; i < data.length; i++) {
        if (!Array.isArray(data[i])) {
          console.warn(`Row ${i} is not an array, converting`);
          result[i] = new Array(width).fill(NaN);
        } else {
          result[i] = new Array(width);
          for (let j = 0; j < width; j++) {
            result[i][j] = j < data[i].length ? data[i][j] : NaN;
          }
        }
      }
      return result;
    }
  }
  
  // 将一维数组转换为二维数组
  try {
    const result = new Array(height);
    for (let i = 0; i < height; i++) {
      result[i] = new Array(width);
      for (let j = 0; j < width; j++) {
        const index = i * width + j;
        result[i][j] = index < data.length ? data[index] : NaN;
      }
    }
    return result;
  } catch (error) {
    console.error('Error converting data to 2D array:', error);
    return createEmptyArray(height, width);
  }
}

/**
 * 创建空的二维数组
 * @param {number} height 高度
 * @param {number} width 宽度
 * @returns {Array<Array<number>>} 填充NaN的二维数组
 */
function createEmptyArray(height, width) {
  const result = new Array(Math.max(1, height));
  for (let i = 0; i < result.length; i++) {
    result[i] = new Array(Math.max(1, width)).fill(NaN);
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
  // 验证输入参数
  if (!pathinfo || !Array.isArray(pathinfo.z)) {
    console.error('Invalid pathinfo in makeCrossings');
    // 初始化空的结果对象
    pathinfo.starts = [];
    pathinfo.crossings = {};
    return;
  }
  
  const z = pathinfo.z;
  const m = z.length;
  
  // 检查z[0]是否存在且是数组
  if (m === 0 || !Array.isArray(z[0])) {
    console.error('Invalid z array in makeCrossings');
    pathinfo.starts = [];
    pathinfo.crossings = {};
    return;
  }
  
  const n = z[0].length;
  const level = pathinfo.level;
  
  // 检查是否有有效的级别值
  if (typeof level !== 'number' || isNaN(level) || !isFinite(level)) {
    console.error('Invalid level value in makeCrossings:', level);
    pathinfo.starts = [];
    pathinfo.crossings = {};
    return;
  }
  
  // 确保宽度和高度有效
  if (n < 2 || m < 2) {
    console.warn('Data too small for contour generation (needs at least 2x2)');
    pathinfo.starts = [];
    pathinfo.crossings = {};
    return;
  }
  
  // 存储起点和交叉信息
  pathinfo.starts = [];
  pathinfo.crossings = {};
  
  // 是否是边界特殊处理的情况
  const twoWide = n === 2 || m === 2;
  
  // 遍历每个单元格
  for (let yi = 0; yi < m - 1; yi++) {
    if (!Array.isArray(z[yi]) || !Array.isArray(z[yi+1])) continue;
    
    for (let xi = 0; xi < n - 1; xi++) {
      // 检查单元格的四个角落是否都有值
      if (xi >= z[yi].length || xi >= z[yi+1].length || 
          xi+1 >= z[yi].length || xi+1 >= z[yi+1].length) {
        continue;
      }
      
      // 获取四个角落的值并检查它们是否有效
      const z00 = z[yi][xi];
      const z01 = z[yi][xi+1];
      const z11 = z[yi+1][xi+1];
      const z10 = z[yi+1][xi];
      
      if (typeof z00 !== 'number' || isNaN(z00) || !isFinite(z00) ||
          typeof z01 !== 'number' || isNaN(z01) || !isFinite(z01) ||
          typeof z11 !== 'number' || isNaN(z11) || !isFinite(z11) ||
          typeof z10 !== 'number' || isNaN(z10) || !isFinite(z10)) {
        continue;
      }
      
      // 创建角落值数组
      const corners = [
        [z00, z01],
        [z10, z11]
      ];
      
      // 计算marching index
      const mi = getMarchingIndex(level, corners);
      
      // 如果没有交叉，跳过
      if (mi === 0 || mi === 15) continue;
      
      // 存储交叉信息
      if (mi < 15) {
        const edgesMi = [mi];
        
        // 处理鞍点情况（mi=5或mi=10）- 完全按照plotly.js的实现逻辑
        if (mi === 5 || mi === 10) {
          // 计算均值
          const avg = (z00 + z01 + z10 + z11) / 4;
          
          // 确保CONSTANTS对象中有需要的项
          if (!CONSTANTS.CHOOSESADDLE || 
              !CONSTANTS.CHOOSESADDLE[104] || !CONSTANTS.CHOOSESADDLE[208] ||
              !CONSTANTS.CHOOSESADDLE[713] || !CONSTANTS.CHOOSESADDLE[1114]) {
            console.error('Missing CHOOSESADDLE constants');
            continue;
          }
          
          if ((avg > level) === (mi === 5)) {
            // 拆分为两个三角形区域
            edgesMi.push(CONSTANTS.CHOOSESADDLE[mi === 5 ? 104 : 208][0]);
            edgesMi.push(CONSTANTS.CHOOSESADDLE[mi === 5 ? 104 : 208][1]);
          } else {
            edgesMi.push(CONSTANTS.CHOOSESADDLE[mi === 5 ? 713 : 1114][0]);
            edgesMi.push(CONSTANTS.CHOOSESADDLE[mi === 5 ? 713 : 1114][1]);
          }
        }
        
        // 存储所有交叉点
        for (let j = 0; j < edgesMi.length; j++) {
          const mij = edgesMi[j];
          
          let theLocStr;
          if (mij === 1 || mij === 4 || mij === 7 || mij === 13) {
            theLocStr = [xi, yi].join(',');
          } else if (mij === 8 || mij === 11 || mij === 14) {
            theLocStr = [xi, yi+1].join(',');
          } else if (mij === 2 || mij === 3) {
            theLocStr = [xi+1, yi].join(',');
          } else {
            theLocStr = [xi+1, yi+1].join(',');
          }
          
          pathinfo.crossings[theLocStr] = mij;
          
          // 保存起点位置
          // 这是边界或仅有的一个点的情况
          if (xi === 0 && CONSTANTS.LEFTSTART.indexOf(mij) !== -1 ||
              yi === 0 && CONSTANTS.TOPSTART.indexOf(mij) !== -1 ||
              xi === n - 2 && CONSTANTS.RIGHTSTART.indexOf(mij) !== -1 ||
              yi === m - 2 && CONSTANTS.BOTTOMSTART.indexOf(mij) !== -1 ||
              twoWide) {
            
            // 从字符串位置转换为数字数组
            const locParts = theLocStr.split(',');
            if (locParts.length === 2) {
              const x = Number(locParts[0]);
              const y = Number(locParts[1]);
              
              // 确保转换有效
              if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
                pathinfo.starts.push([x, y]);
              }
            }
          }
        }
      }
    }
  }
}

/**
 * 获取marching index
 * 参考Plotly.js的实现
 * @param {number} val 等值线级别
 * @param {Array<Array<number>>} corners 四个角落的值
 * @returns {number} marching index
 */
function getMarchingIndex(val, corners) {
  const mi = (corners[0][0] > val ? 0 : 1) +
             (corners[0][1] > val ? 0 : 2) +
             (corners[1][1] > val ? 0 : 4) +
             (corners[1][0] > val ? 0 : 8);
  
  // 特殊处理鞍点情况
  if (mi === 5 || mi === 10) {
    const avg = (corners[0][0] + corners[0][1] +
                 corners[1][0] + corners[1][1]) / 4;
    
    if ((avg > val) === (mi === 5)) {
      return mi + 99;
    } else {
      return mi + 703;
    }
  }
  
  return mi;
}

/**
 * 查找所有等值线路径
 * 参考 Plotly.js 的 find_all_paths.js
 * @param {Object} pathinfo 路径信息
 * @param {number} width 数据宽度
 * @param {number} height 数据高度
 */
function findAllPaths(pathinfo, width, height) {
  // 容差设置 - 用于确定点是否相同
  const xtol = 0.01;
  const ytol = 0.01;
  
  // 处理每个起点
  for (let i = 0; i < pathinfo.starts.length; i++) {
    const startLoc = pathinfo.starts[i];
    const startlocStr = String(startLoc);
    
    // 如果这个起点已经被使用，跳过
    if (pathinfo.crossings[startlocStr] === 0) continue;
    
    // 确定是否为边缘路径 - 沿着数据的边缘
    // 注意：这里和plotly.js保持一致，使用固定的边界判断
    const edgeflag = (
      startLoc[0] === 0 || startLoc[0] === width - 1 || 
      startLoc[1] === 0 || startLoc[1] === height - 1
    );
    
    // 创建路径
    const path = makePath(pathinfo, startLoc, edgeflag, xtol, ytol, width, height);
    
    // 如果路径为空，继续下一个
    if (!path || !path.length) continue;
    
    // 保存路径
    if (edgeflag) pathinfo.edgepaths.push(path);
    else pathinfo.paths.push(path);
  }
  
  // 如果有超过1条边缘路径，尝试合并
  if (pathinfo.edgepaths.length > 1) {
    pathinfo.edgepaths = mergeEdgePaths(pathinfo.edgepaths, xtol, ytol);
  }
}

/**
 * 生成单个等值线路径
 * @param {Object} pi 路径信息
 * @param {Array<number>} loc 起始位置
 * @param {boolean} edgeflag 是否为边缘路径
 * @param {number} xtol x容差
 * @param {number} ytol y容差
 * @param {number} width 数据宽度
 * @param {number} height 数据高度
 * @returns {Array<Array<number>>} 路径点数组
 */
function makePath(pi, loc, edgeflag, xtol, ytol, width, height) {
  const startLocStr = String(loc);
  let mi0 = pi.crossings[startLocStr];
  
  // 如果起点已被使用，返回空路径
  if (mi0 === 0) return [];
  
  // 获取起始步骤
  let startStep = getStartStep(mi0, edgeflag, loc);
  if (!startStep) return [];
  
  // 初始化路径
  const path = [];
  let loc0 = loc.slice();
  let locStr = startLocStr;
  let mi = mi0;
  let step = startStep;
  
  // 添加起点
  const startPt = getInterpPx(pi, loc, step);
  if (!startPt) return [];
  path.push(startPt);
  
  // 标记起点为已使用
  pi.crossings[locStr] = 0;
  
  // 处理鞍点情况
  if (mi === 5 || mi === 10) {
    if (step[0] * step[1]) {
      mi = CONSTANTS.SADDLEREMAINDER[step[0] > 0 ? step[0] : -step[0]];
    } else {
      mi = CONSTANTS.SADDLEREMAINDER[step[1] > 0 ? step[1] : -step[1]];
    }
  }
  
  let badStep = false;
  let maxIterations = 10000; // 防止无限循环
  let iterations = 0;
  
  // 循环直到路径闭合或到达边界
  while (iterations < maxIterations) {
    iterations++;
    
    // 计算下一步的位置和方向
    const newLoc = [loc0[0], loc0[1]];
    if (step[0]) {
      if (step[0] > 0) {
        step = [-1, 0];
        newLoc[0]++;
      } else {
        step = [1, 0];
        newLoc[0]--;
      }
    } else {
      if (step[1] > 0) {
        step = [0, -1];
        newLoc[1]++;
      } else {
        step = [0, 1];
        newLoc[1]--;
      }
    }
    
    // 检查是否超出数据范围
    if (newLoc[0] < 0 || newLoc[0] > width - 1 || 
        newLoc[1] < 0 || newLoc[1] > height - 1) {
      // 已到达边界，结束循环
      break;
    }
    
    // 获取新位置的状态
    const newLocStr = String(newLoc);
    mi = pi.crossings[newLocStr];
    
    // 如果到达起点，完成闭环
    if (newLocStr === startLocStr && path.length > 2) {
      // 检查路径是否形成闭环
      const endpt = getInterpPx(pi, newLoc, step);
      if (endpt && equalPts(endpt, startPt, xtol, ytol)) {
        // 闭环完成，结束路径
        break;
      }
    }
    
    if (!mi) {
      // 无效的交叉点，结束路径
      badStep = true;
      break;
    }
    
    const nextStep = CONSTANTS.NEWDELTA[mi];
    if (!nextStep) {
      badStep = true;
      break;
    }
    
    // 处理鞍点
    if (mi === 5 || mi === 10) {
      // 使用plotly.js的鞍点处理逻辑
      const saddle = mi === 5 ? [1, 4] : [2, 8];
      const dx = step[0];
      const dy = step[1];
      
      if (dx && dy) {
        // 来自对角线，找到其中一个方向
        mi = CONSTANTS.SADDLEREMAINDER[Math.abs(dx)];
      } else if (!dx) {
        // 来自y方向
        mi = (dy * saddle[0] > 0) ? saddle[0] : saddle[1];
      } else {
        // 来自x方向
        mi = (dx * saddle[0] > 0) ? saddle[0] : saddle[1];
      }
    }
    
    // 重置步骤
    if (mi === 5 || mi === 10) {
      if (nextStep[0] * nextStep[1]) {
        mi = CONSTANTS.SADDLEREMAINDER[nextStep[0] > 0 ? nextStep[0] : -nextStep[0]];
      } else {
        mi = CONSTANTS.SADDLEREMAINDER[nextStep[1] > 0 ? nextStep[1] : -nextStep[1]];
      }
    }
    
    // 添加点
    const pt = getInterpPx(pi, newLoc, step);
    if (!pt) {
      badStep = true;
      break;
    }
    path.push(pt);
    
    // 标记为已使用
    pi.crossings[newLocStr] = 0;
    
    // 更新位置
    loc0 = newLoc;
    locStr = newLocStr;
    step = nextStep;
  }
  
  // 如果达到最大迭代次数，记录警告
  if (iterations >= maxIterations) {
    console.warn('Maximum iterations reached in makePath');
  }
  
  // 如果有错误但是是边缘路径，保留
  if (badStep && !edgeflag) return [];
  
  // 应用平滑
  if (pi.smoothing > 0) {
    return smoothPath(path, pi.smoothing);
  }
  
  return path;
}

/**
 * 合并边缘路径
 * @param {Array<Array<Array<number>>>} edgepaths 边缘路径数组
 * @param {number} xtol x容差
 * @param {number} ytol y容差
 */
function mergeEdgePaths(edgepaths, xtol, ytol) {
  let merged;
  do {
    merged = false;
    
    // 尝试合并任意两条路径
    for (let i = 0; i < edgepaths.length; i++) {
      const path1 = edgepaths[i];
      if (!path1 || !Array.isArray(path1) || path1.length === 0) continue;
      
      for (let j = i + 1; j < edgepaths.length; j++) {
        const path2 = edgepaths[j];
        if (!path2 || !Array.isArray(path2) || path2.length === 0) continue;
        
        // 检查四种可能的连接方式
        
        // 1. path1的终点连接到path2的起点
        if (equalPts(path1[path1.length - 1], path2[0], xtol, ytol)) {
          // 移除重复点
          path2.shift();
          
          // 合并路径
          edgepaths[i] = [...path1, ...path2];
          edgepaths.splice(j, 1);
          merged = true;
          break;
        }
        
        // 2. path1的终点连接到path2的终点
        if (equalPts(path1[path1.length - 1], path2[path2.length - 1], xtol, ytol)) {
          // 移除重复点
          path2.pop();
          
          // 合并路径（需要反转path2）
          edgepaths[i] = [...path1, ...path2.reverse()];
          edgepaths.splice(j, 1);
          merged = true;
          break;
        }
        
        // 3. path1的起点连接到path2的起点
        if (equalPts(path1[0], path2[0], xtol, ytol)) {
          // 移除重复点
          path1.shift();
          
          // 合并路径（需要反转path1）
          edgepaths[i] = [...path2, ...path1.reverse()];
          edgepaths.splice(j, 1);
          merged = true;
          break;
        }
        
        // 4. path1的起点连接到path2的终点
        if (equalPts(path1[0], path2[path2.length - 1], xtol, ytol)) {
          // 移除重复点
          path1.shift();
          
          // 合并路径
          edgepaths[i] = [...path2, ...path1];
          edgepaths.splice(j, 1);
          merged = true;
          break;
        }
      }
      
      if (merged) break;
    }
  } while (merged);
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
  
  // 边界检查
  if (!pi.z || !Array.isArray(pi.z) || y0 < 0 || y0 >= pi.z.length || 
      !pi.z[y0] || !Array.isArray(pi.z[y0]) || x0 < 0 || x0 >= pi.z[y0].length) {
    console.warn('Invalid coordinates in getInterpPx:', x0, y0);
    return [x0, y0]; // 返回原始坐标作为回退
  }
  
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
    // 检查x0+1是否在范围内
    if (x0 + 1 >= pi.z[y0].length) {
      // 超出范围，使用默认值
      px = x0 + 0.5;
    } else {
      const z01 = pi.z[y0][x0 + 1];
      if (isNaN(z00) || isNaN(z01) || z00 === z01) {
        px = x0 + 0.5;
      } else {
        px = x0 + (val - z00) / (z01 - z00);
        if (px < x0) px = x0;
        else if (px > x0 + 1) px = x0 + 1;
      }
    }
    py = y0;
  } else {
    // 垂直步骤
    // 检查y0+1是否在范围内
    if (y0 + 1 >= pi.z.length || !pi.z[y0 + 1] || !Array.isArray(pi.z[y0 + 1]) || x0 >= pi.z[y0 + 1].length) {
      // 超出范围，使用默认值
      py = y0 + 0.5;
    } else {
      const z10 = pi.z[y0 + 1][x0];
      if (isNaN(z00) || isNaN(z10) || z00 === z10) {
        py = y0 + 0.5;
      } else {
        py = y0 + (val - z00) / (z10 - z00);
        if (py < y0) py = y0;
        else if (py > y0 + 1) py = y0 + 1;
      }
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
 * @returns {Array<Array<number>>} 平滑后的路径点
 */
function smoothPath(pts, smoothing) {
  // 安全检查
  if (!pts || !Array.isArray(pts)) return [];
  if (pts.length < 2) return pts.slice();
  
  // 检查平滑参数
  if (!smoothing || smoothing <= 0 || pts.length < 3) return pts.slice();
  
  // 检查点的有效性
  const validPts = pts.filter(pt => 
    pt && Array.isArray(pt) && pt.length >= 2 && 
    typeof pt[0] === 'number' && !isNaN(pt[0]) && 
    typeof pt[1] === 'number' && !isNaN(pt[1])
  );
  
  if (validPts.length < 2) return pts.slice();
  
  // 创建副本以避免修改原始数组
  const result = validPts.map(pt => [pt[0], pt[1]]);
  
  const isClosed = equalPts(result[0], result[result.length-1], 0.001, 0.001);
  
  // 首先过滤掉太近的点来减少锯齿
  const xtol = 0.005;
  const ytol = 0.005;
  let i = 1;
  while (i < result.length - 1) {
    if (equalPts(result[i], result[i+1], xtol, ytol)) {
      result.splice(i, 1);
    } else {
      i++;
    }
  }
  
  // 如果过滤后点太少，直接返回
  if (result.length < 3) return result;
  
  // 改进的平滑算法 - 使用三次样条插值
  const iterations = Math.max(1, Math.round(smoothing * 3));
  
  for (let iter = 0; iter < iterations; iter++) {
    const n = result.length;
    const newPts = [];
    
    // 确定计算范围
    const startIdx = isClosed ? 0 : 0;
    const endIdx = isClosed ? n : n - 1;
    
    // 如果是开放曲线，保持原始端点
    if (!isClosed) newPts.push([result[0][0], result[0][1]]);
    
    // 为闭合曲线准备循环索引
    function getPoint(idx) {
      if (isClosed) {
        // 对于闭合曲线，允许循环索引
        return result[(idx + n) % n];
      } else {
        // 对于开放曲线，限制在有效范围内
        return result[Math.max(0, Math.min(n - 1, idx))];
      }
    }
    
    // 对每个线段执行平滑
    for (let i = startIdx; i < endIdx; i++) {
      // 获取相邻的四个点用于三次样条插值
      const p0 = getPoint(i - 1);
      const p1 = getPoint(i);
      const p2 = getPoint(i + 1);
      const p3 = getPoint(i + 2);
      
      // 安全检查
      if (!p1 || !p2 || !Array.isArray(p1) || !Array.isArray(p2) || 
          p1.length < 2 || p2.length < 2) {
        continue;
      }
      
      // 添加原始点
      if (i > 0 || isClosed) {
        newPts.push([p1[0], p1[1]]);
      }
      
      // 添加插值点 - 使用Catmull-Rom样条
      const tension = 0.5 - smoothing * 0.3; // 根据平滑度调整张力
      
      // 在p1和p2之间添加插值点
      const numInterpPoints = 2; // 每段插入2个点
      for (let t = 1; t <= numInterpPoints; t++) {
        const t1 = t / (numInterpPoints + 1);
        
        // Catmull-Rom样条插值
        const t2 = t1 * t1;
        const t3 = t2 * t1;
        
        // x坐标插值
        const x = 0.5 * (
          (2 * p1[0]) +
          (-p0[0] + p2[0]) * t1 +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
        );
        
        // y坐标插值
        const y = 0.5 * (
          (2 * p1[1]) +
          (-p0[1] + p2[1]) * t1 +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
        );
        
        newPts.push([x, y]);
      }
    }
    
    // 如果是开放曲线，保持原始端点
    if (!isClosed && result.length > 0) newPts.push([result[n-1][0], result[n-1][1]]);
    // 如果是闭合曲线，确保首尾相接
    else if (isClosed && newPts.length > 0) newPts.push([newPts[0][0], newPts[0][1]]);
    
    // 替换点集
    result.length = 0;
    for (let i = 0; i < newPts.length; i++) {
      result.push(newPts[i]);
    }
  }
  
  return result;
}

/**
 * 处理边界闭合
 * 参考 Plotly.js 的 close_boundaries.js
 * @param {Object} pathinfo 路径信息
 * @param {Array<Array<number>>} z 数据
 */
function closeBoundaries(pathinfo, z) {
  // 验证输入参数
  if (!pathinfo || !Array.isArray(z) || z.length === 0) {
    console.warn('Invalid input to closeBoundaries');
    return;
  }
  
  // 确保pathinfo.edgepaths存在
  if (!Array.isArray(pathinfo.edgepaths)) {
    pathinfo.edgepaths = [];
  }
  
  // 获取数据维度
  const m = z.length;     // 高度
  const n = z[0] && z[0].length ? z[0].length : 0;  // 宽度
  
  if (m === 0 || n === 0) {
    console.warn('Empty data in closeBoundaries');
    pathinfo.prefixBoundary = false;
    return;
  }
  
  // 如果有edgepaths，不需要额外的处理
  if (pathinfo.edgepaths.length) {
    pathinfo.prefixBoundary = false;
    return;
  }
  
  const level = pathinfo.level;
  
  // 确保pathinfo.starts存在
  if (!Array.isArray(pathinfo.starts)) {
    pathinfo.starts = [];
  }
  
  // 使用左上角的值作为参考点
  const edgeVal2 = Math.min(z[0][0], z[0][1]);
  
  // 直接使用plotly.js的逻辑
  pathinfo.prefixBoundary = (edgeVal2 > level || (pathinfo.starts.length && edgeVal2 === level));
}

/**
 * 拼接所有路径
 * 参考 Plotly.js 的 joinAllPaths 函数
 * @param {Object} pi 路径信息
 * @param {Array<Array<number>>} perimeter 边界点
 * @returns {Array} 完整路径（包含 null 分隔符）
 */
function joinAllPaths(pi, perimeter) {
  // 验证基本参数，确保返回空数组而不是null
  if (!pi) return [];
  
  // 确保路径数组存在
  if (!Array.isArray(pi.edgepaths)) pi.edgepaths = [];
  if (!Array.isArray(pi.paths)) pi.paths = [];
  
  // 用来构建完整路径的点数组
  const result = [];
  
  // 验证perimeter
  if (!perimeter || !Array.isArray(perimeter) || perimeter.length < 4) {
    console.warn('Invalid perimeter, using default');
    perimeter = [[0, 0], [1, 0], [1, 1], [0, 1]];
  }
  
  // 处理边界情况：没有任何路径
  if (pi.edgepaths.length === 0 && pi.paths.length === 0) {
    if (pi.prefixBoundary === undefined) {
      pi.prefixBoundary = false;
    }
    
    if (pi.prefixBoundary) {
      // 添加闭合的边界路径
      result.push(
        [...perimeter[0]], 
        [...perimeter[1]], 
        [...perimeter[2]], 
        [...perimeter[3]], 
        [...perimeter[0]]
      );
      return result;
    }
    return [];
  }
  
  // 主要处理逻辑
  try {
    // 辅助函数：判断点是否在各边界上
    const epsilon = 0.01;
    const istop = (pt) => Math.abs(pt[1] - perimeter[0][1]) < epsilon;
    const isbottom = (pt) => Math.abs(pt[1] - perimeter[2][1]) < epsilon;
    const isleft = (pt) => Math.abs(pt[0] - perimeter[0][0]) < epsilon;
    const isright = (pt) => Math.abs(pt[0] - perimeter[2][0]) < epsilon;
    
    // 这部分完全按照plotly.js的实现
    let fullpath = '';
    let i = 0;
    let startsleft = pi.edgepaths.map((_, i) => i);
    let newloop = true;
    let endpt, newendpt, cnt, nexti, possiblei, addpath;
    
    // 处理所有的edgepaths (边缘路径)
    while (startsleft.length) {
      // 添加当前路径
      const currentPath = pi.edgepaths[i];
      
      // 创建路径字符串 (使用简单连接替代smoothopen)
      addpath = 'M' + currentPath.map(pt => pt.join(',')).join('L');
      fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
      
      // 从待处理列表中移除当前路径
      startsleft.splice(startsleft.indexOf(i), 1);
      
      // 获取当前路径的终点
      endpt = pi.edgepaths[i][pi.edgepaths[i].length - 1];
      nexti = -1;
      
      // 沿着边界移动终点，直到找到新的起点
      for (cnt = 0; cnt < 4; cnt++) {
        if (!endpt) {
          console.warn('Missing endpoint in edgepath', i);
          break;
        }
        
        // 确定下一个点的位置
        if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1]; // 右上
        else if (isleft(endpt)) newendpt = perimeter[0]; // 左上
        else if (isbottom(endpt)) newendpt = perimeter[3]; // 右下
        else if (isright(endpt)) newendpt = perimeter[2]; // 左下
        
        // 找到距离当前终点最近的下一条路径的起点
        for (possiblei = 0; possiblei < pi.edgepaths.length; possiblei++) {
          if (startsleft.indexOf(possiblei) === -1) continue;
          
          const ptNew = pi.edgepaths[possiblei][0];
          
          // 检查新点是否在从endpt到newendpt的线段上
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
        fullpath += 'L' + newendpt.join(',');
      }
      
      // 确定下一个处理的路径
      if (nexti >= 0) {
        i = nexti;
        newloop = (startsleft.indexOf(i) === -1);
        if (newloop) {
          i = startsleft[0];
          fullpath += 'Z';
        }
      } else {
        // 如果没有找到下一个路径，关闭当前路径并开始新的路径
        fullpath += 'Z';
        if (startsleft.length === 0) break;
        i = startsleft[0];
        newloop = true;
      }
    }
    
    // 添加内部闭合路径
    for (i = 0; i < pi.paths.length; i++) {
      // 使用简单连接替代smoothclosed
      fullpath += 'M' + pi.paths[i].map(pt => pt.join(',')).join('L') + 'Z';
    }
    
    // 将SVG路径字符串转换为点数组
    // 这里我们需要解析SVG路径并创建点数组
    // 为简化起见，我们创建一些基本的点来表示路径
    if (fullpath) {
      // 创建一个样例点
      if (pi.edgepaths.length > 0) {
        for (const path of pi.edgepaths) {
          for (const pt of path) {
            result.push([...pt]);
          }
          result.push(null); // 使用null分隔不同路径
        }
      }
      
      if (pi.paths.length > 0) {
        for (const path of pi.paths) {
          for (const pt of path) {
            result.push([...pt]);
          }
          // 闭合路径
          if (path.length > 0) {
            result.push([...path[0]]);
          }
          result.push(null); // 使用null分隔不同路径
        }
      }
    }
  } catch (error) {
    console.error('Error in joinAllPaths:', error);
  }
  
  return result;
}

/**
 * 将SVG路径字符串解析为点数组
 * @param {string} pathStr SVG路径字符串
 * @returns {Array} 点数组，包含null作为分隔符
 */
function parseSvgPath(pathStr) {
  // 安全检查
  if (!pathStr || typeof pathStr !== 'string') {
    console.warn('Invalid SVG path string:', pathStr);
    return [];
  }
  
  try {
    const result = [];
    const commands = pathStr.match(/[MLZ][^MLZ]*/g) || [];
    let currentPath = [];
    
    for (const cmd of commands) {
      const type = cmd[0];
      const rest = cmd.slice(1).trim();
      
      if (type === 'Z') {
        // 闭合路径，如果当前路径不为空，添加起点作为终点
        if (currentPath.length > 0) {
          result.push([...currentPath[0]]); // 添加起点副本作为终点
          result.push(null); // 添加分隔符
          currentPath = []; // 重置当前路径
        }
        continue;
      }
      
      // 解析坐标点
      const coordPairs = rest.split(/[,\s]+/);
      if (coordPairs.length % 2 !== 0) {
        console.warn('Invalid coordinate pairs in SVG path:', rest);
        continue; // 跳过无效的命令
      }
      
      for (let i = 0; i < coordPairs.length; i += 2) {
        if (i + 1 >= coordPairs.length) continue;
        
        const x = parseFloat(coordPairs[i]);
        const y = parseFloat(coordPairs[i + 1]);
        
        if (isNaN(x) || isNaN(y)) {
          console.warn('Invalid coordinates in SVG path:', coordPairs[i], coordPairs[i + 1]);
          continue; // 跳过无效的坐标
        }
        
        const point = [x, y];
        
        // 对于L命令，直接添加点
        if (type === 'L') {
          result.push(point);
          currentPath.push(point);
        } 
        // 对于M命令，如果当前路径不为空，添加null分隔符
        else if (type === 'M') {
          if (currentPath.length > 0) {
            result.push(null);
          }
          result.push(point);
          currentPath = [point];
        }
      }
    }
    
    // 移除末尾的null
    if (result.length > 0 && result[result.length - 1] === null) {
      result.pop();
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing SVG path:', error);
    return [];
  }
}

/**
 * 获取等值线级别对应的颜色
 * @param {number} level 等值线级别
 * @param {Array<number>} levels 所有级别
 * @param {Array<Array<number|string>>} colorScale 颜色映射
 * @param {number} t 百分比位置 (0-1)
 * @returns {string} 颜色字符串
 */
function getColorForLevel(level, levels, colorScale, t) {
  try {
    // 确保 colorScale 是有效的
    if (!colorScale || !Array.isArray(colorScale) || colorScale.length === 0) {
      console.warn('Invalid colorScale in getColorForLevel');
      // 使用默认的蓝-红渐变
      return interpolateColorScale(t, [
        [0, 'rgb(0, 0, 255)'],   // 蓝色
        [0.5, 'rgb(255, 0, 255)'], // 紫色
        [1, 'rgb(255, 0, 0)']    // 红色
      ]);
    }
    
    // 如果colorScale的长度与levels长度一致，直接使用对应索引的颜色
    if (Array.isArray(levels) && colorScale.length === levels.length) {
      const index = levels.indexOf(level);
      if (index !== -1 && index < colorScale.length) {
        return colorScale[index][1]; // 直接返回对应的颜色
      }
    }
    
    // 如果提供了t值，直接使用它进行插值
    if (t !== undefined && typeof t === 'number' && !isNaN(t)) {
      return interpolateColorScale(t, colorScale);
    }
    
    // 验证级别数组
    if (!Array.isArray(levels) || levels.length === 0) {
      console.warn('Invalid levels array in getColorForLevel');
      return interpolateColorScale(0.5, colorScale);
    }
    
    // 过滤出有效的级别值
    const validLevels = levels.filter(l => typeof l === 'number' && !isNaN(l));
    if (validLevels.length === 0) {
      console.warn('No valid levels in getColorForLevel');
      return interpolateColorScale(0.5, colorScale);
    }
    
    // 计算相对位置
    const min = Math.min(...validLevels);
    const max = Math.max(...validLevels);
    const range = max - min;
    
    // 避免除以零
    if (range === 0 || !isFinite(range)) {
      return interpolateColorScale(0.5, colorScale);
    }
    
    // 处理无效的level值
    if (typeof level !== 'number' || isNaN(level)) {
      console.warn('Invalid level value in getColorForLevel:', level);
      return interpolateColorScale(0.5, colorScale);
    }
    
    // 计算归一化位置 (0-1)
    let position = (level - min) / range;
    position = Math.max(0, Math.min(1, position)); // 确保在 [0,1] 范围内
    
    // 获取颜色
    return interpolateColorScale(position, colorScale);
  } catch (error) {
    console.error('Error in getColorForLevel:', error, 'for level:', level);
    return 'rgb(0, 0, 0)'; // 默认黑色
  }
}

/**
 * 在颜色比例尺上插值
 * @param {number} t 位置 (0-1)
 * @param {Array<Array<number|string>>} colorScale 颜色映射
 * @returns {string} 颜色字符串
 */
function interpolateColorScale(t, colorScale) {
  try {
    // 确保 t 是有效数字且在 [0,1] 范围内
    if (typeof t !== 'number' || isNaN(t)) {
      console.warn('Invalid t value for color interpolation:', t);
      t = 0.5; // 使用中间值作为默认
    } else {
      t = Math.max(0, Math.min(1, t));
    }
    
    // 如果没有颜色比例尺，使用默认蓝-红渐变
    if (!colorScale || !Array.isArray(colorScale) || colorScale.length === 0) {
      const hue = (1 - t) * 240; // 从蓝色(240)到红色(0)
      return `hsl(${hue}, 100%, 50%)`;
    }
    
    // 验证颜色比例尺格式
    const validColorScale = [];
    for (let i = 0; i < colorScale.length; i++) {
      // 检查是否是有效的颜色比例尺项 [position, color]
      if (Array.isArray(colorScale[i]) && colorScale[i].length >= 2) {
        const pos = typeof colorScale[i][0] === 'number' && !isNaN(colorScale[i][0]) ? 
                    colorScale[i][0] : (colorScale.length > 1 ? i / (colorScale.length - 1) : 0.5);
        const color = colorScale[i][1];
        validColorScale.push([pos, color]);
      } else if (i < colorScale.length) {
        // 如果只提供了颜色，假设位置是均匀分布的
        const pos = colorScale.length > 1 ? i / (colorScale.length - 1) : 0.5;
        validColorScale.push([pos, colorScale[i]]);
      }
    }
    
    // 如果没有有效的颜色比例尺项，使用默认颜色
    if (validColorScale.length === 0) {
      return 'rgb(0, 0, 0)';
    }
    
    // 单个颜色的情况
    if (validColorScale.length === 1) {
      const rgb = parseColor(validColorScale[0][1]);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
    
    // 对颜色比例尺按位置排序
    validColorScale.sort((a, b) => a[0] - b[0]);
    
    // 确保颜色比例尺覆盖 [0,1] 范围
    if (validColorScale[0][0] > 0) {
      validColorScale.unshift([0, validColorScale[0][1]]);
    }
    if (validColorScale[validColorScale.length - 1][0] < 1) {
      validColorScale.push([1, validColorScale[validColorScale.length - 1][1]]);
    }
    
    // 找到t在颜色比例尺中的位置
    let i = 0;
    while (i < validColorScale.length - 1 && t > validColorScale[i+1][0]) {
      i++;
    }
    
    // 边界情况
    if (i >= validColorScale.length - 1) {
      const rgb = parseColor(validColorScale[validColorScale.length - 1][1]);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
    
    // 在两个颜色之间插值
    const tStart = validColorScale[i][0];
    const tEnd = validColorScale[i+1][0];
    const colorStart = validColorScale[i][1];
    const colorEnd = validColorScale[i+1][1];
    
    // 计算子区间中的相对位置
    const segmentT = (tEnd === tStart) ? 0 : (t - tStart) / (tEnd - tStart);
    
    // 插值颜色
    return interpolateColor(colorStart, colorEnd, segmentT);
  } catch (error) {
    console.error('Error in interpolateColorScale:', error, 'for value:', t, 'and scale:', colorScale);
    return 'rgb(0, 0, 0)'; // 出错时返回黑色
  }
}

/**
 * 颜色插值
 * @param {Object|string|Array} color1 颜色1
 * @param {Object|string|Array} color2 颜色2
 * @param {number} t 插值因子 [0,1]
 * @returns {string} 插值后的颜色
 */
function interpolateColor(color1, color2, t) {
  // 确保 t 在 [0,1] 范围内
  t = Math.max(0, Math.min(1, t));
  
  try {
    // 解析颜色
    const rgb1 = parseColor(color1);
    const rgb2 = parseColor(color2);
    
    if (!rgb1 || !rgb2 || 
        typeof rgb1.r !== 'number' || typeof rgb1.g !== 'number' || typeof rgb1.b !== 'number' ||
        typeof rgb2.r !== 'number' || typeof rgb2.g !== 'number' || typeof rgb2.b !== 'number') {
      console.warn('Invalid color values for interpolation:', color1, color2);
      return 'rgb(0, 0, 0)';
    }
    
    // 线性插值
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
    
    // 确保RGB值在有效范围内
    const validR = Math.max(0, Math.min(255, r));
    const validG = Math.max(0, Math.min(255, g));
    const validB = Math.max(0, Math.min(255, b));
    
    return `rgb(${validR}, ${validG}, ${validB})`;
  } catch (error) {
    console.error('Error interpolating colors:', error, 'for colors:', color1, color2);
    return 'rgb(0, 0, 0)'; // 默认黑色
  }
}

/**
 * 解析颜色字符串为RGB对象
 * @param {string|Object|Array} color 颜色字符串或对象
 * @returns {Object} RGB对象 {r,g,b}
 */
function parseColor(color) {
  try {
    // 处理 null 或 undefined
    if (color === null || color === undefined) {
      return { r: 0, g: 0, b: 0 };
    }
    
    // 如果已经是RGB对象，直接返回
    if (typeof color === 'object' && color !== null && 'r' in color && 'g' in color && 'b' in color) {
      return {
        r: typeof color.r === 'number' ? Math.min(255, Math.max(0, Math.round(color.r))) : 0,
        g: typeof color.g === 'number' ? Math.min(255, Math.max(0, Math.round(color.g))) : 0,
        b: typeof color.b === 'number' ? Math.min(255, Math.max(0, Math.round(color.b))) : 0
      };
    }
    
    // 处理数组格式 [r, g, b]
    if (Array.isArray(color) && color.length >= 3) {
      return {
        r: typeof color[0] === 'number' ? Math.min(255, Math.max(0, Math.round(color[0]))) : 0,
        g: typeof color[1] === 'number' ? Math.min(255, Math.max(0, Math.round(color[1]))) : 0,
        b: typeof color[2] === 'number' ? Math.min(255, Math.max(0, Math.round(color[2]))) : 0
      };
    }
    
    // 处理字符串类型的颜色
    if (typeof color === 'string') {
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
        let hex = color.substring(1);
        
        // 处理简写形式 (#RGB)
        if (hex.length === 3) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        
        if (hex.length === 6) {
          const bigint = parseInt(hex, 16);
          return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255
          };
        }
      }
      
      // 处理颜色名称
      const colorNames = {
        black: {r: 0, g: 0, b: 0},
        white: {r: 255, g: 255, b: 255},
        red: {r: 255, g: 0, b: 0},
        green: {r: 0, g: 128, b: 0},
        blue: {r: 0, g: 0, b: 255},
        yellow: {r: 255, g: 255, b: 0},
        cyan: {r: 0, g: 255, b: 255},
        magenta: {r: 255, g: 0, b: 255},
        gray: {r: 128, g: 128, b: 128},
        orange: {r: 255, g: 165, b: 0},
        purple: {r: 128, g: 0, b: 128}
      };
      
      const lowerColor = color.toLowerCase();
      if (colorNames[lowerColor]) {
        return colorNames[lowerColor];
      }
    } else {
      // 非字符串、非对象、非数组的颜色，尝试转换为字符串
      const colorStr = String(color);
      
      // 处理基本的颜色名称
      const colorNames = {
        black: {r: 0, g: 0, b: 0},
        white: {r: 255, g: 255, b: 255},
        red: {r: 255, g: 0, b: 0},
        green: {r: 0, g: 128, b: 0},
        blue: {r: 0, g: 0, b: 255}
      };
      
      const lowerColor = colorStr.toLowerCase();
      if (colorNames[lowerColor]) {
        return colorNames[lowerColor];
      }
    }
  } catch (error) {
    console.error('Error parsing color:', error, 'for color:', color);
  }
  
  // 默认黑色
  return { r: 0, g: 0, b: 0 };
}

/**
 * 将路径数组转换为多边形数组
 * @param {Array} path 路径数组（包含null分隔符）
 * @returns {Array<Array<Array<number>>>} 多边形数组
 */
function convertPathToPolygons(path) {
  // 安全检查
  if (!path) return [];
  
  try {
    if (!Array.isArray(path)) {
      console.warn('Path is not an array:', path);
      return [];
    }
    
    if (path.length === 0) return [];
    
    // 检查是否是只有单个点的特殊情况
    let singlePointOnly = true;
    let hasNonNull = false;
    
    for (let i = 0; i < path.length; i++) {
      if (path[i] !== null) {
        hasNonNull = true;
        if (i + 1 < path.length && path[i+1] !== null) {
          singlePointOnly = false;
          break;
        }
      }
    }
    
    // 如果只有单个点，我们需要创建一个围绕它的小多边形
    if (singlePointOnly && hasNonNull) {
      console.log('检测到单点路径，创建围绕它的多边形');
      
      // 找到第一个非null点
      let firstPoint = null;
      for (const pt of path) {
        if (pt !== null && Array.isArray(pt) && pt.length >= 2) {
          firstPoint = pt;
          break;
        }
      }
      
      if (firstPoint) {
        // 创建一个小矩形作为多边形
        const size = 0.5; // 矩形大小
        const polygon = [
          [firstPoint[0] - size, firstPoint[1] - size],
          [firstPoint[0] + size, firstPoint[1] - size],
          [firstPoint[0] + size, firstPoint[1] + size],
          [firstPoint[0] - size, firstPoint[1] + size],
          [firstPoint[0] - size, firstPoint[1] - size]
        ];
        
        return [polygon];
      }
    }
    
    const polygons = [];
    let currentPolygon = [];
    
    // 安全的点比较函数
    const safeEqualPts = (pt1, pt2, xtol, ytol) => {
      if (!Array.isArray(pt1) || !Array.isArray(pt2) || 
          pt1.length < 2 || pt2.length < 2) return false;
      
      const x1 = pt1[0];
      const y1 = pt1[1];
      const x2 = pt2[0];
      const y2 = pt2[1];
      
      if (typeof x1 !== 'number' || isNaN(x1) || !isFinite(x1) ||
          typeof y1 !== 'number' || isNaN(y1) || !isFinite(y1) ||
          typeof x2 !== 'number' || isNaN(x2) || !isFinite(x2) ||
          typeof y2 !== 'number' || isNaN(y2) || !isFinite(y2)) {
        return false;
      }
      
      return Math.abs(x1 - x2) < xtol && Math.abs(y1 - y2) < ytol;
    };
    
    // 判断点是否有效
    const isValidPoint = (pt) => {
      return Array.isArray(pt) && pt.length >= 2 && 
             typeof pt[0] === 'number' && !isNaN(pt[0]) && isFinite(pt[0]) &&
             typeof pt[1] === 'number' && !isNaN(pt[1]) && isFinite(pt[1]);
    };
    
    // 处理每个点
    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      
      if (point === null) {
        // 结束当前多边形
        if (currentPolygon.length > 0) {
          // 如果只有1-2个点，尝试创建一个小多边形
          if (currentPolygon.length < 3) {
            if (currentPolygon.length === 1 && isValidPoint(currentPolygon[0])) {
              const pt = currentPolygon[0];
              const size = 0.5; // 创建的矩形大小
              
              currentPolygon = [
                [pt[0] - size, pt[1] - size],
                [pt[0] + size, pt[1] - size],
                [pt[0] + size, pt[1] + size],
                [pt[0] - size, pt[1] + size],
                [pt[0] - size, pt[1] - size]
              ];
            } else if (currentPolygon.length === 2 && 
                      isValidPoint(currentPolygon[0]) && 
                      isValidPoint(currentPolygon[1])) {
              // 两点情况，创建一个细长矩形
              const pt1 = currentPolygon[0];
              const pt2 = currentPolygon[1];
              const dx = pt2[0] - pt1[0];
              const dy = pt2[1] - pt1[1];
              const length = Math.sqrt(dx*dx + dy*dy);
              
              if (length > 0) {
                const nx = -dy / length * 0.2; // 法向量
                const ny = dx / length * 0.2;
                
                currentPolygon = [
                  [pt1[0] + nx, pt1[1] + ny],
                  [pt2[0] + nx, pt2[1] + ny],
                  [pt2[0] - nx, pt2[1] - ny],
                  [pt1[0] - nx, pt1[1] - ny],
                  [pt1[0] + nx, pt1[1] + ny]
                ];
              }
            }
          } else {
            // 确保多边形闭合
            if (!safeEqualPts(currentPolygon[0], currentPolygon[currentPolygon.length - 1], 0.01, 0.01)) {
              // 只有在开始点有效时才添加
              if (isValidPoint(currentPolygon[0])) {
                currentPolygon.push([...currentPolygon[0]]);
              }
            }
          }
          
          // 检查是否有足够的点
          if (currentPolygon.length >= 3) {
            polygons.push([...currentPolygon]); // 创建副本以避免引用问题
          }
        }
        currentPolygon = [];
      } else if (isValidPoint(point)) {
        // 添加有效的点
        currentPolygon.push([...point]); // 创建副本以避免引用问题
      }
    }
    
    // 处理最后一个多边形（如果没有以null结束）
    if (currentPolygon.length > 0) {
      // 同样处理少于3个点的情况
      if (currentPolygon.length < 3) {
        if (currentPolygon.length === 1 && isValidPoint(currentPolygon[0])) {
          const pt = currentPolygon[0];
          const size = 0.5; // 创建的矩形大小
          
          currentPolygon = [
            [pt[0] - size, pt[1] - size],
            [pt[0] + size, pt[1] - size],
            [pt[0] + size, pt[1] + size],
            [pt[0] - size, pt[1] + size],
            [pt[0] - size, pt[1] - size]
          ];
        } else if (currentPolygon.length === 2 && 
                  isValidPoint(currentPolygon[0]) && 
                  isValidPoint(currentPolygon[1])) {
          // 两点情况，创建一个细长矩形
          const pt1 = currentPolygon[0];
          const pt2 = currentPolygon[1];
          const dx = pt2[0] - pt1[0];
          const dy = pt2[1] - pt1[1];
          const length = Math.sqrt(dx*dx + dy*dy);
          
          if (length > 0) {
            const nx = -dy / length * 0.2; // 法向量
            const ny = dx / length * 0.2;
            
            currentPolygon = [
              [pt1[0] + nx, pt1[1] + ny],
              [pt2[0] + nx, pt2[1] + ny],
              [pt2[0] - nx, pt2[1] - ny],
              [pt1[0] - nx, pt1[1] - ny],
              [pt1[0] + nx, pt1[1] + ny]
            ];
          }
        }
      } else {
        // 确保多边形闭合
        if (!safeEqualPts(currentPolygon[0], currentPolygon[currentPolygon.length - 1], 0.01, 0.01)) {
          if (isValidPoint(currentPolygon[0])) {
            currentPolygon.push([...currentPolygon[0]]);
          }
        }
      }
      
      // 检查是否有足够的点
      if (currentPolygon.length >= 3) {
        polygons.push([...currentPolygon]);
      }
    }
    
    return polygons;
  } catch (error) {
    console.error('Error converting path to polygons:', error);
    return [];
  }
}

/**
 * 确保颜色比例尺有效，并且长度与levels匹配
 * @param {*} colorScale 原始颜色比例尺
 * @param {number} levelCount levels数组的长度
 * @returns {Array} 有效的颜色比例尺，长度与levels一致
 */
function getValidColorScale(colorScale, levelCount) {
  // 验证颜色比例尺
  let validColorScale = colorScale;
  
  // 如果提供的是颜色数组而不是颜色比例尺数组，转换为标准格式
  if (Array.isArray(colorScale)) {
    if (colorScale.length > 0 && !Array.isArray(colorScale[0])) {
      // 简单颜色数组，转换为标准格式 [[pos, color], ...]
      validColorScale = colorScale.map((color, idx) => {
        const pos = colorScale.length > 1 ? idx / (colorScale.length - 1) : 0.5;
        return [pos, color];
      });
    }
  } else if (!colorScale) {
    // 如果没有提供颜色比例尺，使用默认的蓝-红渐变
    validColorScale = [
      [0, 'rgb(0, 0, 255)'],   // 蓝色
      [0.5, 'rgb(255, 0, 255)'], // 紫色
      [1, 'rgb(255, 0, 0)']    // 红色
    ];
  } else if (typeof colorScale === 'object' && !Array.isArray(colorScale)) {
    // 如果是自定义对象格式，尝试转换为标准格式
    try {
      if ('colors' in colorScale && Array.isArray(colorScale.colors)) {
        // 如果有 colors 属性，使用它
        validColorScale = colorScale.colors.map((color, idx) => {
          const pos = colorScale.colors.length > 1 ? idx / (colorScale.colors.length - 1) : 0.5;
          return [pos, color];
        });
      } else {
        // 尝试从对象中提取颜色
        const colors = [];
        for (const key in colorScale) {
          if (colorScale.hasOwnProperty(key)) {
            colors.push(colorScale[key]);
          }
        }
        
        if (colors.length > 0) {
          validColorScale = colors.map((color, idx) => {
            const pos = colors.length > 1 ? idx / (colors.length - 1) : 0.5;
            return [pos, color];
          });
        } else {
          // 回退到默认颜色
          validColorScale = [
            [0, 'rgb(0, 0, 255)'],   // 蓝色
            [0.5, 'rgb(255, 0, 255)'], // 紫色
            [1, 'rgb(255, 0, 0)']    // 红色
          ];
        }
      }
    } catch (e) {
      // 回退到默认颜色
      validColorScale = [
        [0, 'rgb(0, 0, 255)'],   // 蓝色
        [0.5, 'rgb(255, 0, 255)'], // 紫色
        [1, 'rgb(255, 0, 0)']    // 红色
      ];
    }
  }
  
  // 确保validColorScale是标准格式[[pos, color], ...]
  if (!Array.isArray(validColorScale) || !Array.isArray(validColorScale[0])) {
    console.warn('Invalid color scale format, using default');
    validColorScale = [
      [0, 'rgb(0, 0, 255)'],
      [0.5, 'rgb(255, 0, 255)'],
      [1, 'rgb(255, 0, 0)']
    ];
  }
  
  // 如果levels长度大于颜色比例尺长度，需要创建足够的颜色
  if (levelCount > 0 && validColorScale.length > 0) {
    // 提取位置和颜色
    const positions = validColorScale.map(item => item[0]);
    const colors = validColorScale.map(item => item[1]);
    
    // 创建新的颜色比例尺，确保长度与levels一致
    const newColorScale = [];
    for (let i = 0; i < levelCount; i++) {
      const t = i / Math.max(1, levelCount - 1); // 归一化位置 [0,1]
      
      // 找到t在positions中的位置
      let idx = 0;
      while (idx < positions.length - 1 && t > positions[idx + 1]) {
        idx++;
      }
      
      let color;
      if (idx >= positions.length - 1) {
        // 如果超出范围，使用最后一个颜色
        color = colors[colors.length - 1];
      } else if (positions[idx] === t) {
        // 如果正好匹配某个位置，直接使用对应颜色
        color = colors[idx];
      } else {
        // 否则在两个颜色之间插值
        const p1 = positions[idx];
        const p2 = positions[idx + 1];
        const c1 = colors[idx];
        const c2 = colors[idx + 1];
        
        // 计算插值比例
        const segmentT = (p2 === p1) ? 0 : (t - p1) / (p2 - p1);
        color = interpolateColor(c1, c2, segmentT);
      }
      
      newColorScale.push([t, color]);
    }
    
    return newColorScale;
  }
  
  return validColorScale;
} 