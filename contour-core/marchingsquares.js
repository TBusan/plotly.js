'use strict';

var constants = require('./constants');

/**
 * Calculate all the marching indices for ALL levels at once.
 * Uses an exhaustive approach - checks for contour crossings
 * at every intersection rather than just following a path.
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
    var xi, yi, startIndices, ystartIndices, label, corners, mi, pi, i;

    // pathinfo is level-sorted ascending (setContours → uniqueSorted), so per
    // cell we can binary-search the subrange of levels that can cross it and
    // skip the rest: O(cells × levels) → O(cells × log levels). A level can
    // cross a cell iff min(corners) <= level < max(corners); a level equal to
    // cellMax yields mi 0 and is skipped downstream, so it's harmless to
    // include it in the upper-bound search.
    var levels = new Array(pathinfo.length);
    for (i = 0; i < pathinfo.length; i++) {
        levels[i] = pathinfo[i].level;
    }

    function lowerBound(arr, x) {
        var lo = 0, hi = arr.length;
        while (lo < hi) {
            var mid = (lo + hi) >>> 1;
            if (arr[mid] < x) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    function upperBound(arr, x) {
        var lo = 0, hi = arr.length;
        while (lo < hi) {
            var mid = (lo + hi) >>> 1;
            if (arr[mid] <= x) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    for (yi = 0; yi < m - 1; yi++) {
        ystartIndices = [];
        if (yi === 0) ystartIndices = ystartIndices.concat(constants.BOTTOMSTART);
        if (yi === m - 2) ystartIndices = ystartIndices.concat(constants.TOPSTART);

        for (xi = 0; xi < n - 1; xi++) {
            startIndices = ystartIndices.slice();
            if (xi === 0) startIndices = startIndices.concat(constants.LEFTSTART);
            if (xi === n - 2) startIndices = startIndices.concat(constants.RIGHTSTART);

            // Get corner values for this cell
            var c00 = z[yi][xi], c01 = z[yi][xi + 1];
            var c10 = z[yi + 1][xi], c11 = z[yi + 1][xi + 1];
            corners = [[c00, c01], [c10, c11]];

            var levelLo = lowerBound(levels, Math.min(c00, c01, c10, c11));
            var levelHi = upperBound(levels, Math.max(c00, c01, c10, c11));

            label = xi + ',' + yi;

            for (i = levelLo; i < levelHi; i++) {
                pi = pathinfo[i];
                mi = getMarchingIndex(pi.level, corners);
                if (!mi) continue;

                pi.crossings[label] = mi;
                if (startIndices.indexOf(mi) !== -1) {
                    pi.starts.push([xi, yi]);
                    if (twoWide && startIndices.indexOf(mi, startIndices.indexOf(mi) + 1) !== -1) {
                        // The same square has starts from opposite sides
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
