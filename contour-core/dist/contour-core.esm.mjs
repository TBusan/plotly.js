var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// levels.js
var require_levels = __commonJS({
  "levels.js"(exports, module) {
    "use strict";
    function setContours(options, vals) {
      var levels = [];
      if (options.valueColorMap && Array.isArray(options.valueColorMap) && options.valueColorMap.length > 0) {
        var isValidFormat = options.valueColorMap.every(function(item) {
          return Array.isArray(item) && item.length >= 2 && typeof item[0] === "number" && typeof item[1] === "string";
        });
        if (isValidFormat) {
          levels = options.valueColorMap.map(function(item) {
            return item[0];
          }).sort(function(a, b) {
            return a - b;
          });
          levels = uniqueSorted(levels);
          if (levels.length > 0) {
            return levels;
          }
        }
      }
      if (options.thresholds && Array.isArray(options.thresholds) && options.thresholds.length > 0) {
        levels = options.thresholds.slice().sort(function(a, b) {
          return a - b;
        });
        levels = levels.filter(function(val2) {
          return typeof val2 === "number" && !isNaN(val2) && isFinite(val2);
        });
        if (levels.length > 0) {
          return levels;
        }
      }
      if (options.autocontour) {
        var flatVals = vals.flat().filter(function(v) {
          return typeof v === "number" && !isNaN(v) && isFinite(v);
        });
        if (flatVals.length === 0) {
          return [];
        }
        var zmin = Math.min.apply(Math, flatVals);
        var zmax = Math.max.apply(Math, flatVals);
        var start, end;
        if (typeof options.start === "number") {
          start = options.start;
        } else {
          start = zmin;
        }
        if (typeof options.end === "number") {
          end = options.end;
        } else {
          end = zmax;
        }
        var ncontours = options.ncontours || 15;
        var smartTicks = computeNiceTicks(start, end, ncontours);
        for (var val = smartTicks.start; val <= smartTicks.end + smartTicks.step * 1e-4; val += smartTicks.step) {
          levels.push(val);
        }
        levels = uniqueSorted(levels);
      } else {
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
        for (var val = start; val <= end + size * 1e-4; val += size) {
          levels.push(Math.round(val * 1e4) / 1e4);
        }
        levels = uniqueSorted(levels);
      }
      return levels;
    }
    function computeNiceTicks(start, end, ncontours) {
      var range = end - start;
      if (range <= 0) {
        return {
          start,
          end,
          step: 1
        };
      }
      var roughStep = range / (ncontours || 15);
      if (roughStep <= 0) {
        roughStep = 1;
      }
      var exponent = Math.floor(Math.log10(roughStep));
      var fraction = roughStep / Math.pow(10, exponent);
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
      var step = niceFraction * Math.pow(10, exponent);
      var adjustedStart;
      if (start >= 0) {
        adjustedStart = Math.ceil(start / step) * step;
      } else {
        adjustedStart = Math.floor(start / step) * step;
      }
      if (adjustedStart > start) {
        adjustedStart -= step;
      }
      var adjustedEnd;
      if (end >= 0) {
        adjustedEnd = Math.floor(end / step) * step;
      } else {
        adjustedEnd = Math.ceil(end / step) * step;
      }
      if (adjustedEnd < end) {
        adjustedEnd += step;
      }
      if (adjustedEnd <= adjustedStart) {
        adjustedEnd = adjustedStart + step;
      }
      var precision = Math.max(0, -exponent);
      return {
        start: roundToPrecision(adjustedStart, precision),
        end: roundToPrecision(adjustedEnd, precision),
        step: roundToPrecision(step, precision)
      };
    }
    function roundToPrecision(value, precision) {
      if (precision <= 0) {
        return Math.round(value);
      }
      var factor = Math.pow(10, precision);
      return Math.round(value * factor) / factor;
    }
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
      return out.sort(function(a, b) {
        return a - b;
      });
    }
    function endPlus(contours) {
      var end = contours.end;
      var size = contours.size;
      if (!isFinite(size)) {
        size = 1;
      }
      return end + size * 1e-4;
    }
    module.exports = {
      setContours,
      endPlus,
      computeNiceTicks,
      roundToPrecision
    };
  }
});

// constants.js
var require_constants = __commonJS({
  "constants.js"(exports, module) {
    "use strict";
    module.exports = {
      // Edge start indicators for marching squares
      BOTTOMSTART: [1, 9, 13, 104, 713],
      TOPSTART: [4, 6, 7, 104, 713],
      LEFTSTART: [8, 12, 14, 208, 1114],
      RIGHTSTART: [2, 3, 11, 208, 1114],
      // Which way [dx,dy] do we leave a given index?
      // saddles are already disambiguated
      NEWDELTA: [
        null,
        [-1, 0],
        [0, -1],
        [-1, 0],
        [1, 0],
        null,
        [0, -1],
        [-1, 0],
        [0, 1],
        [0, 1],
        null,
        [0, 1],
        [1, 0],
        [1, 0],
        [0, -1]
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
      SADDLEREMAINDER: { 1: 4, 2: 8, 4: 1, 7: 13, 8: 2, 11: 14, 13: 7, 14: 11 },
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
  }
});

// marchingsquares.js
var require_marchingsquares = __commonJS({
  "marchingsquares.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    function makeCrossings(pathinfo) {
      var z = pathinfo[0].z;
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
          corners = [
            [z[yi][xi], z[yi][xi + 1]],
            [z[yi + 1][xi], z[yi + 1][xi + 1]]
          ];
          label = xi + "," + yi;
          for (i = 0; i < pathinfo.length; i++) {
            pi = pathinfo[i];
            mi = getMarchingIndex(pi.level, corners);
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
    function getMarchingIndex(val, corners) {
      var mi = (corners[0][0] > val ? 0 : 1) + (corners[0][1] > val ? 0 : 2) + (corners[1][1] > val ? 0 : 4) + (corners[1][0] > val ? 0 : 8);
      if (mi === 5 || mi === 10) {
        var avg = (corners[0][0] + corners[0][1] + corners[1][0] + corners[1][1]) / 4;
        if (val > avg) return mi === 5 ? 713 : 1114;
        return mi === 5 ? 104 : 208;
      }
      return mi === 15 ? 0 : mi;
    }
    module.exports = {
      makeCrossings,
      getMarchingIndex
    };
  }
});

// pathfinding.js
var require_pathfinding = __commonJS({
  "pathfinding.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    function findAllPaths(pathinfo, xtol, ytol) {
      var cnt, startLoc, i, pi, j;
      xtol = xtol || 0.01;
      ytol = ytol || 0.01;
      for (i = 0; i < pathinfo.length; i++) {
        pi = pathinfo[i];
        for (j = 0; j < pi.starts.length; j++) {
          startLoc = pi.starts[j];
          makePath(pi, startLoc, "edge", xtol, ytol);
        }
        cnt = 0;
        while (Object.keys(pi.crossings).length && cnt < 1e4) {
          cnt++;
          startLoc = Object.keys(pi.crossings)[0].split(",").map(Number);
          makePath(pi, startLoc, void 0, xtol, ytol);
        }
        if (cnt === 1e4) {
          console.warn("Infinite loop in contour calculation");
        }
      }
    }
    function equalPts(pt1, pt2, xtol, ytol) {
      return Math.abs(pt1[0] - pt2[0]) < xtol && Math.abs(pt1[1] - pt2[1]) < ytol;
    }
    function ptDist(pt1, pt2) {
      var dx = pt1[2] - pt2[2];
      var dy = pt1[3] - pt2[3];
      return Math.sqrt(dx * dx + dy * dy);
    }
    function makePath(pi, loc, edgeflag, xtol, ytol) {
      var locStr = loc.join(",");
      var mi = pi.crossings[locStr];
      var marchStep = getStartStep(mi, edgeflag, loc);
      var pts = [getInterpPx(pi, loc, [-marchStep[0], -marchStep[1]])];
      var m = pi.z.length;
      var n = pi.z[0].length;
      var startLoc = loc.slice();
      var startStep = marchStep.slice();
      var cnt;
      for (cnt = 0; cnt < 1e4; cnt++) {
        if (mi > 20) {
          mi = constants.CHOOSESADDLE[mi][(marchStep[0] || marchStep[1]) < 0 ? 0 : 1];
          pi.crossings[locStr] = constants.SADDLEREMAINDER[mi];
        } else {
          delete pi.crossings[locStr];
        }
        marchStep = constants.NEWDELTA[mi];
        if (!marchStep) {
          console.warn("Found bad marching index:", mi, loc, pi.level);
          break;
        }
        pts.push(getInterpPx(pi, loc, marchStep));
        loc[0] += marchStep[0];
        loc[1] += marchStep[1];
        locStr = loc.join(",");
        if (equalPts(pts[pts.length - 1], pts[pts.length - 2], xtol, ytol)) {
          pts.pop();
        }
        var atEdge = marchStep[0] && (loc[0] < 0 || loc[0] > n - 2) || marchStep[1] && (loc[1] < 0 || loc[1] > m - 2);
        var closedLoop = loc[0] === startLoc[0] && loc[1] === startLoc[1] && marchStep[0] === startStep[0] && marchStep[1] === startStep[1];
        if (closedLoop || edgeflag && atEdge) break;
        mi = pi.crossings[locStr];
      }
      if (cnt === 1e4) {
        console.warn("Infinite loop in contour path");
      }
      var closedpath = equalPts(pts[0], pts[pts.length - 1], xtol, ytol);
      var simplifiedPts = simplifyPath(pts, pi.smoothing, closedpath);
      for (cnt = 0; cnt < simplifiedPts.length; cnt++) {
        simplifiedPts[cnt].length = 2;
      }
      if (simplifiedPts.length < 2) return;
      if (closedpath) {
        pi.paths.push(simplifiedPts);
      } else {
        mergeEdgePath(pi, simplifiedPts, xtol, ytol);
      }
    }
    function simplifyPath(pts, smoothing, closedpath) {
      var totaldist = 0;
      var alldists = [];
      var cnt;
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
      function getpt(i2) {
        return pts[i2 % pts.length];
      }
      for (cnt = pts.length - 2; cnt >= cropstart; cnt--) {
        distgroup = alldists[cnt];
        if (distgroup < distThreshold) {
          cnt3 = 0;
          for (cnt2 = cnt - 1; cnt2 >= cropstart; cnt2--) {
            if (distgroup + alldists[cnt2] < distThreshold) {
              distgroup += alldists[cnt2];
            } else break;
          }
          if (closedpath && cnt === pts.length - 2) {
            for (cnt3 = 0; cnt3 < cnt2; cnt3++) {
              if (distgroup + alldists[cnt3] < distThreshold) {
                distgroup += alldists[cnt3];
              } else break;
            }
          }
          var ptcnt = cnt - cnt2 + cnt3 + 1;
          ptavg = Math.floor((cnt + cnt2 + cnt3 + 2) / 2);
          if (!closedpath && cnt === pts.length - 2) {
            newpt = pts[pts.length - 1];
          } else if (!closedpath && cnt2 === -1) {
            newpt = pts[0];
          } else if (ptcnt % 2) {
            newpt = getpt(ptavg);
          } else {
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
    function mergeEdgePath(pi, pts, xtol, ytol) {
      var merged = false;
      var i, j, edgepathi, edgepathj;
      for (i = 0; i < pi.edgepaths.length; i++) {
        edgepathi = pi.edgepaths[i];
        if (!merged && equalPts(edgepathi[0], pts[pts.length - 1], xtol, ytol)) {
          pts.pop();
          merged = true;
          var doublemerged = false;
          for (j = 0; j < pi.edgepaths.length; j++) {
            edgepathj = pi.edgepaths[j];
            if (equalPts(edgepathj[edgepathj.length - 1], pts[0], xtol, ytol)) {
              doublemerged = true;
              pts.shift();
              pi.edgepaths.splice(i, 1);
              if (j === i) {
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
    function getStartStep(mi, edgeflag, loc) {
      var dx = 0;
      var dy = 0;
      if (mi > 20 && edgeflag) {
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
    function getInterpPx(pi, loc, step, scaleFunctions) {
      var locx = loc[0] + Math.max(step[0], 0);
      var locy = loc[1] + Math.max(step[1], 0);
      var zxy = pi.z[locy][locx];
      var x = scaleFunctions && scaleFunctions.x ? scaleFunctions.x : pi.x;
      var y = scaleFunctions && scaleFunctions.y ? scaleFunctions.y : pi.y;
      if (step[1]) {
        var dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);
        if (!isFinite(dx)) dx = 0.5;
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
          dataX,
          // X in data space
          dataY,
          // Y in data space
          locx + dx,
          // Interpolated grid index X
          locy
          // Grid index Y
        ];
      } else {
        var dy = (pi.level - zxy) / (pi.z[locy + 1][locx] - zxy);
        if (!isFinite(dy)) dy = 0.5;
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
          dataX,
          // X in data space
          dataY,
          // Y in data space
          locx,
          // Grid index X
          locy + dy
          // Interpolated grid index Y
        ];
      }
    }
    module.exports = {
      findAllPaths,
      getInterpPx
    };
  }
});

// null_handling/validate.js
var require_validate = __commonJS({
  "null_handling/validate.js"(exports, module) {
    "use strict";
    function isValidValue(val) {
      return val !== null && val !== void 0 && typeof val === "number" && !isNaN(val) && isFinite(val);
    }
    module.exports = isValidValue;
  }
});

// null_handling/normalize.js
var require_normalize = __commonJS({
  "null_handling/normalize.js"(exports, module) {
    "use strict";
    var isValidValue = require_validate();
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
          cleanedRow.length = n;
          for (var j = 0; j < n; j++) {
            cleanedRow[j] = void 0;
            maskRow[j] = true;
          }
          cleanedGrid.push(cleanedRow);
          nullMask.push(maskRow);
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
            cleanedRow.push(void 0);
            maskRow.push(true);
            nullCount++;
          }
        }
        cleanedGrid.push(cleanedRow);
        nullMask.push(maskRow);
      }
      return {
        cleanedGrid,
        nullMask,
        nullCount,
        validCount
      };
    }
    module.exports = normalizeNullValues;
  }
});

// null_handling/mask.js
var require_mask = __commonJS({
  "null_handling/mask.js"(exports, module) {
    "use strict";
    function generateNullMask(grid) {
      if (!grid || !Array.isArray(grid) || grid.length === 0) {
        return [];
      }
      var m = grid.length;
      var mask = [];
      for (var i = 0; i < m; i++) {
        var row = grid[i];
        if (!row || !Array.isArray(row)) {
          mask.push([]);
          continue;
        }
        var maskRow = [];
        for (var j = 0; j < row.length; j++) {
          var val = row[j];
          var isNull = val === null || val === void 0 || typeof val === "number" && isNaN(val);
          maskRow.push(isNull);
        }
        mask.push(maskRow);
      }
      return mask;
    }
    module.exports = generateNullMask;
  }
});

// null_handling/find_empties.js
var require_find_empties = __commonJS({
  "null_handling/find_empties.js"(exports, module) {
    "use strict";
    function findEmpties(z) {
      if (!z || z.length === 0) {
        return [];
      }
      var empties = [];
      var neighborHash = {};
      var noNeighborList = [];
      var rowLength = 0;
      for (var i = 0; i < z.length; i++) {
        if (z[i] && z[i].length > rowLength) {
          rowLength = z[i].length;
        }
      }
      var blank = [0, 0, 0];
      var prevRow, row, nextRow;
      for (var i = 0; i < z.length; i++) {
        prevRow = row;
        row = z[i];
        nextRow = z[i + 1] || [];
        for (var j = 0; j < rowLength; j++) {
          if (row[j] === void 0) {
            var neighborCount = (row[j - 1] !== void 0 ? 1 : 0) + (row[j + 1] !== void 0 ? 1 : 0) + (prevRow && prevRow[j] !== void 0 ? 1 : 0) + (nextRow && nextRow[j] !== void 0 ? 1 : 0);
            if (neighborCount) {
              if (i === 0) neighborCount++;
              if (j === 0) neighborCount++;
              if (i === z.length - 1) neighborCount++;
              if (row && j === row.length - 1) neighborCount++;
              if (neighborCount < 4) {
                neighborHash[[i, j]] = [i, j, neighborCount];
              }
              empties.push([i, j, neighborCount]);
            } else {
              noNeighborList.push([i, j]);
            }
          }
        }
      }
      var newNeighborHash, foundNewNeighbors, thisPt, neighborCount;
      while (noNeighborList.length) {
        newNeighborHash = {};
        foundNewNeighbors = false;
        for (var p = noNeighborList.length - 1; p >= 0; p--) {
          thisPt = noNeighborList[p];
          var i = thisPt[0];
          var j = thisPt[1];
          neighborCount = ((neighborHash[[i - 1, j]] || blank)[2] + (neighborHash[[i + 1, j]] || blank)[2] + (neighborHash[[i, j - 1]] || blank)[2] + (neighborHash[[i, j + 1]] || blank)[2]) / 20;
          if (neighborCount) {
            newNeighborHash[thisPt] = [i, j, neighborCount];
            noNeighborList.splice(p, 1);
            foundNewNeighbors = true;
          }
        }
        if (!foundNewNeighbors) {
          throw new Error("findEmpties: Iterated with no new neighbors - cannot interpolate all empty points");
        }
        for (var key in newNeighborHash) {
          neighborHash[key] = newNeighborHash[key];
          empties.push(newNeighborHash[key]);
        }
      }
      return empties.sort(function(a, b) {
        return b[2] - a[2];
      });
    }
    module.exports = findEmpties;
  }
});

// null_handling/interp2d.js
var require_interp2d = __commonJS({
  "null_handling/interp2d.js"(exports, module) {
    "use strict";
    var INTERPTHRESHOLD = 0.01;
    var NEIGHBORSHIFTS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    function correctionOvershoot(maxFractionalChange) {
      return 0.5 - 0.25 * Math.min(1, maxFractionalChange * 0.5);
    }
    function interp2d(z, emptyPoints) {
      var maxFractionalChange = 1;
      var i;
      iterateInterp2d(z, emptyPoints);
      for (i = 0; i < emptyPoints.length; i++) {
        if (emptyPoints[i][2] < 4) break;
      }
      emptyPoints = emptyPoints.slice(i);
      for (i = 0; i < 100 && maxFractionalChange > INTERPTHRESHOLD; i++) {
        maxFractionalChange = iterateInterp2d(
          z,
          emptyPoints,
          correctionOvershoot(maxFractionalChange)
        );
      }
      if (maxFractionalChange > INTERPTHRESHOLD) {
        console.warn("interp2d: Did not converge quickly, maxChange =", maxFractionalChange);
      }
      return z;
    }
    function iterateInterp2d(z, emptyPoints, overshoot) {
      var maxFractionalChange = 0;
      var thisPt;
      var i;
      var j;
      var p;
      var q;
      var neighborShift;
      var neighborRow;
      var neighborVal;
      var neighborCount;
      var neighborSum;
      var initialVal;
      var minNeighbor;
      var maxNeighbor;
      for (p = 0; p < emptyPoints.length; p++) {
        thisPt = emptyPoints[p];
        i = thisPt[0];
        j = thisPt[1];
        initialVal = z[i][j];
        neighborSum = 0;
        neighborCount = 0;
        for (q = 0; q < 4; q++) {
          neighborShift = NEIGHBORSHIFTS[q];
          neighborRow = z[i + neighborShift[0]];
          if (!neighborRow) continue;
          neighborVal = neighborRow[j + neighborShift[1]];
          if (neighborVal !== void 0) {
            if (neighborSum === 0) {
              minNeighbor = maxNeighbor = neighborVal;
            } else {
              minNeighbor = Math.min(minNeighbor, neighborVal);
              maxNeighbor = Math.max(maxNeighbor, neighborVal);
            }
            neighborCount++;
            neighborSum += neighborVal;
          }
        }
        if (neighborCount === 0) {
          throw new Error("iterateInterp2d order is wrong: no defined neighbors for point [" + i + "," + j + "]");
        }
        z[i][j] = neighborSum / neighborCount;
        if (initialVal === void 0) {
          if (neighborCount < 4) maxFractionalChange = 1;
        } else {
          if (overshoot !== void 0 && overshoot !== 0) {
            z[i][j] = (1 + overshoot) * z[i][j] - overshoot * initialVal;
          }
          if (maxNeighbor > minNeighbor) {
            maxFractionalChange = Math.max(
              maxFractionalChange,
              Math.abs(z[i][j] - initialVal) / (maxNeighbor - minNeighbor)
            );
          }
        }
      }
      return maxFractionalChange;
    }
    module.exports = interp2d;
    module.exports.iterateInterp2d = iterateInterp2d;
    module.exports.correctionOvershoot = correctionOvershoot;
  }
});

// close_boundaries.js
var require_close_boundaries = __commonJS({
  "close_boundaries.js"(exports, module) {
    "use strict";
    function closeBoundaries(pathinfo, contours) {
      var pi0 = pathinfo[0];
      var z = pi0.z;
      var i;
      switch (contours.type || contours.coloring) {
        case "levels":
        case "fill":
          var edgeVal2 = Math.min(z[0][0], z[0][1]);
          for (i = 0; i < pathinfo.length; i++) {
            var pi = pathinfo[i];
            pi.prefixBoundary = !pi.edgepaths.length && (edgeVal2 > pi.level || pi.starts.length && edgeVal2 === pi.level);
          }
          break;
        case "constraint":
          pi0.prefixBoundary = false;
          if (pi0.edgepaths.length) return;
          var na = pi0.x.length;
          var nb = pi0.y.length;
          var boundaryMax = -Infinity;
          var boundaryMin = Infinity;
          for (i = 0; i < nb; i++) {
            boundaryMin = Math.min(boundaryMin, z[i][0]);
            boundaryMin = Math.min(boundaryMin, z[i][na - 1]);
            boundaryMax = Math.max(boundaryMax, z[i][0]);
            boundaryMax = Math.max(boundaryMax, z[i][na - 1]);
          }
          for (i = 1; i < na - 1; i++) {
            boundaryMin = Math.min(boundaryMin, z[0][i]);
            boundaryMin = Math.min(boundaryMin, z[nb - 1][i]);
            boundaryMax = Math.max(boundaryMax, z[0][i]);
            boundaryMax = Math.max(boundaryMax, z[nb - 1][i]);
          }
          var contoursValue = contours.value;
          var v1, v2;
          switch (contours._operation) {
            case ">":
              if (contoursValue > boundaryMax) {
                pi0.prefixBoundary = true;
              }
              break;
            case "<":
              if (contoursValue < boundaryMin || pi0.starts.length && contoursValue === boundaryMin) {
                pi0.prefixBoundary = true;
              }
              break;
            case "[]":
              v1 = Math.min(contoursValue[0], contoursValue[1]);
              v2 = Math.max(contoursValue[0], contoursValue[1]);
              if (v2 < boundaryMin || v1 > boundaryMax || pi0.starts.length && v2 === boundaryMin) {
                pi0.prefixBoundary = true;
              }
              break;
            case "][":
              v1 = Math.min(contoursValue[0], contoursValue[1]);
              v2 = Math.max(contoursValue[0], contoursValue[1]);
              if (v1 < boundaryMin && v2 > boundaryMax) {
                pi0.prefixBoundary = true;
              }
              break;
          }
          break;
      }
    }
    module.exports = closeBoundaries;
  }
});

// null_handling/clip_mask.js
var require_clip_mask = __commonJS({
  "null_handling/clip_mask.js"(exports, module) {
    "use strict";
    var marchingSquares = require_marchingsquares();
    var pathFinding = require_pathfinding();
    var closeBoundaries = require_close_boundaries();
    function makeBinaryMask(nullMask) {
      if (!nullMask) return null;
      var m = nullMask.length;
      var n = nullMask[0].length;
      var binaryMask = [];
      for (var i = 0; i < m; i++) {
        var row = [];
        for (var j = 0; j < n; j++) {
          row.push(nullMask[i][j] ? 0 : 1);
        }
        binaryMask.push(row);
      }
      return binaryMask;
    }
    function generateClipPath(contourResult, options) {
      options = options || {};
      var nullMask = contourResult.nullMask;
      if (!nullMask || contourResult.nullCount === 0) {
        return null;
      }
      var binaryMask = makeBinaryMask(nullMask);
      if (!binaryMask) return null;
      var m = binaryMask.length;
      var n = binaryMask[0].length;
      var width = options.width || 500;
      var height = options.height || 400;
      var padding = options.padding || 30;
      var x = [];
      var y = [];
      for (var i = 0; i < n; i++) x.push(i);
      for (var j = 0; j < m; j++) y.push(j);
      var clipPathInfo = {
        level: 0.9,
        crossings: {},
        starts: [],
        edgepaths: [],
        paths: [],
        z: binaryMask,
        x,
        y,
        smoothing: 0
      };
      marchingSquares.makeCrossings([clipPathInfo]);
      pathFinding.findAllPaths([clipPathInfo], 0.01, 0.01);
      closeBoundaries([clipPathInfo], { type: "levels" });
      return createClipPathSVG(clipPathInfo, width, height, padding, m, n);
    }
    function pathToSVG(path, isClosed) {
      if (!path || path.length === 0) return "";
      var d = "M " + path[0][0] + " " + path[0][1];
      for (var i = 1; i < path.length; i++) {
        d += " L " + path[i][0] + " " + path[i][1];
      }
      if (isClosed) {
        d += " Z";
      }
      return d;
    }
    function createClipPathSVG(clipPathInfo, width, height, padding, m, n) {
      var perimeter = createPerimeter(width, height, padding);
      var scaleX = (width - 2 * padding) / (n - 1);
      var scaleY = (height - 2 * padding) / (m - 1);
      function scalePath(path) {
        return path.map(function(pt) {
          return [
            padding + pt[0] * scaleX,
            padding + (m - 1 - pt[1]) * scaleY
          ];
        });
      }
      var boundaryPath = "M" + perimeter.join("L") + "Z";
      var joinedPaths = joinAllPaths(clipPathInfo, perimeter, scalePath, pathToSVG);
      var fullpath = "";
      if (clipPathInfo.prefixBoundary) {
        fullpath = boundaryPath + joinedPaths;
      } else {
        fullpath = joinedPaths;
      }
      return fullpath;
    }
    function createPerimeter(width, height, padding) {
      var xMin = padding;
      var xMax = width - padding;
      var yMin = padding;
      var yMax = height - padding;
      return [
        [xMin, yMin],
        // 0: top-left
        [xMax, yMin],
        // 1: top-right
        [xMax, yMax],
        // 2: bottom-right
        [xMin, yMax]
        // 3: bottom-left
      ];
    }
    function joinAllPaths(pathInfo, perimeter, scalePath, pathToSVGFn) {
      var fullpath = "";
      var edgepaths = pathInfo.edgepaths;
      if (edgepaths.length === 0 && pathInfo.paths.length === 0) {
        return "";
      }
      var i = 0;
      var startsleft = edgepaths.map(function(v, idx) {
        return idx;
      });
      var newloop = true;
      var endpt;
      var newendpt;
      var cnt;
      var nexti;
      var possiblei;
      var addpath;
      function istop(pt) {
        return Math.abs(pt[1] - perimeter[0][1]) < 0.1;
      }
      function isbottom(pt) {
        return Math.abs(pt[1] - perimeter[2][1]) < 0.1;
      }
      function isleft(pt) {
        return Math.abs(pt[0] - perimeter[0][0]) < 0.1;
      }
      function isright(pt) {
        return Math.abs(pt[0] - perimeter[2][0]) < 0.1;
      }
      while (startsleft.length > 0) {
        var scaledPath = scalePath(edgepaths[i]);
        addpath = pathToSVGFn(scaledPath, false);
        fullpath += newloop ? addpath : addpath.replace(/^M/, "L");
        startsleft.splice(startsleft.indexOf(i), 1);
        endpt = scaledPath[scaledPath.length - 1];
        nexti = -1;
        for (cnt = 0; cnt < 4; cnt++) {
          if (!endpt) break;
          if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1];
          else if (isleft(endpt)) newendpt = perimeter[0];
          else if (isbottom(endpt)) newendpt = perimeter[3];
          else if (isright(endpt)) newendpt = perimeter[2];
          for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
            var ptNew = scalePath(edgepaths[possiblei])[0];
            if (Math.abs(endpt[0] - newendpt[0]) < 0.1) {
              if (Math.abs(endpt[0] - ptNew[0]) < 0.1 && (ptNew[1] - endpt[1]) * (newendpt[1] - ptNew[1]) >= 0) {
                newendpt = ptNew;
                nexti = possiblei;
              }
            } else if (Math.abs(endpt[1] - newendpt[1]) < 0.1) {
              if (Math.abs(endpt[1] - ptNew[1]) < 0.1 && (ptNew[0] - endpt[0]) * (newendpt[0] - ptNew[0]) >= 0) {
                newendpt = ptNew;
                nexti = possiblei;
              }
            }
          }
          endpt = newendpt;
          if (nexti >= 0) break;
          fullpath += "L" + newendpt[0] + " " + newendpt[1];
        }
        if (nexti === edgepaths.length || nexti < 0) break;
        i = nexti;
        newloop = startsleft.indexOf(i) === -1;
        if (newloop) {
          if (startsleft.length > 0) {
            i = startsleft[0];
          }
          fullpath += "Z";
        }
      }
      for (i = 0; i < pathInfo.paths.length; i++) {
        var scaledPath = scalePath(pathInfo.paths[i]);
        fullpath += pathToSVGFn(scaledPath, true);
      }
      return fullpath;
    }
    module.exports = {
      generateClipPath,
      makeBinaryMask,
      createClipPathSVG
    };
  }
});

// null_handling/index.js
var require_null_handling = __commonJS({
  "null_handling/index.js"(exports, module) {
    "use strict";
    module.exports = {
      normalizeNullValues: require_normalize(),
      generateNullMask: require_mask(),
      isValidValue: require_validate(),
      findEmpties: require_find_empties(),
      interp2d: require_interp2d(),
      generateClipPath: require_clip_mask().generateClipPath,
      makeBinaryMask: require_clip_mask().makeBinaryMask
    };
  }
});

// compute.js
var require_compute = __commonJS({
  "compute.js"(exports, module) {
    "use strict";
    var levels = require_levels();
    var marchingSquares = require_marchingsquares();
    var pathFinding = require_pathfinding();
    var nullHandling = require_null_handling();
    var closeBoundaries = require_close_boundaries();
    var findEmpties = require_find_empties();
    var interp2d = require_interp2d();
    function computeContours(grid, options) {
      options = options || {};
      if (!grid || !grid.z || !Array.isArray(grid.z)) {
        throw new Error("Invalid grid: must have z property as 2D array");
      }
      var z = grid.z;
      var m = z.length;
      var n = z[0].length;
      if (m < 2 || n < 2) {
        throw new Error("Invalid grid: must have at least 2x2 data points");
      }
      var normalization = nullHandling.normalizeNullValues(z);
      var cleanedZ = normalization.cleanedGrid;
      var nullMask = normalization.nullMask;
      var x = grid.x || createIndexArray(n);
      var y = grid.y || createIndexArray(m);
      var connectGaps = options.connectgaps !== void 0 ? options.connectgaps : true;
      var emptyPoints = findEmpties(cleanedZ);
      if (emptyPoints.length > 0) {
        cleanedZ = interp2d(cleanedZ, emptyPoints);
      }
      var contourLevels = levels.setContours(options, cleanedZ);
      if (contourLevels.length === 0) {
        return { levels: [], paths: [] };
      }
      if (contourLevels.length > 1e3) {
        console.warn("Too many contours (" + contourLevels.length + "), clipping at 1000");
        contourLevels = contourLevels.slice(0, 1e3);
      }
      var pathinfo = contourLevels.map(function(level) {
        return {
          level,
          crossings: {},
          starts: [],
          edgepaths: [],
          paths: [],
          z: cleanedZ,
          x,
          y,
          nullMask,
          // Always include nullMask for renderer reference
          smoothing: options.smoothing || 0
        };
      });
      marchingSquares.makeCrossings(pathinfo);
      pathFinding.findAllPaths(pathinfo, 0.01, 0.01);
      var contourOptions = options.contours || {};
      if (!contourOptions.type && !contourOptions.coloring) {
        contourOptions.coloring = "fill";
      }
      closeBoundaries(pathinfo, contourOptions);
      return {
        levels: contourLevels,
        paths: pathinfo.map(function(pi) {
          return {
            level: pi.level,
            edgepaths: pi.edgepaths,
            paths: pi.paths,
            prefixBoundary: pi.prefixBoundary,
            smoothing: pi.smoothing
          };
        }),
        pathinfo,
        nullMask,
        // Always include nullMask for renderer to use
        nullCount: normalization.nullCount,
        validCount: normalization.validCount,
        connectgaps: connectGaps
        // Include connectgaps flag for renderer reference
      };
    }
    function scalePathsToData(result, x, y) {
      var n = x.length;
      var m = y.length;
      function scalePointToData(pt) {
        var ix = Math.max(0, Math.min(n - 1, Math.round(pt[0])));
        var iy = Math.max(0, Math.min(m - 1, Math.round(pt[1])));
        return [x[ix], y[iy]];
      }
      result.paths.forEach(function(pathInfo) {
        pathInfo.edgepaths = pathInfo.edgepaths.map(function(path) {
          return path.map(scalePointToData);
        });
        pathInfo.paths = pathInfo.paths.map(function(path) {
          return path.map(scalePointToData);
        });
      });
      return result;
    }
    function createIndexArray(n) {
      var arr = [];
      for (var i = 0; i < n; i++) {
        arr.push(i);
      }
      return arr;
    }
    module.exports = {
      computeContours,
      scalePathsToData
    };
  }
});

// smooth.js
var require_smooth = __commonJS({
  "smooth.js"(exports, module) {
    "use strict";
    var CatmullRomExp = 0.5;
    function smoothopen(pts, smoothness) {
      if (pts.length < 3) {
        return "M" + pts.join("L");
      }
      var path = "M" + pts[0];
      var tangents = [];
      var i;
      for (i = 1; i < pts.length - 1; i++) {
        tangents.push(makeTangent(pts[i - 1], pts[i], pts[i + 1], smoothness));
      }
      path += "Q" + tangents[0][0] + " " + pts[1];
      for (i = 2; i < pts.length - 1; i++) {
        path += "C" + tangents[i - 2][1] + " " + tangents[i - 1][0] + " " + pts[i];
      }
      path += "Q" + tangents[pts.length - 3][1] + " " + pts[pts.length - 1];
      return path;
    }
    function smoothclosed(pts, smoothness) {
      if (pts.length < 3) {
        return "M" + pts.join("L") + "Z";
      }
      var path = "M" + pts[0];
      var pLast = pts.length - 1;
      var tangents = [makeTangent(pts[pLast], pts[0], pts[1], smoothness)];
      var i;
      for (i = 1; i < pLast; i++) {
        tangents.push(makeTangent(pts[i - 1], pts[i], pts[i + 1], smoothness));
      }
      tangents.push(makeTangent(pts[pLast - 1], pts[pLast], pts[0], smoothness));
      for (i = 1; i <= pLast; i++) {
        path += "C" + tangents[i - 1][1] + " " + tangents[i][0] + " " + pts[i];
      }
      path += "C" + tangents[pLast][1] + " " + tangents[0][0] + " " + pts[0] + "Z";
      return path;
    }
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
    function round(v) {
      return Math.round(v * 100) / 100;
    }
    module.exports = {
      smoothopen,
      smoothclosed
    };
  }
});

// colorbar/colors.js
var require_colors = __commonJS({
  "colorbar/colors.js"(exports, module) {
    "use strict";
    var COLOR_SCALES = {
      Viridis: [
        "#440154",
        "#482878",
        "#3e4a89",
        "#31688e",
        "#26838f",
        "#1f9d8a",
        "#35b779",
        "#6dcd59",
        "#b4de2c",
        "#fde725"
      ],
      Plasma: [
        "#0d0887",
        "#46039f",
        "#7201a8",
        "#9c179e",
        "#bd3786",
        "#d8576b",
        "#ed7953",
        "#fb9f3a",
        "#fdca26",
        "#f0f921"
      ],
      Hot: [
        "#000000",
        "#4a0000",
        "#880000",
        "#c20000",
        "#ff0000",
        "#ff4a00",
        "#ff8800",
        "#ffc200",
        "#ffff00",
        "#ffff80"
      ],
      Jet: [
        "#000080",
        "#0000ff",
        "#0080ff",
        "#00ffff",
        "#80ff80",
        "#ffff00",
        "#ff8000",
        "#ff0000",
        "#800000",
        "#000000"
      ],
      Earth: [
        "#2a1c0b",
        "#5c4033",
        "#8f6b4e",
        "#c19a6b",
        "#e5c99b",
        "#f5e6c8",
        "#8b4513",
        "#a0522d",
        "#cd853f",
        "#deb887"
      ],
      Electric: [
        "#000004",
        "#1b0c42",
        "#4a0c6e",
        "#781c6d",
        "#a52c60",
        "#cf4446",
        "#ed6925",
        "#fb9b06",
        "#f7d13d",
        "#fcffa4"
      ]
    };
    function parseColorscale(colorscale) {
      let colors;
      if (Array.isArray(colorscale)) {
        if (colorscale.length > 0 && Array.isArray(colorscale[0]) && colorscale[0].length === 2) {
          return colorscale;
        }
        colors = colorscale;
      } else if (typeof colorscale === "string") {
        const name = colorscale.charAt(0).toUpperCase() + colorscale.slice(1).toLowerCase();
        colors = COLOR_SCALES[name] || COLOR_SCALES.Viridis;
      } else {
        colors = COLOR_SCALES.Viridis;
      }
      return colors.map((color, i) => [i / (colors.length - 1), color]);
    }
    function interpolateColor(color1, color2, t) {
      const r1 = parseInt(color1.slice(1, 3), 16);
      const g1 = parseInt(color1.slice(3, 5), 16);
      const b1 = parseInt(color1.slice(5, 7), 16);
      const r2 = parseInt(color2.slice(1, 3), 16);
      const g2 = parseInt(color2.slice(3, 5), 16);
      const b2 = parseInt(color2.slice(5, 7), 16);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return "#" + [r, g, b].map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      }).join("");
    }
    function getColorAtPosition(colorscale, position) {
      const t = Math.max(0, Math.min(1, position));
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
      const localT = (t - pos1) / (pos2 - pos1);
      return interpolateColor(color1, color2, localT);
    }
    function mapColors(value, min, max, colorscale, options) {
      options = options || {};
      let scale = parseColorscale(colorscale);
      if (options.reverse) {
        scale = scale.slice().reverse();
        scale = scale.map(([pos, color]) => [1 - pos, color]).sort((a, b) => a[0] - b[0]);
      }
      if (options.dataMin !== void 0 && options.dataMin < min) {
        const firstColor = scale[0][1];
        scale.unshift([options.dataMin, firstColor]);
        min = options.dataMin;
      }
      if (options.dataMax !== void 0 && options.dataMax > max) {
        const lastColor = scale[scale.length - 1][1];
        scale.push([options.dataMax, lastColor]);
        max = options.dataMax;
      }
      const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
      return getColorAtPosition(scale, t);
    }
    function buildColorScale(levels, colorscale, options) {
      options = options || {};
      if (levels.length === 0) {
        return [];
      }
      let scale = parseColorscale(colorscale);
      if (options.reverse) {
        scale = scale.slice().reverse();
        scale = scale.map(([pos, color]) => [1 - pos, color]).sort((a, b) => a[0] - b[0]);
      }
      const levelMin = levels[0];
      const levelMax = levels[levels.length - 1];
      const colorStops = [];
      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        let t;
        if (levels.length === 1) {
          t = 0.5;
        } else {
          t = (level - levelMin) / (levelMax - levelMin);
        }
        const color = getColorAtPosition(scale, t);
        colorStops.push([level, color]);
      }
      if (options.extend && options.dataMin !== void 0 && options.dataMin < levelMin) {
        const firstColor = colorStops[0][1];
        colorStops.unshift([options.dataMin, firstColor]);
      }
      if (options.extend && options.dataMax !== void 0 && options.dataMax > levelMax) {
        const lastColor = colorStops[colorStops.length - 1][1];
        colorStops.push([options.dataMax, lastColor]);
      }
      return colorStops;
    }
    function createColorMapper(levels, colorscale, options) {
      const colorStops = buildColorScale(levels, colorscale, options);
      return function(value) {
        for (let i = 0; i < colorStops.length - 1; i++) {
          const stop1 = colorStops[i];
          const stop2 = colorStops[i + 1];
          if (value >= stop1[0] && value <= stop2[0]) {
            const t = (value - stop1[0]) / (stop2[0] - stop1[0]);
            return interpolateColor(stop1[1], stop2[1], t);
          }
        }
        if (value < colorStops[0][0]) {
          return colorStops[0][1];
        }
        return colorStops[colorStops.length - 1][1];
      };
    }
    function getGradientStops(levels, colorscale, horizontal) {
      const colorStops = buildColorScale(levels, colorscale);
      const min = colorStops[0][0];
      const max = colorStops[colorStops.length - 1][0];
      return colorStops.map(([value, color]) => ({
        offset: (value - min) / (max - min),
        color
      }));
    }
    module.exports = {
      mapColors,
      buildColorScale,
      createColorMapper,
      getGradientStops,
      parseColorscale,
      getColorAtPosition,
      interpolateColor,
      COLOR_SCALES
    };
  }
});

// renderers/canvas/paths.js
var require_paths = __commonJS({
  "renderers/canvas/paths.js"(exports, module) {
    "use strict";
    var smooth = require_smooth();
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
      return [
        [xMin, yMin],
        // 0: top-left
        [xMax, yMin],
        // 1: top-right
        [xMax, yMax],
        // 2: bottom-right
        [xMin, yMax]
        // 3: bottom-left
      ];
    }
    function joinAllPaths(pathInfo, perimeter, style) {
      var fullpath = "";
      var edgepaths = pathInfo.edgepaths;
      if (edgepaths.length === 0 && pathInfo.paths.length === 0) {
        return "";
      }
      var i = 0;
      var startsleft = edgepaths.map(function(v, i2) {
        return i2;
      });
      var newloop = true;
      var endpt;
      var newendpt;
      var cnt;
      var nexti;
      var possiblei;
      var addpath;
      function istop(pt) {
        return Math.abs(pt[1] - perimeter[0][1]) < 0.1;
      }
      function isbottom(pt) {
        return Math.abs(pt[1] - perimeter[2][1]) < 0.1;
      }
      function isleft(pt) {
        return Math.abs(pt[0] - perimeter[0][0]) < 0.1;
      }
      function isright(pt) {
        return Math.abs(pt[0] - perimeter[2][0]) < 0.1;
      }
      while (startsleft.length > 0) {
        var currentPath = edgepaths[i];
        if (!currentPath || !Array.isArray(currentPath) || currentPath.length === 0) {
          startsleft.splice(startsleft.indexOf(i), 1);
          if (startsleft.length > 0) {
            i = startsleft[0];
            newloop = true;
          }
          continue;
        }
        var scaledPath = currentPath.map(function(pt) {
          return scalePoint(style, pt);
        });
        addpath = smooth.smoothopen(scaledPath, pathInfo.smoothing || 0);
        fullpath += newloop ? addpath : addpath.replace(/^M/, "L");
        startsleft.splice(startsleft.indexOf(i), 1);
        endpt = scalePoint(style, currentPath[currentPath.length - 1]);
        nexti = -1;
        for (cnt = 0; cnt < 4; cnt++) {
          if (!endpt) break;
          if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1];
          else if (isleft(endpt)) newendpt = perimeter[0];
          else if (isbottom(endpt)) newendpt = perimeter[3];
          else if (isright(endpt)) newendpt = perimeter[2];
          for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
            if (!edgepaths[possiblei] || !Array.isArray(edgepaths[possiblei]) || edgepaths[possiblei].length === 0) {
              continue;
            }
            var ptNew = scalePoint(style, edgepaths[possiblei][0]);
            if (Math.abs(endpt[0] - newendpt[0]) < 0.1) {
              if (Math.abs(endpt[0] - ptNew[0]) < 0.1 && (ptNew[1] - endpt[1]) * (newendpt[1] - ptNew[1]) >= 0) {
                newendpt = ptNew;
                nexti = possiblei;
              }
            } else if (Math.abs(endpt[1] - newendpt[1]) < 0.1) {
              if (Math.abs(endpt[1] - ptNew[1]) < 0.1 && (ptNew[0] - endpt[0]) * (newendpt[0] - ptNew[0]) >= 0) {
                newendpt = ptNew;
                nexti = possiblei;
              }
            }
          }
          endpt = newendpt;
          if (nexti >= 0) break;
          fullpath += "L" + newendpt[0] + " " + newendpt[1];
        }
        if (nexti === edgepaths.length || nexti < 0) break;
        i = nexti;
        newloop = startsleft.indexOf(i) === -1;
        if (newloop) {
          if (startsleft.length > 0) {
            i = startsleft[0];
          }
          fullpath += "Z";
        }
      }
      for (i = 0; i < pathInfo.paths.length; i++) {
        if (!pathInfo.paths[i] || !Array.isArray(pathInfo.paths[i]) || pathInfo.paths[i].length === 0) {
          continue;
        }
        var scaledPath = pathInfo.paths[i].map(function(pt) {
          return scalePoint(style, pt);
        });
        fullpath += smooth.smoothclosed(scaledPath, pathInfo.smoothing || 0);
      }
      return fullpath;
    }
    function interpolateColor(color1, color2, t) {
      var r1 = parseInt(color1.slice(1, 3), 16);
      var g1 = parseInt(color1.slice(3, 5), 16);
      var b1 = parseInt(color1.slice(5, 7), 16);
      var r2 = parseInt(color2.slice(1, 3), 16);
      var g2 = parseInt(color2.slice(3, 5), 16);
      var b2 = parseInt(color2.slice(5, 7), 16);
      t = Math.max(0, Math.min(1, t));
      var r = Math.round(r1 + (r2 - r1) * t);
      var g = Math.round(g1 + (g2 - g1) * t);
      var b = Math.round(b1 + (b2 - b1) * t);
      return "#" + [r, g, b].map(function(x) {
        var hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      }).join("");
    }
    function getColorForValue(value, colorScale) {
      if (!colorScale || !Array.isArray(colorScale)) {
        return "rgba(100, 100, 100, 0.5)";
      }
      var n = colorScale.length;
      if (n === 0) return "rgba(100, 100, 100, 0.5)";
      if (n === 1) return colorScale[0][1];
      for (var i = 0; i < n - 1; i++) {
        if (value >= colorScale[i][0] && value <= colorScale[i + 1][0]) {
          var t = (value - colorScale[i][0]) / (colorScale[i + 1][0] - colorScale[i][0]);
          return interpolateColor(colorScale[i][1], colorScale[i + 1][1], t);
        }
      }
      if (value < colorScale[0][0]) return colorScale[0][1];
      if (value > colorScale[n - 1][0]) return colorScale[n - 1][1];
      return colorScale[Math.floor(n / 2)][1];
    }
    function getColorForSegmentedValue(value, valueColorMap) {
      if (!valueColorMap || !Array.isArray(valueColorMap) || valueColorMap.length === 0) {
        return "rgba(100, 100, 100, 0.5)";
      }
      if (value < valueColorMap[0][0]) {
        return valueColorMap[0][1];
      }
      for (var i = 0; i < valueColorMap.length - 1; i++) {
        if (value >= valueColorMap[i][0] && value < valueColorMap[i + 1][0]) {
          return valueColorMap[i][1];
        }
      }
      return valueColorMap[valueColorMap.length - 1][1];
    }
    function getColorForLevel(level, levelIndex, levels, colorScale, hasCustomLevels, stepSize, valueColorMap) {
      if (valueColorMap && Array.isArray(valueColorMap) && valueColorMap.length > 0) {
        var segmentValue;
        if (levelIndex < valueColorMap.length - 1) {
          segmentValue = (valueColorMap[levelIndex][0] + valueColorMap[levelIndex + 1][0]) / 2;
        } else if (levelIndex === valueColorMap.length - 1) {
          segmentValue = valueColorMap[levelIndex][0] + 1;
        } else {
          segmentValue = level;
        }
        return getColorForSegmentedValue(segmentValue, valueColorMap);
      }
      if (!colorScale || colorScale.length === 0) {
        return "rgba(100, 100, 100, 0.5)";
      }
      if (!levels || levels.length === 0) {
        return colorScale[0][1] || "rgba(100, 100, 100, 0.5)";
      }
      var firstVal = colorScale[0][0];
      if (Math.abs(firstVal - levels[0]) < Math.abs(firstVal) + 0.1) {
        for (var i = 0; i < colorScale.length; i++) {
          if (Math.abs(colorScale[i][0] - level) < 0.01) {
            return colorScale[i][1];
          }
        }
        var closestIdx = 0;
        var closestDist = Math.abs(colorScale[0][0] - level);
        for (var j = 1; j < colorScale.length; j++) {
          var dist = Math.abs(colorScale[j][0] - level);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = j;
          }
        }
        return colorScale[closestIdx][1];
      }
      var value;
      if (hasCustomLevels) {
        if (levelIndex < levels.length - 1) {
          value = (levels[levelIndex] + levels[levelIndex + 1]) / 2;
        } else {
          var lastStep = levels.length > 1 ? levels[levels.length - 1] - levels[levels.length - 2] : 1;
          value = levels[levelIndex] + lastStep / 2;
        }
      } else {
        value = level + 0.5 * stepSize;
      }
      var minVal = levels[0];
      var maxVal = levels[levels.length - 1];
      var range = maxVal - minVal;
      if (range === 0) {
        return colorScale[0][1] || "rgba(100, 100, 100, 0.5)";
      }
      var normalizedValue = (value - minVal) / range;
      normalizedValue = Math.max(0, Math.min(1, normalizedValue));
      return getColorForValue(normalizedValue, colorScale);
    }
    function drawFilledPaths(ctx, contourResult, style) {
      var paths = contourResult.paths;
      var levels = contourResult.levels;
      var width = style.width || ctx.canvas.width;
      var height = style.height || ctx.canvas.height;
      var smoothing = style.smoothing || 0;
      var perimeter = createPerimeter(style);
      var showLines = style.showLines !== false;
      var lineColor = style.lineColor || "#333";
      var lineWidth = style.lineWidth || 1.5;
      if (paths.length === 0) return;
      var hasCustomLevels = style.thresholds && Array.isArray(style.thresholds);
      var stepSize = !hasCustomLevels && levels.length > 1 ? levels[1] - levels[0] : 0;
      var colorScale = style.colorScale;
      var valueColorMap = style.valueColorMap;
      if (!colorScale) {
        if (typeof style.colorscale === "string") {
          var colors = require_colors();
          colorScale = colors.parseColorscale(style.colorscale);
        } else {
          colorScale = [[0, "blue"], [1, "red"]];
        }
      }
      var bgColor;
      if (valueColorMap) {
        bgColor = valueColorMap[0][1];
      } else if (hasCustomLevels) {
        if (levels.length > 1) {
          var firstInterval = levels[1] - levels[0];
          var bgValue = levels[0] - firstInterval / 2;
          var minVal = levels[0];
          var maxVal = levels[levels.length - 1];
          var range = maxVal - minVal;
          var normalizedBg = (bgValue - minVal) / range;
          normalizedBg = Math.max(0, Math.min(1, normalizedBg));
          bgColor = getColorForValue(normalizedBg, colorScale);
        } else {
          bgColor = getColorForLevel(levels[0], 0, levels, colorScale, true, stepSize, null);
        }
      } else {
        var bgValue = levels[0] - 0.5 * stepSize;
        var minVal = levels[0];
        var maxVal = levels[levels.length - 1];
        var range = maxVal - minVal;
        var normalizedBg = (bgValue - minVal) / range;
        normalizedBg = Math.max(0, Math.min(1, normalizedBg));
        bgColor = getColorForValue(normalizedBg, colorScale);
      }
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.rect(
        perimeter[0][0],
        perimeter[0][1],
        perimeter[1][0] - perimeter[0][0],
        perimeter[2][1] - perimeter[0][1]
      );
      ctx.fill();
      for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        var fillColor = getColorForLevel(pathInfo.level, i, levels, colorScale, hasCustomLevels, stepSize, valueColorMap);
        ctx.fillStyle = fillColor;
        var boundaryPath = "M" + perimeter.join("L") + "Z";
        var joinedPaths = joinAllPaths(pathInfo, perimeter, style);
        var fullpath = pathInfo.prefixBoundary ? boundaryPath + joinedPaths : joinedPaths;
        if (fullpath) {
          ctx.beginPath();
          drawSVGPath(ctx, fullpath);
          ctx.fill();
          if (showLines) {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = lineWidth;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }
      }
    }
    function drawStrokePaths(ctx, contourResult, style) {
      var paths = contourResult.paths;
      var levels = contourResult.levels;
      var smoothing = style.smoothing || 0;
      var colorScale = style.colorScale;
      var useColorScale = colorScale && Array.isArray(colorScale) && colorScale.length > 0;
      ctx.lineWidth = style.lineWidth || 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        if (useColorScale) {
          var level = pathInfo.level;
          var color = "#333";
          for (var j = 0; j < colorScale.length; j++) {
            if (Math.abs(colorScale[j][0] - level) < 0.01) {
              color = colorScale[j][1];
              break;
            }
          }
          ctx.strokeStyle = color;
        } else {
          ctx.strokeStyle = style.lineColor || "#333";
        }
        for (var k = 0; k < pathInfo.paths.length; k++) {
          drawPathStroke(ctx, pathInfo.paths[k], smoothing, true, style);
        }
        for (k = 0; k < pathInfo.edgepaths.length; k++) {
          drawPathStroke(ctx, pathInfo.edgepaths[k], smoothing, false, style);
        }
      }
    }
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
    function scalePoint(style, pt) {
      if (!pt || !Array.isArray(pt) || pt.length < 2) {
        console.warn("scalePoint: Invalid point", pt);
        return [0, 0];
      }
      if (isNaN(pt[0]) || isNaN(pt[1])) {
        console.warn("scalePoint: Point contains NaN", pt);
        return [0, 0];
      }
      var x = style.x || [];
      var y = style.y || [];
      var width = style.width || 500;
      var height = style.height || 400;
      var padding = style.padding || 30;
      var xMin = x && x.length > 0 ? Math.min.apply(Math, x) : 0;
      var xMax = x && x.length > 0 ? Math.max.apply(Math, x) : 10;
      var yMin = y && y.length > 0 ? Math.min.apply(Math, y) : 0;
      var yMax = y && y.length > 0 ? Math.max.apply(Math, y) : 10;
      var xRange = xMax - xMin || 1;
      var yRange = yMax - yMin || 1;
      var canvasX = padding + (pt[0] - xMin) / xRange * (width - 2 * padding);
      var canvasY = padding + (pt[1] - yMin) / yRange * (height - 2 * padding);
      canvasY = height - padding - (canvasY - padding);
      return [canvasX, canvasY];
    }
    function drawSVGPath(ctx, pathStr) {
      var commands = parseSVGPath(pathStr);
      for (var i = 0; i < commands.length; i++) {
        var cmd = commands[i];
        switch (cmd.type) {
          case "M":
            ctx.moveTo(cmd.x, cmd.y);
            break;
          case "L":
            ctx.lineTo(cmd.x, cmd.y);
            break;
          case "C":
            ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
            break;
          case "Q":
            ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
            break;
          case "Z":
            ctx.closePath();
            break;
        }
      }
    }
    function parseSVGPath(pathStr) {
      var commands = [];
      var regex = /([MLCQZ])\s*([^MLCQZ]*)/gi;
      var match;
      while ((match = regex.exec(pathStr)) !== null) {
        var type = match[1];
        var coords = match[2].trim().split(/[\s,]+/).map(Number).filter(function(n) {
          return !isNaN(n);
        });
        switch (type) {
          case "M":
            commands.push({ type: "M", x: coords[0], y: coords[1] });
            break;
          case "L":
            for (var i = 0; i < coords.length; i += 2) {
              commands.push({ type: "L", x: coords[i], y: coords[i + 1] });
            }
            break;
          case "C":
            for (i = 0; i < coords.length; i += 6) {
              commands.push({
                type: "C",
                x1: coords[i],
                y1: coords[i + 1],
                x2: coords[i + 2],
                y2: coords[i + 3],
                x: coords[i + 4],
                y: coords[i + 5]
              });
            }
            break;
          case "Q":
            for (i = 0; i < coords.length; i += 4) {
              commands.push({
                type: "Q",
                x1: coords[i],
                y1: coords[i + 1],
                x: coords[i + 2],
                y: coords[i + 3]
              });
            }
            break;
          case "Z":
            commands.push({ type: "Z" });
            break;
        }
      }
      return commands;
    }
    module.exports = {
      drawFilledPaths,
      drawStrokePaths,
      scalePoint
    };
  }
});

// labels/cost.js
var require_cost = __commonJS({
  "labels/cost.js"(exports, module) {
    "use strict";
    var COST_CONSTANTS = {
      EDGECOST: 1,
      ANGLECOST: 1,
      NEIGHBORCOST: 5,
      SAMELEVELFACTOR: 10,
      SAMELEVELDISTANCE: 5,
      MAXCOST: 100
    };
    function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
      var a = x2 - x1, b = x3 - x1, c = x4 - x3;
      var d = y2 - y1, e = y3 - y1, f = y4 - y3;
      var det = a * f - c * d;
      if (det === 0) return null;
      var t = (b * f - c * e) / det;
      var u = (b * d - a * e) / det;
      if (u < 0 || u > 1 || t < 0 || t > 1) return null;
      return { x: x1 + a * t, y: y1 + d * t };
    }
    function perpDistance2(xab, yab, llab, xac, yac) {
      var fcAB = xac * xab + yac * yab;
      if (fcAB < 0) {
        return xac * xac + yac * yac;
      } else if (fcAB > llab) {
        var xbc = xac - xab;
        var ybc = yac - yab;
        return xbc * xbc + ybc * ybc;
      } else {
        var crossProduct = xac * yab - yac * xab;
        return crossProduct * crossProduct / llab;
      }
    }
    function locationCost(loc, textOpts, labelData, bounds) {
      var halfWidth = textOpts.width / 2;
      var halfHeight = textOpts.height / 2;
      var x = loc.x;
      var y = loc.y;
      var theta = loc.theta || 0;
      var dx = Math.cos(theta) * halfWidth;
      var dy = Math.sin(theta) * halfWidth;
      bounds = bounds || {};
      var left = bounds.left !== void 0 ? bounds.left : x - 100;
      var right = bounds.right !== void 0 ? bounds.right : x + 100;
      var top = bounds.top !== void 0 ? bounds.top : y - 100;
      var bottom = bounds.bottom !== void 0 ? bounds.bottom : y + 100;
      var center = bounds.center !== void 0 ? bounds.center : (left + right) / 2;
      var middle = bounds.middle !== void 0 ? bounds.middle : (top + bottom) / 2;
      var normX = (x > center ? right - x : x - left) / (dx + Math.abs(Math.sin(theta) * halfHeight));
      var normY = (y > middle ? bottom - y : y - top) / (Math.abs(dy) + Math.cos(theta) * halfHeight);
      if (normX < 1 || normY < 1) return Infinity;
      var cost = COST_CONSTANTS.EDGECOST * (1 / (normX - 1) + 1 / (normY - 1));
      cost += COST_CONSTANTS.ANGLECOST * theta * theta;
      if (labelData && labelData.length > 0) {
        var x1 = x - dx;
        var y1 = y - dy;
        var x2 = x + dx;
        var y2 = y + dy;
        for (var i = 0; i < labelData.length; i++) {
          var labeli = labelData[i];
          var dxd = Math.cos(labeli.theta || 0) * labeli.width / 2;
          var dyd = Math.sin(labeli.theta || 0) * labeli.width / 2;
          var dist = segmentDistance(
            x1,
            y1,
            x2,
            y2,
            labeli.x - dxd,
            labeli.y - dyd,
            labeli.x + dxd,
            labeli.y + dyd
          ) * 2 / (textOpts.height + labeli.height);
          var sameLevel = textOpts.level === labeli.level;
          var distOffset = sameLevel ? COST_CONSTANTS.SAMELEVELDISTANCE : 1;
          if (dist <= distOffset) return Infinity;
          var distFactor = COST_CONSTANTS.NEIGHBORCOST * (sameLevel ? COST_CONSTANTS.SAMELEVELFACTOR : 1);
          cost += distFactor / (dist - distOffset);
        }
      }
      return cost;
    }
    function segmentDistance(x1, y1, x2, y2, x3, y3, x4, y4) {
      if (segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4)) return 0;
      var x12 = x2 - x1, y12 = y2 - y1;
      var x34 = x4 - x3, y34 = y4 - y3;
      var ll12 = x12 * x12 + y12 * y12;
      var ll34 = x34 * x34 + y34 * y34;
      var dist2 = Math.min(
        perpDistance2(x12, y12, ll12, x3 - x1, y3 - y1),
        // Point 3 to segment 12
        perpDistance2(x12, y12, ll12, x4 - x1, y4 - y1),
        // Point 4 to segment 12
        perpDistance2(x34, y34, ll34, x1 - x3, y1 - y3),
        // Point 1 to segment 34
        perpDistance2(x34, y34, ll34, x2 - x3, y2 - y3)
        // Point 2 to segment 34
      );
      return Math.sqrt(dist2);
    }
    module.exports = locationCost;
  }
});

// labels/position.js
var require_position = __commonJS({
  "labels/position.js"(exports, module) {
    "use strict";
    var locationCost = require_cost();
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
    var workingPath = null;
    var workingTextWidth = 0;
    var locationCache = {};
    function mod(n, m) {
      return (n % m + m) % m;
    }
    function pathLength(path) {
      var len = 0;
      for (var i = 1; i < path.length; i++) {
        var dx = path[i][0] - path[i - 1][0];
        var dy = path[i][1] - path[i - 1][1];
        len += Math.sqrt(dx * dx + dy * dy);
      }
      return len;
    }
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
    function getTextLocation(path, totalPathLen, positionOnPath, textWidth, isClosed) {
      if (path !== workingPath || textWidth !== workingTextWidth) {
        locationCache = {};
        workingPath = path;
        workingTextWidth = textWidth;
      }
      var cacheKey = Math.round(positionOnPath * 100) / 100;
      if (locationCache[cacheKey] !== void 0) {
        return locationCache[cacheKey];
      }
      var halfWidth = textWidth / 2;
      var p0Pos, p1Pos;
      if (isClosed) {
        p0Pos = mod(positionOnPath - halfWidth, totalPathLen);
        p1Pos = mod(positionOnPath + halfWidth, totalPathLen);
      } else {
        p0Pos = Math.max(0, positionOnPath - halfWidth);
        p1Pos = Math.min(totalPathLen, positionOnPath + halfWidth);
      }
      var p0 = getPointAtLength(path, p0Pos);
      var p1 = getPointAtLength(path, p1Pos);
      var pCenter = getPointAtLength(path, positionOnPath);
      var theta = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      var x = (pCenter.x * 4 + p0.x + p1.x) / 6;
      var y = (pCenter.y * 4 + p0.y + p1.y) / 6;
      var result = { x, y, theta };
      locationCache[cacheKey] = result;
      return result;
    }
    function findBestTextLocation(path, textOpts, existingLabels, plotBounds, isClosed) {
      if (!path || path.length < 2) {
        return null;
      }
      existingLabels = existingLabels || [];
      plotBounds = plotBounds || {};
      var textWidth = textOpts.width || 50;
      var totalPathLen = pathLength(path);
      if (isClosed === void 0) {
        var startPt = path[0];
        var endPt = path[path.length - 1];
        var dx = endPt[0] - startPt[0];
        var dy = endPt[1] - startPt[1];
        var closureDist = Math.sqrt(dx * dx + dy * dy);
        isClosed = closureDist < 1;
      }
      var dp, p0, pMax;
      if (isClosed) {
        dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
        p0 = dp / 2;
        pMax = totalPathLen;
      } else if (totalPathLen > textWidth * 2) {
        dp = (totalPathLen - textWidth * 2) / (COST_CONSTANTS.INITIALSEARCHPOINTS - 1);
        p0 = textWidth;
        pMax = totalPathLen - textWidth;
      } else {
        dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
        p0 = dp / 2;
        pMax = totalPathLen;
      }
      var bestCost = Infinity;
      var bestLoc = null;
      var pMin = p0;
      for (var j = 0; j < COST_CONSTANTS.ITERATIONS; j++) {
        for (var p = p0; p < pMax; p += dp) {
          var newLocation = getTextLocation(path, totalPathLen, p, textWidth, isClosed);
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
        if (j > 0) dp /= 2;
        p0 = pMin - dp / 2;
        pMax = pMin + dp * 1.5;
      }
      if (bestCost <= COST_CONSTANTS.MAXCOST) {
        bestLoc.level = textOpts.level || 0;
        return bestLoc;
      }
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
        theta,
        level: textOpts.level || 0
      };
    }
    module.exports = findBestTextLocation;
  }
});

// labels/formatter.js
var require_formatter = __commonJS({
  "labels/formatter.js"(exports, module) {
    "use strict";
    function formatContourLabel(value, format) {
      if (format === void 0) {
        return String(value);
      }
      if (format.includes("f")) {
        const match = format.match(/\.(\d+)f/);
        if (match) {
          const precision = parseInt(match[1]);
          let formatted = value.toFixed(precision);
          if (format.startsWith("+") && value >= 0) {
            formatted = "+" + formatted;
          }
          return formatted;
        }
      }
      if (format.includes("%")) {
        const match = format.match(/\.(\d+)%/);
        if (match) {
          const precision = parseInt(match[1]);
          return (value * 100).toFixed(precision) + "%";
        }
      }
      return String(value);
    }
    module.exports = formatContourLabel;
  }
});

// labels/density.js
var require_density = __commonJS({
  "labels/density.js"(exports, module) {
    "use strict";
    var DENSITY_CONSTANTS = {
      LABELDISTANCE: 2,
      // Each label occupies this length (multiplier of plot diagonal)
      LABELMIN: 3,
      // Minimum path length (multiplier of text width)
      LABELMAX: 10,
      // Maximum labels per contour line
      LABELINCREASE: 10
      // Start increasing density after this many contour levels
    };
    function calculateMaxLabels(pathLen, textWidth, textHeight, numLevels, plotDiagonal) {
      if (pathLen < (textWidth + textHeight) * DENSITY_CONSTANTS.LABELMIN) {
        return 0;
      }
      var normLength = DENSITY_CONSTANTS.LABELDISTANCE * plotDiagonal / Math.max(1, numLevels / DENSITY_CONSTANTS.LABELINCREASE);
      return Math.min(
        Math.ceil(pathLen / normLength),
        DENSITY_CONSTANTS.LABELMAX
      );
    }
    function pathLength(path) {
      var len = 0;
      for (var i = 1; i < path.length; i++) {
        var dx = path[i][0] - path[i - 1][0];
        var dy = path[i][1] - path[i - 1][1];
        len += Math.sqrt(dx * dx + dy * dy);
      }
      return len;
    }
    function getVisibleSegment(path, bounds, padding) {
      bounds = bounds || {};
      var left = bounds.left !== void 0 ? bounds.left : 0;
      var right = bounds.right !== void 0 ? bounds.right : 100;
      var top = bounds.top !== void 0 ? bounds.top : 0;
      var bottom = bounds.bottom !== void 0 ? bounds.bottom : 100;
      padding = padding || 0;
      var totalLen = pathLength(path);
      var min = null;
      var max = null;
      var accumulated = 0;
      for (var i = 0; i < path.length; i++) {
        var pt = path[i];
        if (pt[0] >= left + padding && pt[0] <= right - padding && pt[1] >= top + padding && pt[1] <= bottom - padding) {
          min = accumulated;
          break;
        }
        if (i > 0) {
          var dx = path[i][0] - path[i - 1][0];
          var dy = path[i][1] - path[i - 1][1];
          accumulated += Math.sqrt(dx * dx + dy * dy);
        }
      }
      if (min === null) return null;
      accumulated = 0;
      for (var i = path.length - 1; i >= 0; i--) {
        var pt = path[i];
        if (pt[0] >= left + padding && pt[0] <= right - padding && pt[1] >= top + padding && pt[1] <= bottom - padding) {
          max = totalLen - accumulated;
          break;
        }
        if (i < path.length - 1) {
          var dx = path[i + 1][0] - path[i][0];
          var dy = path[i + 1][1] - path[i][1];
          accumulated += Math.sqrt(dx * dx + dy * dy);
        }
      }
      if (max === null) max = totalLen;
      var visibleLen = max - min;
      return {
        min,
        max,
        len: visibleLen,
        total: totalLen
      };
    }
    function isPathClosed(path, threshold) {
      threshold = threshold !== void 0 ? threshold : 1;
      if (!path || path.length < 2) return false;
      var start = path[0];
      var end = path[path.length - 1];
      var dx = end[0] - start[0];
      var dy = end[1] - start[1];
      var dist = Math.sqrt(dx * dx + dy * dy);
      return dist < threshold;
    }
    function setDensityConstants(custom) {
      for (var key in custom) {
        if (DENSITY_CONSTANTS.hasOwnProperty(key)) {
          DENSITY_CONSTANTS[key] = custom[key];
        }
      }
    }
    function getDensityConstants() {
      var result = {};
      for (var key in DENSITY_CONSTANTS) {
        result[key] = DENSITY_CONSTANTS[key];
      }
      return result;
    }
    module.exports = {
      calculateMaxLabels,
      pathLength,
      getVisibleSegment,
      isPathClosed,
      setDensityConstants,
      getDensityConstants,
      DENSITY_CONSTANTS
    };
  }
});

// labels/index.js
var require_labels = __commonJS({
  "labels/index.js"(exports, module) {
    "use strict";
    module.exports = {
      findBestTextLocation: require_position(),
      formatContourLabel: require_formatter(),
      locationCost: require_cost(),
      // Density control module
      density: require_density(),
      // Convenience exports from density module
      calculateMaxLabels: require_density().calculateMaxLabels,
      pathLength: require_density().pathLength,
      getVisibleSegment: require_density().getVisibleSegment,
      isPathClosed: require_density().isPathClosed
    };
  }
});

// renderers/canvas/labels.js
var require_labels2 = __commonJS({
  "renderers/canvas/labels.js"(exports, module) {
    "use strict";
    var labels = require_labels();
    var findBestTextLocation = labels.findBestTextLocation;
    var formatContourLabel = labels.formatContourLabel;
    var calculateMaxLabels = labels.calculateMaxLabels;
    var pathLength = labels.pathLength;
    var isPathClosed = labels.isPathClosed;
    function drawLabels(ctx, contourResult, style) {
      style = style || {};
      var paths = contourResult.paths;
      var labelFont = style.labelFont || "Arial";
      var labelSize = style.labelSize || 12;
      var labelColor = style.labelColor || "#000";
      var showLabels = style.showLabels !== false;
      if (!showLabels || !paths || !paths.length) return;
      ctx.font = labelSize + "px " + labelFont;
      ctx.fillStyle = labelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var m = style.z ? style.z.length : 10;
      var n = style.z && style.z[0] ? style.z[0].length : 10;
      var plotBounds = {
        left: 0,
        right: n - 1,
        top: 0,
        bottom: m - 1,
        center: (n - 1) / 2,
        middle: (m - 1) / 2
      };
      var width = style.width || 500;
      var height = style.height || 400;
      var padding = style.padding || 30;
      var scaleX = (width - 2 * padding) / (n - 1);
      var scaleY = (height - 2 * padding) / (m - 1);
      var plotDiagonal = Math.sqrt((n - 1) * (n - 1) + (m - 1) * (m - 1));
      var existingLabels = [];
      var labelsToDraw = [];
      for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        for (var j = 0; j < pathInfo.paths.length; j++) {
          var path = pathInfo.paths[j];
          if (path.length < 3) continue;
          var labelText = formatContourLabel(pathInfo.level, ".1f");
          var textWidth = ctx.measureText(labelText).width;
          var textWidthGrid = textWidth / scaleX;
          var textHeightGrid = labelSize / scaleY;
          var len = pathLength(path);
          var maxLabels = calculateMaxLabels(
            len,
            textWidthGrid,
            textHeightGrid,
            paths.length,
            plotDiagonal
          );
          if (maxLabels === 0) continue;
          var closed = isPathClosed(path);
          var usedPositions = [];
          for (var k = 0; k < maxLabels; k++) {
            var labelPos = findBestTextLocation(
              path,
              {
                level: pathInfo.level,
                width: textWidthGrid,
                height: textHeightGrid
              },
              existingLabels,
              plotBounds,
              closed
            );
            if (!labelPos) break;
            var tooClose = false;
            for (var u = 0; u < usedPositions.length; u++) {
              var dx = labelPos.x - usedPositions[u].x;
              var dy = labelPos.y - usedPositions[u].y;
              var dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < textWidthGrid * 2) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) break;
            labelsToDraw.push({
              text: labelText,
              pos: labelPos,
              level: pathInfo.level,
              textColor: labelColor
            });
            existingLabels.push({
              x: labelPos.x,
              y: labelPos.y,
              theta: labelPos.theta || 0,
              level: pathInfo.level,
              width: textWidthGrid,
              height: textHeightGrid
            });
            usedPositions.push(labelPos);
            if (closed) {
              var midLen = len / 2;
              var oppositeLen = usedPositions[usedPositions.length - 2] ? (pathLength(path) / 2 + midLen) % len : midLen;
            }
          }
        }
      }
      for (var i = 0; i < labelsToDraw.length; i++) {
        var label = labelsToDraw[i];
        var scaled = scalePoint(label.pos, n, m, width, height, padding);
        ctx.save();
        ctx.translate(scaled.x, scaled.y);
        ctx.rotate(label.pos.theta || 0);
        if (style.labelBackground) {
          var bgPadding = 2;
          ctx.fillStyle = style.labelBackground || "rgba(255,255,255,0.8)";
          var bgWidth = ctx.measureText(label.text).width;
          var bgHeight = labelSize;
          ctx.fillRect(
            -bgWidth / 2 - bgPadding,
            -bgHeight / 2 - bgPadding,
            bgWidth + bgPadding * 2,
            bgHeight + bgPadding * 2
          );
          ctx.fillStyle = label.textColor;
        }
        ctx.fillText(label.text, 0, 0);
        ctx.restore();
      }
    }
    function scalePoint(pt, n, m, width, height, padding) {
      var scaleX = (width - 2 * padding) / (n - 1);
      var scaleY = (height - 2 * padding) / (m - 1);
      return {
        x: padding + pt.x * scaleX,
        y: padding + (m - 1 - pt.y) * scaleY
      };
    }
    module.exports = drawLabels;
  }
});

// colorbar/compute.js
var require_compute2 = __commonJS({
  "colorbar/compute.js"(exports, module) {
    "use strict";
    function computeColorbar(contourResult, options) {
      options = options || {};
      const levels = contourResult.levels;
      if (!levels || levels.length === 0) {
        return null;
      }
      const zmin = options.zmin !== void 0 ? options.zmin : levels[0];
      const zmax = options.zmax !== void 0 ? options.zmax : levels[levels.length - 1];
      return {
        type: options.coloring || "fill",
        zmin,
        zmax,
        levels,
        colors: options.colors || []
      };
    }
    module.exports = computeColorbar;
  }
});

// colorbar/ticks.js
var require_ticks = __commonJS({
  "colorbar/ticks.js"(exports, module) {
    "use strict";
    function formatTickValue(value, format) {
      if (!format) {
        return autoFormatValue(value);
      }
      const precisionMatch = format.match(/^\.(\d+)([fse%])?$/i);
      if (precisionMatch) {
        const precision = parseInt(precisionMatch[1], 10);
        const type = (precisionMatch[2] || "f").toLowerCase();
        switch (type) {
          case "f":
          case "F":
            return formatFixed(value, precision);
          case "e":
          case "E":
            return formatExponential(value, precision, type === "E");
          case "%":
            return formatPercent(value, precision);
          default:
            return formatFixed(value, precision);
        }
      }
      return autoFormatValue(value);
    }
    function formatFixed(value, precision) {
      if (!isFinite(value)) return String(value);
      if (Math.abs(value) < Math.pow(10, -precision)) {
        return "0";
      }
      return value.toFixed(precision);
    }
    function formatExponential(value, precision, uppercase) {
      if (!isFinite(value)) return String(value);
      if (value === 0) return "0e+0";
      let str = value.toExponential(precision);
      if (uppercase) {
        str = str.replace("e", "E");
      }
      return str;
    }
    function formatPercent(value, precision) {
      if (!isFinite(value)) return String(value);
      return (value * 100).toFixed(precision) + "%";
    }
    function autoFormatValue(value) {
      if (!isFinite(value)) return String(value);
      if (value === 0) return "0";
      const absValue = Math.abs(value);
      if (absValue < 0.01) {
        return value.toExponential(2);
      }
      if (absValue >= 1e4) {
        return value.toExponential(2);
      }
      if (absValue < 1) {
        return value.toFixed(4);
      }
      if (absValue < 100) {
        return parseFloat(value.toFixed(2)).toString();
      }
      if (absValue >= 100 && absValue < 1e4) {
        return value.toFixed(1).replace(/\.0$/, "");
      }
      return value.toString();
    }
    function computeTicks(colorbar, options) {
      options = options || {};
      const levels = colorbar.levels || [];
      const tickCount = options.nticks || 5;
      const tickMode = options.tickmode || "linear";
      const ticks = [];
      if (tickMode === "linear" && levels.length > 0) {
        const smartTicks = computeSmartTicks(levels[0], levels[levels.length - 1], tickCount);
        for (let i = 0; i < smartTicks.values.length; i++) {
          const value = smartTicks.values[i];
          const position = smartTicks.positions[i];
          ticks.push({
            position,
            value,
            label: formatTickValue(value, options.tickformat)
          });
        }
      } else if (tickMode === "array") {
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
      } else if (tickMode === "auto") {
        const smartTicks = computeSmartTicks(colorbar.zmin, colorbar.zmax, tickCount);
        for (let i = 0; i < smartTicks.values.length; i++) {
          const value = smartTicks.values[i];
          const position = (value - colorbar.zmin) / (colorbar.zmax - colorbar.zmin);
          ticks.push({
            position: Math.max(0, Math.min(1, position)),
            value,
            label: formatTickValue(value, options.tickformat)
          });
        }
      }
      return ticks;
    }
    function computeSmartTicks(start, end, nTicks) {
      const range = end - start;
      if (range <= 0 || nTicks <= 0) {
        return {
          values: [start],
          positions: [0.5]
        };
      }
      const roughStep = range / (nTicks - 1);
      const exponent = Math.floor(Math.log10(roughStep));
      const fraction = roughStep / Math.pow(10, exponent);
      let niceFraction;
      if (fraction < 1.5) niceFraction = 1;
      else if (fraction < 3) niceFraction = 2;
      else if (fraction < 7) niceFraction = 5;
      else niceFraction = 10;
      const step = niceFraction * Math.pow(10, exponent);
      const values = [];
      const positions = [];
      let firstTick = Math.ceil(start / step) * step;
      if (firstTick > start) firstTick -= step;
      for (let val = firstTick; val <= end + step * 1e-4; val += step) {
        if (val >= start - step * 1e-4) {
          values.push(val);
          positions.push((val - start) / range);
        }
      }
      return {
        values,
        positions
      };
    }
    module.exports = computeTicks;
    module.exports.formatTickValue = formatTickValue;
    module.exports.autoFormatValue = autoFormatValue;
    module.exports.computeSmartTicks = computeSmartTicks;
  }
});

// colorbar/index.js
var require_colorbar = __commonJS({
  "colorbar/index.js"(exports, module) {
    "use strict";
    var colors = require_colors();
    module.exports = {
      computeColorbar: require_compute2(),
      computeTicks: require_ticks(),
      mapColors: colors.mapColors,
      buildColorScale: colors.buildColorScale,
      COLOR_SCALES: colors.COLOR_SCALES
    };
  }
});

// renderers/canvas/colorbar.js
var require_colorbar2 = __commonJS({
  "renderers/canvas/colorbar.js"(exports, module) {
    "use strict";
    var mapColors = require_colorbar().mapColors;
    var computeTicks = require_colorbar().computeTicks;
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
      var colorscale = style.colorscale || "Viridis";
      var zmin = style.zmin !== void 0 ? style.zmin : levels[0];
      var zmax = style.zmax !== void 0 ? style.zmax : levels[levels.length - 1];
      for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var value = zmin + t * (zmax - zmin);
        var color = mapColors(value, zmin, zmax, colorscale, style.reversescale);
        ctx.fillStyle = color;
        ctx.fillRect(x, y + i, thickness, 1);
      }
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, thickness, barHeight);
      if (style.colorbarTitle) {
        ctx.fillStyle = "#000";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.save();
        ctx.translate(x + thickness / 2, y - 10);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(style.colorbarTitle, 0, 0);
        ctx.restore();
      }
      ctx.fillStyle = "#666";
      ctx.font = "10px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      var tickCount = Math.min(5, levels.length);
      for (i = 0; i < tickCount; i++) {
        var idx = Math.floor(i * (levels.length - 1) / (tickCount - 1));
        var level = levels[idx];
        var t = (level - levels[0]) / (levels[levels.length - 1] - levels[0]);
        var tickY = y + barHeight * (1 - t);
        ctx.fillText(level.toFixed(1), x + thickness + 5, tickY);
      }
    }
    module.exports = drawColorbar;
  }
});

// renderers/canvas/nulls.js
var require_nulls = __commonJS({
  "renderers/canvas/nulls.js"(exports, module) {
    "use strict";
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
      ctx.save();
      var fillColor = nullRegion.fill || nullRegion.bgColor || "#ffffff";
      if (fillColor !== "transparent") {
        ctx.fillStyle = fillColor;
        for (var i = 0; i < m; i++) {
          for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
              var x = padding + j * scaleX;
              var y = padding + (m - 1 - i) * scaleY;
              var sizeX = scaleX + 1;
              var sizeY = scaleY + 1;
              ctx.fillRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
            }
          }
        }
      } else {
        ctx.globalCompositeOperation = "destination-out";
        for (var i = 0; i < m; i++) {
          for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
              var x = padding + j * scaleX;
              var y = padding + (m - 1 - i) * scaleY;
              var sizeX = scaleX + 1;
              var sizeY = scaleY + 1;
              ctx.fillRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
            }
          }
        }
        ctx.globalCompositeOperation = "source-over";
      }
      var strokeColor = nullRegion.stroke;
      var showStroke = nullRegion.showStroke !== void 0 ? nullRegion.showStroke : true;
      if (strokeColor && showStroke) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = nullRegion.strokeWidth !== void 0 ? nullRegion.strokeWidth : 1;
        ctx.setLineDash(nullRegion.strokeDash || []);
        for (var i = 0; i < m; i++) {
          for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
              var x = padding + j * scaleX;
              var y = padding + (m - 1 - i) * scaleY;
              var sizeX = scaleX + 1;
              var sizeY = scaleY + 1;
              ctx.strokeRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
            }
          }
        }
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
    module.exports = drawNulls;
  }
});

// renderers/canvas/heatmap.js
var require_heatmap = __commonJS({
  "renderers/canvas/heatmap.js"(exports, module) {
    "use strict";
    var colors = require_colors();
    function drawHeatmapBackground(ctx, grid, style) {
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
      var cellWidth = plotWidth / (n - 1);
      var cellHeight = plotHeight / (m - 1);
      var colorscale = style.colorscale || "Viridis";
      var zmin, zmax;
      if (style.dataRange && style.dataRange.min !== void 0) {
        zmin = style.dataRange.min;
        zmax = style.dataRange.max;
      } else {
        var minVal = Infinity;
        var maxVal = -Infinity;
        for (var i = 0; i < m; i++) {
          for (var j = 0; j < n; j++) {
            var val = z[i][j];
            if (typeof val === "number" && isFinite(val)) {
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
      for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
          var value = z[i][j];
          if (typeof value !== "number" || !isFinite(value)) {
            continue;
          }
          var color = colors.mapColors(
            value,
            zmin,
            zmax,
            colorscale,
            {
              reverse: style.reverse,
              dataMin: style.dataRange ? style.dataRange.min : void 0,
              dataMax: style.dataRange ? style.dataRange.max : void 0
            }
          );
          var x = padding + j * cellWidth;
          var y = padding + (m - 1 - i) * cellHeight;
          ctx.fillStyle = color;
          ctx.fillRect(
            x - cellWidth / 2,
            y - cellHeight / 2,
            cellWidth + 1,
            // +1 to overlap slightly
            cellHeight + 1
          );
        }
      }
    }
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
      var zmin, zmax;
      if (style.dataRange && style.dataRange.min !== void 0) {
        zmin = style.dataRange.min;
        zmax = style.dataRange.max;
      } else {
        var minVal = Infinity;
        var maxVal = -Infinity;
        for (var i = 0; i < m; i++) {
          for (var j = 0; j < n; j++) {
            var val = z[i][j];
            if (typeof val === "number" && isFinite(val)) {
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
      var colorscale = style.colorscale || "Viridis";
      var heatmapCanvas = document.createElement("canvas");
      heatmapCanvas.width = n;
      heatmapCanvas.height = m;
      var heatmapCtx = heatmapCanvas.getContext("2d");
      var imageData = heatmapCtx.createImageData(n, m);
      for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
          var value = z[i][j];
          var pixelIndex = (i * n + j) * 4;
          if (typeof value === "number" && isFinite(value)) {
            var color = colors.mapColors(
              value,
              zmin,
              zmax,
              colorscale,
              {
                reverse: style.reverse
              }
            );
            var r = parseInt(color.slice(1, 3), 16);
            var g = parseInt(color.slice(3, 5), 16);
            var b = parseInt(color.slice(5, 7), 16);
            imageData.data[pixelIndex] = r;
            imageData.data[pixelIndex + 1] = g;
            imageData.data[pixelIndex + 2] = b;
            imageData.data[pixelIndex + 3] = 255;
          } else {
            imageData.data[pixelIndex + 3] = 0;
          }
        }
      }
      heatmapCtx.putImageData(imageData, 0, 0);
      ctx.save();
      ctx.translate(padding, padding);
      ctx.scale(plotWidth / n, plotHeight / m);
      ctx.translate(0, m);
      ctx.scale(1, -1);
      ctx.drawImage(heatmapCanvas, 0, 0);
      ctx.restore();
    }
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
      var scaleFactor = Math.max(1, Math.min(10, Math.ceil(100 / Math.max(n, m))));
      var hiresCanvas = document.createElement("canvas");
      hiresCanvas.width = n * scaleFactor;
      hiresCanvas.height = m * scaleFactor;
      var hiresCtx = hiresCanvas.getContext("2d");
      drawInterpolatedHeatmap(hiresCtx, grid, {
        width: hiresCanvas.width,
        height: hiresCanvas.height,
        padding: 0,
        colorscale: style.colorscale,
        dataRange: style.dataRange,
        reverse: style.reverse
      });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.save();
      ctx.translate(padding, padding);
      ctx.scale(plotWidth / hiresCanvas.width, plotHeight / hiresCanvas.height);
      ctx.translate(0, hiresCanvas.height);
      ctx.scale(1, -1);
      ctx.drawImage(hiresCanvas, 0, 0);
      ctx.restore();
    }
    module.exports = {
      drawHeatmapBackground,
      drawInterpolatedHeatmap,
      drawSmoothHeatmap
    };
  }
});

// axes/auto_ticks.js
var require_auto_ticks = __commonJS({
  "axes/auto_ticks.js"(exports, module) {
    "use strict";
    function calcTickInterval(rangeMin, rangeMax, targetTickCount) {
      if (targetTickCount === void 0) {
        targetTickCount = 5;
      }
      var range = Math.abs(rangeMax - rangeMin);
      if (range === 0) {
        return 1;
      }
      var roughDTick = range / targetTickCount;
      var exponent = Math.floor(Math.log10(roughDTick));
      var base = Math.pow(10, exponent);
      var normalized = roughDTick / base;
      var niceNumbers = [1, 2, 5, 10];
      var niceNum = niceNumbers[0];
      var minDiff = Math.abs(normalized - niceNum);
      for (var i = 1; i < niceNumbers.length; i++) {
        var diff = Math.abs(normalized - niceNumbers[i]);
        if (diff < minDiff) {
          minDiff = diff;
          niceNum = niceNumbers[i];
        }
      }
      var dtick = niceNum * base;
      if (dtick <= 0 || !isFinite(dtick)) {
        dtick = 1;
      }
      return dtick;
    }
    function calcFirstTick(rangeMin, rangeMax, dtick, tick0) {
      if (tick0 === void 0) {
        tick0 = 0;
      }
      if (rangeMin >= 0) {
        var firstTick = Math.ceil((rangeMin - tick0) / dtick) * dtick + tick0;
        return firstTick;
      }
      var firstTick = Math.floor((rangeMin - tick0) / dtick) * dtick + tick0;
      if (firstTick < rangeMin) {
        firstTick += dtick;
      }
      return firstTick;
    }
    function calcLastTick(rangeMax, dtick, tick0) {
      if (tick0 === void 0) {
        tick0 = 0;
      }
      var lastTick = Math.floor((rangeMax - tick0) / dtick) * dtick + tick0;
      if (lastTick > rangeMax) {
        lastTick -= dtick;
      }
      return lastTick;
    }
    function generateTickValues(firstTick, lastTick, dtick) {
      var ticks = [];
      var numTicks = Math.round((lastTick - firstTick) / dtick) + 1;
      numTicks = Math.min(100, Math.max(2, numTicks));
      for (var i = 0; i < numTicks; i++) {
        ticks.push(firstTick + i * dtick);
      }
      return ticks;
    }
    function autoTicks(rangeMin, rangeMax, targetTickCount, tick0) {
      var dtick = calcTickInterval(rangeMin, rangeMax, targetTickCount);
      if (tick0 === void 0) {
        if (rangeMin >= 0) {
          tick0 = 0;
        } else if (rangeMax <= 0) {
          tick0 = Math.ceil(rangeMin / dtick) * dtick;
        } else {
          tick0 = 0;
        }
      }
      var firstTick = calcFirstTick(rangeMin, rangeMax, dtick, tick0);
      var lastTick = calcLastTick(rangeMax, dtick, tick0);
      var values = generateTickValues(firstTick, lastTick, dtick);
      return {
        dtick,
        tick0,
        firstTick,
        lastTick,
        values
      };
    }
    module.exports = {
      calcTickInterval,
      calcFirstTick,
      calcLastTick,
      generateTickValues,
      autoTicks
    };
  }
});

// axes/tick_format.js
var require_tick_format = __commonJS({
  "axes/tick_format.js"(exports, module) {
    "use strict";
    function countDecimals(value) {
      if (Math.floor(value) === value) {
        return 0;
      }
      var str = value.toString();
      var decimalIndex = str.indexOf(".");
      if (decimalIndex === -1) {
        return 0;
      }
      return str.length - decimalIndex - 1;
    }
    function roundTo(value, decimals) {
      var factor = Math.pow(10, decimals);
      return Math.round(value * factor) / factor;
    }
    function formatScientific(value, precision) {
      if (precision === void 0) {
        precision = 3;
      }
      if (value === 0) {
        return "0";
      }
      var exponent = Math.floor(Math.log10(Math.abs(value)));
      var mantissa = value / Math.pow(10, exponent);
      mantissa = roundTo(mantissa, precision);
      return mantissa + "e" + (exponent >= 0 ? "+" : "") + exponent;
    }
    function formatFixed(value, decimals) {
      return value.toFixed(decimals);
    }
    function formatTickLabel(value, options) {
      options = options || {};
      if (!isFinite(value)) {
        return String(value);
      }
      if (value === 0) {
        return "0";
      }
      var absValue = Math.abs(value);
      if (options.format) {
        if (typeof options.format === "function") {
          return options.format(value);
        }
        return String(value);
      }
      var useScientific = false;
      var precision = 2;
      if (absValue < 1e-3 && absValue > 0) {
        useScientific = true;
        precision = 2;
      } else if (absValue >= 1e4) {
        useScientific = true;
        precision = 3;
      }
      var decimals;
      if (useScientific) {
        if (options.exponentformat === "none") {
          useScientific = false;
        }
      }
      if (useScientific) {
        return formatScientific(value, precision);
      }
      if (absValue < 0.01) {
        decimals = 4;
      } else if (absValue < 1) {
        decimals = 3;
      } else if (absValue < 100) {
        decimals = 2;
      } else if (absValue < 1e3) {
        decimals = 1;
      } else {
        decimals = 0;
      }
      if (options.precision !== void 0) {
        decimals = options.precision;
      }
      var formatted = formatFixed(value, decimals);
      if (decimals > 0) {
        formatted = formatted.replace(/\.?0+$/, "");
      }
      return formatted;
    }
    function formatTickLabels(values, options) {
      var result = [];
      for (var i = 0; i < values.length; i++) {
        result.push(formatTickLabel(values[i], options));
      }
      return result;
    }
    function calculatePrecision(values, dtick) {
      var maxDecimals = 0;
      var dtickDecimals = countDecimals(dtick);
      if (dtickDecimals > maxDecimals) {
        maxDecimals = dtickDecimals;
      }
      for (var i = 0; i < values.length; i++) {
        var decimals = countDecimals(values[i]);
        if (decimals > maxDecimals) {
          maxDecimals = decimals;
        }
      }
      return Math.min(6, maxDecimals);
    }
    function formatTickLabelsUniform(values, dtick, options) {
      options = options || {};
      var precision;
      if (options.precision !== void 0) {
        precision = options.precision;
      } else {
        precision = calculatePrecision(values, dtick);
      }
      var result = [];
      for (var i = 0; i < values.length; i++) {
        var formatted = formatFixed(values[i], precision);
        if (precision > 0) {
          formatted = formatted.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
        }
        result.push(formatted);
      }
      return result;
    }
    module.exports = {
      countDecimals,
      roundTo,
      formatScientific,
      formatFixed,
      formatTickLabel,
      formatTickLabels,
      formatTickLabelsUniform,
      calculatePrecision
    };
  }
});

// axes/calc_ticks.js
var require_calc_ticks = __commonJS({
  "axes/calc_ticks.js"(exports, module) {
    "use strict";
    var autoTicks = require_auto_ticks();
    var tickFormat = require_tick_format();
    var DEFAULT_AXIS_CONFIG = {
      show: true,
      showticklabels: true,
      showgrid: false,
      tickmode: "auto",
      dtick: void 0,
      tick0: void 0,
      nticks: 5,
      tickvals: void 0,
      ticktext: void 0,
      ticklen: 5,
      tickcolor: "#666666",
      tickwidth: 1,
      side: "bottom",
      // for x-axis: 'bottom' | 'top', for y-axis: 'left' | 'right'
      title: "",
      exponentformat: "auto"
      // 'auto' | 'none' | 'e' | 'E' | 'power' | 'SI'
    };
    function inferRangeFromData(data) {
      if (!data || data.length === 0) {
        return [0, 1];
      }
      var min = data[0];
      var max = data[0];
      for (var i = 1; i < data.length; i++) {
        var val = data[i];
        if (typeof val === "number" && isFinite(val)) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
      if (min === max) {
        if (min === 0) {
          return [0, 1];
        }
        return [min - Math.abs(min) * 0.1, max + Math.abs(max) * 0.1];
      }
      return [min, max];
    }
    function normalizeAxisConfig(axis) {
      if (!axis) {
        axis = {};
      }
      var normalized = {};
      for (var key in DEFAULT_AXIS_CONFIG) {
        if (axis.hasOwnProperty(key)) {
          normalized[key] = axis[key];
        } else {
          normalized[key] = DEFAULT_AXIS_CONFIG[axis[key]];
        }
      }
      return normalized;
    }
    function calcTicks(axis) {
      axis = normalizeAxisConfig(axis);
      var range = axis.range;
      if (!range) {
        if (axis.data) {
          range = inferRangeFromData(axis.data);
        } else {
          range = [0, 10];
        }
      }
      var rangeMin = Math.min(range[0], range[1]);
      var rangeMax = Math.max(range[0], range[1]);
      var tickValues = [];
      var tickTexts = [];
      if (axis.tickmode === "array" && axis.tickvals && axis.tickvals.length > 0) {
        tickValues = axis.tickvals.slice();
        tickValues = tickValues.filter(function(v) {
          return v >= rangeMin && v <= rangeMax;
        });
        if (axis.ticktext && axis.ticktext.length === axis.tickvals.length) {
          var textMap = {};
          for (var i = 0; i < axis.tickvals.length; i++) {
            textMap[axis.tickvals[i]] = axis.ticktext[i];
          }
          tickTexts = tickValues.map(function(v) {
            return String(textMap[v] !== void 0 ? textMap[v] : v);
          });
        }
      } else if (axis.tickmode === "linear" && axis.dtick) {
        var dtick = axis.dtick;
        var tick0 = axis.tick0 !== void 0 ? axis.tick0 : 0;
        var firstTick = autoTicks.calcFirstTick(rangeMin, rangeMax, dtick, tick0);
        var lastTick = autoTicks.calcLastTick(rangeMax, dtick, tick0);
        tickValues = autoTicks.generateTickValues(firstTick, lastTick, dtick);
      } else {
        var autoResult = autoTicks.autoTicks(
          rangeMin,
          rangeMax,
          axis.nticks || 5,
          axis.tick0
        );
        tickValues = autoResult.values;
      }
      if (tickTexts.length === 0) {
        var formatOptions = {
          exponentformat: axis.exponentformat,
          precision: axis.precision
        };
        var dtick = axis.dtick || autoTicks.calcTickInterval(rangeMin, rangeMax, axis.nticks || 5);
        tickTexts = tickFormat.formatTickLabelsUniform(tickValues, dtick, formatOptions);
      }
      var ticks = [];
      for (var i = 0; i < tickValues.length; i++) {
        ticks.push({
          value: tickValues[i],
          text: tickTexts[i],
          index: i
        });
      }
      return ticks;
    }
    function calcAxesTicks(config) {
      config = config || {};
      var xConfig = config.x || {};
      var yConfig = config.y || {};
      if (config.xData) {
        xConfig.data = config.xData;
      }
      if (config.yData) {
        yConfig.data = config.yData;
      }
      return {
        xTicks: calcTicks(xConfig),
        yTicks: calcTicks(yConfig)
      };
    }
    module.exports = {
      calcTicks,
      calcAxesTicks,
      normalizeAxisConfig,
      inferRangeFromData,
      DEFAULT_AXIS_CONFIG
    };
  }
});

// axes/position.js
var require_position2 = __commonJS({
  "axes/position.js"(exports, module) {
    "use strict";
    function createLinearToPixel(range, pixelLength, reverse) {
      var rMin = Math.min(range[0], range[1]);
      var rMax = Math.max(range[0], range[1]);
      var rRange = rMax - rMin;
      if (rRange === 0) {
        return function l2p(value) {
          return pixelLength / 2;
        };
      }
      return function l2p(value) {
        var clampedValue = Math.max(rMin, Math.min(rMax, value));
        var normalized = (clampedValue - rMin) / rRange;
        if (reverse) {
          normalized = 1 - normalized;
        }
        return normalized * pixelLength;
      };
    }
    function createPixelToLinear(range, pixelLength, reverse) {
      var rMin = Math.min(range[0], range[1]);
      var rMax = Math.max(range[0], range[1]);
      var rRange = rMax - rMin;
      if (rRange === 0) {
        return function p2l(pixel) {
          return rMin;
        };
      }
      return function p2l(pixel) {
        var normalized = pixel / pixelLength;
        if (reverse) {
          normalized = 1 - normalized;
        }
        return rMin + normalized * rRange;
      };
    }
    function createCategoryToPixel(categories, pixelLength, reverse) {
      var numCategories = categories.length;
      if (numCategories === 0) {
        return function c2p(index) {
          return 0;
        };
      }
      var categoryWidth = pixelLength / numCategories;
      return function c2p(index) {
        var clampedIndex = Math.max(0, Math.min(numCategories - 1, Math.floor(index)));
        var position = clampedIndex * categoryWidth + categoryWidth / 2;
        if (reverse) {
          position = pixelLength - position;
        }
        return position;
      };
    }
    function calculateAxisMargins(axis, isHorizontal) {
      var margins = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      };
      if (!axis || axis.show === false) {
        return margins;
      }
      var tickLength = axis.ticklen || 5;
      var showLabels = axis.showticklabels !== false;
      var title = axis.title;
      if (isHorizontal) {
        if (axis.side === "top") {
          margins.top = tickLength;
          if (showLabels) margins.top += 15;
          if (title) margins.top += 20;
        } else {
          margins.bottom = tickLength;
          if (showLabels) margins.bottom += 15;
          if (title) margins.bottom += 20;
        }
      } else {
        if (axis.side === "right") {
          margins.right = tickLength;
          if (showLabels) margins.right += 30;
          if (title) margins.right += 20;
        } else {
          margins.left = tickLength;
          if (showLabels) margins.left += 30;
          if (title) margins.left += 20;
        }
      }
      return margins;
    }
    function calculateDrawingArea(canvasWidth, canvasHeight, xAxis, yAxis) {
      var xMargins = calculateAxisMargins(xAxis, true);
      var yMargins = calculateAxisMargins(yAxis, false);
      var margins = {
        left: Math.max(xMargins.left, yMargins.left, 30),
        right: Math.max(xMargins.right, yMargins.right, 30),
        top: Math.max(xMargins.top, yMargins.top, 30),
        bottom: Math.max(xMargins.bottom, yMargins.bottom, 30)
      };
      return {
        x: margins.left,
        y: margins.top,
        width: canvasWidth - margins.left - margins.right,
        height: canvasHeight - margins.top - margins.bottom,
        margins
      };
    }
    module.exports = {
      createLinearToPixel,
      createPixelToLinear,
      createCategoryToPixel,
      calculateAxisMargins,
      calculateDrawingArea
    };
  }
});

// axes/index.js
var require_axes = __commonJS({
  "axes/index.js"(exports, module) {
    "use strict";
    var calcTicks = require_calc_ticks();
    var autoTicks = require_auto_ticks();
    var tickFormat = require_tick_format();
    var position = require_position2();
    function setupAxes(config) {
      config = config || {};
      var width = config.width || 600;
      var height = config.height || 500;
      var drawingArea = position.calculateDrawingArea(
        width,
        height,
        config.x || {},
        config.y || {}
      );
      var xConfig = config.x || {};
      var yConfig = config.y || {};
      if (!xConfig.range && config.xData) {
        xConfig.range = calcTicks.inferRangeFromData(config.xData);
      }
      if (!yConfig.range && config.yData) {
        yConfig.range = calcTicks.inferRangeFromData(config.yData);
      }
      var xRange = xConfig.range || [0, width];
      var yRange = yConfig.range || [0, height];
      var ticksResult = calcTicks.calcAxesTicks({
        x: xConfig,
        y: yConfig
      });
      var xIsReversed = xRange[0] > xRange[1];
      var yIsReversed = yRange[0] < yRange[1];
      var xL2P = position.createLinearToPixel(
        xRange,
        drawingArea.width,
        xIsReversed
      );
      var yL2P = position.createLinearToPixel(
        yRange,
        drawingArea.height,
        yIsReversed
      );
      var xTicksWithPos = ticksResult.xTicks.map(function(tick) {
        return {
          value: tick.value,
          text: tick.text,
          index: tick.index,
          pixel: xL2P(tick.value)
        };
      });
      var yTicksWithPos = ticksResult.yTicks.map(function(tick) {
        return {
          value: tick.value,
          text: tick.text,
          index: tick.index,
          pixel: yL2P(tick.value)
        };
      });
      return {
        // Drawing area
        drawingArea,
        // X-axis
        x: {
          ticks: xTicksWithPos,
          l2p: xL2P,
          range: xRange,
          config: calcTicks.normalizeAxisConfig(xConfig)
        },
        // Y-axis
        y: {
          ticks: yTicksWithPos,
          l2p: yL2P,
          range: yRange,
          config: calcTicks.normalizeAxisConfig(yConfig)
        }
      };
    }
    module.exports = {
      // Main setup function
      setupAxes,
      // Tick calculation
      calcTicks: calcTicks.calcTicks,
      calcAxesTicks: calcTicks.calcAxesTicks,
      normalizeAxisConfig: calcTicks.normalizeAxisConfig,
      inferRangeFromData: calcTicks.inferRangeFromData,
      // Auto ticks algorithm
      calcTickInterval: autoTicks.calcTickInterval,
      calcFirstTick: autoTicks.calcFirstTick,
      calcLastTick: autoTicks.calcLastTick,
      generateTickValues: autoTicks.generateTickValues,
      autoTicks: autoTicks.autoTicks,
      // Position conversion
      createLinearToPixel: position.createLinearToPixel,
      createPixelToLinear: position.createPixelToLinear,
      createCategoryToPixel: position.createCategoryToPixel,
      calculateAxisMargins: position.calculateAxisMargins,
      calculateDrawingArea: position.calculateDrawingArea,
      // Tick formatting
      countDecimals: tickFormat.countDecimals,
      roundTo: tickFormat.roundTo,
      formatTickLabel: tickFormat.formatTickLabel,
      formatTickLabels: tickFormat.formatTickLabels,
      formatTickLabelsUniform: tickFormat.formatTickLabelsUniform,
      calculatePrecision: tickFormat.calculatePrecision
    };
  }
});

// renderers/canvas/axes.js
var require_axes2 = __commonJS({
  "renderers/canvas/axes.js"(exports, module) {
    "use strict";
    var axes = require_axes();
    function drawXAxis(ctx, axisSetup, yOffset) {
      var xAxis = axisSetup.x;
      var config = xAxis.config;
      var ticks = xAxis.ticks;
      var drawingArea = axisSetup.drawingArea;
      if (config.show === false) {
        return;
      }
      var side = config.side || "bottom";
      var tickLength = config.ticklen || 5;
      var tickColor = config.tickcolor || "#666666";
      var tickWidth = config.tickwidth || 1;
      var showLabels = config.showticklabels !== false;
      var axisY;
      var labelY;
      var labelAlign = "center";
      var labelBaseline = "top";
      if (side === "top") {
        axisY = drawingArea.margins.top;
        labelY = axisY - tickLength - 5;
        labelBaseline = "bottom";
      } else {
        axisY = drawingArea.y + drawingArea.height;
        labelY = axisY + tickLength + 5;
        labelBaseline = "top";
      }
      ctx.beginPath();
      ctx.strokeStyle = config.linecolor || "#333";
      ctx.lineWidth = config.linewidth || 1;
      ctx.moveTo(drawingArea.x, axisY);
      ctx.lineTo(drawingArea.x + drawingArea.width, axisY);
      ctx.stroke();
      ctx.font = config.tickfont || "12px Arial, sans-serif";
      ctx.fillStyle = config.tickfontcolor || "#333";
      ctx.textAlign = labelAlign;
      ctx.textBaseline = labelBaseline;
      for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var x = drawingArea.x + tick.pixel;
        if (tick.pixel < -10 || tick.pixel > drawingArea.width + 10) {
          continue;
        }
        ctx.beginPath();
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = tickWidth;
        if (side === "top") {
          ctx.moveTo(x, axisY);
          ctx.lineTo(x, axisY - tickLength);
        } else {
          ctx.moveTo(x, axisY);
          ctx.lineTo(x, axisY + tickLength);
        }
        ctx.stroke();
        if (showLabels) {
          ctx.fillText(tick.text, x, labelY);
        }
      }
      if (config.title) {
        ctx.save();
        ctx.font = config.titlefont || "bold 14px Arial, sans-serif";
        ctx.fillStyle = config.titlefontcolor || "#000";
        ctx.textAlign = "center";
        var titleY;
        if (side === "top") {
          titleY = labelY - 25;
        } else {
          titleY = labelY + 20;
        }
        ctx.fillText(config.title, drawingArea.x + drawingArea.width / 2, titleY);
        ctx.restore();
      }
    }
    function drawYAxis(ctx, axisSetup, xOffset) {
      var yAxis = axisSetup.y;
      var config = yAxis.config;
      var ticks = yAxis.ticks;
      var drawingArea = axisSetup.drawingArea;
      if (config.show === false) {
        return;
      }
      var side = config.side || "left";
      var tickLength = config.ticklen || 5;
      var tickColor = config.tickcolor || "#666666";
      var tickWidth = config.tickwidth || 1;
      var showLabels = config.showticklabels !== false;
      var axisX;
      var labelX;
      var labelAlign = "end";
      var labelBaseline = "middle";
      if (side === "right") {
        axisX = drawingArea.x + drawingArea.width;
        labelX = axisX + tickLength + 5;
        labelAlign = "start";
      } else {
        axisX = drawingArea.margins.left;
        labelX = axisX - tickLength - 5;
        labelAlign = "end";
      }
      ctx.beginPath();
      ctx.strokeStyle = config.linecolor || "#333";
      ctx.lineWidth = config.linewidth || 1;
      ctx.moveTo(axisX, drawingArea.y);
      ctx.lineTo(axisX, drawingArea.y + drawingArea.height);
      ctx.stroke();
      ctx.font = config.tickfont || "12px Arial, sans-serif";
      ctx.fillStyle = config.tickfontcolor || "#333";
      ctx.textAlign = labelAlign;
      ctx.textBaseline = labelBaseline;
      for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var y = drawingArea.y + tick.pixel;
        if (tick.pixel < -10 || tick.pixel > drawingArea.height + 10) {
          continue;
        }
        ctx.beginPath();
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = tickWidth;
        if (side === "right") {
          ctx.moveTo(axisX, y);
          ctx.lineTo(axisX + tickLength, y);
        } else {
          ctx.moveTo(axisX, y);
          ctx.lineTo(axisX - tickLength, y);
        }
        ctx.stroke();
        if (showLabels) {
          ctx.fillText(tick.text, labelX, y);
        }
      }
      if (config.title) {
        ctx.save();
        ctx.font = config.titlefont || "bold 14px Arial, sans-serif";
        ctx.fillStyle = config.titlefontcolor || "#000";
        ctx.textAlign = "center";
        var titleX;
        var titleY = drawingArea.y + drawingArea.height / 2;
        if (side === "right") {
          titleX = labelX + 30;
        } else {
          titleX = labelX - 25;
        }
        ctx.translate(titleX, titleY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(config.title, 0, 0);
        ctx.restore();
      }
    }
    function drawGrid(ctx, axisSetup, isXAxis) {
      var axis = isXAxis ? axisSetup.x : axisSetup.y;
      var config = axis.config;
      var ticks = axis.ticks;
      var drawingArea = axisSetup.drawingArea;
      if (!config.showgrid) {
        return;
      }
      ctx.beginPath();
      ctx.strokeStyle = config.gridcolor || "#e0e0e0";
      ctx.lineWidth = config.gridwidth || 1;
      if (config.griddash) {
        var dashArray = typeof config.griddash === "string" ? config.griddash.split(",").map(Number) : [5, 5];
        ctx.setLineDash(dashArray);
      } else {
        ctx.setLineDash([]);
      }
      for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        if (tick.pixel < 0 || tick.pixel > (isXAxis ? drawingArea.width : drawingArea.height)) {
          continue;
        }
        if (isXAxis) {
          var x = drawingArea.x + tick.pixel;
          ctx.moveTo(x, drawingArea.y);
          ctx.lineTo(x, drawingArea.y + drawingArea.height);
        } else {
          var y = drawingArea.y + tick.pixel;
          ctx.moveTo(drawingArea.x, y);
          ctx.lineTo(drawingArea.x + drawingArea.width, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    function drawAxes(ctx, axesConfig) {
      axesConfig = axesConfig || {};
      var width = axesConfig.width || ctx.canvas.width;
      var height = axesConfig.height || ctx.canvas.height;
      var axisSetup = axes.setupAxes(axesConfig);
      drawGrid(ctx, axisSetup, true);
      drawGrid(ctx, axisSetup, false);
      drawXAxis(ctx, axisSetup);
      drawYAxis(ctx, axisSetup);
      return axisSetup;
    }
    function drawAxesFromSetup(ctx, axisSetup) {
      drawGrid(ctx, axisSetup, true);
      drawGrid(ctx, axisSetup, false);
      drawXAxis(ctx, axisSetup);
      drawYAxis(ctx, axisSetup);
    }
    module.exports = {
      drawAxes,
      drawAxesFromSetup,
      drawXAxis,
      drawYAxis,
      drawGrid
    };
  }
});

// renderers/canvas/index.js
var require_canvas = __commonJS({
  "renderers/canvas/index.js"(exports, module) {
    "use strict";
    var drawPaths = require_paths();
    var drawLabels = require_labels2();
    var drawColorbar = require_colorbar2();
    var drawNulls = require_nulls();
    var drawHeatmap = require_heatmap();
    var axesRenderer = require_axes2();
    var nullHandling = require_null_handling();
    function drawContours(ctx, contourResult, style) {
      style = style || {};
      var width = style.width || ctx.canvas.width;
      var height = style.height || ctx.canvas.height;
      var coloring = style.coloring || "lines";
      var showLines = style.showLines !== false;
      var smoothing = style.smoothing || 0;
      var useClipMask = style.useClipMask !== false;
      ctx.clearRect(0, 0, width, height);
      var connectGaps = contourResult.connectgaps !== void 0 ? contourResult.connectgaps : true;
      var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;
      if (needsClip && useClipMask) {
        var clipPathData = nullHandling.generateClipPath(contourResult, style);
        if (clipPathData) {
          applyCanvasClip(ctx, clipPathData, width, height);
        }
      }
      if (coloring === "heatmap") {
        drawHeatmap.drawInterpolatedHeatmap(ctx, {
          z: contourResult.pathinfo[0].z,
          x: contourResult.pathinfo[0].x,
          y: contourResult.pathinfo[0].y
        }, style);
      }
      if (coloring === "fill" || coloring === "heatmap") {
        drawPaths.drawFilledPaths(ctx, contourResult, style);
      }
      if (showLines && coloring === "lines") {
        drawPaths.drawStrokePaths(ctx, contourResult, style);
      }
      if (needsClip && useClipMask) {
        ctx.restore();
      }
      if (style.showLabels) {
        drawLabels(ctx, contourResult, style);
      }
      if (style.colorbar !== false && coloring !== "lines") {
        drawColorbar(ctx, contourResult, style);
      }
      if (needsClip && !useClipMask) {
        drawNulls(ctx, contourResult, style);
      }
    }
    function applyCanvasClip(ctx, pathData, width, height) {
      ctx.save();
      parseSVGPathToCanvas(ctx, pathData);
      ctx.clip();
    }
    function parseSVGPathToCanvas(ctx, pathData) {
      var commands = pathData.split(/[MmLlHhVvAaQqTtCcSsZz]/);
      var types = pathData.match(/[MmLlHhVvAaQqTtCcSsZz]/g) || [];
      var currentX = 0, currentY = 0;
      var startX = 0, startY = 0;
      ctx.beginPath();
      for (var i = 0; i < types.length; i++) {
        var type = types[i];
        var args = commands[i + 1] ? commands[i + 1].trim().split(/[\s,]+/).map(parseFloat) : [];
        switch (type) {
          case "M":
            ctx.moveTo(args[0], args[1]);
            currentX = args[0];
            currentY = args[1];
            startX = args[0];
            startY = args[1];
            break;
          case "m":
            ctx.moveTo(currentX + args[0], currentY + args[1]);
            currentX += args[0];
            currentY += args[1];
            startX = currentX;
            startY = currentY;
            break;
          case "L":
            ctx.lineTo(args[0], args[1]);
            currentX = args[0];
            currentY = args[1];
            break;
          case "l":
            ctx.lineTo(currentX + args[0], currentY + args[1]);
            currentX += args[0];
            currentY += args[1];
            break;
          case "H":
            ctx.lineTo(args[0], currentY);
            currentX = args[0];
            break;
          case "h":
            ctx.lineTo(currentX + args[0], currentY);
            currentX += args[0];
            break;
          case "V":
            ctx.lineTo(currentX, args[0]);
            currentY = args[0];
            break;
          case "v":
            ctx.lineTo(currentX, currentY + args[0]);
            currentY += args[0];
            break;
          case "Z":
          case "z":
            ctx.closePath();
            currentX = startX;
            currentY = startY;
            break;
          default:
            if (args.length >= 2) {
              ctx.lineTo(args[args.length - 2], args[args.length - 1]);
            }
            break;
        }
      }
    }
    module.exports = {
      drawContours,
      drawPaths,
      drawLabels,
      drawColorbar,
      drawNulls,
      drawHeatmap,
      drawAxes: axesRenderer.drawAxes
    };
  }
});

// api.js
var require_api = __commonJS({
  "api.js"(exports, module) {
    "use strict";
    var compute = require_compute();
    var canvasRenderer = require_canvas();
    var COLOR_SCALES = {
      Viridis: [
        "#440154",
        "#482878",
        "#3e4a89",
        "#31688e",
        "#26838f",
        "#1f9d8a",
        "#35b779",
        "#6dcd59",
        "#b4de2c",
        "#fde725"
      ],
      Plasma: [
        "#0d0887",
        "#46039f",
        "#7201a8",
        "#9c179e",
        "#bd3786",
        "#d8576b",
        "#ed7953",
        "#fb9f3a",
        "#fdca26",
        "#f0f921"
      ],
      Hot: [
        "#000000",
        "#4a0000",
        "#880000",
        "#c20000",
        "#ff0000",
        "#ff4a00",
        "#ff8800",
        "#ffc200",
        "#ffff00",
        "#ffff80"
      ],
      Jet: [
        "#000080",
        "#0000ff",
        "#0080ff",
        "#00ffff",
        "#80ff80",
        "#ffff00",
        "#ff8000",
        "#ff0000",
        "#800000",
        "#000000"
      ],
      Earth: [
        "#2a1c0b",
        "#5c4033",
        "#8f6b4e",
        "#c19a6b",
        "#e5c99b",
        "#f5e6c8",
        "#8b4513",
        "#a0522d",
        "#cd853f",
        "#deb887"
      ],
      Electric: [
        "#000004",
        "#1b0c42",
        "#4a0c6e",
        "#781c6d",
        "#a52c60",
        "#cf4446",
        "#ed6925",
        "#fb9b06",
        "#f7d13d",
        "#fcffa4"
      ]
    };
    function render(canvas, config) {
      if (!canvas) {
        throw new Error("Canvas element is required");
      }
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2D context from canvas");
      }
      config = config || {};
      var grid = {
        z: config.z,
        x: config.x,
        y: config.y
      };
      var options = {
        autocontour: config.autocontour !== false,
        ncontours: config.ncontours || 15,
        start: config.contours ? config.contours.start : void 0,
        end: config.contours ? config.contours.end : void 0,
        size: config.contours ? config.contours.size : void 0,
        smoothing: config.smoothing !== void 0 ? config.smoothing : 0.5,
        valueColorMap: config.valueColorMap
        // Segmented color mapping [[value, color], ...]
      };
      var result = compute.computeContours(grid, options);
      var width = config.width || canvas.width || 600;
      var height = config.height || canvas.height || 500;
      var contourType = "lines";
      if (config.contours && config.contours.type) {
        contourType = config.contours.type;
      }
      var colors = getColors(config.colorscale, result.levels, config.zmin, config.zmax, config.reversescale);
      var colorScale = buildColorScale(result.levels, colors);
      var valueColorMap = config.valueColorMap;
      var style = {
        width,
        height,
        x: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].x : config.x,
        y: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].y : config.y,
        z: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].z : config.z,
        coloring: contourType,
        showLines: contourType === "lines" || contourType === "heatmap",
        lineWidth: 1.5,
        lineColor: contourType === "lines" ? "#666" : "rgba(255,255,255,0.5)",
        colorScale,
        valueColorMap,
        // Segmented color mapping
        smoothing: options.smoothing
      };
      canvasRenderer.drawContours(ctx, result, style);
      if (result.nullMask && result.nullCount > 0) {
        drawNullRegions(ctx, result, style, config.nullRegion);
      }
      if (config.axes) {
        var axesConfig = config.axes;
        axesConfig.width = width;
        axesConfig.height = height;
        if (config.x) {
          axesConfig.xData = config.x;
        }
        if (config.y) {
          axesConfig.yData = config.y;
        }
        canvasRenderer.drawAxes(ctx, axesConfig);
      }
      if (config.colorbar && config.colorbar.show !== false && contourType !== "lines") {
        drawColorbar(ctx, result, colors, config.colorbar, width, height);
      }
      return result;
    }
    function drawTo(canvas, result, options) {
      if (!canvas) {
        throw new Error("Canvas element is required");
      }
      if (!result || !result.paths) {
        throw new Error("Invalid contour result");
      }
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2D context from canvas");
      }
      options = options || {};
      var width = options.width || canvas.width || 600;
      var height = options.height || canvas.height || 500;
      var colors = getColors(
        options.colorscale,
        result.levels,
        options.zmin,
        options.zmax,
        options.reversescale
      );
      var colorScale = buildColorScale(result.levels, colors);
      var valueColorMap = options.valueColorMap;
      var style = {
        width,
        height,
        coloring: options.coloring || "fill",
        showLines: options.showLines !== false,
        lineWidth: options.lineWidth || 1.5,
        lineColor: options.lineColor || "#666",
        colorScale,
        valueColorMap,
        smoothing: options.smoothing || 0
      };
      canvasRenderer.drawContours(ctx, result, style);
      if (result.nullMask && result.nullCount > 0) {
        drawNullRegions(ctx, result, style, options.nullRegion);
      }
      if (options.showColorbar !== false) {
        drawColorbar(ctx, result, colors, options.colorbar, width, height);
      }
    }
    function getColors(colorscale, levels, zmin, zmax, reverse) {
      var colors;
      if (Array.isArray(colorscale)) {
        colors = colorscale;
      } else if (typeof colorscale === "string") {
        var name = colorscale.charAt(0).toUpperCase() + colorscale.slice(1).toLowerCase();
        colors = COLOR_SCALES[name] || COLOR_SCALES.Viridis;
      } else {
        colors = COLOR_SCALES.Viridis;
      }
      if (reverse) {
        colors = colors.slice().reverse();
      }
      return colors;
    }
    function buildColorScale(levels, colors) {
      var scale = [];
      var min = levels[0];
      var max = levels[levels.length - 1];
      for (var i = 0; i < levels.length; i++) {
        var t = levels.length > 1 ? i / (levels.length - 1) : 0;
        var colorIdx = Math.floor(t * (colors.length - 1));
        colorIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));
        scale.push([levels[i], colors[colorIdx]]);
      }
      return scale;
    }
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
      ctx.fillStyle = config.fill || "#ffffff";
      ctx.strokeStyle = config.stroke || "#cccccc";
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
    function drawColorbar(ctx, result, colors, config, canvasWidth, canvasHeight) {
      config = config || {};
      var thickness = config.thickness || 20;
      var len = config.len || 0.8;
      var barHeight = canvasHeight * len;
      var x = canvasWidth - thickness - 10;
      var y = (canvasHeight - barHeight) / 2;
      for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var colorIdx = Math.floor(t * (colors.length - 1));
        colorIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));
        ctx.fillStyle = colors[colorIdx];
        ctx.fillRect(x, y + i, thickness, 1);
      }
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, thickness, barHeight);
      if (config.title) {
        ctx.fillStyle = "#000";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.save();
        ctx.translate(x + thickness / 2, y - 10);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(config.title, 0, 0);
        ctx.restore();
      }
      ctx.fillStyle = "#666";
      ctx.font = "10px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
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
    module.exports = {
      render,
      drawTo,
      COLOR_SCALES
    };
  }
});

// geojson.js
var require_geojson = __commonJS({
  "geojson.js"(exports, module) {
    "use strict";
    function toGeoJSON(result, options) {
      if (!result || !result.paths) {
        throw new Error("Invalid contour result: missing paths");
      }
      options = options || {};
      var type = options.type || "lines";
      var propertyName = options.propertyName || "value";
      var includeEdgePaths = options.includeEdgePaths !== false;
      var separateFeatures = options.separateFeatures || false;
      var bounds = options.bounds;
      var features = [];
      for (var i = 0; i < result.paths.length; i++) {
        var pathInfo = result.paths[i];
        var level = result.levels[i];
        if (pathInfo.paths) {
          for (var j = 0; j < pathInfo.paths.length; j++) {
            var path = pathInfo.paths[j];
            var coords = convertPathCoordinates(path, options);
            if (coords.length < 2) continue;
            if (bounds && !isPathInBounds(coords, bounds)) {
              continue;
            }
            if (type === "fill") {
              features.push({
                type: "Feature",
                properties: createProperties(level, propertyName, "polygon", i, j, true),
                geometry: {
                  type: "Polygon",
                  coordinates: [coords]
                }
              });
            } else {
              features.push({
                type: "Feature",
                properties: createProperties(level, propertyName, "linestring", i, j, true),
                geometry: {
                  type: "LineString",
                  coordinates: coords
                }
              });
            }
          }
        }
        if (includeEdgePaths && pathInfo.edgepaths) {
          for (var k = 0; k < pathInfo.edgepaths.length; k++) {
            var edgePath = pathInfo.edgepaths[k];
            var edgeCoords = convertPathCoordinates(edgePath, options);
            if (edgeCoords.length < 2) continue;
            if (bounds && !isPathInBounds(edgeCoords, bounds)) {
              continue;
            }
            if (type === "fill") {
              continue;
            } else {
              features.push({
                type: "Feature",
                properties: createProperties(level, propertyName, "linestring_edge", i, k, false),
                geometry: {
                  type: "LineString",
                  coordinates: edgeCoords
                }
              });
            }
          }
        }
      }
      if (!separateFeatures && type === "fill") {
        features = groupFeaturesByLevel(features, propertyName);
      }
      return {
        type: "FeatureCollection",
        features
      };
    }
    function toFilledGeoJSON(result, options) {
      if (!result || !result.paths) {
        throw new Error("Invalid contour result: missing paths");
      }
      options = options || {};
      var propertyName = options.propertyName || "value";
      var clip = options.clip || false;
      var features = [];
      var levels = result.levels;
      var paths = result.paths;
      var dataBounds = getDataBounds(result);
      if (!dataBounds) {
        dataBounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
      }
      var perimeter = createPerimeter(dataBounds);
      var numLevels = clip ? paths.length - 1 : paths.length;
      for (var i = 0; i < numLevels; i++) {
        var pathInfo = paths[i];
        var level = levels[i];
        var currentBoundary = buildLevelBoundary(pathInfo, perimeter, dataBounds, options);
        var nextBoundary = null;
        if (i + 1 < paths.length) {
          var nextPathInfo = paths[i + 1];
          nextBoundary = buildLevelBoundary(nextPathInfo, perimeter, dataBounds, options);
        }
        var polygons = buildClippedPolygons(currentBoundary, nextBoundary, perimeter);
        for (var j = 0; j < polygons.length; j++) {
          var poly = polygons[j];
          var hasHoles = poly.length > 1;
          var value = level;
          if (clip && i + 1 < levels.length) {
            value = (level + levels[i + 1]) / 2;
          }
          features.push({
            type: "Feature",
            properties: {
              value,
              level,
              levelIndex: i,
              minValue: level,
              maxValue: clip ? levels[i + 1] || level : level,
              type: "filled_contour",
              hasHoles,
              polygonIndex: j,
              clipped: clip
            },
            geometry: {
              type: "Polygon",
              coordinates: poly
            }
          });
        }
      }
      return {
        type: "FeatureCollection",
        features
      };
    }
    function buildLevelBoundary(pathInfo, perimeter, bounds, options) {
      var boundaries = [];
      var edgepaths = pathInfo.edgepaths || [];
      var closedPaths = pathInfo.paths || [];
      function isTop(pt) {
        return Math.abs(pt[1] - perimeter[0][1]) < 0.1;
      }
      function isBottom(pt) {
        return Math.abs(pt[1] - perimeter[2][1]) < 0.1;
      }
      function isLeft(pt) {
        return Math.abs(pt[0] - perimeter[0][0]) < 0.1;
      }
      function isRight(pt) {
        return Math.abs(pt[0] - perimeter[2][0]) < 0.1;
      }
      var startIndices = [];
      for (var i = 0; i < edgepaths.length; i++) {
        if (edgepaths[i] && edgepaths[i].length > 0) {
          startIndices.push(i);
        }
      }
      var currentBoundary = null;
      if (pathInfo.prefixBoundary) {
        currentBoundary = [
          [perimeter[0][0], perimeter[0][1]],
          [perimeter[1][0], perimeter[1][1]],
          [perimeter[2][0], perimeter[2][1]],
          [perimeter[3][0], perimeter[3][1]],
          [perimeter[0][0], perimeter[0][1]]
          // Close the perimeter
        ];
      }
      while (startIndices.length > 0) {
        var edgePath = edgepaths[startIndices[0]];
        if (!edgePath || edgePath.length === 0) {
          startIndices.shift();
          continue;
        }
        var edgeCoords = convertPathCoordinates(edgePath, options);
        if (!currentBoundary) {
          currentBoundary = edgeCoords.slice();
        } else {
          var lastPt = currentBoundary[currentBoundary.length - 1];
          var firstEdgePt = edgeCoords[0];
          addBoundaryConnection(currentBoundary, lastPt, firstEdgePt, perimeter, isTop, isBottom, isLeft, isRight);
          currentBoundary = currentBoundary.concat(edgeCoords);
        }
        startIndices.shift();
        if (edgeCoords.length > 0) {
          var endPt = edgeCoords[edgeCoords.length - 1];
          var foundNext = false;
          for (var cnt = 0; cnt < 4 && !foundNext; cnt++) {
            var nextCorner = getNextCorner(endPt, perimeter, isTop, isBottom, isLeft, isRight);
            var nextStartIdx = -1;
            for (var j = 0; j < startIndices.length; j++) {
              var nextPath = edgepaths[startIndices[j]];
              if (!nextPath || nextPath.length === 0) continue;
              var nextCoords = convertPathCoordinates(nextPath, options);
              if (isOnEdgeSegment(nextCoords[0], endPt, nextCorner, isTop, isBottom, isLeft, isRight)) {
                nextStartIdx = startIndices[j];
                nextCorner = nextCoords[0];
                break;
              }
            }
            if (nextStartIdx >= 0) {
              currentBoundary.push([nextCorner[0], nextCorner[1]]);
              endPt = nextCorner;
              startIndices.splice(startIndices.indexOf(nextStartIdx), 1);
              foundNext = true;
            } else {
              currentBoundary.push([nextCorner[0], nextCorner[1]]);
              endPt = nextCorner;
            }
          }
        }
      }
      if (currentBoundary && currentBoundary.length > 2) {
        if (!pathInfo.prefixBoundary) {
          currentBoundary.push([currentBoundary[0][0], currentBoundary[0][1]]);
        }
        boundaries.push(currentBoundary);
      }
      for (var k = 0; k < closedPaths.length; k++) {
        if (!closedPaths[k] || closedPaths[k].length < 3) continue;
        var closedCoords = convertPathCoordinates(closedPaths[k], options);
        closedCoords.push([closedCoords[0][0], closedCoords[0][1]]);
        boundaries.push(closedCoords);
      }
      return boundaries;
    }
    function buildClippedPolygons(currentBoundary, nextBoundary, perimeter) {
      var polygons = [];
      if (!currentBoundary || currentBoundary.length === 0) {
        return polygons;
      }
      if (!nextBoundary || nextBoundary.length === 0) {
        for (var i = 0; i < currentBoundary.length; i++) {
          polygons.push([currentBoundary[i]]);
        }
        return polygons;
      }
      for (i = 0; i < currentBoundary.length; i++) {
        var exteriorRing = currentBoundary[i];
        var rings = [exteriorRing];
        for (var j = 0; j < nextBoundary.length; j++) {
          var innerRing = nextBoundary[j];
          if (innerRing.length > 0 && isPointInPolygon(innerRing[0], exteriorRing)) {
            rings.push(innerRing);
          }
        }
        polygons.push(rings);
      }
      return polygons;
    }
    function isPointInPolygon(point, polygon) {
      if (!polygon || polygon.length < 3) return false;
      var x = point[0];
      var y = point[1];
      var inside = false;
      for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        var xi = polygon[i][0];
        var yi = polygon[i][1];
        var xj = polygon[j][0];
        var yj = polygon[j][1];
        var intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }
    function getNextCorner(pt, perimeter, isTop, isBottom, isLeft, isRight) {
      if (isTop(pt) && !isRight(pt)) return perimeter[1];
      if (isLeft(pt)) return perimeter[0];
      if (isBottom(pt)) return perimeter[3];
      if (isRight(pt)) return perimeter[2];
      return perimeter[0];
    }
    function isOnEdgeSegment(pt, endPt, nextCorner, isTop, isBottom, isLeft, isRight) {
      if (Math.abs(pt[0] - endPt[0]) < 0.1 && Math.abs(pt[0] - nextCorner[0]) < 0.1) {
        var yMin = Math.min(endPt[1], nextCorner[1]);
        var yMax = Math.max(endPt[1], nextCorner[1]);
        return pt[1] >= yMin - 0.1 && pt[1] <= yMax + 0.1;
      }
      if (Math.abs(pt[1] - endPt[1]) < 0.1 && Math.abs(pt[1] - nextCorner[1]) < 0.1) {
        var xMin = Math.min(endPt[0], nextCorner[0]);
        var xMax = Math.max(endPt[0], nextCorner[0]);
        return pt[0] >= xMin - 0.1 && pt[0] <= xMax + 0.1;
      }
      return false;
    }
    function addBoundaryConnection(poly, fromPt, toPt, perimeter, isTop, isBottom, isLeft, isRight) {
      if (!fromPt || !toPt) return;
      var currentPt = fromPt;
      for (var cnt = 0; cnt < 4 && (Math.abs(currentPt[0] - toPt[0]) > 0.1 || Math.abs(currentPt[1] - toPt[1]) > 0.1); cnt++) {
        var nextCorner;
        if (isTop(currentPt) && !isRight(currentPt)) nextCorner = perimeter[1];
        else if (isLeft(currentPt)) nextCorner = perimeter[0];
        else if (isBottom(currentPt)) nextCorner = perimeter[3];
        else if (isRight(currentPt)) nextCorner = perimeter[2];
        else break;
        if (isOnEdgeSegment(toPt, currentPt, nextCorner, isTop, isBottom, isLeft, isRight)) {
          poly.push([toPt[0], toPt[1]]);
          return;
        }
        poly.push([nextCorner[0], nextCorner[1]]);
        currentPt = nextCorner;
      }
    }
    function createPerimeter(bounds) {
      return [
        [bounds.minX, bounds.minY],
        // bottom-left
        [bounds.maxX, bounds.minY],
        // bottom-right
        [bounds.maxX, bounds.maxY],
        // top-right
        [bounds.minX, bounds.maxY]
        // top-left
      ];
    }
    function getDataBounds(result) {
      if (!result.pathinfo || result.pathinfo.length === 0) {
        return null;
      }
      var pi = result.pathinfo[0];
      if (!pi.x || !pi.y) {
        return null;
      }
      var x = pi.x;
      var y = pi.y;
      return {
        minX: x[0],
        maxX: x[x.length - 1],
        minY: y[0],
        maxY: y[y.length - 1]
      };
    }
    function convertPathCoordinates(path, options) {
      var coords = [];
      for (var i = 0; i < path.length; i++) {
        var pt = path[i];
        if (Array.isArray(pt) && pt.length >= 2) {
          coords.push([pt[0], pt[1]]);
        }
      }
      return coords;
    }
    function createProperties(level, propertyName, geomType, levelIndex, pathIndex, isClosed) {
      var props = {};
      props[propertyName] = level;
      props.level = level;
      props.levelIndex = levelIndex;
      props.pathIndex = pathIndex;
      props.type = geomType;
      props.closed = isClosed;
      return props;
    }
    function isPathInBounds(coords, bounds) {
      var minX = bounds[0], minY = bounds[1], maxX = bounds[2], maxY = bounds[3];
      for (var i = 0; i < coords.length; i++) {
        var x = coords[i][0];
        var y = coords[i][1];
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          return true;
        }
      }
      return false;
    }
    function groupFeaturesByLevel(features, propertyName) {
      var grouped = {};
      for (var i = 0; i < features.length; i++) {
        var feat = features[i];
        var level = feat.properties[propertyName];
        var key = String(level);
        if (!grouped[key]) {
          grouped[key] = {
            properties: feat.properties,
            geometries: []
          };
        }
        grouped[key].geometries.push(feat.geometry);
      }
      var result = [];
      for (var key in grouped) {
        var group = grouped[key];
        var geomType = group.geometries[0].type;
        if (geomType === "LineString") {
          result.push({
            type: "Feature",
            properties: group.properties,
            geometry: {
              type: "MultiLineString",
              coordinates: group.geometries.map(function(g) {
                return g.coordinates;
              })
            }
          });
        } else if (geomType === "Polygon") {
          result.push({
            type: "Feature",
            properties: group.properties,
            geometry: {
              type: "MultiPolygon",
              coordinates: group.geometries.map(function(g) {
                return g.coordinates;
              })
            }
          });
        }
      }
      return result;
    }
    function stringify(result, options) {
      var geojson = toGeoJSON(result, options);
      return JSON.stringify(geojson, null, options && options.indent || 2);
    }
    module.exports = {
      toGeoJSON,
      stringify,
      toFilledGeoJSON
    };
  }
});

// renderers/svg/paths.js
var require_paths2 = __commonJS({
  "renderers/svg/paths.js"(exports, module) {
    "use strict";
    function pathToSVG(path, isClosed) {
      if (!path || path.length === 0) return "";
      var d = "M " + path[0][0] + " " + path[0][1];
      for (var i = 1; i < path.length; i++) {
        d += " L " + path[i][0] + " " + path[i][1];
      }
      if (isClosed) {
        d += " Z";
      }
      return d;
    }
    function svgPathElement(d, attrs) {
      attrs = attrs || {};
      var parts = [];
      for (var key in attrs) {
        parts.push(key + '="' + attrs[key] + '"');
      }
      return '<path d="' + d + '" ' + parts.join(" ") + " />";
    }
    function createPerimeter(options) {
      var width = options.width || 500;
      var height = options.height || 400;
      var padding = options.padding || 30;
      var xMin = padding;
      var xMax = width - padding;
      var yMin = padding;
      var yMax = height - padding;
      return [
        [xMin, yMin],
        // 0: top-left
        [xMax, yMin],
        // 1: top-right
        [xMax, yMax],
        // 2: bottom-right
        [xMin, yMax]
        // 3: bottom-left
      ];
    }
    function scalePath(path, options) {
      var pathinfo = options.pathinfo || options.paths;
      var m = 10, n = 10;
      if (pathinfo && pathinfo[0] && pathinfo[0].z) {
        m = pathinfo[0].z.length;
        n = pathinfo[0].z[0].length;
      }
      var width = options.width || 500;
      var height = options.height || 400;
      var padding = options.padding || 30;
      var scaleX = (width - 2 * padding) / (n - 1);
      var scaleY = (height - 2 * padding) / (m - 1);
      return path.map(function(pt) {
        return [
          padding + pt[0] * scaleX,
          padding + (m - 1 - pt[1]) * scaleY
        ];
      });
    }
    function getColorForLevel(level, levels, options) {
      var colorscale = options.colorscale || "Viridis";
      var colors = Array.isArray(colorscale) ? colorscale : require_colors().COLOR_SCALES[colorscale] || require_colors().COLOR_SCALES.Viridis;
      var min = levels[0];
      var max = levels[levels.length - 1];
      var t = (level - min) / (max - min);
      var idx = Math.floor(t * (colors.length - 1));
      idx = Math.max(0, Math.min(colors.length - 1, idx));
      return colors[idx];
    }
    function joinAllPaths(pathInfo, perimeter, options) {
      var fullpath = "";
      var edgepaths = pathInfo.edgepaths;
      if (edgepaths.length === 0 && pathInfo.paths.length === 0) {
        return "";
      }
      var i = 0;
      var startsleft = edgepaths.map(function(v, i2) {
        return i2;
      });
      var newloop = true;
      var endpt;
      var newendpt;
      var cnt;
      var nexti;
      var possiblei;
      var addpath;
      function istop(pt) {
        return Math.abs(pt[1] - perimeter[0][1]) < 0.1;
      }
      function isbottom(pt) {
        return Math.abs(pt[1] - perimeter[2][1]) < 0.1;
      }
      function isleft(pt) {
        return Math.abs(pt[0] - perimeter[0][0]) < 0.1;
      }
      function isright(pt) {
        return Math.abs(pt[0] - perimeter[2][0]) < 0.1;
      }
      while (startsleft.length > 0) {
        var scaledPath = scalePath(edgepaths[i], options);
        addpath = pathToSVG(scaledPath, false);
        fullpath += newloop ? addpath : addpath.replace(/^M/, "L");
        startsleft.splice(startsleft.indexOf(i), 1);
        endpt = scaledPath[scaledPath.length - 1];
        nexti = -1;
        for (cnt = 0; cnt < 4; cnt++) {
          if (!endpt) break;
          if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1];
          else if (isleft(endpt)) newendpt = perimeter[0];
          else if (isbottom(endpt)) newendpt = perimeter[3];
          else if (isright(endpt)) newendpt = perimeter[2];
          for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
            var ptNew = scalePath(edgepaths[possiblei], options)[0];
            if (Math.abs(endpt[0] - newendpt[0]) < 0.1) {
              if (Math.abs(endpt[0] - ptNew[0]) < 0.1 && (ptNew[1] - endpt[1]) * (newendpt[1] - ptNew[1]) >= 0) {
                newendpt = ptNew;
                nexti = possiblei;
              }
            } else if (Math.abs(endpt[1] - newendpt[1]) < 0.1) {
              if (Math.abs(endpt[1] - ptNew[1]) < 0.1 && (ptNew[0] - endpt[0]) * (newendpt[0] - ptNew[0]) >= 0) {
                newendpt = ptNew;
                nexti = possiblei;
              }
            }
          }
          endpt = newendpt;
          if (nexti >= 0) break;
          fullpath += "L" + newendpt[0] + " " + newendpt[1];
        }
        if (nexti === edgepaths.length || nexti < 0) break;
        i = nexti;
        newloop = startsleft.indexOf(i) === -1;
        if (newloop) {
          if (startsleft.length > 0) {
            i = startsleft[0];
          }
          fullpath += "Z";
        }
      }
      for (i = 0; i < pathInfo.paths.length; i++) {
        var scaledPath = scalePath(pathInfo.paths[i], options);
        fullpath += pathToSVG(scaledPath, true);
      }
      return fullpath;
    }
    function createFilledPaths(contourResult, options) {
      options = options || {};
      options.pathinfo = contourResult.pathinfo;
      var paths = contourResult.paths;
      var levels = contourResult.levels;
      var width = options.width || 500;
      var height = options.height || 400;
      var perimeter = createPerimeter(options);
      var svgParts = [];
      if (paths.length > 0) {
        var bgColor = getColorForLevel(levels[0], levels, options);
        var xMin = perimeter[0][0];
        var yMin = perimeter[0][1];
        var bgWidth = perimeter[1][0] - perimeter[0][0];
        var bgHeight = perimeter[2][1] - perimeter[0][1];
        svgParts.push('<rect x="' + xMin + '" y="' + yMin + '" width="' + bgWidth + '" height="' + bgHeight + '" fill="' + bgColor + '" stroke="none" />');
      }
      for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        var color = getColorForLevel(pathInfo.level, levels, options);
        var boundaryPath = "M" + perimeter.join("L") + "Z";
        var joinedPaths = joinAllPaths(pathInfo, perimeter, options);
        var fullpath = "";
        if (pathInfo.prefixBoundary) {
          fullpath = boundaryPath + joinedPaths;
        } else {
          fullpath = joinedPaths;
        }
        if (fullpath) {
          svgParts.push(svgPathElement(fullpath, {
            fill: color,
            "fill-rule": "evenodd",
            stroke: "none",
            "stroke-width": 0
          }));
        }
      }
      return svgParts.join("\n");
    }
    function createStrokePaths(contourResult, options) {
      options = options || {};
      options.pathinfo = contourResult.pathinfo;
      var paths = contourResult.paths;
      var lineColor = options.lineColor || "#333";
      var lineWidth = options.lineWidth || 1.5;
      var svgParts = [];
      for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        for (var j = 0; j < pathInfo.paths.length; j++) {
          var path = pathInfo.paths[j];
          var scaled = scalePath(path, options);
          var d = pathToSVG(scaled, true);
          svgParts.push(svgPathElement(d, {
            fill: "none",
            stroke: lineColor,
            "stroke-width": lineWidth,
            "stroke-linejoin": "round",
            "stroke-linecap": "round"
          }));
        }
        for (j = 0; j < pathInfo.edgepaths.length; j++) {
          var path = pathInfo.edgepaths[j];
          var scaled = scalePath(path, options);
          var d = pathToSVG(scaled, false);
          svgParts.push(svgPathElement(d, {
            fill: "none",
            stroke: lineColor,
            "stroke-width": lineWidth,
            "stroke-linejoin": "round",
            "stroke-linecap": "round"
          }));
        }
      }
      return svgParts.join("\n");
    }
    module.exports = {
      createFilledPaths,
      createStrokePaths,
      pathToSVG,
      svgPathElement
    };
  }
});

// renderers/svg/labels.js
var require_labels3 = __commonJS({
  "renderers/svg/labels.js"(exports, module) {
    "use strict";
    var labels = require_labels();
    var findBestTextLocation = labels.findBestTextLocation;
    var formatContourLabel = labels.formatContourLabel;
    var calculateMaxLabels = labels.calculateMaxLabels;
    var pathLength = labels.pathLength;
    var isPathClosed = labels.isPathClosed;
    function createLabels(contourResult, options) {
      options = options || {};
      var paths = contourResult.paths;
      var labelFont = options.labelFont || "Arial";
      var labelSize = options.labelSize || 12;
      var labelColor = options.labelColor || "#000";
      if (!paths || !paths.length) return "";
      var svgParts = [];
      var m = 10, n = 10;
      var pathinfo = contourResult.pathinfo || contourResult.paths;
      if (pathinfo && pathinfo[0] && pathinfo[0].z) {
        m = pathinfo[0].z.length;
        n = pathinfo[0].z[0].length;
      }
      var plotBounds = {
        left: 0,
        right: n - 1,
        top: 0,
        bottom: m - 1,
        center: (n - 1) / 2,
        middle: (m - 1) / 2
      };
      var width = options.width || 500;
      var height = options.height || 400;
      var padding = options.padding || 30;
      var scaleX = (width - 2 * padding) / (n - 1);
      var scaleY = (height - 2 * padding) / (m - 1);
      var plotDiagonal = Math.sqrt((n - 1) * (n - 1) + (m - 1) * (m - 1));
      var existingLabels = [];
      for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        for (var j = 0; j < pathInfo.paths.length; j++) {
          var path = pathInfo.paths[j];
          if (path.length < 3) continue;
          var labelText = formatContourLabel(pathInfo.level, ".1f");
          var textWidth = labelText.length * labelSize * 0.6;
          var textWidthGrid = textWidth / scaleX;
          var textHeightGrid = labelSize / scaleY;
          var len = pathLength(path);
          var maxLabels = calculateMaxLabels(
            len,
            textWidthGrid,
            textHeightGrid,
            paths.length,
            plotDiagonal
          );
          if (maxLabels === 0) continue;
          var closed = isPathClosed(path);
          var usedPositions = [];
          for (var k = 0; k < maxLabels; k++) {
            var labelPos = findBestTextLocation(
              path,
              {
                level: pathInfo.level,
                width: textWidthGrid,
                height: textHeightGrid
              },
              existingLabels,
              plotBounds,
              closed
            );
            if (!labelPos) break;
            var tooClose = false;
            for (var u = 0; u < usedPositions.length; u++) {
              var dx = labelPos.x - usedPositions[u].x;
              var dy = labelPos.y - usedPositions[u].y;
              var dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < textWidthGrid * 2) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) break;
            var scaled = {
              x: padding + labelPos.x * scaleX,
              y: padding + (m - 1 - labelPos.y) * scaleY
            };
            var transform = "translate(" + scaled.x + " " + scaled.y + ") rotate(" + (labelPos.theta || 0) * 180 / Math.PI + ")";
            svgParts.push(
              '<text x="0" y="0" transform="' + transform + '" font-family="' + labelFont + '" font-size="' + labelSize + '" fill="' + labelColor + '" text-anchor="middle" dominant-baseline="middle">' + labelText + "</text>"
            );
            existingLabels.push({
              x: labelPos.x,
              y: labelPos.y,
              theta: labelPos.theta || 0,
              level: pathInfo.level,
              width: textWidthGrid,
              height: textHeightGrid
            });
            usedPositions.push(labelPos);
          }
        }
      }
      return svgParts.join("\n");
    }
    module.exports = {
      createLabels
    };
  }
});

// renderers/svg/colorbar.js
var require_colorbar3 = __commonJS({
  "renderers/svg/colorbar.js"(exports, module) {
    "use strict";
    var computeTicks = require_colorbar().computeTicks;
    function createColorbar(contourResult, options) {
      options = options || {};
      var levels = contourResult.levels;
      if (!levels || levels.length === 0) return "";
      var width = options.width || 500;
      var height = options.height || 400;
      var thickness = options.colorbarThickness || 20;
      var len = options.colorbarLen || 0.8;
      var barHeight = height * len;
      var x = width - thickness - 10;
      var y = (height - barHeight) / 2;
      var colorscale = options.colorscale || "Viridis";
      var zmin = options.zmin !== void 0 ? options.zmin : levels[0];
      var zmax = options.zmax !== void 0 ? options.zmax : levels[levels.length - 1];
      var svgParts = [];
      var gradientId = "colorbar-gradient-" + Date.now();
      var gradientStops = [];
      for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var value = zmin + t * (zmax - zmin);
        var color = mapColors(value, zmin, zmax, colorscale, options.reversescale);
        gradientStops.push('<stop offset="' + (i / barHeight * 100).toFixed(1) + '%" stop-color="' + color + '" />');
      }
      svgParts.push(
        '<defs><linearGradient id="' + gradientId + '" x1="0%" y1="100%" x2="0%" y2="0%">' + gradientStops.join("") + "</linearGradient></defs>"
      );
      svgParts.push(
        '<rect x="' + x + '" y="' + y + '" width="' + thickness + '" height="' + barHeight + '" fill="url(#' + gradientId + ')" stroke="#666" stroke-width="1" />'
      );
      if (options.colorbarTitle) {
        svgParts.push(
          '<text x="' + (x + thickness / 2) + '" y="' + (y - 10) + '" font-family="Arial" font-size="12" fill="#000" text-anchor="middle" transform="rotate(-90, ' + (x + thickness / 2) + ", " + (y - 10) + ')">' + options.colorbarTitle + "</text>"
        );
      }
      var tickCount = Math.min(5, levels.length);
      for (i = 0; i < tickCount; i++) {
        var idx = Math.floor(i * (levels.length - 1) / (tickCount - 1));
        var level = levels[idx];
        var t = (level - levels[0]) / (levels[levels.length - 1] - levels[0]);
        var tickY = y + barHeight * (1 - t);
        svgParts.push(
          '<text x="' + (x + thickness + 5) + '" y="' + tickY + '" font-family="Arial" font-size="10" fill="#666" text-anchor="start" dominant-baseline="middle">' + level.toFixed(1) + "</text>"
        );
      }
      return svgParts.join("\n");
    }
    function mapColors(value, min, max, colorscale, reverse) {
      var colors = require_colors().COLOR_SCALES;
      var colorArray = Array.isArray(colorscale) ? colorscale : colors[colorscale] || colors.Viridis;
      if (reverse) {
        colorArray = colorArray.slice().reverse();
      }
      var t = Math.max(0, Math.min(1, (value - min) / (max - min)));
      var idx = Math.floor(t * (colorArray.length - 1));
      return colorArray[Math.max(0, Math.min(colorArray.length - 1, idx))];
    }
    module.exports = {
      createColorbar
    };
  }
});

// renderers/svg/nulls.js
var require_nulls2 = __commonJS({
  "renderers/svg/nulls.js"(exports, module) {
    "use strict";
    function createNullRegions(contourResult, options) {
      var nullMask = contourResult.nullMask;
      if (!nullMask) return "";
      options = options || {};
      var nullRegion = options.nullRegion || {};
      var visible = nullRegion.visible !== false;
      if (!visible) return "";
      var m = nullMask.length;
      var n = nullMask[0].length;
      var width = options.width || 500;
      var height = options.height || 400;
      var padding = options.padding || 30;
      var scaleX = (width - 2 * padding) / (n - 1);
      var scaleY = (height - 2 * padding) / (m - 1);
      var fill = nullRegion.fill || "#ffffff";
      var stroke = nullRegion.stroke || "#cccccc";
      var strokeWidth = nullRegion.strokeWidth !== void 0 ? nullRegion.strokeWidth : 1;
      var svgParts = [];
      for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
          if (nullMask[i][j]) {
            var x = padding + j * scaleX;
            var y = padding + (m - 1 - i) * scaleY;
            var sizeX = scaleX + 1;
            var sizeY = scaleY + 1;
            svgParts.push(
              '<rect x="' + (x - sizeX / 2) + '" y="' + (y - sizeY / 2) + '" width="' + sizeX + '" height="' + sizeY + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + strokeWidth + '" />'
            );
          }
        }
      }
      return svgParts.join("\n");
    }
    module.exports = {
      createNullRegions
    };
  }
});

// renderers/svg/index.js
var require_svg = __commonJS({
  "renderers/svg/index.js"(exports, module) {
    "use strict";
    var createPaths = require_paths2();
    var createLabels = require_labels3();
    var createColorbar = require_colorbar3();
    var createNulls = require_nulls2();
    var nullHandling = require_null_handling();
    function renderSVG(contourResult, options) {
      options = options || {};
      var width = options.width || 500;
      var height = options.height || 400;
      var coloring = options.coloring || "fill";
      var showLines = options.showLines !== false;
      var useClipMask = options.useClipMask !== false;
      var svgParts = [];
      var clipId = "clip" + Date.now() + Math.floor(Math.random() * 1e4);
      svgParts.push(
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + " " + height + '">'
      );
      var connectGaps = contourResult.connectgaps !== void 0 ? contourResult.connectgaps : true;
      var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;
      if (needsClip && useClipMask) {
        var clipPathData = nullHandling.generateClipPath(contourResult, options);
        if (clipPathData) {
          svgParts.push(
            '<defs><clipPath id="' + clipId + '"><path d="' + clipPathData + '" fill="none" stroke="none"/></clipPath></defs>'
          );
        }
      }
      if (needsClip && useClipMask) {
        svgParts.push('<g clip-path="url(#' + clipId + ')">');
      }
      if (coloring === "fill" || coloring === "heatmap") {
        svgParts.push(createPaths.createFilledPaths(contourResult, options));
      }
      if (showLines && coloring !== "heatmap") {
        svgParts.push(createPaths.createStrokePaths(contourResult, options));
      }
      if (needsClip && useClipMask) {
        svgParts.push("</g>");
      }
      if (options.showLabels) {
        svgParts.push(createLabels.createLabels(contourResult, options));
      }
      if (options.colorbar !== false && coloring !== "lines") {
        svgParts.push(createColorbar.createColorbar(contourResult, options));
      }
      if (needsClip && !useClipMask) {
        svgParts.push(createNulls.createNullRegions(contourResult, options));
      }
      svgParts.push("</svg>");
      return svgParts.join("\n");
    }
    function toSVG(contourResult, options) {
      return renderSVG(contourResult, options);
    }
    module.exports = {
      renderSVG,
      toSVG,
      createPaths,
      createFilledPaths: createPaths.createFilledPaths,
      createStrokePaths: createPaths.createStrokePaths,
      createLabels,
      createColorbar,
      createNulls
    };
  }
});

// renderers/index.js
var require_renderers = __commonJS({
  "renderers/index.js"(exports, module) {
    "use strict";
    module.exports = {
      canvas: require_canvas(),
      svg: require_svg()
    };
  }
});

// index.js
var require_index = __commonJS({
  "index.js"(exports, module) {
    var api = require_api();
    var contourCore = {
      // ============================================
      // Core computation
      // ============================================
      computeContours: require_compute().computeContours,
      scalePathsToData: require_compute().scalePathsToData,
      // ============================================
      // Simplified rendering API (NEW in v0.2.0)
      // ============================================
      render: api.render,
      drawTo: api.drawTo,
      // ============================================
      // GeoJSON export (NEW)
      // ============================================
      toGeoJSON: require_geojson().toGeoJSON,
      toFilledGeoJSON: require_geojson().toFilledGeoJSON,
      geojsonStringify: require_geojson().stringify,
      // ============================================
      // Low-level modules
      // ============================================
      marchingSquares: require_marchingsquares(),
      pathFinding: require_pathfinding(),
      levels: require_levels(),
      smooth: require_smooth(),
      constants: require_constants(),
      // ============================================
      // Feature modules
      // ============================================
      nullHandling: require_null_handling(),
      labels: require_labels(),
      colorbar: require_colorbar(),
      renderers: require_renderers(),
      axes: require_axes(),
      // ============================================
      // Utilities
      // ============================================
      COLOR_SCALES: api.COLOR_SCALES
    };
    if (typeof module !== "undefined" && module.exports) {
      module.exports = contourCore;
    }
    if (typeof window !== "undefined") {
      window.contourCore = contourCore;
      window.contour = contourCore;
    }
  }
});
export default require_index();
