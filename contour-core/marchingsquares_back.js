'use strict';

var constants = require('./constants');

// ✅ 预计算 Set 用于 O(1) 查找（在模块加载时只执行一次）
var BOTTOMSTART_SET = new Set(constants.BOTTOMSTART);
var TOPSTART_SET = new Set(constants.TOPSTART);
var LEFTSTART_SET = new Set(constants.LEFTSTART);
var RIGHTSTART_SET = new Set(constants.RIGHTSTART);

/**
 * Calculate all the marching indices for ALL levels at once.
 * Uses an exhaustive approach - checks for contour crossings
 * at every intersection rather than just following a path.
 *
 * Optimized version for better performance with large grids.
 *
 * @param {Array} pathinfo - Array of path info objects, one per contour level
 *   Each pathinfo object should have:
 *   - level: the contour level value
 *   - crossings: object to store crossing data
 *   - starts: array to store starting points
 *   - z: 2D array of z values
 */
function makeCrossings(pathinfo) {
    var z = pathinfo[0].z;
    var m = z.length;
    var n = z[0].length;
    var twoWide = m === 2 || n === 2;
    var numLevels = pathinfo.length;

    // 循环变量
    var yi, xi, i, pi, mi, level;
    var z00, z01, z10, z11, avg;
    var isBottom, isTop, isLeft, isRight;
    var matchCount;

    for (yi = 0; yi < m - 1; yi++) {
        // 预计算行边界状态
        isBottom = yi === 0;
        isTop = yi === m - 2;

        for (xi = 0; xi < n - 1; xi++) {
            // 预计算列边界状态
            isLeft = xi === 0;
            isRight = xi === n - 2;

            // ✅ 优化: 直接访问角点值，避免创建 corners 数组
            z00 = z[yi][xi];
            z01 = z[yi][xi + 1];
            z10 = z[yi + 1][xi];
            z11 = z[yi + 1][xi + 1];

            // 保持字符串 key 格式，确保与 pathfinding.js 兼容
            var label = xi + ',' + yi;

            for (i = 0; i < numLevels; i++) {
                pi = pathinfo[i];
                level = pi.level;

                // ✅ 优化: 内联 getMarchingIndex 逻辑，避免函数调用开销
                // 计算 marching index (0-15)
                mi = (z00 > level ? 0 : 1) +
                     (z01 > level ? 0 : 2) +
                     (z11 > level ? 0 : 4) +
                     (z10 > level ? 0 : 8);

                // 跳过无穿越的情况
                if (mi === 0 || mi === 15) continue;

                // 处理鞍点情况
                if (mi === 5 || mi === 10) {
                    avg = (z00 + z01 + z10 + z11) * 0.25;
                    // 两个峰之间的大山谷
                    if (level > avg) {
                        mi = (mi === 5) ? 713 : 1114;
                    } else {
                        // 两个山谷之间的大山脊
                        mi = (mi === 5) ? 104 : 208;
                    }
                }

                pi.crossings[label] = mi;

                // ✅ 优化: 使用 Set 进行 O(1) 查找，代替 indexOf 的 O(n) 查找
                // 检查是否是边界起点
                matchCount = 0;
                if (isBottom && BOTTOMSTART_SET.has(mi)) matchCount++;
                if (isTop && TOPSTART_SET.has(mi)) matchCount++;
                if (isLeft && LEFTSTART_SET.has(mi)) matchCount++;
                if (isRight && RIGHTSTART_SET.has(mi)) matchCount++;

                if (matchCount > 0) {
                    pi.starts.push([xi, yi]);
                    // 处理边界交叉的情况（如左下角同时满足 LEFT 和 BOTTOM）
                    if (twoWide && matchCount > 1) {
                        pi.starts.push([xi, yi]);
                    }
                }
            }
        }
    }
}

/**
 * Modified marching squares algorithm with saddle point disambiguation.
 * Ignores cases with no crossings.
 *
 * Index based on: http://en.wikipedia.org/wiki/Marching_squares
 * Saddles bifurcate and are represented as the decimal combination
 * of the two appropriate non-saddle indices.
 *
 * @param {Number} val - Contour level value
 * @param {Array} corners - 2x2 array of corner values [[z00, z01], [z10, z11]]
 * @returns {Number} Marching index (0-15 for standard, >100 for saddle points)
 */
function getMarchingIndex(val, corners) {
    var mi = (corners[0][0] > val ? 0 : 1) +
             (corners[0][1] > val ? 0 : 2) +
             (corners[1][1] > val ? 0 : 4) +
             (corners[1][0] > val ? 0 : 8);

    if (mi === 5 || mi === 10) {
        var avg = (corners[0][0] + corners[0][1] +
                   corners[1][0] + corners[1][1]) / 4;
        // Two peaks with a big valley
        if (val > avg) return (mi === 5) ? 713 : 1114;
        // Two valleys with a big ridge
        return (mi === 5) ? 104 : 208;
    }
    return (mi === 15) ? 0 : mi;
}

module.exports = {
    makeCrossings: makeCrossings,
    getMarchingIndex: getMarchingIndex
};
