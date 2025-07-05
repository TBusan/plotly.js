/**
 * ContourToGeoJSON
 * 
 * This module extracts contour lines from plotly.js contour traces
 * and converts them to GeoJSON format for use in mapping applications.
 * 
 * Based on plotly.js's implementation of the Marching Squares algorithm.
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ContourToGeoJSON = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  /**
   * Constants for Marching Squares algorithm
   * Copied directly from plotly.js contour implementation
   */
  const CONSTANTS = {
    // some constants to help with marching squares algorithm
    // where does the path start for each index?
    BOTTOMSTART: [1, 9, 13, 104, 713],
    TOPSTART: [4, 6, 7, 104, 713],
    LEFTSTART: [8, 12, 14, 208, 1114],
    RIGHTSTART: [2, 3, 11, 208, 1114],

    // which way [dx,dy] do we leave a given index?
    // saddles are already disambiguated
    NEWDELTA: [
      null, [-1, 0], [0, -1], [-1, 0],
      [1, 0], null, [0, -1], [-1, 0],
      [0, 1], [0, 1], null, [0, 1],
      [1, 0], [1, 0], [0, -1]
    ],

    // for each saddle, the first index here is used
    // for dx||dy<0, the second for dx||dy>0
    CHOOSESADDLE: {
      104: [4, 1],
      208: [2, 8],
      713: [7, 13],
      1114: [11, 14]
    },

    // after one index has been used for a saddle, which do we
    // substitute to be used up later?
    SADDLEREMAINDER: {1: 4, 2: 8, 4: 1, 7: 13, 8: 2, 11: 14, 13: 7, 14: 11}
  };

  /**
   * Helper function to create an empty pathinfo object
   * @param {Array} z - 2D array of values
   * @param {Array} x - x coordinates
   * @param {Array} y - y coordinates
   * @param {Array} contours - contour levels
   * @returns {Array} Array of pathinfo objects
   */
  function emptyPathinfo(z, x, y, contours) {
    const pathinfo = [];
    
    for (let i = 0; i < contours.length; i++) {
      pathinfo.push({
        level: contours[i],
        crossings: {},
        starts: [],
        edgepaths: [],
        paths: [],
        z: z,
        x: x,
        y: y,
        smoothing: 0
      });
    }
    
    return pathinfo;
  }

  /**
   * Calculate contour crossings using the Marching Squares algorithm
   * @param {Array} pathinfo - Array of pathinfo objects
   */
  function makeCrossings(pathinfo) {
    const z = pathinfo[0].z;
    const m = z.length;
    const n = z[0].length;
    const twoWide = m === 2 || n === 2;
    
    for (let yi = 0; yi < m - 1; yi++) {
      let ystartIndices = [];
      if (yi === 0) ystartIndices = ystartIndices.concat(CONSTANTS.BOTTOMSTART);
      if (yi === m - 2) ystartIndices = ystartIndices.concat(CONSTANTS.TOPSTART);

      for (let xi = 0; xi < n - 1; xi++) {
        let startIndices = ystartIndices.slice();
        if (xi === 0) startIndices = startIndices.concat(CONSTANTS.LEFTSTART);
        if (xi === n - 2) startIndices = startIndices.concat(CONSTANTS.RIGHTSTART);

        const label = xi + ',' + yi;
        const corners = [
          [z[yi][xi], z[yi][xi + 1]],
          [z[yi + 1][xi], z[yi + 1][xi + 1]]
        ];
        
        for (let i = 0; i < pathinfo.length; i++) {
          const pi = pathinfo[i];
          const mi = getMarchingIndex(pi.level, corners);
          if (!mi) continue;

          pi.crossings[label] = mi;
          if (startIndices.indexOf(mi) !== -1) {
            pi.starts.push([xi, yi]);
            if (twoWide && startIndices.indexOf(mi, startIndices.indexOf(mi) + 1) !== -1) {
              pi.starts.push([xi, yi]);
            }
          }
        }
      }
    }
  }

  /**
   * Get the marching index for a given contour level
   * @param {Number} val - Contour level
   * @param {Array} corners - Corner values
   * @returns {Number} Marching index
   */
  function getMarchingIndex(val, corners) {
    let mi = (corners[0][0] > val ? 0 : 1) +
             (corners[0][1] > val ? 0 : 2) +
             (corners[1][1] > val ? 0 : 4) +
             (corners[1][0] > val ? 0 : 8);
    
    if (mi === 5 || mi === 10) {
      const avg = (corners[0][0] + corners[0][1] + corners[1][0] + corners[1][1]) / 4;
      // two peaks with a big valley
      if (val > avg) return (mi === 5) ? 713 : 1114;
      // two valleys with a big ridge
      return (mi === 5) ? 104 : 208;
    }
    
    return (mi === 15) ? 0 : mi;
  }

  /**
   * Find all contour paths for the given pathinfo
   * @param {Array} pathinfo - Array of pathinfo objects
   */
  function findAllPaths(pathinfo) {
    for (let pi = 0; pi < pathinfo.length; pi++) {
      const pathinfo_pi = pathinfo[pi];
      const startLocations = pathinfo_pi.starts;
      
      for (let i = 0; i < startLocations.length; i++) {
        const startLoc = startLocations[i];
        const startLocStr = startLoc.join(',');
        
        if (pathinfo_pi.crossings[startLocStr]) {
          const path = makePath(pathinfo_pi, startLoc, true);
          if (path && path.length > 1) {
            if (path[0][0] === path[path.length - 1][0] &&
                path[0][1] === path[path.length - 1][1]) {
              pathinfo_pi.paths.push(path);
            } else {
              pathinfo_pi.edgepaths.push(path);
            }
          }
        }
      }
      
      let cnt = 0;
      while (Object.keys(pathinfo_pi.crossings).length && cnt < 10000) {
        cnt++;
        const startLoc = Object.keys(pathinfo_pi.crossings)[0].split(',').map(Number);
        makePath(pathinfo_pi, startLoc, false);
      }
      
      if (cnt === 10000) {
        console.warn('Infinite loop in contour?');
      }
    }
  }

  /**
   * Check if two points are equal
   * @param {Array} pt1 - First point [x, y]
   * @param {Array} pt2 - Second point [x, y]
   * @returns {Boolean} Whether the points are equal
   */
  function equalPts(pt1, pt2) {
    return Math.abs(pt1[0] - pt2[0]) < 1e-6 && Math.abs(pt1[1] - pt2[1]) < 1e-6;
  }

  /**
   * Create a contour path starting from the given location
   * @param {Object} pi - Pathinfo object
   * @param {Array} loc - Starting location [xi, yi]
   * @param {Boolean} edgeflag - Whether this is an edge path
   * @returns {Array} Path as array of [x, y] coordinates
   */
  function makePath(pi, loc, edgeflag) {
    let locStr = loc.join(',');
    let mi = pi.crossings[locStr];
    let marchStep = getStartStep(mi, edgeflag, loc);
    
    // Start by going backward a half step and finding the crossing point
    let firstPoint = getInterpPx(pi, loc, [-marchStep[0], -marchStep[1]]);
    // 确保第一个点不包含null值
    if (!isValidPoint(firstPoint)) {
      console.warn('Invalid first point in contour path:', firstPoint);
      return null;
    }
    
    let pts = [firstPoint];
    
    const m = pi.z.length;
    const n = pi.z[0].length;
    const startLoc = loc.slice();
    const startStep = marchStep.slice();
    let cnt;

    // Now follow the path
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

      // Find the crossing a half step forward, and then take the full step
      const nextPoint = getInterpPx(pi, loc, marchStep);
      
      // 确保下一个点不包含null值
      if (!isValidPoint(nextPoint)) {
        console.warn('Invalid point in contour path:', nextPoint);
        // 如果是无效点，我们可以尝试用前一个点的值来修复
        if (pts.length > 0) {
          const lastValidPoint = pts[pts.length - 1];
          // 使用最后一个有效点，但稍微偏移一点以避免完全重复
          const fixedPoint = [
            lastValidPoint[0] + (marchStep[0] * 0.01),
            lastValidPoint[1] + (marchStep[1] * 0.01)
          ];
          pts.push(fixedPoint);
        }
      } else {
        pts.push(nextPoint);
      }
      
      loc[0] += marchStep[0];
      loc[1] += marchStep[1];
      locStr = loc.join(',');

      // Don't include the same point multiple times
      if (pts.length > 1 && equalPts(pts[pts.length - 1], pts[pts.length - 2])) {
        pts.pop();
      }

      const atEdge = (marchStep[0] && (loc[0] < 0 || loc[0] > n - 2)) ||
              (marchStep[1] && (loc[1] < 0 || loc[1] > m - 2));

      const closedLoop = loc[0] === startLoc[0] && loc[1] === startLoc[1] &&
              marchStep[0] === startStep[0] && marchStep[1] === startStep[1];

      // Have we completed a loop, or reached an edge?
      if (closedLoop || (edgeflag && atEdge)) break;

      mi = pi.crossings[locStr];
    }

    if (cnt === 10000) {
      console.warn('Infinite loop in contour path');
    }
    
    // 最后检查一遍，确保没有无效点
    pts = pts.filter(isValidPoint);
    
    // 确保路径至少有两个点
    if (pts.length < 2) {
      return null;
    }
    
    return pts;
  }

  /**
   * 检查点是否有效（不包含null或NaN值）
   * @param {Array} point - 点坐标 [x, y]
   * @returns {Boolean} 点是否有效
   */
  function isValidPoint(point) {
    return point && 
           point.length === 2 && 
           point[0] !== null && 
           point[1] !== null && 
           !isNaN(point[0]) && 
           !isNaN(point[1]);
  }

  /**
   * Get interpolated x,y coordinates for a contour crossing
   * @param {Object} pi - Pathinfo object
   * @param {Array} loc - Location [xi, yi]
   * @param {Array} step - Step direction [dx, dy]
   * @returns {Array} [x, y] coordinates
   */
  function getInterpPx(pi, loc, step) {
    const z = pi.z;
    const x = pi.x;
    const y = pi.y;
    const level = pi.level;
    
    // 检查索引是否在有效范围内
    const xi = loc[0];
    const yi = loc[1];
    const xi_step = xi + step[0];
    const yi_step = yi + step[1];
    
    // 确保所有索引都在有效范围内
    if (xi < 0 || xi >= x.length || yi < 0 || yi >= y.length ||
        xi_step < 0 || xi_step >= x.length || yi_step < 0 || yi_step >= y.length) {
      return null;
    }
    
    try {
      let x0, x1, y0, y1, z0, z1;
      
      if (step[0]) {
        // 水平步进
        x0 = x[xi];
        x1 = x[xi_step];
        y0 = y1 = y[yi];
        z0 = z[yi][xi];
        z1 = z[yi][xi_step];
      } else {
        // 垂直步进
        y0 = y[yi];
        y1 = y[yi_step];
        x0 = x1 = x[xi];
        z0 = z[yi][xi];
        z1 = z[yi_step][xi];
      }
      
      // 检查z值是否有效
      if (z0 === undefined || z1 === undefined || z0 === null || z1 === null) {
        return null;
      }
      
      // 避免除以零
      if (z1 === z0) {
        return step[0] ? [x0, y0] : [x0, y0];
      }
      
      const t = (level - z0) / (z1 - z0);
      
      // 确保t在[0,1]范围内，避免外推
      const tClamped = Math.max(0, Math.min(1, t));
      
      if (step[0]) {
        return [x0 + tClamped * (x1 - x0), y0];
      } else {
        return [x0, y0 + tClamped * (y1 - y0)];
      }
    } catch (e) {
      console.warn('Error in getInterpPx:', e);
      return null;
    }
  }

  /**
   * Get the starting step for a contour path
   * @param {Number} mi - Marching index
   * @param {Boolean} edgeflag - Whether this is an edge path
   * @param {Array} loc - Starting location [xi, yi]
   * @returns {Array} Starting step [dx, dy]
   */
  function getStartStep(mi, edgeflag, loc) {
    let dx = 0;
    let dy = 0;
    
    if (mi > 20 && edgeflag) {
      // These saddles start at +/- x
      if (mi === 208 || mi === 1114) {
        // If we're starting at the left side, we must be going right
        dx = loc[0] === 0 ? 1 : -1;
      } else {
        // If we're starting at the bottom, we must be going up
        dy = loc[1] === 0 ? 1 : -1;
      }
    } else if (CONSTANTS.BOTTOMSTART.indexOf(mi) !== -1) dy = 1;
    else if (CONSTANTS.LEFTSTART.indexOf(mi) !== -1) dx = 1;
    else if (CONSTANTS.TOPSTART.indexOf(mi) !== -1) dy = -1;
    else dx = -1;
    
    return [dx, dy];
  }

  /**
   * Convert contour paths to GeoJSON LineString features
   * @param {Array} paths - Array of paths
   * @param {Number} level - Contour level
   * @returns {Object} GeoJSON features
   */
  function pathsToLineGeoJSON(paths, level) {
    const features = [];
    
    for (let i = 0; i < paths.length; i++) {
      if (paths[i] && paths[i].length >= 2) {
        // 确保路径中没有无效点
        const validPath = paths[i].filter(isValidPoint);
        
        if (validPath.length >= 2) {
          features.push({
            type: 'Feature',
            properties: {
              level: level
            },
            geometry: {
              type: 'LineString',
              coordinates: validPath
            }
          });
        }
      }
    }
    
    return features;
  }

  /**
   * 将等值线数据转换为GeoJSON格式
   * @param {Object} options - 配置选项
   * @param {Array} options.z - 2D数值数组
   * @param {Array} options.x - x坐标
   * @param {Array} options.y - y坐标
   * @param {Array} options.contours - 等值线级别
   * @returns {Object} 包含等值线的GeoJSON对象
   */
  function contourToGeoJSON(options) {
    const { z, x, y, contours } = options;
    
    // 为每个等值线级别创建pathinfo
    const pathinfo = emptyPathinfo(z, x, y, contours);
    
    // 计算等值线交叉点和路径
    makeCrossings(pathinfo);
    findAllPaths(pathinfo);
    
    // 创建GeoJSON结果
    const result = {
      type: 'FeatureCollection',
      features: []
    };
    
    // 处理每个等值线级别
    for (let i = 0; i < pathinfo.length; i++) {
      const pi = pathinfo[i];
      const level = pi.level;
      
      // 添加边缘路径（非闭合路径）
      if (pi.edgepaths.length > 0) {
        const lineFeatures = pathsToLineGeoJSON(pi.edgepaths, level);
        result.features = result.features.concat(lineFeatures);
      }
      
      // 添加闭合路径（内部等值线）
      if (pi.paths.length > 0) {
        const lineFeatures = pathsToLineGeoJSON(pi.paths, level);
        result.features = result.features.concat(lineFeatures);
      }
    }
    
    return result;
  }

  // 返回公共API
  return {
    contourToGeoJSON: contourToGeoJSON
  };
}));
