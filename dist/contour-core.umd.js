/**
 * contour-core v0.2.0 - Standalone Contour Calculation Library
 * Features: Null value support + Simplified rendering API
 * License: MIT
 *
 * Extracted from Plotly.js for SSR and performance optimization
 */

(function (root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ContourCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ============================================
    // NULL HANDLING MODULE
    // ============================================

    /**
 * Check if a value is valid (not null, undefined, or NaN)
 *
 * @param {*} val - Value to check
 * @returns {Boolean} True if value is valid
 */
function isValidValue(val) {
    return val !== null &&
           val !== undefined &&
           (typeof val === 'number') &&
           !isNaN(val) &&
           isFinite(val);
}

    /**
 * Normalize null values in a grid
 * Converts all invalid values (null, undefined, NaN) to NaN
 * and generates statistics about the null values
 *
 * @param {Array} grid - 2D array of values (may contain null/undefined/NaN)
 * @returns {Object} Normalization result containing:
 *   - cleanedGrid: 2D array with all invalid values converted to NaN
 *   - nullMask: 2D boolean array (true = null position)
 *   - nullCount: Total number of null values
 *   - validCount: Total number of valid values
 */
function normalizeNullValues(grid) {
    if (!grid || !Array.isArray(grid) || grid.length === 0) {
        return {
            cleanedGrid: [],
            nullMask: [],
            nullCount: 0,
            validCount: 0
        };
    }

    var m = grid.length;
    var n = grid[0].length || 0;
    var cleanedGrid = [];
    var nullMask = [];
    var nullCount = 0;
    var validCount = 0;

    for (var i = 0; i < m; i++) {
        var row = grid[i];
        var cleanedRow = [];
        var maskRow = [];

        if (!row || !Array.isArray(row)) {
            // Handle missing rows
            cleanedGrid.push(new Array(n).fill(NaN));
            nullMask.push(new Array(n).fill(true));
            nullCount += n;
            continue;
        }

        for (var j = 0; j < n; j++) {
            var val = row[j];

            if (isValidValue(val)) {
                cleanedRow.push(val);
                maskRow.push(false);
                validCount++;
            } else {
                cleanedRow.push(NaN);
                maskRow.push(true);
                nullCount++;
            }
        }

        cleanedGrid.push(cleanedRow);
        nullMask.push(maskRow);
    }

    return {
        cleanedGrid: cleanedGrid,
        nullMask: nullMask,
        nullCount: nullCount,
        validCount: validCount
    };
}

    /**
 * Generate a boolean mask indicating null value positions in a grid
 *
 * @param {Array} grid - 2D array of values
 * @returns {Array} 2D boolean array where true indicates a null/invalid value
 */
function generateNullMask(grid) {
    if (!grid || !Array.isArray(grid) || grid.length === 0) {
        return [];
    }

    var m = grid.length;
    var mask = [];

    for (var i = 0; i < m; i++) {
        var row = grid[i];

        if (!row || !Array.isArray(row)) {
            // Handle missing rows - treat as all null
            mask.push([]);
            continue;
        }

        var maskRow = [];
        for (var j = 0; j < row.length; j++) {
            var val = row[j];
            var isNull = val === null ||
                        val === undefined ||
                        (typeof val === 'number' && isNaN(val));
            maskRow.push(isNull);
        }
        mask.push(maskRow);
    }

    return mask;
}

    var nullHandling = {
        isValidValue: isValidValue,
        normalizeNullValues: normalizeNullValues,
        generateNullMask: generateNullMask
    };

    // ============================================
    // CONSTANTS
    // ============================================
    var constants = {


    BOTTOMSTART: [1, 9, 13, 104, 713],
    TOPSTART: [4, 6, 7, 104, 713],
    LEFTSTART: [8, 12, 14, 208, 1114],
    RIGHTSTART: [2, 3, 11, 208, 1114],
    NEWDELTA: [
        null, [-1, 0], [0, -1], [-1, 0],
        [1, 0], null, [0, -1], [-1, 0],
        [0, 1], [0, 1], null, [0, 1],
        [1, 0], [1, 0], [0, -1]
    ],
    CHOOSESADDLE: {
        104: [4, 1],
        208: [2, 8],
        713: [7, 13],
        1114: [11, 14]
    },
    SADDLEREMAINDER: {1: 4, 2: 8, 4: 1, 7: 13, 8: 2, 11: 14, 13: 7, 14: 11},
    LABELDISTANCE: 2,
    LABELINCREASE: 10,
    LABELMIN: 3,
    LABELMAX: 10,
    LABELOPTIMIZER: {
        EDGECOST: 1,
        ANGLECOST: 1,
        NEIGHBORCOST: 5,
        SAMELEVELFACTOR: 10,
        SAMELEVELDISTANCE: 5,
        MAXCOST: 100,
        INITIALSEARCHPOINTS: 10,
        ITERATIONS: 5
    }

};

    // ============================================
    // LEVELS
    // ============================================
    /**
 * Compute contour levels from data and options
 */

/**
 * Calculate contour levels based on options
 *
 * @param {Object} options - Contour options
 * @param {Array} options.thresholds - Custom threshold values (optional)
 * @param {Boolean} options.autocontour - Auto-generate contour levels
 * @param {Number} options.start - Start value for contours
 * @param {Number} options.end - End value for contours
 * @param {Number} options.size - Step size between contours
 * @param {Number} options.ncontours - Approximate number of contours (for auto mode)
 * @param {Array} vals - 2D array of z values
 * @returns {Array} Array of contour level values
 */
function setContours(options, vals) {
    var levels = [];

    // Check if we have custom thresholds - highest priority
    if (options.thresholds && Array.isArray(options.thresholds) && options.thresholds.length > 0) {
        // Validate and sort thresholds
        levels = options.thresholds.slice().sort(function(a, b) {
            return a - b;
        });

        // Filter out non-numeric values
        levels = levels.filter(function(val) {
            return typeof val === 'number' && !isNaN(val) && isFinite(val);
        });

        if (levels.length > 0) {
            return levels;
        }
    }

    // Auto-generate contour levels
    if (options.autocontour) {
        // Flatten and filter out NaN/null values
        var flatVals = vals.flat().filter(function(v) {
            return typeof v === 'number' && !isNaN(v) && isFinite(v);
        });

        if (flatVals.length === 0) {
            return [];  // No valid data
        }

        var zmin = Math.min.apply(Math, flatVals);
        var zmax = Math.max.apply(Math, flatVals);

        var start, end, size;

        if (typeof options.start === 'number') {
            start = options.start;
        } else {
            start = zmin;
        }

        if (typeof options.end === 'number') {
            end = options.end;
        } else {
            end = zmax;
        }

        var ncontours = options.ncontours || 15;
        size = (end - start) / (ncontours - 1);

        if (size <= 0) {
            size = 1;
        }

        // Generate levels
        for (var val = start; val <= end + size * 0.0001; val += size) {
            levels.push(Math.round(val * 10000) / 10000); // Round to avoid floating point issues
        }

        // Remove duplicates and sort
        levels = uniqueSorted(levels);
    } else {
        // Manual contour levels
        var start = options.start || 0;
        var end = options.end || 100;
        var size = options.size || 1;

        if (start > end) {
            var temp = start;
            start = end;
            end = temp;
        }

        if (size <= 0) {
            size = 1;
        }

        // Generate levels
        for (var val = start; val <= end + size * 0.0001; val += size) {
            levels.push(Math.round(val * 10000) / 10000);
        }

        // Remove duplicates and sort
        levels = uniqueSorted(levels);
    }

    return levels;
}

/**
 * Remove duplicates and sort array
 */
function uniqueSorted(arr) {
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
        var val = arr[i];
        if (!seen[val]) {
            seen[val] = true;
            out.push(val);
        }
    }
    return out.sort(function(a, b) { return a - b; });
}

/**
 * Calculate the end value for contours (inclusive)
 */
function endPlus(contours) {
    var end = contours.end;
    var size = contours.size;

    if (!isFinite(size)) {
        size = 1;
    }

    // Add a small fraction to make the end inclusive
    return end + size * 0.0001;
}

    // ============================================
    // SMOOTH
    // ============================================
    /**
 * Path smoothing utilities using Catmull-Rom splines
 * Based on: http://www.cemyuksel.com/research/catmullrom_param/catmullrom.pdf
 */

// Catmull-Rom exponent (0.5 is the standard value)
var CatmullRomExp = 0.5;

/**
 * Smooth an open path (not closed) using Catmull-Rom splines
 * @param {Array} pts - Array of [x, y] points
 * @param {Number} smoothness - Smoothing factor (0-1)
 * @returns {String} SVG path string
 */
function smoothopen(pts, smoothness) {
    if (pts.length < 3) {
        return 'M' + pts.join('L');
    }
    var path = 'M' + pts[0];
    var tangents = [];
    var i;
    for (i = 1; i < pts.length - 1; i++) {
        tangents.push(makeTangent(pts[i - 1], pts[i], pts[i + 1], smoothness));
    }
    path += 'Q' + tangents[0][0] + ' ' + pts[1];
    for (i = 2; i < pts.length - 1; i++) {
        path += 'C' + tangents[i - 2][1] + ' ' + tangents[i - 1][0] + ' ' + pts[i];
    }
    path += 'Q' + tangents[pts.length - 3][1] + ' ' + pts[pts.length - 1];
    return path;
}

/**
 * Smooth a closed path using Catmull-Rom splines
 * @param {Array} pts - Array of [x, y] points
 * @param {Number} smoothness - Smoothing factor (0-1)
 * @returns {String} SVG path string
 */
function smoothclosed(pts, smoothness) {
    if (pts.length < 3) {
        return 'M' + pts.join('L') + 'Z';
    }
    var path = 'M' + pts[0];
    var pLast = pts.length - 1;
    var tangents = [makeTangent(pts[pLast], pts[0], pts[1], smoothness)];
    var i;
    for (i = 1; i < pLast; i++) {
        tangents.push(makeTangent(pts[i - 1], pts[i], pts[i + 1], smoothness));
    }
    tangents.push(makeTangent(pts[pLast - 1], pts[pLast], pts[0], smoothness));

    for (i = 1; i <= pLast; i++) {
        path += 'C' + tangents[i - 1][1] + ' ' + tangents[i][0] + ' ' + pts[i];
    }
    path += 'C' + tangents[pLast][1] + ' ' + tangents[0][0] + ' ' + pts[0] + 'Z';
    return path;
}

/**
 * Create tangent points for Catmull-Rom spline interpolation
 * @param {Array} prevpt - Previous point [x, y]
 * @param {Array} thispt - Current point [x, y]
 * @param {Array} nextpt - Next point [x, y]
 * @param {Number} smoothness - Smoothing factor
 * @returns {Array} Array of two tangent points [[x1, y1], [x2, y2]]
 */
function makeTangent(prevpt, thispt, nextpt, smoothness) {
    var d1x = prevpt[0] - thispt[0];
    var d1y = prevpt[1] - thispt[1];
    var d2x = nextpt[0] - thispt[0];
    var d2y = nextpt[1] - thispt[1];
    var d1a = Math.pow(d1x * d1x + d1y * d1y, CatmullRomExp / 2);
    var d2a = Math.pow(d2x * d2x + d2y * d2y, CatmullRomExp / 2);
    var numx = (d2a * d2a * d1x - d1a * d1a * d2x) * smoothness;
    var numy = (d2a * d2a * d1y - d1a * d1a * d2y) * smoothness;
    var denom1 = 3 * d2a * (d1a + d2a);
    var denom2 = 3 * d1a * (d1a + d2a);
    return [
        [
            round(thispt[0] + (denom1 && numx / denom1)),
            round(thispt[1] + (denom1 && numy / denom1))
        ],
        [
            round(thispt[0] - (denom2 && numx / denom2)),
            round(thispt[1] - (denom2 && numy / denom2))
        ]
    ];
}

/**
 * Round a number to 2 decimal places
 */
function round(v) {
    return Math.round(v * 100) / 100;
}

    // ============================================
    // MARCHING SQUARES
    // ============================================
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
    var nullMask = pathinfo[0].nullMask;
    var m = z.length;
    var n = z[0].length;
    var twoWide = m === 2 || n === 2;
    var xi, yi, startIndices, ystartIndices, label, corners, mi, pi, i;

    for (yi = 0; yi < m - 1; yi++) {
        ystartIndices = [];
        if (yi === 0) ystartIndices = ystartIndices.concat(constants.BOTTOMSTART);
        if (yi === m - 2) ystartIndices = ystartIndices.concat(constants.TOPSTART);

        for (xi = 0; xi < n - 1; xi++) {
            startIndices = ystartIndices.slice();
            if (xi === 0) startIndices = startIndices.concat(constants.LEFTSTART);
            if (xi === n - 2) startIndices = startIndices.concat(constants.RIGHTSTART);

            // Check if any corner has a null value
            var hasNull = false;
            if (nullMask) {
                if (nullMask[yi][xi] || nullMask[yi][xi + 1] ||
                    nullMask[yi + 1][xi] || nullMask[yi + 1][xi + 1]) {
                    hasNull = true;
                }
            }

            // Also check for NaN values in z
            corners = [[z[yi][xi], z[yi][xi + 1]],
                       [z[yi + 1][xi], z[yi + 1][xi + 1]]];
            if (!hasNull) {
                if (isNaN(corners[0][0]) || isNaN(corners[0][1]) ||
                    isNaN(corners[1][0]) || isNaN(corners[1][1])) {
                    hasNull = true;
                }
            }

            // Skip this cell if it has null values
            if (hasNull) continue;

            label = xi + ',' + yi;

            for (i = 0; i < pathinfo.length; i++) {
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

    // ============================================
    // PATHFINDING
    // ============================================
    /**
 * Find all contour paths from the crossing data generated by marching squares.
 *
 * @param {Array} pathinfo - Array of path info objects with crossings data
 * @param {Number} xtol - X tolerance for considering points equal (default 0.01)
 * @param {Number} ytol - Y tolerance for considering points equal (default 0.01)
 */
function findAllPaths(pathinfo, xtol, ytol) {
    var cnt, startLoc, i, pi, j;

    // Default tolerance values
    xtol = xtol || 0.01;
    ytol = ytol || 0.01;

    for (i = 0; i < pathinfo.length; i++) {
        pi = pathinfo[i];

        // Process all edge paths (paths that start at the boundary)
        for (j = 0; j < pi.starts.length; j++) {
            startLoc = pi.starts[j];
            makePath(pi, startLoc, 'edge', xtol, ytol);
        }

        // Process all interior paths
        cnt = 0;
        while (Object.keys(pi.crossings).length && cnt < 10000) {
            cnt++;
            startLoc = Object.keys(pi.crossings)[0].split(',').map(Number);
            makePath(pi, startLoc, undefined, xtol, ytol);
        }
        if (cnt === 10000) {
            console.warn('Infinite loop in contour calculation');
        }
    }
}

/**
 * Check if two points are equal within tolerance
 */
function equalPts(pt1, pt2, xtol, ytol) {
    return Math.abs(pt1[0] - pt2[0]) < xtol &&
           Math.abs(pt1[1] - pt2[1]) < ytol;
}

/**
 * Calculate distance in index units between two points
 * Uses the 3rd and 4th items in points (grid indices)
 */
function ptDist(pt1, pt2) {
    var dx = pt1[2] - pt2[2];
    var dy = pt1[3] - pt2[3];
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Make a single contour path starting from a given location
 *
 * @param {Object} pi - Path info object for this contour level
 * @param {Array} loc - Starting location [xi, yi]
 * @param {String} edgeflag - 'edge' if this is an edge path, undefined otherwise
 * @param {Number} xtol - X tolerance
 * @param {Number} ytol - Y tolerance
 */
function makePath(pi, loc, edgeflag, xtol, ytol) {
    var locStr = loc.join(',');
    var mi = pi.crossings[locStr];
    var marchStep = getStartStep(mi, edgeflag, loc);

    // Start by going backward a half step and finding the crossing point
    var pts = [getInterpPx(pi, loc, [-marchStep[0], -marchStep[1]])];
    var m = pi.z.length;
    var n = pi.z[0].length;
    var startLoc = loc.slice();
    var startStep = marchStep.slice();
    var cnt;

    // Now follow the path
    for (cnt = 0; cnt < 10000; cnt++) {
        if (mi > 20) {
            mi = constants.CHOOSESADDLE[mi][(marchStep[0] || marchStep[1]) < 0 ? 0 : 1];
            pi.crossings[locStr] = constants.SADDLEREMAINDER[mi];
        } else {
            delete pi.crossings[locStr];
        }

        marchStep = constants.NEWDELTA[mi];
        if (!marchStep) {
            console.warn('Found bad marching index:', mi, loc, pi.level);
            break;
        }

        // Find the crossing a half step forward, then take the full step
        pts.push(getInterpPx(pi, loc, marchStep));
        loc[0] += marchStep[0];
        loc[1] += marchStep[1];
        locStr = loc.join(',');

        // Don't include the same point multiple times
        if (equalPts(pts[pts.length - 1], pts[pts.length - 2], xtol, ytol)) {
            pts.pop();
        }

        var atEdge = (marchStep[0] && (loc[0] < 0 || loc[0] > n - 2)) ||
                (marchStep[1] && (loc[1] < 0 || loc[1] > m - 2));

        var closedLoop = loc[0] === startLoc[0] && loc[1] === startLoc[1] &&
                marchStep[0] === startStep[0] && marchStep[1] === startStep[1];

        // Have we completed a loop, or reached an edge?
        if (closedLoop || (edgeflag && atEdge)) break;

        mi = pi.crossings[locStr];
    }

    if (cnt === 10000) {
        console.warn('Infinite loop in contour path');
    }

    var closedpath = equalPts(pts[0], pts[pts.length - 1], xtol, ytol);

    // Simplify path by removing points that are too close together
    var simplifiedPts = simplifyPath(pts, pi.smoothing, closedpath);

    // Remove index parts (3rd and 4th items) before storing
    for (cnt = 0; cnt < simplifiedPts.length; cnt++) {
        simplifiedPts[cnt].length = 2;
    }

    // Don't return single-point paths
    if (simplifiedPts.length < 2) return;

    if (closedpath) {
        pi.paths.push(simplifiedPts);
    } else {
        // Edge path - merge with existing edge paths if possible
        mergeEdgePath(pi, simplifiedPts, xtol, ytol);
    }
}

/**
 * Simplify path by removing points that are too close together
 */
function simplifyPath(pts, smoothing, closedpath) {
    var totaldist = 0;
    var alldists = [];
    var cnt;

    // Calculate all distances
    for (cnt = 1; cnt < pts.length; cnt++) {
        var thisdist = ptDist(pts[cnt], pts[cnt - 1]);
        totaldist += thisdist;
        alldists.push(thisdist);
    }

    if (alldists.length === 0) return pts;

    var distThresholdFactor = 0.2 * smoothing;
    var distThreshold = totaldist / alldists.length * distThresholdFactor;

    var result = [];
    var cropstart = 0;
    var i, cnt2, cnt3, newpt, ptavg, distgroup;

    function getpt(i) { return pts[i % pts.length]; }

    for (cnt = pts.length - 2; cnt >= cropstart; cnt--) {
        distgroup = alldists[cnt];
        if (distgroup < distThreshold) {
            cnt3 = 0;
            for (cnt2 = cnt - 1; cnt2 >= cropstart; cnt2--) {
                if (distgroup + alldists[cnt2] < distThreshold) {
                    distgroup += alldists[cnt2];
                } else break;
            }

            // Closed path with close points wrapping around the boundary?
            if (closedpath && cnt === pts.length - 2) {
                for (cnt3 = 0; cnt3 < cnt2; cnt3++) {
                    if (distgroup + alldists[cnt3] < distThreshold) {
                        distgroup += alldists[cnt3];
                    } else break;
                }
            }

            var ptcnt = cnt - cnt2 + cnt3 + 1;
            ptavg = Math.floor((cnt + cnt2 + cnt3 + 2) / 2);

            // Keep endpoints for open paths
            if (!closedpath && cnt === pts.length - 2) {
                newpt = pts[pts.length - 1];
            } else if (!closedpath && cnt2 === -1) {
                newpt = pts[0];
            } else if (ptcnt % 2) {
                // Odd number of points - take the central one
                newpt = getpt(ptavg);
            } else {
                // Even number of points - average central two
                newpt = [
                    (getpt(ptavg)[0] + getpt(ptavg + 1)[0]) / 2,
                    (getpt(ptavg)[1] + getpt(ptavg + 1)[1]) / 2,
                    getpt(ptavg)[2],
                    getpt(ptavg)[3]
                ];
            }

            pts.splice(cnt2 + 1, cnt - cnt2 + 1, newpt);
            cnt = cnt2 + 1;
            if (cnt3) cropstart = cnt3;
            if (closedpath) {
                if (cnt === pts.length - 2) pts[cnt3] = pts[pts.length - 1];
                else if (cnt === 0) pts[pts.length - 1] = pts[0];
            }
        }
    }

    pts.splice(0, cropstart);
    return pts;
}

/**
 * Merge an edge path with existing edge paths if they connect
 */
function mergeEdgePath(pi, pts, xtol, ytol) {
    var merged = false;
    var i, j, edgepathi, edgepathj;

    // Try to connect the end of pts to the start of an existing path
    for (i = 0; i < pi.edgepaths.length; i++) {
        edgepathi = pi.edgepaths[i];
        if (!merged && equalPts(edgepathi[0], pts[pts.length - 1], xtol, ytol)) {
            pts.pop();
            merged = true;

            // Check if it ALSO meets the end of another (or the same) path
            var doublemerged = false;
            for (j = 0; j < pi.edgepaths.length; j++) {
                edgepathj = pi.edgepaths[j];
                if (equalPts(edgepathj[edgepathj.length - 1], pts[0], xtol, ytol)) {
                    doublemerged = true;
                    pts.shift();
                    pi.edgepaths.splice(i, 1);
                    if (j === i) {
                        // The path is now closed
                        pi.paths.push(pts.concat(edgepathj));
                    } else {
                        if (j > i) j--;
                        pi.edgepaths[j] = edgepathj.concat(pts, edgepathi);
                    }
                    break;
                }
            }
            if (!doublemerged) {
                pi.edgepaths[i] = pts.concat(edgepathi);
            }
        }
    }

    // Try to connect the start of pts to the end of an existing path
    for (i = 0; i < pi.edgepaths.length; i++) {
        if (merged) break;
        edgepathi = pi.edgepaths[i];
        if (equalPts(edgepathi[edgepathi.length - 1], pts[0], xtol, ytol)) {
            pts.shift();
            pi.edgepaths[i] = edgepathi.concat(pts);
            merged = true;
        }
    }

    if (!merged) {
        pi.edgepaths.push(pts);
    }
}

/**
 * Get the marching step for the first point in the path
 */
function getStartStep(mi, edgeflag, loc) {
    var dx = 0;
    var dy = 0;

    if (mi > 20 && edgeflag) {
        // Saddles start at +/- x
        if (mi === 208 || mi === 1114) {
            dx = loc[0] === 0 ? 1 : -1;
        } else {
            dy = loc[1] === 0 ? 1 : -1;
        }
    } else if (constants.BOTTOMSTART.indexOf(mi) !== -1) {
        dy = 1;
    } else if (constants.LEFTSTART.indexOf(mi) !== -1) {
        dx = 1;
    } else if (constants.TOPSTART.indexOf(mi) !== -1) {
        dy = -1;
    } else {
        dx = -1;
    }
    return [dx, dy];
}

/**
 * Find the pixel coordinates of a particular crossing
 *
 * @param {Object} pi - Path info object at this level
 * @param {Array} loc - Grid index [x, y] of the crossing
 * @param {Array} step - Direction [dx, dy] we're moving on the grid
 * @returns {Array} [xpx, ypx, xi, yi] - pixel location + interpolated grid indices
 */
function getInterpPx(pi, loc, step) {
    var locx = loc[0] + Math.max(step[0], 0);
    var locy = loc[1] + Math.max(step[1], 0);
    var zxy = pi.z[locy][locx];

    // This is a simplified version that works in grid index space
    // For proper pixel coordinates, you'll need to provide scale functions
    if (step[1]) {
        // Vertical interpolation
        var dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);
        return [
            locx + dx,
            locy,
            locx + dx,
            locy
        ];
    } else {
        // Horizontal interpolation
        var dy = (pi.level - zxy) / (pi.z[locy + 1][locx] - zxy);
        return [
            locx,
            locy + dy,
            locx,
            locy + dy
        ];
    }
}

    // ============================================
    // CANVAS RENDERER
    // ============================================
    /**
 * Canvas renderer for contour-core
 * Renders contour paths on an HTML5 Canvas
 */

var smooth = { smoothclosed: smoothclosed, smoothopen: smoothopen };

/**
 * Draw contours on a canvas context
 * Adapted from Plotly.js src/traces/contour/plot.js
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} style - Rendering options
 */
function drawContours(ctx, contourResult, style) {
    style = style || {};

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var coloring = style.coloring || 'lines';
    var showLines = style.showLines !== false;
    var smoothing = style.smoothing || 0;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Determine scale factors (default to grid indices)
    var n = contourResult.pathinfo[0].x.length;
    var m = contourResult.pathinfo[0].y.length;
    var padding = style.padding || 30;

    // Scale to fit canvas with padding
    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    function scalePoint(pt) {
        return [
            padding + pt[0] * scaleX,
            padding + (m - 1 - pt[1]) * scaleY  // Flip Y for canvas coordinates
        ];
    }

    // Calculate perimeter (boundary)
    var perimeter = [
        [padding, padding],                              // top-left
        [width - padding, padding],                       // top-right
        [width - padding, height - padding],              // bottom-right
        [padding, height - padding]                      // bottom-left
    ];

    // Draw background if needed (for fill mode)
    if (coloring === 'fill' || coloring === 'heatmap') {
        makeBackground(ctx, perimeter, coloring);
    }

    // Draw fills (using even-odd rule)
    if (coloring === 'fill') {
        makeFills(ctx, contourResult, perimeter, scalePoint, smoothing, style);
    }

    // Draw heatmap (for heatmap mode)
    if (coloring === 'heatmap') {
        makeHeatmap(ctx, contourResult, perimeter, scalePoint, style);
    }

    // Draw lines
    if (showLines && coloring !== 'heatmap') {
        makeLines(ctx, contourResult, scalePoint, smoothing, style);
    }
}

/**
 * Draw background rectangle
 */
function makeBackground(ctx, perimeter, coloring) {
    if (coloring !== 'fill') return;

    ctx.fillStyle = '#fff';  // Default background
    ctx.beginPath();
    ctx.moveTo(perimeter[0][0], perimeter[0][1]);
    ctx.lineTo(perimeter[1][0], perimeter[1][1]);
    ctx.lineTo(perimeter[2][0], perimeter[2][1]);
    ctx.lineTo(perimeter[3][0], perimeter[3][1]);
    ctx.closePath();
    ctx.fill();
}

/**
 * Draw filled contours using even-odd rule
 * Adapted from Plotly.js makeFills
 */
function makeFills(ctx, contourResult, perimeter, scalePoint, smoothing, style) {
    var boundaryPath = 'M' + perimeter.join('L') + 'Z';
    var pathinfo = contourResult.paths;

    for (var i = 0; i < pathinfo.length; i++) {
        var pi = pathinfo[i];

        // Skip if no paths to draw
        if (!pi.edgepaths && !pi.paths) continue;
        if (pi.edgepaths && pi.edgepaths.length === 0 && (!pi.paths || pi.paths.length === 0)) continue;

        var fullpath = '';

        // Add boundary prefix if needed
        if (pi.prefixBoundary) {
            fullpath = boundaryPath + joinAllPaths(pi, perimeter, scalePoint, smoothing);
        } else {
            fullpath = joinAllPaths(pi, perimeter, scalePoint, smoothing);
        }

        if (!fullpath) continue;

        // Get color for this level
        var color = getColorForLevel(pi.level, contourResult.levels, style);

        // Draw the fill path
        drawSVGPathString(ctx, fullpath, {
            fill: color,
            stroke: 'none'
        });
    }
}

/**
 * Join all paths together for even-odd fill
 * Adapted from Plotly.js joinAllPaths
 */
function joinAllPaths(pi, perimeter, scalePoint, smoothing) {
    var fullpath = '';

    // Validate edgepaths
    if (!pi.edgepaths || pi.edgepaths.length === 0) {
        return fullpath;
    }

    // Filter out invalid paths
    var validEdgePaths = [];
    for (var i = 0; i < pi.edgepaths.length; i++) {
        var path = pi.edgepaths[i];
        // Check path exists, has points, and first point is a valid [x, y] array
        if (path && Array.isArray(path) && path.length > 0) {
            var firstPoint = path[0];
            if (firstPoint && Array.isArray(firstPoint) && firstPoint.length >= 2) {
                validEdgePaths.push(path);
            }
        }
    }

    if (validEdgePaths.length === 0) {
        return fullpath;
    }

    var startsleft = validEdgePaths.map(function(v, idx) { return idx; });
    var newloop = true;
    var endpt;
    var newendpt;
    var cnt;
    var nexti;
    var possiblei;
    var addpath;

    function istop(pt) { return Math.abs(pt[1] - perimeter[0][1]) < 0.5; }
    function isbottom(pt) { return Math.abs(pt[1] - perimeter[2][1]) < 0.5; }
    function isleft(pt) { return Math.abs(pt[0] - perimeter[0][0]) < 0.5; }
    function isright(pt) { return Math.abs(pt[0] - perimeter[2][0]) < 0.5; }

    while (startsleft.length) {
        var i = startsleft[0];
        addpath = smoothPath(validEdgePaths[i], scalePoint, smoothing, false);
        if (!addpath) {
            startsleft.splice(startsleft.indexOf(i), 1);
            continue;
        }
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);
        endpt = getLastPoint(validEdgePaths[i]);
        nexti = -1;

        // Loop around perimeter until we find a new start
        for (cnt = 0; cnt < 4 && endpt; cnt++) {
            if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1]; // right top
            else if (isleft(endpt)) newendpt = perimeter[0]; // left top
            else if (isbottom(endpt)) newendpt = perimeter[3]; // right bottom
            else if (isright(endpt)) newendpt = perimeter[2]; // left bottom
            else break; // Not on perimeter - stop walking

            if (!newendpt) break; // Safety check

            fullpath += 'L' + newendpt[0] + ' ' + newendpt[1];

            // Look for a path starting at this new endpoint
            nexti = -1;
            for (possiblei = 0; possiblei < validEdgePaths.length; possiblei++) {
                var pathStart = getFirstPoint(validEdgePaths[possiblei]);
                if (pathStart && Math.abs(pathStart[0] - newendpt[0]) < 0.5 &&
                    Math.abs(pathStart[1] - newendpt[1]) < 0.5) {
                    nexti = possiblei;
                    break;
                }
            }

            if (nexti >= 0) {
                // Found a path starting here - continue
                startsleft.splice(startsleft.indexOf(nexti), 1);
                endpt = getLastPoint(validEdgePaths[nexti]);
                addpath = smoothPath(validEdgePaths[nexti], scalePoint, smoothing, false);
                if (addpath) {
                    fullpath += 'L' + addpath.replace(/^M/, '');
                }
            } else {
                // No path found - end this loop
                break;
            }
        }

        newloop = false;
    }

    return fullpath;
}

/**
 * Draw heatmap (filled rectangles)
 */
function makeHeatmap(ctx, contourResult, perimeter, scalePoint, style) {
    // For heatmap mode, just draw rectangles
    // This is a simplified implementation
    var pathinfo = contourResult.pathinfo;
    var z = pathinfo[0].z;
    var m = z.length;
    var n = z[0].length;
    var levels = contourResult.levels;

    for (var i = 0; i < m - 1; i++) {
        for (var j = 0; j < n - 1; j++) {
            var z0 = z[i][j];
            var z1 = z[i][j + 1];
            var z2 = z[i + 1][j];
            var z3 = z[i + 1][j + 1];
            if (isNaN(z0) || isNaN(z1) || isNaN(z2) || isNaN(z3)) continue;

            var avgZ = (z0 + z1 + z2 + z3) / 4;
            var color = getColorForLevel(avgZ, levels, style);

            var p1 = scalePoint([j, i]);
            var p2 = scalePoint([j + 1, i]);
            var p3 = scalePoint([j + 1, i + 1]);
            var p4 = scalePoint([j, i + 1]);

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
            ctx.lineTo(p3[0], p3[1]);
            ctx.lineTo(p4[0], p4[1]);
            ctx.closePath();
            ctx.fill();
        }
    }
}

/**
 * Draw contour lines
 */
function makeLines(ctx, contourResult, scalePoint, smoothing, style) {
    ctx.strokeStyle = style.lineColor || '#666';
    ctx.lineWidth = style.lineWidth || 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    var pathinfo = contourResult.paths;

    for (var i = 0; i < pathinfo.length; i++) {
        var pi = pathinfo[i];

        if (!pi.edgepaths && !pi.paths) continue;

        // Draw edge paths (open contours)
        if (pi.edgepaths) {
            for (var j = 0; j < pi.edgepaths.length; j++) {
                var path = pi.edgepaths[j];
                if (path && path.length > 0) {
                    drawSVGPathString(ctx, smoothPath(path, scalePoint, smoothing, false), {
                        stroke: style.lineColor || '#666',
                        fill: 'none',
                        lineWidth: style.lineWidth || 1
                    });
                }
            }
        }

        // Draw closed paths
        if (pi.paths) {
            for (j = 0; j < pi.paths.length; j++) {
                var path = pi.paths[j];
                if (path && path.length > 0) {
                    drawSVGPathString(ctx, smoothPath(path, scalePoint, smoothing, true), {
                        stroke: style.lineColor || '#666',
                        fill: 'none',
                        lineWidth: style.lineWidth || 1
                    });
                }
            }
        }
    }
}

/**
 * Get color for a contour level
 */
function getColorForLevel(level, levels, style) {
    if (style.colorScale && Array.isArray(style.colorScale)) {
        // Find the color for this level
        for (var i = 0; i < style.colorScale.length - 1; i++) {
            var stop1 = style.colorScale[i];
            var stop2 = style.colorScale[i + 1];
            if (level >= stop1[0] && level <= stop2[0]) {
                return stop2[1];
            }
        }
        return style.colorScale[style.colorScale.length - 1][1];
    }
    return 'rgba(100, 100, 100, 0.3)';
}

/**
 * Draw a filled path
 */
function drawPath(ctx, path, scalePoint, smoothing, isClosed) {
    if (path.length < 2) return;

    ctx.beginPath();

    var scaledPath = path.map(scalePoint);

    if (smoothing > 0 && isClosed) {
        var pathStr = smooth.smoothclosed(scaledPath, smoothing);
        drawSVGPath(ctx, pathStr);
    } else if (smoothing > 0 && !isClosed) {
        var pathStr = smooth.smoothopen(scaledPath, smoothing);
        drawSVGPath(ctx, pathStr);
    } else {
        ctx.moveTo(scaledPath[0][0], scaledPath[0][1]);
        for (var i = 1; i < scaledPath.length; i++) {
            ctx.lineTo(scaledPath[i][0], scaledPath[i][1]);
        }
        if (isClosed) {
            ctx.closePath();
        }
    }

    ctx.fill();
}

/**
 * Draw a path stroke
 */
function drawPathStroke(ctx, path, scalePoint, smoothing, isClosed) {
    if (path.length < 2) return;

    ctx.beginPath();

    var scaledPath = path.map(scalePoint);

    if (smoothing > 0 && isClosed) {
        var pathStr = smooth.smoothclosed(scaledPath, smoothing);
        drawSVGPath(ctx, pathStr);
    } else if (smoothing > 0 && !isClosed) {
        var pathStr = smooth.smoothopen(scaledPath, smoothing);
        drawSVGPath(ctx, pathStr);
    } else {
        ctx.moveTo(scaledPath[0][0], scaledPath[0][1]);
        for (var i = 1; i < scaledPath.length; i++) {
            ctx.lineTo(scaledPath[i][0], scaledPath[i][1]);
        }
        if (isClosed) {
            ctx.closePath();
        }
    }

    ctx.stroke();
}

/**
 * Draw an SVG path string on canvas
 * Simple parser for M, L, C, Q, Z commands
 */
function drawSVGPath(ctx, pathStr) {
    var commands = parseSVGPath(pathStr);

    for (var i = 0; i < commands.length; i++) {
        var cmd = commands[i];
        switch (cmd.type) {
            case 'M':
                ctx.moveTo(cmd.x, cmd.y);
                break;
            case 'L':
                ctx.lineTo(cmd.x, cmd.y);
                break;
            case 'C':
                ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                break;
            case 'Q':
                ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
                break;
            case 'Z':
                ctx.closePath();
                break;
        }
    }
}

/**
 * Parse SVG path string into commands
 */
function parseSVGPath(pathStr) {
    var commands = [];
    var regex = /([MLCQZ])\s*([^MLCQZ]*)/gi;
    var match;

    while ((match = regex.exec(pathStr)) !== null) {
        var type = match[1];
        var coords = match[2].trim().split(/[\s,]+/).map(Number).filter(function(n) { return !isNaN(n); });

        switch (type) {
            case 'M':
                commands.push({ type: 'M', x: coords[0], y: coords[1] });
                break;
            case 'L':
                for (var i = 0; i < coords.length; i += 2) {
                    commands.push({ type: 'L', x: coords[i], y: coords[i + 1] });
                }
                break;
            case 'C':
                for (i = 0; i < coords.length; i += 6) {
                    commands.push({
                        type: 'C',
                        x1: coords[i], y1: coords[i + 1],
                        x2: coords[i + 2], y2: coords[i + 3],
                        x: coords[i + 4], y: coords[i + 5]
                    });
                }
                break;
            case 'Q':
                for (i = 0; i < coords.length; i += 4) {
                    commands.push({
                        type: 'Q',
                        x1: coords[i], y1: coords[i + 1],
                        x: coords[i + 2], y: coords[i + 3]
                    });
                }
                break;
            case 'Z':
                commands.push({ type: 'Z' });
                break;
        }
    }

    return commands;
}

/**
 * Smooth a path using smooth.smoothopen or smooth.smoothclosed
 */
function smoothPath(path, scalePoint, smoothing, isClosed) {
    if (!path || path.length === 0) {
        return '';
    }

    var scaledPath = path.map(scalePoint);
    if (smoothing > 0 && isClosed) {
        return smooth.smoothclosed(scaledPath, smoothing);
    } else if (smoothing > 0 && !isClosed) {
        return smooth.smoothopen(scaledPath, smoothing);
    } else {
        // Convert to simple path string (M L L...)
        return 'M ' + scaledPath.map(function(pt) {
            return 'L ' + pt[0] + ' ' + pt[1];
        }).join(' ').replace(/^M L/, 'M ');
    }
}

/**
 * Get first point of a path
 */
function getFirstPoint(path) {
    if (!path || path.length === 0) return null;
    return path[0];
}

/**
 * Get last point of a path
 */
function getLastPoint(path) {
    if (!path || path.length === 0) return null;
    return path[path.length - 1];
}

/**
 * Draw an SVG path string directly
 */
function drawSVGPathString(ctx, pathStr, style) {
    var commands = parseSVGPath(pathStr);

    ctx.beginPath();

    for (var i = 0; i < commands.length; i++) {
        var cmd = commands[i];
        switch (cmd.type) {
            case 'M':
                ctx.moveTo(cmd.x, cmd.y);
                break;
            case 'L':
                ctx.lineTo(cmd.x, cmd.y);
                break;
            case 'C':
                ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                break;
            case 'Q':
                ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
                break;
            case 'Z':
                ctx.closePath();
                break;
        }
    }

    if (style && style.fill && style.fill !== 'none') {
        ctx.fillStyle = style.fill;
        ctx.fill();
    }

    if (style && style.stroke && style.stroke !== 'none') {
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.lineWidth || 1;
        ctx.stroke();
    }
}

    // ============================================
    // CLOSE BOUNDARIES
    // ============================================
    /**
 * Close boundary paths for contour filling
 * Adapted from Plotly.js src/traces/contour/close_boundaries.js
 *
 * This function sets prefixBoundary flag on each pathinfo item
 * to indicate whether the perimeter boundary should be prepended
 * to the fill path.
 *
 * @param {Array} pathinfo - Array of path info objects from marching squares
 * @param {Object} contours - Contour configuration
 */
function closeBoundaries(pathinfo, contours) {
    var pi0 = pathinfo[0];
    var z = pi0.z;
    var i;

    switch(contours.type || contours.coloring) {
        case 'levels':
        case 'fill':
            // Why (just) use z[0][0] and z[0][1]?
            //
            // N.B. using boundaryMin instead of edgeVal2 here makes the
            //      `contour_scatter` mock fail
            var edgeVal2 = Math.min(z[0][0], z[0][1]);

            for(i = 0; i < pathinfo.length; i++) {
                var pi = pathinfo[i];
                pi.prefixBoundary = !pi.edgepaths.length &&
                    (edgeVal2 > pi.level || pi.starts.length && edgeVal2 === pi.level);
            }
            break;
        case 'constraint':
            // after convertToConstraints, pathinfo has length=0
            pi0.prefixBoundary = false;

            // joinAllPaths does enough already when edgepaths are present
            if(pi0.edgepaths.length) return;

            var na = pi0.x.length;
            var nb = pi0.y.length;
            var boundaryMax = -Infinity;
            var boundaryMin = Infinity;

            for(i = 0; i < nb; i++) {
                boundaryMin = Math.min(boundaryMin, z[i][0]);
                boundaryMin = Math.min(boundaryMin, z[i][na - 1]);
                boundaryMax = Math.max(boundaryMax, z[i][0]);
                boundaryMax = Math.max(boundaryMax, z[i][na - 1]);
            }
            for(i = 1; i < na - 1; i++) {
                boundaryMin = Math.min(boundaryMin, z[0][i]);
                boundaryMin = Math.min(boundaryMin, z[nb - 1][i]);
                boundaryMax = Math.max(boundaryMax, z[0][i]);
                boundaryMax = Math.max(boundaryMax, z[nb - 1][i]);
            }

            var contoursValue = contours.value;
            var v1, v2;

            switch(contours._operation) {
                case '>':
                    if(contoursValue > boundaryMax) {
                        pi0.prefixBoundary = true;
                    }
                    break;
                case '<':
                    if(contoursValue < boundaryMin ||
                        (pi0.starts.length && contoursValue === boundaryMin)) {
                        pi0.prefixBoundary = true;
                    }
                    break;
                case '[]':
                    v1 = Math.min(contoursValue[0], contoursValue[1]);
                    v2 = Math.max(contoursValue[0], contoursValue[1]);
                    if(v2 < boundaryMin || v1 > boundaryMax ||
                        (pi0.starts.length && v2 === boundaryMin)) {
                        pi0.prefixBoundary = true;
                    }
                    break;
                case '][':
                    v1 = Math.min(contoursValue[0], contoursValue[1]);
                    v2 = Math.max(contoursValue[0], contoursValue[1]);
                    if(v1 < boundaryMin && v2 > boundaryMax) {
                        pi0.prefixBoundary = true;
                    }
                    break;
            }
            break;
    }
}

    // ============================================
    // COMPUTE (with null handling)
    // ============================================
    /**
 * Main contour computation module
 * Standalone implementation - no dependencies on Plotly, D3, or browser APIs
 */

var levels = { setContours: setContours };
var marchingSquares = { makeCrossings: makeCrossings };
var pathFinding = { findAllPaths: findAllPaths };
var nullHandling = { isValidValue: isValidValue, normalizeNullValues: normalizeNullValues, generateNullMask: generateNullMask };


/**
 * Compute contours from a 2D grid of values
 *
 * @param {Object} grid - Input data
 * @param {Array} grid.z - 2D array of z values
 * @param {Array} grid.x - 1D array of x coordinates (optional, defaults to indices)
 * @param {Array} grid.y - 1D array of y coordinates (optional, defaults to indices)
 *
 * @param {Object} options - Contour computation options
 * @param {Array} options.thresholds - Custom threshold values (optional)
 * @param {Boolean} options.autocontour - Auto-generate contour levels (default: true)
 * @param {Number} options.start - Start value for contours (optional)
 * @param {Number} options.end - End value for contours (optional)
 * @param {Number} options.size - Step size between contours (optional)
 * @param {Number} options.ncontours - Approximate number of contours (default: 15)
 * @param {Number} options.smoothing - Smoothing factor for paths (0-1, default: 0)
 *
 * @returns {Object} Contour result containing:
 *   - levels: Array of contour level values
 *   - paths: Array of path objects, one per level
 *     - level: the contour level value
 *     - edgepaths: Array of edge paths (not closed)
 *     - paths: Array of closed paths
 *     Each path is an array of [x, y] coordinates
 */
function computeContours(grid, options) {
    options = options || {};

    // Validate input
    if (!grid || !grid.z || !Array.isArray(grid.z)) {
        throw new Error('Invalid grid: must have z property as 2D array');
    }

    var z = grid.z;
    var m = z.length;
    if (m < 2) {
        throw new Error('Invalid grid: must have at least 2 rows');
    }
    var n = z[0].length;
    if (n < 2) {
        throw new Error('Invalid grid: must have at least 2 columns');
    }

    // Normalize null values (convert null/undefined to NaN)
    var normalization = nullHandling.normalizeNullValues(z);
    var cleanedZ = normalization.cleanedGrid;
    var nullMask = normalization.nullMask;

    // Create x and y coordinate arrays if not provided
    var x = grid.x || [];
    var y = grid.y || [];
    if (x.length === 0) {
        for (var i = 0; i < n; i++) x.push(i);
    }
    if (y.length === 0) {
        for (var j = 0; j < m; j++) y.push(j);
    }

    // Compute contour levels (using cleaned grid with NaN values)
    var contourLevels = levels.setContours(options, cleanedZ);

    if (contourLevels.length === 0) {
        return {
            levels: [],
            paths: []
        };
    }

    // Limit to maximum of 1000 contours
    if (contourLevels.length > 1000) {
        console.warn('Too many contours (' + contourLevels.length + '), clipping at 1000');
        contourLevels = contourLevels.slice(0, 1000);
    }

    // Create pathinfo array for all levels
    var pathinfo = [];
    for (var i = 0; i < contourLevels.length; i++) {
        pathinfo.push({
            level: contourLevels[i],
            crossings: {},
            starts: [],
            edgepaths: [],
            paths: [],
            z: cleanedZ,
            x: x,
            y: y,
            nullMask: nullMask,
            smoothing: options.smoothing || 0
        });
    }

    // Run marching squares algorithm (will skip null cells)
    marchingSquares.makeCrossings(pathinfo);

    // Find all paths
    pathFinding.findAllPaths(pathinfo, 0.01, 0.01);

    // Close boundaries for proper fill rendering
    // This must be called after findAllPaths and before returning results
    // It sets prefixBoundary flags needed for correct even-odd fill rule
    var contourOptions = options.contours || {};
    closeBoundaries(pathinfo, contourOptions);

    // Convert paths to normalized format
    // Note: The paths are currently in grid index space
    // You can scale them to data space or pixel space as needed
    var result = {
        levels: contourLevels,
        paths: pathinfo.map(function(pi) {
            return {
                level: pi.level,
                edgepaths: pi.edgepaths,
                paths: pi.paths,
                prefixBoundary: pi.prefixBoundary  // Added for correct fill logic
            };
        }),
        // Include raw pathinfo for advanced rendering
        pathinfo: pathinfo,
        // Include null mask and statistics for rendering layer
        nullMask: nullMask,
        nullCount: normalization.nullCount,
        validCount: normalization.validCount
    };

    return result;
}

/**
 * Scale paths from grid index space to data space
 *
 * @param {Object} result - Result from computeContours
 * @param {Array} x - X coordinate array
 * @param {Array} y - Y coordinate array
 * @returns {Object} Result with scaled paths
 */
function scalePathsToData(result, x, y) {
    var n = x.length;
    var m = y.length;

    function scalePoint(pt) {
        var ix = Math.round(pt[0]);
        var iy = Math.round(pt[1]);
        // Clamp to valid range
        ix = Math.max(0, Math.min(n - 1, ix));
        iy = Math.max(0, Math.min(m - 1, iy));
        return [x[ix], y[iy]];
    }

    result.paths.forEach(function(pathInfo) {
        pathInfo.edgepaths = pathInfo.edgepaths.map(function(path) {
            return path.map(scalePoint);
        });
        pathInfo.paths = pathInfo.paths.map(function(path) {
            return path.map(scalePoint);
        });
    });

    return result;
}

    // ============================================
    // SIMPLIFIED RENDERING API
    // ============================================
    /**
 * Simplified rendering API for contour-core
 * Provides easy-to-use functions similar to Plotly's API
 */

var compute = { computeContours: computeContours, scalePathsToData: scalePathsToData };
var canvasRenderer = { drawContours: drawContours };

// Preset color scales
var COLOR_SCALES = {
    Viridis: [
        '#440154', '#482878', '#3e4a89', '#31688e', '#26838f',
        '#1f9d8a', '#35b779', '#6dcd59', '#b4de2c', '#fde725'
    ],
    Plasma: [
        '#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786',
        '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'
    ],
    Hot: [
        '#000000', '#4a0000', '#880000', '#c20000', '#ff0000',
        '#ff4a00', '#ff8800', '#ffc200', '#ffff00', '#ffff80'
    ],
    Jet: [
        '#000080', '#0000ff', '#0080ff', '#00ffff', '#80ff80',
        '#ffff00', '#ff8000', '#ff0000', '#800000', '#000000'
    ],
    Earth: [
        '#2a1c0b', '#5c4033', '#8f6b4e', '#c19a6b', '#e5c99b',
        '#f5e6c8', '#8b4513', '#a0522d', '#cd853f', '#deb887'
    ],
    Electric: [
        '#000004', '#1b0c42', '#4a0c6e', '#781c6d', '#a52c60',
        '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'
    ]
};

/**
 * One-step contour rendering - compute and render in one call
 * Similar to Plotly's API: just pass data and options
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Object} config - Configuration object
 * @param {Array} config.z - 2D array of z values (supports null/undefined/NaN)
 * @param {Array} config.x - Optional x coordinates
 * @param {Array} config.y - Optional y coordinates
 * @param {Object} config.contours - Contour configuration
 * @param {String} config.contours.type - 'fill', 'lines', 'heatmap', or 'none'
 * @param {Boolean} config.contours.showlabels - Show contour labels (future)
 * @param {Number} config.contours.start - Start value for manual contours
 * @param {Number} config.contours.end - End value for manual contours
 * @param {Number} config.contours.size - Step size for manual contours
 * @param {Boolean} config.autocontour - Auto-generate contours (default: true)
 * @param {Number} config.ncontours - Number of auto contours (default: 15)
 * @param {Number} config.smoothing - Smoothing factor 0-1 (default: 0.5)
 * @param {String|Array} config.colorscale - Color scale name or array of colors
 * @param {Number} config.zmin - Minimum z value for color mapping
 * @param {Number} config.zmax - Maximum z value for color mapping
 * @param {Boolean} config.reversescale - Reverse the color scale
 * @param {Object} config.colorbar - Colorbar configuration
 * @param {Boolean} config.colorbar.show - Show colorbar (default: true)
 * @param {String} config.colorbar.title - Colorbar title
 * @param {Number} config.colorbar.thickness - Colorbar thickness (default: 20)
 * @param {Number} config.colorbar.len - Colorbar length (0-1, default: 0.8)
 * @param {Object} config.nullRegion - Null region configuration
 * @param {Boolean} config.nullRegion.visible - Show null regions (default: true)
 * @param {String} config.nullRegion.fill - Fill color for null regions (default: '#ffffff')
 * @param {String} config.nullRegion.stroke - Stroke color for null regions (default: '#cccccc')
 * @param {Number} config.nullRegion.strokeWidth - Stroke width (default: 1)
 * @param {Number} config.width - Canvas width (default: canvas.width)
 * @param {Number} config.height - Canvas height (default: canvas.height)
 */
function render(canvas, config) {
    if (!canvas) {
        throw new Error('Canvas element is required');
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context from canvas');
    }

    config = config || {};

    // Extract data
    var grid = {
        z: config.z,
        x: config.x,
        y: config.y
    };

    // Compute options
    var options = {
        autocontour: config.autocontour !== false,
        ncontours: config.ncontours || 15,
        start: config.contours ? config.contours.start : undefined,
        end: config.contours ? config.contours.end : undefined,
        size: config.contours ? config.contours.size : undefined,
        smoothing: config.smoothing !== undefined ? config.smoothing : 0.5
    };

    // Compute contours
    var result = compute.computeContours(grid, options);

    // Get canvas dimensions
    var width = config.width || canvas.width || 600;
    var height = config.height || canvas.height || 500;

    // Determine contour type
    var contourType = 'lines';
    if (config.contours && config.contours.type) {
        contourType = config.contours.type;
    }

    // Get color scale
    var colors = getColors(config.colorscale, result.levels, config.zmin, config.zmax, config.reversescale);

    // Build color scale array for renderer
    var colorScale = buildColorScale(result.levels, colors);

    // Rendering style
    var style = {
        width: width,
        height: height,
        coloring: contourType,
        showLines: contourType === 'lines' || contourType === 'heatmap',
        lineWidth: 1.5,
        lineColor: contourType === 'lines' ? '#666' : 'rgba(255,255,255,0.5)',
        colorScale: colorScale,
        smoothing: options.smoothing
    };

    // Draw contours
    canvasRenderer.drawContours(ctx, result, style);

    // Draw null regions if present
    if (result.nullMask && result.nullCount > 0) {
        drawNullRegions(ctx, result, style, config.nullRegion);
    }

    // Draw colorbar if requested
    if (config.colorbar && config.colorbar.show !== false && contourType !== 'lines') {
        drawColorbar(ctx, result, colors, config.colorbar, width, height);
    }

    return result;
}

/**
 * Two-step rendering: compute first, then render
 * Useful when you need to reuse computation results
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Object} result - Result from computeContours()
 * @param {Object} options - Rendering options
 */
function drawTo(canvas, result, options) {
    if (!canvas) {
        throw new Error('Canvas element is required');
    }

    if (!result || !result.paths) {
        throw new Error('Invalid contour result');
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context from canvas');
    }

    options = options || {};

    var width = options.width || canvas.width || 600;
    var height = options.height || canvas.height || 500;

    // Get color scale
    var colors = getColors(
        options.colorscale,
        result.levels,
        options.zmin,
        options.zmax,
        options.reversescale
    );

    var colorScale = buildColorScale(result.levels, colors);

    var style = {
        width: width,
        height: height,
        coloring: options.coloring || 'fill',
        showLines: options.showLines !== false,
        lineWidth: options.lineWidth || 1.5,
        lineColor: options.lineColor || '#666',
        colorScale: colorScale,
        smoothing: options.smoothing || 0
    };

    // Draw contours
    canvasRenderer.drawContours(ctx, result, style);

    // Draw null regions if present
    if (result.nullMask && result.nullCount > 0) {
        drawNullRegions(ctx, result, style, options.nullRegion);
    }

    // Draw colorbar if requested
    if (options.showColorbar !== false) {
        drawColorbar(ctx, result, colors, options.colorbar, width, height);
    }
}

/**
 * Get color array from config
 */
function getColors(colorscale, levels, zmin, zmax, reverse) {
    var colors;

    if (Array.isArray(colorscale)) {
        // Custom color array
        colors = colorscale;
    } else if (typeof colorscale === 'string') {
        // Preset color scale
        var name = colorscale.charAt(0).toUpperCase() + colorscale.slice(1).toLowerCase();
        colors = COLOR_SCALES[name] || COLOR_SCALES.Viridis;
    } else {
        // Default to Viridis
        colors = COLOR_SCALES.Viridis;
    }

    if (reverse) {
        colors = colors.slice().reverse();
    }

    return colors;
}

/**
 * Build color scale array for rendering
 */
function buildColorScale(levels, colors) {
    var scale = [];
    var min = levels[0];
    var max = levels[levels.length - 1];

    for (var i = 0; i < levels.length; i++) {
        var t = (levels.length > 1) ? (i / (levels.length - 1)) : 0;
        var colorIdx = Math.floor(t * (colors.length - 1));
        colorIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));
        scale.push([levels[i], colors[colorIdx]]);
    }

    return scale;
}

/**
 * Draw null regions on canvas
 */
function drawNullRegions(ctx, result, style, config) {
    if (!result.nullMask) return;

    config = config || {};
    var visible = config.visible !== false;
    if (!visible) return;

    var nullMask = result.nullMask;
    var m = nullMask.length;
    var n = nullMask[0].length;

    var width = style.width;
    var height = style.height;
    var padding = 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    ctx.fillStyle = config.fill || '#ffffff';
    ctx.strokeStyle = config.stroke || '#cccccc';
    ctx.lineWidth = config.strokeWidth || 1;

    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
                var x = padding + j * scaleX;
                var y = padding + (m - 1 - i) * scaleY;
                var sizeX = scaleX + 1;
                var sizeY = scaleY + 1;

                ctx.fillRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
                ctx.strokeRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
            }
        }
    }
}

/**
 * Draw colorbar on canvas
 */
function drawColorbar(ctx, result, colors, config, canvasWidth, canvasHeight) {
    config = config || {};
    var thickness = config.thickness || 20;
    var len = config.len || 0.8;
    var barHeight = canvasHeight * len;
    var x = canvasWidth - thickness - 10;
    var y = (canvasHeight - barHeight) / 2;

    // Draw gradient
    for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var colorIdx = Math.floor(t * (colors.length - 1));
        colorIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));

        ctx.fillStyle = colors[colorIdx];
        ctx.fillRect(x, y + i, thickness, 1);
    }

    // Draw border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, thickness, barHeight);

    // Draw title (future)
    if (config.title) {
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(x + thickness / 2, y - 10);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(config.title, 0, 0);
        ctx.restore();
    }

    // Draw tick labels (simplified)
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    var levels = result.levels;
    var tickCount = Math.min(5, levels.length);
    for (var i = 0; i < tickCount; i++) {
        var idx = Math.floor(i * (levels.length - 1) / (tickCount - 1));
        var level = levels[idx];
        var t = (level - levels[0]) / (levels[levels.length - 1] - levels[0]);
        var tickY = y + barHeight * (1 - t);

        ctx.fillText(level.toFixed(1), x + thickness + 5, tickY);
    }
}

    // ============================================
    // PUBLIC API
    // ============================================
    return {
        version: '0.2.0',

        // Core computation
        computeContours: computeContours,
        scalePathsToData: scalePathsToData,

        // Simplified rendering API (NEW in v0.2.0)
        render: render,
        drawTo: drawTo,

        // Null handling (NEW in v0.2.0)
        nullHandling: nullHandling,

        // Color scales
        COLOR_SCALES: COLOR_SCALES
    };
}));

console.log('ContourCore v0.2.0 loaded');
