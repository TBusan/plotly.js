/**
 * contour-generator.js
 * 
 * 等值线生成器模块，用于在主线程中调用 Web Worker 进行等值线计算
 * 提供与 Plotly.js 兼容的 API 接口
 */

/**
 * 等值线生成器类
 */
class ContourGenerator {
  /**
   * 构造函数
   * @param {Object} options 配置选项
   */
  constructor(options = {}) {
    this.options = Object.assign({
      // 默认配置
      smoothing: 0,
      coloring: 'fill',
      showLines: true,
      connectGaps: false,
      workerUrl: './contour-worker.js',
      useImprovedPathHandling: true, // 是否使用改进的路径处理算法
      ncontours: 10,
      fillOpacity: 0.7,
      zsmooth: true,
      lineGenerationMode: 'improved' // 线条生成模式，可选 'improved' 或 'simple'
    }, options);
    
    this._worker = null;
    this._callbacks = {};
    this._callbackId = 0;
    this._workerInitialized = false;
    
    // 初始化 Worker
    this._initWorker();
  }
  
  /**
   * 初始化 Web Worker
   * @private
   */
  _initWorker() {
    if (typeof Worker === 'undefined') {
      console.error('Web Worker is not supported in this environment');
      return;
    }
    
    try {
      this._worker = new Worker(this.options.workerUrl);
      
      // 设置消息处理
      this._worker.onmessage = (e) => {
        const { id, status, result, error } = e.data;
        console.log('Worker message received:', e.data);
        
        // 查找回调
        if (id && this._callbacks[id]) {
          const callback = this._callbacks[id];
          
          if (status === 'success') {
            callback.resolve(result);
          } else {
            callback.reject(new Error(error || 'Unknown error'));
          }
          
          // 清理回调
          delete this._callbacks[id];
        }
      };
      
      this._worker.onerror = (error) => {
        console.error('Worker error:', error);
        this._workerInitialized = false;
      };
      
      this._workerInitialized = true;
      console.log('Worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Web Worker:', error);
      this._workerInitialized = false;
    }
  }
  
  /**
   * 发送消息到 Worker
   * @param {Object} data 消息数据
   * @returns {Promise} Promise 对象
   * @private
   */
  _postMessage(data) {
    return new Promise((resolve, reject) => {
      if (!this._worker || !this._workerInitialized) {
        reject(new Error('Worker not initialized or not available'));
        return;
      }
      
      // 生成唯一 ID
      const id = ++this._callbackId;
      
      // 存储回调
      this._callbacks[id] = { resolve, reject };
      
      // 发送消息
      try {
        console.log('Posting message to worker:', Object.assign({ id }, data));
        this._worker.postMessage(Object.assign({ id }, data));
      } catch (error) {
        delete this._callbacks[id];
        reject(new Error('Failed to send message to worker: ' + error.message));
      }
    });
  }
  
  /**
   * 生成等值线
   * @param {Array<Array<number>>|Float32Array} data 二维数据数组或一维展平的数据
   * @param {number} width 数据宽度
   * @param {number} height 数据高度
   * @param {Object} options 配置选项
   * @returns {Promise<Object>} 等值线数据
   */
  generateContours(data, width, height, options = {}) {
    // 合并选项
    const mergedOptions = Object.assign({}, this.options, options);
    
    // 计算等值线级别
    const levels = this._calculateLevels(data, mergedOptions);
    
    // 发送消息到 Worker
    return this._postMessage({
      data,
      width,
      height,
      levels,
      colorScale: mergedOptions.colorScale || this._defaultColorScale(),
      options: {
        smoothing: mergedOptions.smoothing,
        coloring: mergedOptions.coloring,
        showLines: mergedOptions.showLines,
        connectGaps: mergedOptions.connectGaps,
        useImprovedPathHandling: mergedOptions.useImprovedPathHandling,
        ncontours: mergedOptions.ncontours || 10,
        fillOpacity: mergedOptions.fillOpacity || 0.7,
        zsmooth: mergedOptions.zsmooth !== undefined ? mergedOptions.zsmooth : true,
        lineGenerationMode: mergedOptions.lineGenerationMode || 'improved'
      }
    }).then(result => {
      // 预处理结果（如需比较不同算法的结果）
      return this._processResult(result, mergedOptions);
    });
  }
  
  /**
   * 处理生成的等值线结果
   * @param {Object} result 等值线结果
   * @param {Object} options 选项
   * @returns {Object} 处理后的结果
   * @private
   */
  _processResult(result, options) {
    // 如果需要原始结果（用于比较算法），可以在这里处理
    if (options.includeOriginalAlgorithm && !options.useImprovedPathHandling) {
      // 标记为原始算法结果
      result.algorithmType = 'original';
    } else {
      // 标记为改进算法结果
      result.algorithmType = 'improved';
    }
    
    // 确保统计信息存在
    if (!result.stats) {
      result.stats = this._calculateStats(result);
    }
    
    return result;
  }
  
  /**
   * 计算等值线结果的统计信息
   * @param {Object} result 等值线结果
   * @returns {Object} 统计信息
   * @private
   */
  _calculateStats(result) {
    const stats = {
      levelCount: result.levels.length,
      totalPaths: 0,
      totalEdgePaths: 0,
      totalPoints: 0
    };
    
    // 计算路径数量和点的总数
    if (result.levels) {
      result.levels.forEach(level => {
        if (level.paths) {
          stats.totalPaths += level.paths.length;
          level.paths.forEach(path => {
            stats.totalPoints += path.length;
          });
        }
        
        if (level.edgepaths) {
          stats.totalEdgePaths += level.edgepaths.length;
          level.edgepaths.forEach(path => {
            stats.totalPoints += path.length;
          });
        }
      });
    }
    
    return stats;
  }
  
  /**
   * 计算等值线级别
   * @param {Array<Array<number>>|Float32Array} data 数据
   * @param {Object} options 选项
   * @returns {Array<number>} 等值线级别
   * @private
   */
  _calculateLevels(data, options) {
    // 如果已经提供了级别，直接返回
    if (options.levels && Array.isArray(options.levels)) {
      return options.levels;
    }
    
    // 计算数据范围
    const { min, max } = this._calculateRange(data);
    
    // 计算级别数量
    const count = options.ncontours || 10;
    
    // 计算级别间隔
    const start = options.start !== undefined ? options.start : min;
    const end = options.end !== undefined ? options.end : max;
    const size = options.size !== undefined ? options.size : (end - start) / count;
    
    // 生成级别数组
    const levels = [];
    for (let level = start; level <= end; level += size) {
      levels.push(level);
    }
    
    return levels;
  }
  
  /**
   * 计算数据范围
   * @param {Array<Array<number>>|Float32Array} data 数据
   * @returns {Object} 最小值和最大值
   * @private
   */
  _calculateRange(data) {
    let min = Infinity;
    let max = -Infinity;
    
    // 处理二维数组
    if (Array.isArray(data) && Array.isArray(data[0])) {
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].length; j++) {
          const val = data[i][j];
          if (!isNaN(val)) {
            min = Math.min(min, val);
            max = Math.max(max, val);
          }
        }
      }
    } 
    // 处理一维数组
    else {
      for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (!isNaN(val)) {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      }
    }
    
    return { min, max };
  }
  
  /**
   * 默认颜色映射
   * @returns {Array<Array<number|string>>} 颜色映射
   * @private
   */
  _defaultColorScale() {
    return [
      [0, 'rgb(0, 0, 255)'],
      [0.25, 'rgb(0, 255, 255)'],
      [0.5, 'rgb(0, 255, 0)'],
      [0.75, 'rgb(255, 255, 0)'],
      [1, 'rgb(255, 0, 0)']
    ];
  }
  
  /**
   * 创建自定义颜色映射
   * @param {Array<string>} colors 颜色数组
   * @returns {Array<Array<number|string>>} 颜色映射
   */
  createColorScale(colors) {
    if (!Array.isArray(colors) || colors.length < 2) {
      return this._defaultColorScale();
    }
    
    return colors.map((color, index) => {
      return [index / (colors.length - 1), color];
    });
  }
  
  /**
   * 创建等距的颜色映射
   * @param {Array<number>} values 值数组
   * @param {Array<string>} colors 颜色数组
   * @returns {Array<Array<number|string>>} 颜色映射
   */
  createValueColorScale(values, colors) {
    if (!Array.isArray(values) || !Array.isArray(colors) || 
        values.length !== colors.length || values.length < 2) {
      return this._defaultColorScale();
    }
    
    // 找到最大和最小值
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    // 创建映射
    return values.map((val, index) => {
      const normalizedValue = (val - min) / range;
      return [normalizedValue, colors[index]];
    });
  }
  
  /**
   * 生成默认等值线配置
   * @param {Object} options 额外选项
   * @returns {Object} 配置对象
   */
  createDefaultOptions(options = {}) {
    return Object.assign({
      smoothing: 0.5,
      coloring: 'fill',
      showLines: true,
      connectGaps: false,
      useImprovedPathHandling: true,
      ncontours: 10,
      colorScale: this._defaultColorScale(),
      fillOpacity: 0.7,
      zsmooth: true
    }, options);
  }
  
  /**
   * 销毁实例
   */
  dispose() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    
    this._callbacks = {};
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContourGenerator;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return ContourGenerator; });
} else {
  window.ContourGenerator = ContourGenerator;
} 