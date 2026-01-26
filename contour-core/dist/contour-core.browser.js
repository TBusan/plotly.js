/**
 * contour-core - Browser Bundle
 * Standalone contour calculation library
 * Version: 0.3.0
 *
 * Auto-generated from modules - Do not edit directly
 */

(function(global) {
    'use strict';

    // Module exports cache
    const modules = {};
    const cache = {};

    // Require function for browser
    function require(moduleId) {
        if (cache[moduleId]) {
            return cache[moduleId];
        }

        const module = modules[moduleId];
        if (!module) {
            throw new Error('Cannot find module "' + moduleId + '"');
        }

        cache[moduleId] = module.exports;

        // Execute the module
        const factory = module.factory;
        if (typeof factory === 'function') {
            factory(require, module.exports, module);
        }

        return cache[moduleId];
    }

    // Module definitions

    modules['constants'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Constants for marching squares algorithm and contour optimization
 */

// Marching squares constants - where does the path start for each index?
exports =  {
    // Edge start indicators for marching squares
    BOTTOMSTART: [1, 9, 13, 104, 713],
    TOPSTART: [4, 6, 7, 104, 713],
    LEFTSTART: [8, 12, 14, 208, 1114],
    RIGHTSTART: [2, 3, 11, 208, 1114],

    // Which way [dx,dy] do we leave a given index?
    // saddles are already disambiguated
    NEWDELTA: [
        null, [-1, 0], [0, -1], [-1, 0],
        [1, 0], null, [0, -1], [-1, 0],
        [0, 1], [0, 1], null, [0, 1],
        [1, 0], [1, 0], [0, -1]
    ],

    // For each saddle, the first index here is used
    // for dx||dy<0, the second for dx||dy>0
    CHOOSESADDLE: {
        104: [4, 1],
        208: [2, 8],
        713: [7, 13],
        1114: [11, 14]
    },

    // After one index has been used for a saddle, which do we
    // substitute to be used up later?
    SADDLEREMAINDER: {1: 4, 2: 8, 4: 1, 7: 13, 8: 2, 11: 14, 13: 7, 14: 11},

    // Length of a contour, as a multiple of the plot area diagonal, per label
    LABELDISTANCE: 2,

    // Number of contour levels after which we start increasing the number of
    // labels we draw. Many contours means they will generally be close
    // together, so it will be harder to follow a long way to find a label
    LABELINCREASE: 10,

    // Minimum length of a contour line, as a multiple of the label length,
    // at which we draw *any* labels
    LABELMIN: 3,

    // Max number of labels to draw on a single contour path, no matter how long
    LABELMAX: 10,

    // Constants for the label position cost function
    LABELOPTIMIZER: {
        // weight given to edge proximity
        EDGECOST: 1,
        // weight given to the angle off horizontal
        ANGLECOST: 1,
        // weight given to distance from already-placed labels
        NEIGHBORCOST: 5,
        // cost multiplier for labels on the same level
        SAMELEVELFACTOR: 10,
        // minimum distance (as a multiple of the label length)
        // for labels on the same level
        SAMELEVELDISTANCE: 5,
        // maximum cost before we won't even place the label
        MAXCOST: 100,
        // number of evenly spaced points to look at in the first
        // iteration of the search
        INITIALSEARCHPOINTS: 10,
        // number of binary search iterations after the initial wide search
        ITERATIONS: 5
    }
};

        },
        exports: {}
    };

    modules['levels'] = {
        factory: function(require, exports, module) {
            'use strict';

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

        var start, end;

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

        // Use smart tick algorithm to generate "nice" contour levels
        var smartTicks = computeNiceTicks(start, end, ncontours);

        // Generate levels using nice ticks
        for (var val = smartTicks.start;
             val <= smartTicks.end + smartTicks.step * 0.0001;
             val += smartTicks.step) {
            levels.push(val);
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
 * Compute "nice" tick values for contour levels
 * Based on Plotly's Axes.autoTicks algorithm
 *
 * This generates aesthetically pleasing tick values like 1, 2, 5, 10
 * instead of arbitrary values like 1.234, 2.468, 3.702
 *
 * @param {Number} start - Start value
 * @param {Number} end - End value
 * @param {Number} ncontours - Desired number of contours
 * @returns {Object} Object with {start, end, step}
 */
function computeNiceTicks(start, end, ncontours) {
    var range = end - start;

    // Handle degenerate cases
    if (range <= 0) {
        return {
            start: start,
            end: end,
            step: 1
        };
    }

    // Calculate rough step size
    var roughStep = range / (ncontours || 15);

    // Avoid zero or very small steps
    if (roughStep <= 0) {
        roughStep = 1;
    }

    // Calculate the exponent (power of 10)
    var exponent = Math.floor(Math.log10(roughStep));

    // Normalize the step to be between 1 and 10
    var fraction = roughStep / Math.pow(10, exponent);

    // Choose a "nice" fraction
    // These are the preferred numbers: 1, 2, 5, 10
    var niceFraction;

    if (fraction < 1.5) {
        niceFraction = 1;
    } else if (fraction < 3) {
        niceFraction = 2;
    } else if (fraction < 7) {
        niceFraction = 5;
    } else {
        niceFraction = 10;
    }

    // Calculate the nice step size
    var step = niceFraction * Math.pow(10, exponent);

    // Adjust the start to be a multiple of the step
    // This ensures ticks align on nice boundaries
    var adjustedStart;

    if (start >= 0) {
        adjustedStart = Math.ceil(start / step) * step;
    } else {
        adjustedStart = Math.floor(start / step) * step;
    }

    // Make sure we don't go below the original start
    if (adjustedStart > start) {
        adjustedStart -= step;
    }

    // Adjust the end to be a multiple of the step
    var adjustedEnd;

    if (end >= 0) {
        adjustedEnd = Math.floor(end / step) * step;
    } else {
        adjustedEnd = Math.ceil(end / step) * step;
    }

    // Make sure we don't go above the original end
    if (adjustedEnd < end) {
        adjustedEnd += step;
    }

    // Handle edge case where range is too small
    if (adjustedEnd <= adjustedStart) {
        adjustedEnd = adjustedStart + step;
    }

    // Round to appropriate precision to avoid floating point issues
    var precision = Math.max(0, -exponent);

    return {
        start: roundToPrecision(adjustedStart, precision),
        end: roundToPrecision(adjustedEnd, precision),
        step: roundToPrecision(step, precision)
    };
}

/**
 * Round a number to a specified precision
 *
 * @param {Number} value - Value to round
 * @param {Number} precision - Number of decimal places
 * @returns {Number} Rounded value
 */
function roundToPrecision(value, precision) {
    if (precision <= 0) {
        return Math.round(value);
    }

    var factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
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

exports =  {
    setContours: setContours,
    endPlus: endPlus,
    computeNiceTicks: computeNiceTicks,
    roundToPrecision: roundToPrecision
};

        },
        exports: {}
    };

    modules['marchingsquares'] = {
        factory: function(require, exports, module) {
            'use strict';

var constants = require("./constants");

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

exports =  {
    makeCrossings: makeCrossings,
    getMarchingIndex: getMarchingIndex
};

        },
        exports: {}
    };

    modules['pathfinding'] = {
        factory: function(require, exports, module) {
            'use strict';

var constants = require("./constants");

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
 * Enhanced version with support for data space interpolation
 *
 * @param {Object} pi - Path info object at this level
 * @param {Array} loc - Grid index [x, y] of the crossing
 * @param {Array} step - Direction [dx, dy] we're moving on the grid
 * @param {Object} scaleFunctions - Optional scale functions {xa, ya, x, y}
 * @returns {Array} [xpx, ypx, xi, yi] - interpolated location + grid indices
 */
function getInterpPx(pi, loc, step, scaleFunctions) {
    var locx = loc[0] + Math.max(step[0], 0);
    var locy = loc[1] + Math.max(step[1], 0);
    var zxy = pi.z[locy][locx];

    // Default to grid index space if no scale functions provided
    var x = scaleFunctions && scaleFunctions.x ? scaleFunctions.x : pi.x;
    var y = scaleFunctions && scaleFunctions.y ? scaleFunctions.y : pi.y;

    if (step[1]) {
        // Horizontal edge - interpolate in X direction
        var dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);

        // Protect against division by zero or invalid values
        if (!isFinite(dx)) dx = 0.5;

        // Interpolate in data space (supports non-uniform grids)
        var dataX;
        if (dx !== 1 && dx !== 0) {
            dataX = (1 - dx) * x[locx] + dx * x[locx + 1];
        } else if (dx === 1) {
            dataX = x[locx + 1];
        } else {
            dataX = x[locx];
        }

        var dataY = y[locy];

        return [
            dataX,      // X in data space
            dataY,      // Y in data space
            locx + dx,  // Interpolated grid index X
            locy        // Grid index Y
        ];
    } else {
        // Vertical edge - interpolate in Y direction
        var dy = (pi.level - zxy) / (pi.z[locy + 1][locx] - zxy);

        // Protect against division by zero or invalid values
        if (!isFinite(dy)) dy = 0.5;

        // Interpolate in data space (supports non-uniform grids)
        var dataX = x[locx];
        var dataY;
        if (dy !== 1 && dy !== 0) {
            dataY = (1 - dy) * y[locy] + dy * y[locy + 1];
        } else if (dy === 1) {
            dataY = y[locy + 1];
        } else {
            dataY = y[locy];
        }

        return [
            dataX,      // X in data space
            dataY,      // Y in data space
            locx,       // Grid index X
            locy + dy   // Interpolated grid index Y
        ];
    }
}

exports =  {
    findAllPaths: findAllPaths,
    getInterpPx: getInterpPx
};

        },
        exports: {}
    };

    modules['smooth'] = {
        factory: function(require, exports, module) {
            'use strict';

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

exports =  {
    smoothopen: smoothopen,
    smoothclosed: smoothclosed
};

        },
        exports: {}
    };

    modules['close_boundaries'] = {
        factory: function(require, exports, module) {
            'use strict';

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

exports =  closeBoundaries;

        },
        exports: {}
    };

    modules['null_handling/index'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Null value handling module
 * Provides utilities for normalizing and handling null/undefined/NaN values in contour data
 */

exports =  {
    normalizeNullValues: require("./normalize"),
    generateNullMask: require("./mask"),
    isValidValue: require("./validate")
};

        },
        exports: {}
    };

    modules['labels/index'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Labels module for contour rendering
 * Handles label positioning, formatting, and cost calculation
 */

exports =  {
    findBestTextLocation: require("./position"),
    formatContourLabel: require("./formatter"),
    locationCost: require("./cost")
};

        },
        exports: {}
    };

    modules['labels/position'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Find best text location along a contour path
 * Complete implementation based on Plotly's algorithm
 */

var locationCost = require("./cost");

// Cost optimization constants
var COST_CONSTANTS = {
    EDGECOST: 1,
    ANGLECOST: 1,
    NEIGHBORCOST: 5,
    SAMELEVELFACTOR: 10,
    SAMELEVELDISTANCE: 5,
    MAXCOST: 100,
    INITIALSEARCHPOINTS: 10,
    ITERATIONS: 5
};

/**
 * Calculate path length from array of points
 */
function pathLength(path) {
    var len = 0;
    for (var i = 1; i < path.length; i++) {
        var dx = path[i][0] - path[i - 1][0];
        var dy = path[i][1] - path[i - 1][1];
        len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
}

/**
 * Get point at a specific distance along the path
 */
function getPointAtLength(path, targetLen) {
    var accumulated = 0;
    for (var i = 1; i < path.length; i++) {
        var dx = path[i][0] - path[i - 1][0];
        var dy = path[i][1] - path[i - 1][1];
        var segLen = Math.sqrt(dx * dx + dy * dy);

        if (accumulated + segLen >= targetLen) {
            var t = (targetLen - accumulated) / segLen;
            return {
                x: path[i - 1][0] + dx * t,
                y: path[i - 1][1] + dy * t
            };
        }
        accumulated += segLen;
    }
    return { x: path[path.length - 1][0], y: path[path.length - 1][1] };
}

/**
 * Get text location at a specific position along the path
 * Similar to Plotly's Lib.getTextLocation but works with point arrays
 */
function getTextLocation(path, totalPathLen, positionOnPath, textWidth) {
    var halfWidth = textWidth / 2;
    var p0 = getPointAtLength(path, Math.max(0, positionOnPath - halfWidth));
    var p1 = getPointAtLength(path, Math.min(totalPathLen, positionOnPath + halfWidth));
    var pCenter = getPointAtLength(path, positionOnPath);

    // Calculate angle
    var theta = Math.atan2(p1.y - p0.y, p1.x - p0.x);

    // Center the text at 2/3 of the center position plus 1/3 the p0/p1 midpoint
    var x = (pCenter.x * 4 + p0.x + p1.x) / 6;
    var y = (pCenter.y * 4 + p0.y + p1.y) / 6;

    return { x: x, y: y, theta: theta };
}

/**
 * Find optimal position for a label along a path
 * @param {Array} path - Array of [x, y] points
 * @param {Object} textOpts - Text options {level, width, height}
 * @param {Array} existingLabels - Array of existing labels to avoid overlap
 * @param {Object} plotBounds - Plot boundaries {left, right, top, bottom, center, middle}
 * @returns {Object} Label position with {x, y, theta, level}
 */
function findBestTextLocation(path, textOpts, existingLabels, plotBounds) {
    if (!path || path.length < 2) {
        return null;
    }

    existingLabels = existingLabels || [];
    plotBounds = plotBounds || {};

    var textWidth = textOpts.width || 50;
    var totalPathLen = pathLength(path);

    // Calculate search range
    var dp, p0, pMax;
    if (totalPathLen > textWidth * 2) {
        // Open path - keep text away from edges
        dp = (totalPathLen - textWidth) / (COST_CONSTANTS.INITIALSEARCHPOINTS + 1);
        p0 = dp + textWidth / 2;
        pMax = totalPathLen - textWidth / 2 - dp;
    } else {
        // Closed or very short path
        dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
        p0 = dp / 2;
        pMax = totalPathLen;
    }

    var bestCost = Infinity;
    var bestLoc = null;
    var pMin = p0;

    // Iterative search for best position
    for (var j = 0; j < COST_CONSTANTS.ITERATIONS; j++) {
        for (var p = p0; p < pMax; p += dp) {
            var newLocation = getTextLocation(path, totalPathLen, p, textWidth);
            var newCost = locationCost(newLocation, {
                width: textWidth,
                height: textOpts.height || 20,
                level: textOpts.level || 0
            }, existingLabels, plotBounds);

            if (newCost < bestCost) {
                bestCost = newCost;
                bestLoc = newLocation;
                pMin = p;
            }
        }

        if (bestCost > COST_CONSTANTS.MAXCOST * 2) break;

        // Refine search around best location
        if (j > 0) dp /= 2;
        p0 = pMin - dp / 2;
        pMax = pMin + dp / 2;
    }

    if (bestCost <= COST_CONSTANTS.MAXCOST) {
        bestLoc.level = textOpts.level || 0;
        return bestLoc;
    }

    // Fallback: return middle of path
    var midIdx = Math.floor(path.length / 2);
    var pt = path[midIdx];
    var nextPt = path[Math.min(midIdx + 1, path.length - 1)];
    var theta = 0;
    if (nextPt && pt) {
        theta = Math.atan2(nextPt[1] - pt[1], nextPt[0] - pt[0]);
    }
    return {
        x: pt ? pt[0] : 0,
        y: pt ? pt[1] : 0,
        theta: theta,
        level: textOpts.level || 0
    };
}

exports =  findBestTextLocation;

        },
        exports: {}
    };

    modules['labels/cost'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Calculate cost for label placement
 * Complete implementation based on Plotly's algorithm
 */

// Cost constants (must match position.js)
var COST_CONSTANTS = {
    EDGECOST: 1,
    ANGLECOST: 1,
    NEIGHBORCOST: 5,
    SAMELEVELFACTOR: 10,
    SAMELEVELDISTANCE: 5
};

/**
 * Calculate placement cost for a label at a given position
 * Based on Plotly's locationCost function
 *
 * @param {Object} loc - Label position {x, y, theta, level}
 * @param {Object} textOpts - Text options {width, height, level}
 * @param {Array} labelData - Array of existing labels
 * @param {Object} bounds - Plot boundaries {left, right, top, bottom, center, middle}
 * @returns {number} Cost value (lower is better, Infinity if invalid)
 */
function locationCost(loc, textOpts, labelData, bounds) {
    var halfWidth = textOpts.width / 2;
    var halfHeight = textOpts.height / 2;
    var x = loc.x;
    var y = loc.y;
    var theta = loc.theta || 0;
    var dx = Math.cos(theta) * halfWidth;
    var dy = Math.sin(theta) * halfWidth;

    // Calculate bounds with default values
    bounds = bounds || {};
    var left = bounds.left !== undefined ? bounds.left : x - 100;
    var right = bounds.right !== undefined ? bounds.right : x + 100;
    var top = bounds.top !== undefined ? bounds.top : y - 100;
    var bottom = bounds.bottom !== undefined ? bounds.bottom : y + 100;
    var center = bounds.center !== undefined ? bounds.center : (left + right) / 2;
    var middle = bounds.middle !== undefined ? bounds.middle : (top + bottom) / 2;

    // Cost for being near an edge
    var normX = ((x > center) ? (right - x) : (x - left)) /
        (dx + Math.abs(Math.sin(theta) * halfHeight));
    var normY = ((y > middle) ? (bottom - y) : (y - top)) /
        (Math.abs(dy) + Math.cos(theta) * halfHeight);

    if (normX < 1 || normY < 1) return Infinity;
    var cost = COST_CONSTANTS.EDGECOST * (1 / (normX - 1) + 1 / (normY - 1));

    // Cost for not being horizontal
    cost += COST_CONSTANTS.ANGLECOST * theta * theta;

    // Cost for being close to other labels
    if (labelData && labelData.length > 0) {
        var x1 = x - dx;
        var y1 = y - dy;
        var x2 = x + dx;
        var y2 = y + dy;

        for (var i = 0; i < labelData.length; i++) {
            var labeli = labelData[i];
            var dxd = Math.cos(labeli.theta || 0) * labeli.width / 2;
            var dyd = Math.sin(labeli.theta || 0) * labeli.width / 2;

            // Simple distance check (segmentDistance would be more accurate)
            var dist = segmentDistance(
                x1, y1,
                x2, y2,
                labeli.x - dxd, labeli.y - dyd,
                labeli.x + dxd, labeli.y + dyd
            ) * 2 / (textOpts.height + labeli.height);

            var sameLevel = (textOpts.level === labeli.level);
            var distOffset = sameLevel ? COST_CONSTANTS.SAMELEVELDISTANCE : 1;

            if (dist <= distOffset) return Infinity;

            var distFactor = COST_CONSTANTS.NEIGHBORCOST *
                (sameLevel ? COST_CONSTANTS.SAMELEVELFACTOR : 1);

            cost += distFactor / (dist - distOffset);
        }
    }

    return cost;
}

/**
 * Calculate distance between two line segments
 * Simplified version of segmentDistance
 */
function segmentDistance(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Find the closest points on the two segments
    var dist = Infinity;

    // Check all endpoints
    dist = Math.min(dist, pointToSegmentDistance(x1, y1, x3, y3, x4, y4));
    dist = Math.min(dist, pointToSegmentDistance(x2, y2, x3, y3, x4, y4));
    dist = Math.min(dist, pointToSegmentDistance(x3, y3, x1, y1, x2, y2));
    dist = Math.min(dist, pointToSegmentDistance(x4, y4, x1, y1, x2, y2));

    return dist;
}

/**
 * Distance from point to line segment
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len2 = dx * dx + dy * dy;

    if (len2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));

    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    var projX = x1 + t * dx;
    var projY = y1 + t * dy;

    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
}

exports =  locationCost;

        },
        exports: {}
    };

    modules['labels/formatter'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Format contour label text
 */

/**
 * Format a value as a contour label
 * @param {number} value - The value to format
 * @param {string} format - Format string (e.g., '.2f', '+.1f')
 * @returns {string} Formatted label text
 */
function formatContourLabel(value, format) {
    if (format === undefined) {
        return String(value);
    }

    // Handle format strings like '.2f', '+.1f', '.0f'
    if (format.includes('f')) {
        // Extract precision
        const match = format.match(/\.(\d+)f/);
        if (match) {
            const precision = parseInt(match[1]);
            let formatted = value.toFixed(precision);

            // Handle sign
            if (format.startsWith('+') && value >= 0) {
                formatted = '+' + formatted;
            }

            return formatted;
        }
    }

    // Handle percentage
    if (format.includes('%')) {
        const match = format.match(/\.(\d+)%/);
        if (match) {
            const precision = parseInt(match[1]);
            return (value * 100).toFixed(precision) + '%';
        }
    }

    return String(value);
}

exports =  formatContourLabel;

        },
        exports: {}
    };

    modules['colorbar/colors'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Color mapping utilities for colorbar
 * Enhanced version with support for custom thresholds and heatmap mode
 */

// Preset color scales
const COLOR_SCALES = {
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
 * Parse colorscale into normalized format
 * Handles both simple color arrays and Plotly-style [[position, color], ...] format
 *
 * @param {string|Array} colorscale - Color scale name or array
 * @returns {Array} Normalized colorscale as [[position, color], ...]
 */
function parseColorscale(colorscale) {
    let colors;

    if (Array.isArray(colorscale)) {
        // Check if it's already in [[position, color], ...] format
        if (colorscale.length > 0 && Array.isArray(colorscale[0]) && colorscale[0].length === 2) {
            return colorscale; // Already in correct format
        }
        colors = colorscale;
    } else if (typeof colorscale === 'string') {
        const name = colorscale.charAt(0).toUpperCase() + colorscale.slice(1).toLowerCase();
        colors = COLOR_SCALES[name] || COLOR_SCALES.Viridis;
    } else {
        colors = COLOR_SCALES.Viridis;
    }

    // Convert simple color array to [[position, color], ...] format
    return colors.map((color, i) => [i / (colors.length - 1), color]);
}

/**
 * Interpolate between two colors
 *
 * @param {string} color1 - Start color (hex)
 * @param {string} color2 - End color (hex)
 * @param {number} t - Interpolation factor (0-1)
 * @returns {string} Interpolated color (hex)
 */
function interpolateColor(color1, color2, t) {
    // Parse hex colors
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    // Convert back to hex
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Get color at a specific position from a colorscale
 *
 * @param {Array} colorscale - Normalized colorscale [[position, color], ...]
 * @param {number} position - Position (0-1)
 * @returns {string} Color at position
 */
function getColorAtPosition(colorscale, position) {
    // Clamp position to [0, 1]
    const t = Math.max(0, Math.min(1, position));

    // Find the two colors to interpolate between
    let i = 0;
    while (i < colorscale.length - 1 && colorscale[i + 1][0] < t) {
        i++;
    }

    if (i >= colorscale.length - 1) {
        return colorscale[colorscale.length - 1][1];
    }

    const pos1 = colorscale[i][0];
    const pos2 = colorscale[i + 1][0];
    const color1 = colorscale[i][1];
    const color2 = colorscale[i + 1][1];

    // Interpolate between the two colors
    const localT = (t - pos1) / (pos2 - pos1);
    return interpolateColor(color1, color2, localT);
}

/**
 * Map a value to a color from a color scale
 * Enhanced version with support for custom thresholds and data range extension
 *
 * @param {number} value - Value to map
 * @param {number} min - Minimum value (can be extended with dataMin)
 * @param {number} max - Maximum value (can be extended with dataMax)
 * @param {string|Array} colorscale - Color scale name or array
 * @param {Object} options - Optional parameters
 * @param {number} options.dataMin - Actual data minimum (for heatmap mode extension)
 * @param {number} options.dataMax - Actual data maximum (for heatmap mode extension)
 * @param {boolean} options.reverse - Reverse the color scale
 * @returns {string} Hex color code
 */
function mapColors(value, min, max, colorscale, options) {
    options = options || {};

    // Parse colorscale
    let scale = parseColorscale(colorscale);

    // Reverse if needed
    if (options.reverse) {
        scale = scale.slice().reverse();
        // Re-normalize positions
        scale = scale.map(([pos, color]) => [1 - pos, color]).sort((a, b) => a[0] - b[0]);
    }

    // Extend colorscale for heatmap mode if data range is larger
    if (options.dataMin !== undefined && options.dataMin < min) {
        const firstColor = scale[0][1];
        scale.unshift([options.dataMin, firstColor]);
        min = options.dataMin;
    }
    if (options.dataMax !== undefined && options.dataMax > max) {
        const lastColor = scale[scale.length - 1][1];
        scale.push([options.dataMax, lastColor]);
        max = options.dataMax;
    }

    // Normalize value to 0-1 range
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

    return getColorAtPosition(scale, t);
}

/**
 * Build color stop array for rendering
 * Enhanced version with support for custom thresholds
 *
 * @param {Array} levels - Contour levels (custom thresholds allowed)
 * @param {string|Array} colorscale - Color scale
 * @param {Object} options - Optional parameters
 * @param {number} options.dataMin - Actual data minimum
 * @param {number} options.dataMax - Actual data maximum
 * @param {boolean} options.extend - Extend colorscale to data range (heatmap mode)
 * @returns {Array} Array of [value, color] pairs
 */
function buildColorScale(levels, colorscale, options) {
    options = options || {};

    if (levels.length === 0) {
        return [];
    }

    // Parse colorscale
    let scale = parseColorscale(colorscale);

    // Reverse if needed
    if (options.reverse) {
        scale = scale.slice().reverse();
        scale = scale.map(([pos, color]) => [1 - pos, color]).sort((a, b) => a[0] - b[0]);
    }

    const levelMin = levels[0];
    const levelMax = levels[levels.length - 1];

    // For custom thresholds, map colors directly to threshold values
    // This ensures each threshold gets a distinct color
    const colorStops = [];

    for (let i = 0; i < levels.length; i++) {
        const level = levels[i];

        // Map level to colorscale position
        let t;
        if (levels.length === 1) {
            t = 0.5;
        } else {
            t = (level - levelMin) / (levelMax - levelMin);
        }

        const color = getColorAtPosition(scale, t);
        colorStops.push([level, color]);
    }

    // Extend colorscale for heatmap mode if requested
    if (options.extend && options.dataMin !== undefined && options.dataMin < levelMin) {
        const firstColor = colorStops[0][1];
        colorStops.unshift([options.dataMin, firstColor]);
    }
    if (options.extend && options.dataMax !== undefined && options.dataMax > levelMax) {
        const lastColor = colorStops[colorStops.length - 1][1];
        colorStops.push([options.dataMax, lastColor]);
    }

    return colorStops;
}

/**
 * Create a color mapping function from a colorscale
 * Useful for efficient repeated color lookups
 *
 * @param {Array} levels - Contour levels
 * @param {string|Array} colorscale - Color scale
 * @param {Object} options - Optional parameters
 * @returns {Function} Function that takes a value and returns a color
 */
function createColorMapper(levels, colorscale, options) {
    const colorStops = buildColorScale(levels, colorscale, options);

    return function(value) {
        // Find the color stop that contains this value
        for (let i = 0; i < colorStops.length - 1; i++) {
            const stop1 = colorStops[i];
            const stop2 = colorStops[i + 1];

            if (value >= stop1[0] && value <= stop2[0]) {
                // Interpolate between stops
                const t = (value - stop1[0]) / (stop2[0] - stop1[0]);
                return interpolateColor(stop1[1], stop2[1], t);
            }
        }

        // Value is outside the range, use closest color
        if (value < colorStops[0][0]) {
            return colorStops[0][1];
        }
        return colorStops[colorStops.length - 1][1];
    };
}

/**
 * Get a gradient definition for Canvas/SVG rendering
 *
 * @param {Array} levels - Contour levels
 * @param {string|Array} colorscale - Color scale
 * @param {boolean} horizontal - Horizontal gradient (default: vertical)
 * @returns {Array} Array of {offset, color} objects
 */
function getGradientStops(levels, colorscale, horizontal) {
    const colorStops = buildColorScale(levels, colorscale);
    const min = colorStops[0][0];
    const max = colorStops[colorStops.length - 1][0];

    return colorStops.map(([value, color]) => ({
        offset: (value - min) / (max - min),
        color: color
    }));
}

exports =  {
    mapColors: mapColors,
    buildColorScale: buildColorScale,
    createColorMapper: createColorMapper,
    getGradientStops: getGradientStops,
    parseColorscale: parseColorscale,
    getColorAtPosition: getColorAtPosition,
    interpolateColor: interpolateColor,
    COLOR_SCALES: COLOR_SCALES
};

        },
        exports: {}
    };

    modules['colorbar/ticks'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Compute tick positions and labels for colorbar
 * Enhanced version with smart formatting based on Plotly's algorithm
 */

/**
 * Format a tick value using various format specifiers
 * Supports D3-style format strings like '.2f', '.1%', '.2e'
 *
 * @param {number} value - Value to format
 * @param {string} format - Format string (e.g., '.2f', '.1%', '.2e', '.1s')
 * @returns {string} Formatted value
 */
function formatTickValue(value, format) {
    if (!format) {
        return autoFormatValue(value);
    }

    // Parse format string
    const precisionMatch = format.match(/^\.(\d+)([fse%])?$/i);
    if (precisionMatch) {
        const precision = parseInt(precisionMatch[1], 10);
        const type = (precisionMatch[2] || 'f').toLowerCase();

        switch (type) {
            case 'f':
            case 'F':
                return formatFixed(value, precision);

            case 'e':
            case 'E':
                return formatExponential(value, precision, type === 'E');

            case '%':
                return formatPercent(value, precision);

            default:
                return formatFixed(value, precision);
        }
    }

    // Try to handle other formats
    return autoFormatValue(value);
}

/**
 * Format value with fixed-point notation
 */
function formatFixed(value, precision) {
    // Handle special cases
    if (!isFinite(value)) return String(value);
    if (Math.abs(value) < Math.pow(10, -precision)) {
        return '0';
    }

    return value.toFixed(precision);
}

/**
 * Format value with exponential notation
 */
function formatExponential(value, precision, uppercase) {
    if (!isFinite(value)) return String(value);
    if (value === 0) return '0e+0';

    let str = value.toExponential(precision);
    if (uppercase) {
        str = str.replace('e', 'E');
    }
    return str;
}

/**
 * Format value as percentage
 */
function formatPercent(value, precision) {
    if (!isFinite(value)) return String(value);

    return (value * 100).toFixed(precision) + '%';
}

/**
 * Auto-format value based on its magnitude
 * Intelligently chooses the best format
 *
 * @param {number} value - Value to format
 * @returns {string} Formatted value
 */
function autoFormatValue(value) {
    // Handle special cases
    if (!isFinite(value)) return String(value);
    if (value === 0) return '0';

    const absValue = Math.abs(value);

    // Very small values - use scientific notation
    if (absValue < 0.01) {
        return value.toExponential(2);
    }

    // Very large values - use scientific notation
    if (absValue >= 10000) {
        return value.toExponential(2);
    }

    // Small fractional values - use more precision
    if (absValue < 1) {
        return value.toFixed(4);
    }

    // Fractional values - use medium precision
    if (absValue < 100) {
        // Remove trailing zeros
        return parseFloat(value.toFixed(2)).toString();
    }

    // Large integers - remove decimal places
    if (absValue >= 100 && absValue < 10000) {
        return value.toFixed(1).replace(/\.0$/, '');
    }

    // Default
    return value.toString();
}

/**
 * Compute tick marks for colorbar
 * Enhanced with smart tick positioning
 *
 * @param {Object} colorbar - Colorbar data from computeColorbar
 * @param {Object} options - Options
 * @param {number} options.nticks - Number of ticks (default: 5)
 * @param {string} options.tickmode - Tick mode ('linear' or 'array')
 * @param {Array} options.tickvals - Explicit tick values (for tickmode='array')
 * @param {Array} options.ticktext - Explicit tick labels (for tickmode='array')
 * @param {string} options.tickformat - Format string for tick labels
 * @param {boolean} options.exponentialformat - Use exponential notation
 * @returns {Array} Array of tick objects {position, value, label}
 */
function computeTicks(colorbar, options) {
    options = options || {};

    const levels = colorbar.levels || [];
    const tickCount = options.nticks || 5;
    const tickMode = options.tickmode || 'linear';

    const ticks = [];

    if (tickMode === 'linear' && levels.length > 0) {
        // Use smart ticks from levels if available
        const smartTicks = computeSmartTicks(levels[0], levels[levels.length - 1], tickCount);

        for (let i = 0; i < smartTicks.values.length; i++) {
            const value = smartTicks.values[i];
            const position = smartTicks.positions[i];

            ticks.push({
                position: position,
                value: value,
                label: formatTickValue(value, options.tickformat)
            });
        }
    } else if (tickMode === 'array') {
        // Use explicit tick values
        const tickValues = options.tickvals || [];
        const tickText = options.ticktext || [];

        for (let i = 0; i < tickValues.length; i++) {
            const val = tickValues[i];
            const t = (val - colorbar.zmin) / (colorbar.zmax - colorbar.zmin);

            ticks.push({
                position: Math.max(0, Math.min(1, t)),
                value: val,
                label: tickText[i] || formatTickValue(val, options.tickformat)
            });
        }
    } else if (tickMode === 'auto') {
        // Auto mode - use nice ticks
        const smartTicks = computeSmartTicks(colorbar.zmin, colorbar.zmax, tickCount);

        for (let i = 0; i < smartTicks.values.length; i++) {
            const value = smartTicks.values[i];
            const position = (value - colorbar.zmin) / (colorbar.zmax - colorbar.zmin);

            ticks.push({
                position: Math.max(0, Math.min(1, position)),
                value: value,
                label: formatTickValue(value, options.tickformat)
            });
        }
    }

    return ticks;
}

/**
 * Compute smart tick positions using nice numbers
 * Based on the same algorithm used in levels.js
 *
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} nTicks - Desired number of ticks
 * @returns {Object} Object with {values: [], positions: []}
 */
function computeSmartTicks(start, end, nTicks) {
    const range = end - start;

    if (range <= 0 || nTicks <= 0) {
        return {
            values: [start],
            positions: [0.5]
        };
    }

    // Calculate rough step size
    const roughStep = range / (nTicks - 1);

    // Calculate exponent and nice fraction
    const exponent = Math.floor(Math.log10(roughStep));
    const fraction = roughStep / Math.pow(10, exponent);

    let niceFraction;
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;

    const step = niceFraction * Math.pow(10, exponent);

    // Generate tick values
    const values = [];
    const positions = [];

    let firstTick = Math.ceil(start / step) * step;
    if (firstTick > start) firstTick -= step;

    for (let val = firstTick; val <= end + step * 0.0001; val += step) {
        if (val >= start - step * 0.0001) {
            values.push(val);
            positions.push((val - start) / range);
        }
    }

    return {
        values: values,
        positions: positions
    };
}

/**
 * Legacy formatTick function for backward compatibility
 */
function formatTick(value, options) {
    options = options || {};
    return formatTickValue(value, options.tickformat);
}

exports =  computeTicks;
module.exports.formatTickValue = formatTickValue;
module.exports.autoFormatValue = autoFormatValue;
module.exports.computeSmartTicks = computeSmartTicks;

        },
        exports: {}
    };

    modules['colorbar/compute'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Compute colorbar data from contour result
 */

/**
 * Compute colorbar information
 * @param {Object} contourResult - Result from computeContours
 * @param {Object} options - Colorbar options
 * @returns {Object} Colorbar data
 */
function computeColorbar(contourResult, options) {
    options = options || {};

    const levels = contourResult.levels;
    if (!levels || levels.length === 0) {
        return null;
    }

    const zmin = options.zmin !== undefined ? options.zmin : levels[0];
    const zmax = options.zmax !== undefined ? options.zmax : levels[levels.length - 1];

    return {
        type: options.coloring || 'fill',
        zmin: zmin,
        zmax: zmax,
        levels: levels,
        colors: options.colors || []
    };
}

exports =  computeColorbar;

        },
        exports: {}
    };

    modules['renderers/canvas/paths'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Canvas path drawing for contours
 * Based on Plotly's contour filling algorithm
 */

var smooth = require("../../smooth");

/**
 * Create perimeter path for boundary closing
 * @param {Object} style - Style options
 * @returns {Array} Array of [x, y] perimeter points
 */
function createPerimeter(style) {
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var xMin = padding;
    var xMax = width - padding;
    var yMin = padding;
    var yMax = height - padding;

    // Clockwise perimeter starting from top-left
    return [
        [xMin, yMin],  // 0: top-left
        [xMax, yMin],  // 1: top-right
        [xMax, yMax],  // 2: bottom-right
        [xMin, yMax]   // 3: bottom-left
    ];
}

/**
 * Join all edge paths into a single path with proper boundary connections
 * Based on Plotly's joinAllPaths function
 * @param {Object} pathInfo - Path info object
 * @param {Array} perimeter - Perimeter points
 * @param {Object} style - Style options
 * @returns {String} SVG path string
 */
function joinAllPaths(pathInfo, perimeter, style) {
    var fullpath = '';
    var edgepaths = pathInfo.edgepaths;

    if (edgepaths.length === 0 && pathInfo.paths.length === 0) {
        // No paths at all
        return '';
    }

    var i = 0;
    var startsleft = edgepaths.map(function(v, i) { return i; });
    var newloop = true;
    var endpt;
    var newendpt;
    var cnt;
    var nexti;
    var possiblei;
    var addpath;

    function istop(pt) { return Math.abs(pt[1] - perimeter[0][1]) < 0.1; }
    function isbottom(pt) { return Math.abs(pt[1] - perimeter[2][1]) < 0.1; }
    function isleft(pt) { return Math.abs(pt[0] - perimeter[0][0]) < 0.1; }
    function isright(pt) { return Math.abs(pt[0] - perimeter[2][0]) < 0.1; }

    // Process edge paths (open paths that touch the boundary)
    while (startsleft.length > 0) {
        // Scale and smooth the current edge path
        var scaledPath = edgepaths[i].map(function(pt) {
            return scalePoint(style, pt);
        });
        addpath = smooth.smoothopen(scaledPath, pathInfo.smoothing || 0);
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);

        endpt = scaledPath[scaledPath.length - 1];
        nexti = -1;

        // Loop through sides to find next path
        for (cnt = 0; cnt < 4; cnt++) {
            if (!endpt) break;

            // Determine which corner to move to
            if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1]; // right top
            else if (isleft(endpt)) newendpt = perimeter[0]; // left top
            else if (isbottom(endpt)) newendpt = perimeter[3]; // right bottom
            else if (isright(endpt)) newendpt = perimeter[2]; // left bottom

            // Find next path that starts on this edge
            for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
                var ptNew = edgepaths[possiblei].map(function(pt) {
                    return scalePoint(style, pt);
                })[0];

                // Check if ptNew is on the segment from endpt to newendpt
                if (Math.abs(endpt[0] - newendpt[0]) < 0.1) {
                    // Vertical edge
                    if (Math.abs(endpt[0] - ptNew[0]) < 0.1 &&
                        (ptNew[1] - endpt[1]) * (newendpt[1] - ptNew[1]) >= 0) {
                        newendpt = ptNew;
                        nexti = possiblei;
                    }
                } else if (Math.abs(endpt[1] - newendpt[1]) < 0.1) {
                    // Horizontal edge
                    if (Math.abs(endpt[1] - ptNew[1]) < 0.1 &&
                        (ptNew[0] - endpt[0]) * (newendpt[0] - ptNew[0]) >= 0) {
                        newendpt = ptNew;
                        nexti = possiblei;
                    }
                }
            }

            endpt = newendpt;
            if (nexti >= 0) break;
            fullpath += 'L' + newendpt[0] + ' ' + newendpt[1];
        }

        if (nexti === edgepaths.length || nexti < 0) break;

        i = nexti;

        // if we closed back on a loop we already included,
        // close it and start a new loop
        newloop = (startsleft.indexOf(i) === -1);
        if (newloop) {
            if (startsleft.length > 0) {
                i = startsleft[0];
            }
            fullpath += 'Z';
        }
    }

    // Finally add the interior closed paths (THIS WAS MISSING!)
    for (i = 0; i < pathInfo.paths.length; i++) {
        var scaledPath = pathInfo.paths[i].map(function(pt) {
            return scalePoint(style, pt);
        });
        fullpath += smooth.smoothclosed(scaledPath, pathInfo.smoothing || 0);
    }

    return fullpath;
}

/**
 * Draw filled contour paths
 * Using even-odd fill rule with prefixBoundary
 * This matches Plotly's original makeFills logic
 */
function drawFilledPaths(ctx, contourResult, style) {
    var paths = contourResult.paths;
    var levels = contourResult.levels;
    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var smoothing = style.smoothing || 0;
    var perimeter = createPerimeter(style);

    // Get color for this level (direct mapping, no interpolation)
    function getColorForLevel(level, levelIndex) {
        if (style.colorScale && Array.isArray(style.colorScale)) {
            var nColors = style.colorScale.length;
            var nLevels = levels.length;

            if (nLevels === 0) return style.colorScale[0][1];

            // Map level to color scale directly
            // Each level gets a corresponding color from the scale
            var scaleIndex = Math.floor((levelIndex / nLevels) * (nColors - 1));
            scaleIndex = Math.max(0, Math.min(nColors - 1, scaleIndex));

            return style.colorScale[scaleIndex][1];
        }
        return 'rgba(100, 100, 100, 0.3)';
    }

    // First, draw the entire background with the lowest level color
    // This ensures the base layer is filled
    if (paths.length > 0) {
        ctx.fillStyle = getColorForLevel(levels[0], 0);
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.fill();
    }

    // Draw from LOWEST to HIGHEST (this is critical!)
    // Each level draws the region ABOVE that contour
    // Higher levels cover lower levels, creating the proper gradient
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Use the color corresponding to this level
        ctx.fillStyle = getColorForLevel(pathInfo.level, i);

        // Build the complete path string
        var boundaryPath = 'M' + perimeter.join('L') + 'Z';
        var joinedPaths = joinAllPaths(pathInfo, perimeter, style);
        var fullpath = '';

        // Use prefixBoundary flag to determine if we need to add the boundary
        // This is set by closeBoundaries() function
        if (pathInfo.prefixBoundary) {
            fullpath = boundaryPath + joinedPaths;
        } else {
            fullpath = joinedPaths;
        }

        // Draw the path using even-odd fill rule (same as SVG)
        if (fullpath) {
            ctx.beginPath();
            drawSVGPath(ctx, fullpath);
            ctx.fill('evenodd');  // Use even-odd rule like SVG
        }
    }
}

/**
 * Draw contour line strokes
 */
function drawStrokePaths(ctx, contourResult, style) {
    var paths = contourResult.paths;
    var smoothing = style.smoothing || 0;

    ctx.strokeStyle = style.lineColor || '#333';
    ctx.lineWidth = style.lineWidth || 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Draw closed paths
        for (var j = 0; j < pathInfo.paths.length; j++) {
            drawPathStroke(ctx, pathInfo.paths[j], smoothing, true, style);
        }

        // Draw edge paths
        for (j = 0; j < pathInfo.edgepaths.length; j++) {
            drawPathStroke(ctx, pathInfo.edgepaths[j], smoothing, false, style);
        }
    }
}

/**
 * Draw a single path (filled)
 */
function drawPath(ctx, path, smoothing, isClosed, style) {
    if (path.length < 2) return;

    ctx.beginPath();

    var scaledPath = path.map(scalePoint.bind(null, style));

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
 * Draw edge path (open at boundary)
 * DEPRECATED: Now using joinAllPaths for proper boundary handling
 */
function drawEdgePath(ctx, path, smoothing, style) {
    // This function is kept for backward compatibility
    // but edge paths are now handled in drawFilledPaths via joinAllPaths
    drawPath(ctx, path, smoothing, false, style);
}

/**
 * Draw path stroke
 */
function drawPathStroke(ctx, path, smoothing, isClosed, style) {
    if (path.length < 2) return;

    ctx.beginPath();

    var scaledPath = path.map(scalePoint.bind(null, style));

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
 * Scale point to canvas coordinates
 */
function scalePoint(style, pt) {
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    return [
        padding + pt[0] * scaleX,
        padding + (m - 1 - pt[1]) * scaleY
    ];
}

/**
 * Draw SVG path string on canvas
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

exports =  {
    drawFilledPaths: drawFilledPaths,
    drawStrokePaths: drawStrokePaths,
    scalePoint: scalePoint
};

        },
        exports: {}
    };

    modules['renderers/canvas/heatmap'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Heatmap background rendering for contours
 * Supports 'heatmap' coloring mode
 */

var colors = require("../../colorbar/colors");

/**
 * Draw heatmap background
 * Renders each grid cell with its corresponding color
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} grid - Grid data {z, x, y}
 * @param {Object} style - Style options
 * @param {string|Array} style.colorscale - Color scale
 * @param {number} style.width - Canvas width
 * @param {number} style.height - Canvas height
 * @param {number} style.padding - Padding around plot
 * @param {boolean} style.reverse - Reverse colorscale
 * @param {Object} style.dataRange - Data range {min, max}
 */
function drawHeatmapBackground(ctx, grid, style) {
    if (!grid || !grid.z || !ctx) {
        return;
    }

    var z = grid.z;
    var m = z.length;    // number of rows
    var n = z[0].length; // number of columns

    if (m === 0 || n === 0) {
        return;
    }

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var padding = style.padding || 30;
    var plotWidth = width - 2 * padding;
    var plotHeight = height - 2 * padding;

    var cellWidth = plotWidth / (n - 1);
    var cellHeight = plotHeight / (m - 1);

    // Get colorscale
    var colorscale = style.colorscale || 'Viridis';

    // Determine data range
    var zmin, zmax;
    if (style.dataRange && style.dataRange.min !== undefined) {
        zmin = style.dataRange.min;
        zmax = style.dataRange.max;
    } else {
        // Calculate from data (excluding NaN/null values)
        var minVal = Infinity;
        var maxVal = -Infinity;
        for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
                var val = z[i][j];
                if (typeof val === 'number' && isFinite(val)) {
                    if (val < minVal) minVal = val;
                    if (val > maxVal) maxVal = val;
                }
            }
        }
        zmin = minVal;
        zmax = maxVal;
    }

    if (!isFinite(zmin) || !isFinite(zmax)) {
        return; // No valid data
    }

    // Draw each cell
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            var value = z[i][j];

            // Skip null/NaN values
            if (typeof value !== 'number' || !isFinite(value)) {
                continue;
            }

            // Get color for this cell
            var color = colors.mapColors(
                value,
                zmin,
                zmax,
                colorscale,
                {
                    reverse: style.reverse,
                    dataMin: style.dataRange ? style.dataRange.min : undefined,
                    dataMax: style.dataRange ? style.dataRange.max : undefined
                }
            );

            // Calculate cell position
            // Note: y is inverted (0 at top in canvas, but at bottom in grid)
            var x = padding + j * cellWidth;
            var y = padding + (m - 1 - i) * cellHeight;

            // Draw cell (slightly overlap to avoid gaps)
            ctx.fillStyle = color;
            ctx.fillRect(
                x - cellWidth / 2,
                y - cellHeight / 2,
                cellWidth + 1,  // +1 to overlap slightly
                cellHeight + 1
            );
        }
    }
}

/**
 * Draw heatmap with interpolated cells
 * More accurate but slower version that interpolates colors at cell centers
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} grid - Grid data {z, x, y}
 * @param {Object} style - Style options
 */
function drawInterpolatedHeatmap(ctx, grid, style) {
    if (!grid || !grid.z || !ctx) {
        return;
    }

    var z = grid.z;
    var m = z.length;
    var n = z[0].length;

    if (m === 0 || n === 0) {
        return;
    }

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var padding = style.padding || 30;
    var plotWidth = width - 2 * padding;
    var plotHeight = height - 2 * padding;

    // Determine data range
    var zmin, zmax;
    if (style.dataRange && style.dataRange.min !== undefined) {
        zmin = style.dataRange.min;
        zmax = style.dataRange.max;
    } else {
        var minVal = Infinity;
        var maxVal = -Infinity;
        for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
                var val = z[i][j];
                if (typeof val === 'number' && isFinite(val)) {
                    if (val < minVal) minVal = val;
                    if (val > maxVal) maxVal = val;
                }
            }
        }
        zmin = minVal;
        zmax = maxVal;
    }

    if (!isFinite(zmin) || !isFinite(zmax)) {
        return;
    }

    var colorscale = style.colorscale || 'Viridis';

    // Create an offscreen canvas for the heatmap
    var heatmapCanvas = document.createElement('canvas');
    heatmapCanvas.width = n;
    heatmapCanvas.height = m;
    var heatmapCtx = heatmapCanvas.getContext('2d');
    var imageData = heatmapCtx.createImageData(n, m);

    // Fill pixel data
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            var value = z[i][j];
            var pixelIndex = (i * n + j) * 4;

            if (typeof value === 'number' && isFinite(value)) {
                var color = colors.mapColors(
                    value,
                    zmin,
                    zmax,
                    colorscale,
                    {
                        reverse: style.reverse
                    }
                );

                // Parse hex color
                var r = parseInt(color.slice(1, 3), 16);
                var g = parseInt(color.slice(3, 5), 16);
                var b = parseInt(color.slice(5, 7), 16);

                imageData.data[pixelIndex] = r;
                imageData.data[pixelIndex + 1] = g;
                imageData.data[pixelIndex + 2] = b;
                imageData.data[pixelIndex + 3] = 255; // Alpha
            } else {
                // Transparent for null/NaN values
                imageData.data[pixelIndex + 3] = 0;
            }
        }
    }

    heatmapCtx.putImageData(imageData, 0, 0);

    // Draw scaled to main canvas
    ctx.save();
    ctx.translate(padding, padding);
    ctx.scale(plotWidth / n, plotHeight / m);
    ctx.translate(0, m);
    ctx.scale(1, -1);
    ctx.drawImage(heatmapCanvas, 0, 0);
    ctx.restore();
}

/**
 * Draw heatmap with bicubic interpolation
 * Smoothest but slowest - uses bicubic interpolation
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} grid - Grid data {z, x, y}
 * @param {Object} style - Style options
 */
function drawSmoothHeatmap(ctx, grid, style) {
    if (!grid || !grid.z || !ctx) {
        return;
    }

    var z = grid.z;
    var m = z.length;
    var n = z[0].length;

    if (m === 0 || n === 0) {
        return;
    }

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var padding = style.padding || 30;
    var plotWidth = width - 2 * padding;
    var plotHeight = height - 2 * padding;

    // Create high-resolution offscreen canvas
    var scaleFactor = Math.max(1, Math.min(10, Math.ceil(100 / Math.max(n, m))));
    var hiresCanvas = document.createElement('canvas');
    hiresCanvas.width = n * scaleFactor;
    hiresCanvas.height = m * scaleFactor;
    var hiresCtx = hiresCanvas.getContext('2d');

    // Draw interpolated heatmap at high resolution
    drawInterpolatedHeatmap(hiresCtx, grid, {
        width: hiresCanvas.width,
        height: hiresCanvas.height,
        padding: 0,
        colorscale: style.colorscale,
        dataRange: style.dataRange,
        reverse: style.reverse
    });

    // Enable smoothing for high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw scaled down to main canvas with smoothing
    ctx.save();
    ctx.translate(padding, padding);
    ctx.scale(plotWidth / hiresCanvas.width, plotHeight / hiresCanvas.height);
    ctx.translate(0, hiresCanvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(hiresCanvas, 0, 0);
    ctx.restore();
}

exports =  {
    drawHeatmapBackground: drawHeatmapBackground,
    drawInterpolatedHeatmap: drawInterpolatedHeatmap,
    drawSmoothHeatmap: drawSmoothHeatmap
};

        },
        exports: {}
    };

    modules['renderers/canvas/labels'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Canvas label drawing for contours with optimized label placement
 */

var findBestTextLocation = require("../../labels").findBestTextLocation;
var formatContourLabel = require("../../labels").formatContourLabel;

/**
 * Draw contour labels with overlap avoidance
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} contourResult - Contour computation result
 * @param {Object} style - Style options
 */
function drawLabels(ctx, contourResult, style) {
    style = style || {};

    var paths = contourResult.paths;
    var labelFont = style.labelFont || 'Arial';
    var labelSize = style.labelSize || 12;
    var labelColor = style.labelColor || '#000';
    var showLabels = style.showLabels !== false;

    if (!showLabels) return;

    // Setup context
    ctx.font = labelSize + 'px ' + labelFont;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Track existing labels to avoid overlaps
    var existingLabels = [];
    var plotBounds = calculatePlotBounds(style, contourResult);

    // Process each path level
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Find best position for label on each path
        for (var j = 0; j < pathInfo.paths.length; j++) {
            var path = pathInfo.paths[j];
            if (path.length < 10) continue; // Skip very short paths

            // Estimate text dimensions
            var labelText = formatContourLabel(pathInfo.level, '.1f');
            var textWidth = ctx.measureText(labelText).width;
            var textHeight = labelSize;

            // Find optimal label position
            var labelPos = findBestTextLocation(
                path,
                {
                    level: pathInfo.level,
                    width: textWidth,
                    height: textHeight
                },
                existingLabels,
                plotBounds
            );

            if (!labelPos) continue;

            // Scale position to canvas coordinates
            var scaled = scalePointForLabel(style, labelPos);

            // Draw label
            ctx.save();
            ctx.translate(scaled.x, scaled.y);
            ctx.rotate(labelPos.theta || 0);

            // Draw label background (optional, for readability)
            if (style.labelBackground) {
                var bgPadding = 2;
                ctx.fillStyle = style.labelBackground || 'rgba(255,255,255,0.8)';
                ctx.fillRect(
                    -textWidth / 2 - bgPadding,
                    -textHeight / 2 - bgPadding,
                    textWidth + bgPadding * 2,
                    textHeight + bgPadding * 2
                );
                ctx.fillStyle = labelColor;
            }

            ctx.fillText(labelText, 0, 0);
            ctx.restore();

            // Add to existing labels
            existingLabels.push({
                x: scaled.x,
                y: scaled.y,
                theta: labelPos.theta || 0,
                level: pathInfo.level,
                width: textWidth,
                height: textHeight
            });
        }
    }
}

/**
 * Calculate plot bounds for label placement
 */
function calculatePlotBounds(style, contourResult) {
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    return {
        left: padding,
        right: width - padding,
        top: padding,
        bottom: height - padding,
        center: width / 2,
        middle: height / 2
    };
}

/**
 * Scale label position from grid space to canvas space
 */
function scalePointForLabel(style, pt) {
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    return {
        x: padding + pt.x * scaleX,
        y: padding + (m - 1 - pt.y) * scaleY
    };
}

exports =  drawLabels;

        },
        exports: {}
    };

    modules['renderers/canvas/colorbar'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Canvas colorbar drawing
 */

var mapColors = require("../../colorbar").mapColors;
var computeTicks = require("../../colorbar").computeTicks;

/**
 * Draw colorbar on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} contourResult - Contour result
 * @param {Object} style - Style options
 */
function drawColorbar(ctx, contourResult, style) {
    style = style || {};

    var levels = contourResult.levels;
    if (!levels || levels.length === 0) return;

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;

    var thickness = style.colorbarThickness || 20;
    var len = style.colorbarLen || 0.8;
    var barHeight = height * len;
    var x = width - thickness - 10;
    var y = (height - barHeight) / 2;

    var colorscale = style.colorscale || 'Viridis';
    var zmin = style.zmin !== undefined ? style.zmin : levels[0];
    var zmax = style.zmax !== undefined ? style.zmax : levels[levels.length - 1];

    // Draw gradient
    for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var value = zmin + t * (zmax - zmin);
        var color = mapColors(value, zmin, zmax, colorscale, style.reversescale);

        ctx.fillStyle = color;
        ctx.fillRect(x, y + i, thickness, 1);
    }

    // Draw border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, thickness, barHeight);

    // Draw title
    if (style.colorbarTitle) {
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(x + thickness / 2, y - 10);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(style.colorbarTitle, 0, 0);
        ctx.restore();
    }

    // Draw tick labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    var tickCount = Math.min(5, levels.length);
    for (i = 0; i < tickCount; i++) {
        var idx = Math.floor(i * (levels.length - 1) / (tickCount - 1));
        var level = levels[idx];
        var t = (level - levels[0]) / (levels[levels.length - 1] - levels[0]);
        var tickY = y + barHeight * (1 - t);

        ctx.fillText(level.toFixed(1), x + thickness + 5, tickY);
    }
}

exports =  drawColorbar;

        },
        exports: {}
    };

    modules['renderers/canvas/nulls'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Canvas null region drawing
 * Highlights areas with null/missing data
 */

/**
 * Draw null regions on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} contourResult - Contour result (must have nullMask)
 * @param {Object} style - Style options
 */
function drawNulls(ctx, contourResult, style) {
    var nullMask = contourResult.nullMask;
    if (!nullMask) return;

    style = style || {};

    var nullRegion = style.nullRegion || {};
    var visible = nullRegion.visible !== false;
    if (!visible) return;

    var m = nullMask.length;
    var n = nullMask[0].length;

    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    ctx.fillStyle = nullRegion.fill || '#ffffff';
    ctx.strokeStyle = nullRegion.stroke || '#cccccc';
    ctx.lineWidth = nullRegion.strokeWidth !== undefined ? nullRegion.strokeWidth : 1;

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

exports =  drawNulls;

        },
        exports: {}
    };

    modules['renderers/canvas/index'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Canvas renderer for contour-core
 * Main entry point for canvas rendering
 */

var drawPaths = require("./paths");
var drawLabels = require("./labels");
var drawColorbar = require("./colorbar");
var drawNulls = require("./nulls");
var drawHeatmap = require("./heatmap");

/**
 * Draw contours on a canvas context
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

    // Draw null regions first (if present)
    if (contourResult.nullMask && contourResult.nullCount > 0) {
        drawNulls(ctx, contourResult, style);
    }

    // Draw heatmap background if coloring mode is 'heatmap'
    if (coloring === 'heatmap') {
        drawHeatmap.drawInterpolatedHeatmap(ctx, {
            z: contourResult.pathinfo[0].z,
            x: contourResult.pathinfo[0].x,
            y: contourResult.pathinfo[0].y
        }, style);
    }

    // Draw filled contours
    if (coloring === 'fill' || coloring === 'heatmap') {
        drawPaths.drawFilledPaths(ctx, contourResult, style);
    }

    // Draw contour lines
    if (showLines && coloring !== 'heatmap') {
        drawPaths.drawStrokePaths(ctx, contourResult, style);
    }

    // Draw labels (if enabled)
    if (style.showLabels) {
        drawLabels(ctx, contourResult, style);
    }

    // Draw colorbar (if enabled)
    if (style.colorbar !== false && coloring !== 'lines') {
        drawColorbar(ctx, contourResult, style);
    }
}

exports =  {
    drawContours: drawContours,
    drawPaths: drawPaths,
    drawLabels: drawLabels,
    drawColorbar: drawColorbar,
    drawNulls: drawNulls,
    drawHeatmap: drawHeatmap
};

        },
        exports: {}
    };

    modules['renderers/svg/index'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * SVG renderer for contour-core
 * Renders contour paths as SVG elements
 */

var createPaths = require("./paths");
var createLabels = require("./labels");
var createColorbar = require("./colorbar");
var createNulls = require("./nulls");

/**
 * Render contours as SVG
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} options - Rendering options
 * @returns {String} Complete SVG string
 */
function renderSVG(contourResult, options) {
    options = options || {};

    var width = options.width || 500;
    var height = options.height || 400;
    var coloring = options.coloring || 'fill';
    var showLines = options.showLines !== false;

    var svgParts = [];

    // SVG opening
    svgParts.push(
        '<svg xmlns="http://www.w3.org/2000/svg" ' +
        'width="' + width + '" height="' + height + '" ' +
        'viewBox="0 0 ' + width + ' ' + height + '">'
    );

    // Draw null regions first (if present)
    if (contourResult.nullMask && contourResult.nullCount > 0) {
        svgParts.push(createNulls.createNullRegions(contourResult, options));
    }

    // Draw filled contours
    if (coloring === 'fill' || coloring === 'heatmap') {
        svgParts.push(createPaths.createFilledPaths(contourResult, options));
    }

    // Draw contour lines
    if (showLines && coloring !== 'heatmap') {
        svgParts.push(createPaths.createStrokePaths(contourResult, options));
    }

    // Draw labels (if enabled)
    if (options.showLabels) {
        svgParts.push(createLabels.createLabels(contourResult, options));
    }

    // Draw colorbar (if enabled)
    if (options.colorbar !== false && coloring !== 'lines') {
        svgParts.push(createColorbar.createColorbar(contourResult, options));
    }

    // SVG closing
    svgParts.push('</svg>');

    return svgParts.join('\n');
}

/**
 * Get SVG string for paths only (for custom use)
 */
function toSVG(contourResult, options) {
    return renderSVG(contourResult, options);
}

exports =  {
    renderSVG: renderSVG,
    toSVG: toSVG,
    createPaths: createPaths,
    createFilledPaths: createPaths.createFilledPaths,
    createStrokePaths: createPaths.createStrokePaths,
    createLabels: createLabels,
    createColorbar: createColorbar,
    createNulls: createNulls
};

        },
        exports: {}
    };

    modules['renderers/index'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Renderers module for contour visualization
 * Provides Canvas and SVG rendering capabilities
 */

exports =  {
    canvas: require("./canvas"),
    svg: require("./svg")
};

        },
        exports: {}
    };

    modules['compute'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Main contour computation module
 * Standalone implementation - no dependencies on Plotly, D3, or browser APIs
 */

var levels = require("./levels");
var marchingSquares = require("./marchingsquares");
var pathFinding = require("./pathfinding");
var nullHandling = require("./null_handling");
var closeBoundaries = require("./close_boundaries");

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
    // Default to 'fill' type if not specified
    if (!contourOptions.type && !contourOptions.coloring) {
        contourOptions.coloring = 'fill';
    }
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

exports =  {
    computeContours: computeContours,
    scalePathsToData: scalePathsToData
};

        },
        exports: {}
    };

    modules['api'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * Simplified rendering API for contour-core
 * Provides easy-to-use functions similar to Plotly's API
 */

var compute = require("./compute");
var canvasRenderer = require("./canvas");

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

exports =  {
    render: render,
    drawTo: drawTo,
    COLOR_SCALES: COLOR_SCALES
};

        },
        exports: {}
    };

    modules['index'] = {
        factory: function(require, exports, module) {
            'use strict';

/**
 * contour-core - Standalone contour calculation library
 * Extracted from Plotly.js for SSR and performance optimization
 *
 * v0.2.0 - Null value support + Simplified rendering API
 */

var api = require("./api");

// Export object
var contourCore = {
    // ============================================
    // Core computation
    // ============================================
    computeContours: require("./compute").computeContours,
    scalePathsToData: require("./compute").scalePathsToData,

    // ============================================
    // Simplified rendering API (NEW in v0.2.0)
    // ============================================
    render: api.render,
    drawTo: api.drawTo,

    // ============================================
    // Low-level modules
    // ============================================
    marchingSquares: require("./marchingsquares"),
    pathFinding: require("./pathfinding"),
    levels: require("./levels"),
    smooth: require("./smooth"),
    constants: require("./constants"),

    // ============================================
    // Feature modules
    // ============================================
    nullHandling: require("./null_handling"),
    labels: require("./labels"),
    colorbar: require("./colorbar"),
    renderers: require("./renderers"),

    // ============================================
    // Utilities
    // ============================================
    COLOR_SCALES: api.COLOR_SCALES
};

// CommonJS export for Node.js and browsers (via bundler)
if (typeof module !== 'undefined' && module.exports) {
    exports =  contourCore;
}

        },
        exports: {}
    };


    // Expose to global
    if (typeof window !== 'undefined') {
        window.contourCore = require('index');
    }

    // Export for ES6 modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = window.contourCore;
    }
})(typeof window !== 'undefined' ? window : global);
