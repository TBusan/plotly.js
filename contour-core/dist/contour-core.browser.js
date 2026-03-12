"use strict";
var contourCore = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined")
      return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
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
          var flatVals = [];
          for (var rowIdx = 0; rowIdx < vals.length; rowIdx++) {
            var row = vals[rowIdx];
            if (row) {
              for (var colIdx = 0; colIdx < row.length; colIdx++) {
                var v = row[colIdx];
                if (typeof v === "number" && !isNaN(v) && isFinite(v)) {
                  flatVals.push(v);
                }
              }
            }
          }
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
          if (yi === 0)
            ystartIndices = ystartIndices.concat(constants.BOTTOMSTART);
          if (yi === m - 2)
            ystartIndices = ystartIndices.concat(constants.TOPSTART);
          for (xi = 0; xi < n - 1; xi++) {
            startIndices = ystartIndices.slice();
            if (xi === 0)
              startIndices = startIndices.concat(constants.LEFTSTART);
            if (xi === n - 2)
              startIndices = startIndices.concat(constants.RIGHTSTART);
            corners = [
              [z[yi][xi], z[yi][xi + 1]],
              [z[yi + 1][xi], z[yi + 1][xi + 1]]
            ];
            label = xi + "," + yi;
            for (i = 0; i < pathinfo.length; i++) {
              pi = pathinfo[i];
              mi = getMarchingIndex(pi.level, corners);
              if (!mi)
                continue;
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
          if (val > avg)
            return mi === 5 ? 713 : 1114;
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
          if (closedLoop || edgeflag && atEdge)
            break;
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
        if (simplifiedPts.length < 2)
          return;
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
        if (alldists.length === 0)
          return pts;
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
              } else
                break;
            }
            if (closedpath && cnt === pts.length - 2) {
              for (cnt3 = 0; cnt3 < cnt2; cnt3++) {
                if (distgroup + alldists[cnt3] < distThreshold) {
                  distgroup += alldists[cnt3];
                } else
                  break;
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
            if (cnt3)
              cropstart = cnt3;
            if (closedpath) {
              if (cnt === pts.length - 2)
                pts[cnt3] = pts[pts.length - 1];
              else if (cnt === 0)
                pts[pts.length - 1] = pts[0];
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
                  if (j > i)
                    j--;
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
          if (merged)
            break;
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
          if (!isFinite(dx))
            dx = 0.5;
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
          if (!isFinite(dy))
            dy = 0.5;
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
                if (i === 0)
                  neighborCount++;
                if (j === 0)
                  neighborCount++;
                if (i === z.length - 1)
                  neighborCount++;
                if (row && j === row.length - 1)
                  neighborCount++;
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
          if (emptyPoints[i][2] < 4)
            break;
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
            if (!neighborRow)
              continue;
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
            if (neighborCount < 4)
              maxFractionalChange = 1;
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
            var na = pi0.x.length;
            var nb = pi0.y.length;
            var boundaryMin = Infinity;
            for (i = 0; i < nb; i++) {
              if (z[i][0] !== null && z[i][0] < boundaryMin)
                boundaryMin = z[i][0];
              if (z[i][na - 1] !== null && z[i][na - 1] < boundaryMin)
                boundaryMin = z[i][na - 1];
            }
            for (i = 1; i < na - 1; i++) {
              if (z[0][i] !== null && z[0][i] < boundaryMin)
                boundaryMin = z[0][i];
              if (z[nb - 1][i] !== null && z[nb - 1][i] < boundaryMin)
                boundaryMin = z[nb - 1][i];
            }
            if (boundaryMin === Infinity) {
              boundaryMin = Math.min(z[0][0] || Infinity, z[0][1] || Infinity);
            }
            for (i = 0; i < pathinfo.length; i++) {
              var pi = pathinfo[i];
              pi.prefixBoundary = !pi.edgepaths.length && (boundaryMin > pi.level || pi.starts.length && boundaryMin === pi.level);
            }
            break;
          case "constraint":
            pi0.prefixBoundary = false;
            if (pi0.edgepaths.length)
              return;
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
      var DEFAULT_UPSAMPLE_SCALE = 2;
      var DEFAULT_CLIP_LEVEL = 0.95;
      var DEFAULT_SMOOTHING = 0.3;
      var DEFAULT_SIMPLIFY_TOLERANCE = 0.5;
      function perpendicularDistance(point, lineStart, lineEnd) {
        var dx = lineEnd[0] - lineStart[0];
        var dy = lineEnd[1] - lineStart[1];
        var lineLengthSquared = dx * dx + dy * dy;
        if (lineLengthSquared === 0) {
          var ddx = point[0] - lineStart[0];
          var ddy = point[1] - lineStart[1];
          return Math.sqrt(ddx * ddx + ddy * ddy);
        }
        var t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lineLengthSquared;
        t = Math.max(0, Math.min(1, t));
        var closestX = lineStart[0] + t * dx;
        var closestY = lineStart[1] + t * dy;
        var distX = point[0] - closestX;
        var distY = point[1] - closestY;
        return Math.sqrt(distX * distX + distY * distY);
      }
      function simplifyPathDouglasPeucker(points, tolerance) {
        if (!points || points.length <= 2)
          return points;
        var maxDistance = 0;
        var maxIndex = 0;
        var first = points[0];
        var last = points[points.length - 1];
        for (var i = 1; i < points.length - 1; i++) {
          var distance = perpendicularDistance(points[i], first, last);
          if (distance > maxDistance) {
            maxDistance = distance;
            maxIndex = i;
          }
        }
        if (maxDistance > tolerance) {
          var left = simplifyPathDouglasPeucker(points.slice(0, maxIndex + 1), tolerance);
          var right = simplifyPathDouglasPeucker(points.slice(maxIndex), tolerance);
          return left.slice(0, -1).concat(right);
        } else {
          return [first, last];
        }
      }
      var DEFAULT_SIMPLIFY_TOLERANCE = 0.5;
      function perpendicularDistance(point, lineStart, lineEnd) {
        var dx = lineEnd[0] - lineStart[0];
        var dy = lineEnd[1] - lineStart[1];
        var lineLengthSquared = dx * dx + dy * dy;
        if (lineLengthSquared === 0) {
          return Math.sqrt(
            (point[0] - lineStart[0]) * (point[0] - lineStart[0]) + (point[1] - lineStart[1]) * (point[1] - lineStart[1])
          );
        }
        var t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lineLengthSquared;
        t = Math.max(0, Math.min(1, t));
        var nearestX = lineStart[0] + t * dx;
        var nearestY = lineStart[1] + t * dy;
        return Math.sqrt(
          (point[0] - nearestX) * (point[0] - nearestX) + (point[1] - nearestY) * (point[1] - nearestY)
        );
      }
      function simplifyPathDouglasPeucker(points, tolerance) {
        if (!points || points.length <= 2)
          return points;
        tolerance = tolerance || DEFAULT_SIMPLIFY_TOLERANCE;
        if (tolerance <= 0)
          return points;
        var maxDistance = 0;
        var maxIndex = 0;
        var first = points[0];
        var last = points[points.length - 1];
        for (var i = 1; i < points.length - 1; i++) {
          var distance = perpendicularDistance(points[i], first, last);
          if (distance > maxDistance) {
            maxDistance = distance;
            maxIndex = i;
          }
        }
        if (maxDistance > tolerance) {
          var left = simplifyPathDouglasPeucker(points.slice(0, maxIndex + 1), tolerance);
          var right = simplifyPathDouglasPeucker(points.slice(maxIndex), tolerance);
          return left.slice(0, -1).concat(right);
        }
        return [first, last];
      }
      function simplifyPathInfoPaths(pathInfo, tolerance) {
        if (tolerance <= 0)
          return;
        if (pathInfo.edgepaths && pathInfo.edgepaths.length > 0) {
          for (var i = 0; i < pathInfo.edgepaths.length; i++) {
            if (pathInfo.edgepaths[i] && pathInfo.edgepaths[i].length > 2) {
              pathInfo.edgepaths[i] = simplifyPathDouglasPeucker(pathInfo.edgepaths[i], tolerance);
            }
          }
        }
        if (pathInfo.paths && pathInfo.paths.length > 0) {
          for (var i = 0; i < pathInfo.paths.length; i++) {
            if (pathInfo.paths[i] && pathInfo.paths[i].length > 2) {
              pathInfo.paths[i] = simplifyPathDouglasPeucker(pathInfo.paths[i], tolerance);
            }
          }
        }
      }
      function makeBinaryMask(nullMask) {
        if (!nullMask)
          return null;
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
      function bilinearInterpolate(mask, x, y) {
        var m = mask.length;
        var n = mask[0].length;
        var x0 = Math.max(0, Math.min(Math.floor(x), n - 1));
        var y0 = Math.max(0, Math.min(Math.floor(y), m - 1));
        var x1 = Math.min(x0 + 1, n - 1);
        var y1 = Math.min(y0 + 1, m - 1);
        if (x0 === x1 && y0 === y1)
          return mask[y0][x0];
        if (x0 === x1) {
          var t = y - y0;
          return mask[y0][x0] * (1 - t) + mask[y1][x0] * t;
        }
        if (y0 === y1) {
          var t = x - x0;
          return mask[y0][x0] * (1 - t) + mask[y0][x1] * t;
        }
        var tx = x - x0;
        var ty = y - y0;
        var v00 = mask[y0][x0];
        var v10 = mask[y0][x1];
        var v01 = mask[y1][x0];
        var v11 = mask[y1][x1];
        var v0 = v00 * (1 - tx) + v10 * tx;
        var v1 = v01 * (1 - tx) + v11 * tx;
        return v0 * (1 - ty) + v1 * ty;
      }
      function upsampleMask(mask, scale) {
        if (!mask || mask.length === 0)
          return { mask, scale: 1 };
        scale = scale || DEFAULT_UPSAMPLE_SCALE;
        if (scale < 1)
          scale = 1;
        var m = mask.length;
        var n = mask[0].length;
        if (scale === 1)
          return { mask, scale: 1 };
        var newM = (m - 1) * scale + 1;
        var newN = (n - 1) * scale + 1;
        var upsampled = [];
        for (var i = 0; i < newM; i++) {
          var row = [];
          var origY = i / scale;
          for (var j = 0; j < newN; j++) {
            var origX = j / scale;
            var value = bilinearInterpolate(mask, origX, origY);
            row.push(Math.max(0, Math.min(1, value)));
          }
          upsampled.push(row);
        }
        return { mask: upsampled, scale };
      }
      function generateClipPath(contourResult, options) {
        options = options || {};
        var nullMask = contourResult.nullMask;
        if (!nullMask || contourResult.nullCount === 0) {
          return null;
        }
        var binaryMask = makeBinaryMask(nullMask);
        if (!binaryMask)
          return null;
        var originalM = binaryMask.length;
        var originalN = binaryMask[0].length;
        var clipLevel = options.clipLevel !== void 0 ? options.clipLevel : DEFAULT_CLIP_LEVEL;
        var clipSmoothing = options.clipSmoothing !== void 0 ? options.clipSmoothing : DEFAULT_SMOOTHING;
        var smoothingMethod = options.smoothingMethod || "direct";
        var workingMask, scale, m, n;
        if (smoothingMethod === "upsample") {
          var upsampleScale = options.upsampleScale !== void 0 ? options.upsampleScale : DEFAULT_UPSAMPLE_SCALE;
          var upsampled = upsampleMask(binaryMask, upsampleScale);
          workingMask = upsampled.mask;
          scale = upsampled.scale;
          m = workingMask.length;
          n = workingMask[0].length;
        } else {
          workingMask = binaryMask;
          scale = 1;
          m = originalM;
          n = originalN;
        }
        var x, y;
        if (options.useDataCoordinates && options.dataX && options.dataY) {
          var dataX = options.dataX;
          var dataY = options.dataY;
          var xMin = Math.min.apply(Math, dataX);
          var xMax = Math.max.apply(Math, dataX);
          var yMin = Math.min.apply(Math, dataY);
          var yMax = Math.max.apply(Math, dataY);
          x = [];
          y = [];
          for (var i = 0; i < n; i++) {
            var origIdx = i / scale;
            var origIdxFloor = Math.floor(origIdx);
            var origIdxFrac = origIdx - origIdxFloor;
            if (origIdxFloor >= dataX.length - 1) {
              x.push(dataX[dataX.length - 1]);
            } else if (origIdxFloor < 0) {
              x.push(dataX[0]);
            } else {
              x.push(dataX[origIdxFloor] + (dataX[origIdxFloor + 1] - dataX[origIdxFloor]) * origIdxFrac);
            }
          }
          for (var j = 0; j < m; j++) {
            var origIdx = j / scale;
            var origIdxFloor = Math.floor(origIdx);
            var origIdxFrac = origIdx - origIdxFloor;
            if (origIdxFloor >= dataY.length - 1) {
              y.push(dataY[dataY.length - 1]);
            } else if (origIdxFloor < 0) {
              y.push(dataY[0]);
            } else {
              y.push(dataY[origIdxFloor] + (dataY[origIdxFloor + 1] - dataY[origIdxFloor]) * origIdxFrac);
            }
          }
        } else {
          x = [];
          y = [];
          for (var i = 0; i < n; i++)
            x.push(i / scale);
          for (var j = 0; j < m; j++)
            y.push(j / scale);
        }
        var clipPathInfo = {
          level: clipLevel,
          crossings: {},
          starts: [],
          edgepaths: [],
          paths: [],
          z: workingMask,
          x,
          y,
          smoothing: clipSmoothing
        };
        marchingSquares.makeCrossings([clipPathInfo]);
        var xRange = x.length > 1 ? x[x.length - 1] - x[0] : 1;
        var yRange = y.length > 1 ? y[y.length - 1] - y[0] : 1;
        var xTol = Math.max(1e-10, xRange * 1e-3 / scale);
        var yTol = Math.max(1e-10, yRange * 1e-3 / scale);
        pathFinding.findAllPaths([clipPathInfo], xTol, yTol);
        closeBoundaries([clipPathInfo], { type: "levels" });
        var simplifyTolerance = options.simplifyTolerance !== void 0 ? options.simplifyTolerance : DEFAULT_SIMPLIFY_TOLERANCE;
        if (simplifyTolerance > 0) {
          var xRange = x.length > 1 ? x[x.length - 1] - x[0] : 1;
          var yRange = y.length > 1 ? y[y.length - 1] - y[0] : 1;
          var baseTol = Math.min(xRange, yRange) / Math.max(m, n) * 2;
          var scaledTolerance = baseTol * simplifyTolerance;
          simplifyPathInfoPaths(clipPathInfo, scaledTolerance);
        }
        if (options.useDataCoordinates) {
          return createClipPathDataCoords(clipPathInfo, m, n);
        }
        var width = options.width || 500;
        var height = options.height || 400;
        var padding = options.padding || 30;
        return createClipPathSVG(clipPathInfo, width, height, padding, originalM, originalN);
      }
      function createClipPathDataCoords(clipPathInfo, m, n) {
        var x = clipPathInfo.x || [];
        var y = clipPathInfo.y || [];
        var xMin = x.length > 0 ? Math.min.apply(Math, x) : 0;
        var xMax = x.length > 0 ? Math.max.apply(Math, x) : n - 1;
        var yMin = y.length > 0 ? Math.min.apply(Math, y) : 0;
        var yMax = y.length > 0 ? Math.max.apply(Math, y) : m - 1;
        var xRange = xMax - xMin || 1;
        var yRange = yMax - yMin || 1;
        var tol = Math.max(1e-10, Math.min(xRange, yRange) * 1e-3);
        var perimeter = [
          [xMin, yMax],
          // top-left
          [xMax, yMax],
          // top-right
          [xMax, yMin],
          // bottom-right
          [xMin, yMin]
          // bottom-left
        ];
        var dataPaths = joinAllPathsDataCoords(clipPathInfo, perimeter, tol, false);
        return dataPaths || "";
      }
      function joinAllPathsDataCoords(pathInfo, perimeter, tol, reverseWinding) {
        var fullpath = "";
        var edgepaths = pathInfo.edgepaths || [];
        if (edgepaths.length === 0 && (!pathInfo.paths || pathInfo.paths.length === 0)) {
          return "";
        }
        function istop(pt) {
          return pt && Math.abs(pt[1] - perimeter[0][1]) < tol;
        }
        function isbottom(pt) {
          return pt && Math.abs(pt[1] - perimeter[2][1]) < tol;
        }
        function isleft(pt) {
          return pt && Math.abs(pt[0] - perimeter[0][0]) < tol;
        }
        function isright(pt) {
          return pt && Math.abs(pt[0] - perimeter[2][0]) < tol;
        }
        function pathToSVGStr(path, isClosed) {
          if (!path || path.length === 0)
            return "";
          var orderedPath = reverseWinding ? path.slice().reverse() : path;
          var d = "M " + orderedPath[0][0] + " " + orderedPath[0][1];
          for (var i2 = 1; i2 < orderedPath.length; i2++) {
            d += " L " + orderedPath[i2][0] + " " + orderedPath[i2][1];
          }
          if (isClosed)
            d += " Z";
          return d;
        }
        var startsleft = edgepaths.map(function(v, idx) {
          return idx;
        });
        var i = 0;
        var newloop = true;
        var endpt, newendpt, nexti, addpath;
        while (startsleft.length > 0) {
          addpath = pathToSVGStr(edgepaths[i], false);
          fullpath += newloop ? addpath : addpath.replace(/^M/, "L");
          startsleft.splice(startsleft.indexOf(i), 1);
          endpt = reverseWinding ? edgepaths[i][0] : edgepaths[i][edgepaths[i].length - 1];
          nexti = -1;
          for (var cnt = 0; cnt < 4; cnt++) {
            if (!endpt)
              break;
            if (istop(endpt) && !isright(endpt))
              newendpt = perimeter[1];
            else if (isleft(endpt))
              newendpt = perimeter[0];
            else if (isbottom(endpt))
              newendpt = perimeter[3];
            else if (isright(endpt))
              newendpt = perimeter[2];
            for (var possiblei = 0; possiblei < edgepaths.length; possiblei++) {
              var ptNew = reverseWinding ? edgepaths[possiblei][edgepaths[possiblei].length - 1] : edgepaths[possiblei][0];
              if (Math.abs(endpt[0] - newendpt[0]) < tol) {
                if (Math.abs(endpt[0] - ptNew[0]) < tol && (ptNew[1] - endpt[1]) * (newendpt[1] - ptNew[1]) >= 0) {
                  newendpt = ptNew;
                  nexti = possiblei;
                }
              } else if (Math.abs(endpt[1] - newendpt[1]) < tol) {
                if (Math.abs(endpt[1] - ptNew[1]) < tol && (ptNew[0] - endpt[0]) * (newendpt[0] - ptNew[0]) >= 0) {
                  newendpt = ptNew;
                  nexti = possiblei;
                }
              }
            }
            endpt = newendpt;
            if (nexti >= 0)
              break;
            fullpath += "L" + newendpt[0] + " " + newendpt[1];
          }
          if (nexti === edgepaths.length || nexti < 0)
            break;
          i = nexti;
          newloop = startsleft.indexOf(i) === -1;
          if (newloop) {
            if (startsleft.length > 0) {
              i = startsleft[0];
            }
            fullpath += "Z";
          }
        }
        if (pathInfo.paths) {
          for (i = 0; i < pathInfo.paths.length; i++) {
            fullpath += pathToSVGStr(pathInfo.paths[i], true);
          }
        }
        return fullpath;
      }
      function pathToSVG(path, isClosed) {
        if (!path || path.length === 0)
          return "";
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
        var joinedPaths = joinAllPaths(clipPathInfo, perimeter, scalePath, pathToSVG);
        return joinedPaths;
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
            if (!endpt)
              break;
            if (istop(endpt) && !isright(endpt))
              newendpt = perimeter[1];
            else if (isleft(endpt))
              newendpt = perimeter[0];
            else if (isbottom(endpt))
              newendpt = perimeter[3];
            else if (isright(endpt))
              newendpt = perimeter[2];
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
            if (nexti >= 0)
              break;
            fullpath += "L" + newendpt[0] + " " + newendpt[1];
          }
          if (nexti === edgepaths.length || nexti < 0)
            break;
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
        upsampleMask,
        bilinearInterpolate,
        createClipPathSVG,
        // Export default options for reference
        DEFAULT_UPSAMPLE_SCALE,
        DEFAULT_CLIP_LEVEL,
        DEFAULT_SMOOTHING
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
        var z, x, y;
        if (Array.isArray(grid)) {
          z = grid;
          var m = z.length;
          var n = z[0] ? z[0].length : 0;
          x = createIndexArray(n);
          y = createIndexArray(m);
        } else if (grid && grid.z && Array.isArray(grid.z)) {
          z = grid.z;
          var m = z.length;
          var n = z[0] ? z[0].length : 0;
          x = grid.x || createIndexArray(n);
          y = grid.y || createIndexArray(m);
        } else {
          throw new Error("Invalid grid: must be a 2D array or an object with z property as 2D array");
        }
        if (m < 2 || n < 2) {
          throw new Error("Invalid grid: must have at least 2x2 data points");
        }
        var normalization = nullHandling.normalizeNullValues(z);
        var cleanedZ = normalization.cleanedGrid;
        var nullMask = normalization.nullMask;
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
        var xRange = x.length > 1 ? x[x.length - 1] - x[0] : 1;
        var yRange = y.length > 1 ? y[y.length - 1] - y[0] : 1;
        var xTol = Math.max(1e-10, xRange * 1e-3);
        var yTol = Math.max(1e-10, yRange * 1e-3);
        pathFinding.findAllPaths(pathinfo, xTol, yTol);
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
      function createIndexArray(length, offset) {
        var arr = [];
        for (var i = 0; i < length; i++) {
          arr.push(offset !== void 0 ? offset + i : i);
        }
        return arr;
      }
      function createPerimeter(style) {
        var m = style.z && style.z.length ? style.z.length : 10;
        var n = style.z && style.z[0] && style.z[0].length ? style.z[0].length : 10;
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
      function createDataPerimeter(style) {
        var x = style.x || [];
        var y = style.y || [];
        var xMin, xMax, yMin, yMax;
        if (style.fullRange) {
          xMin = style.fullRange.xMin;
          xMax = style.fullRange.xMax;
          yMin = style.fullRange.yMin;
          yMax = style.fullRange.yMax;
        } else {
          xMin = x && x.length > 0 ? Math.min.apply(Math, x) : 0;
          xMax = x && x.length > 0 ? Math.max.apply(Math, x) : 10;
          yMin = y && y.length > 0 ? Math.min.apply(Math, y) : 0;
          yMax = y && y.length > 0 ? Math.max.apply(Math, y) : 10;
        }
        return [
          [xMin, yMax],
          // 0: top-left (data coords, Y decreases upward)
          [xMax, yMax],
          // 1: top-right
          [xMax, yMin],
          // 2: bottom-right
          [xMin, yMin]
          // 3: bottom-left
        ];
      }
      function joinAllPaths(pathInfo, perimeter, style) {
        var fullpath = "";
        var edgepaths = pathInfo.edgepaths || [];
        if (!perimeter || !Array.isArray(perimeter) || perimeter.length < 4) {
          return "";
        }
        var validPerimeter = perimeter.every(function(pt) {
          return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
        });
        if (!validPerimeter) {
          return "";
        }
        if (edgepaths.length === 0 && (!pathInfo.paths || pathInfo.paths.length === 0)) {
          return "";
        }
        var x = style.x || [];
        var y = style.y || [];
        if (!x || x.length === 0)
          x = createIndexArray(style.z ? style.z.length : 10, 1);
        if (!y || y.length === 0)
          y = createIndexArray(style.z ? style.z[0].length : 10, 1);
        var dataXMin = Math.min.apply(Math, x);
        var dataXMax = Math.max.apply(Math, x);
        var dataYMin = Math.min.apply(Math, y);
        var dataYMax = Math.max.apply(Math, y);
        var tolX = (dataXMax - dataXMin) * 1e-3;
        var tolY = (dataYMax - dataYMin) * 1e-3;
        function isDataTop(pt) {
          return pt && Math.abs(pt[1] - dataYMax) < tolY;
        }
        function isDataBottom(pt) {
          return pt && Math.abs(pt[1] - dataYMin) < tolY;
        }
        function isDataLeft(pt) {
          return pt && Math.abs(pt[0] - dataXMin) < tolX;
        }
        function isDataRight(pt) {
          return pt && Math.abs(pt[0] - dataXMax) < tolX;
        }
        var dataCorners = [
          [dataXMin, dataYMax],
          // 0: top-left (data coords)
          [dataXMax, dataYMax],
          // 1: top-right
          [dataXMax, dataYMin],
          // 2: bottom-right
          [dataXMin, dataYMin]
          // 3: bottom-left
        ];
        var i = 0;
        var startsleft = edgepaths.map(function(v, i2) {
          return i2;
        });
        var newloop = true;
        var endptData;
        var newendptData;
        var cnt;
        var nexti;
        var possiblei;
        var addpath;
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
          var scaledPath = currentPath.filter(function(pt) {
            return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
          }).map(function(pt) {
            return scalePoint(style, pt);
          }).filter(function(pt) {
            return pt && !isNaN(pt[0]) && !isNaN(pt[1]);
          });
          if (scaledPath.length < 2) {
            startsleft.splice(startsleft.indexOf(i), 1);
            if (startsleft.length > 0) {
              i = startsleft[0];
              newloop = true;
            }
            continue;
          }
          var smoothingValue = style.smoothing !== void 0 ? style.smoothing : pathInfo.smoothing || 0;
          addpath = smooth.smoothopen(scaledPath, smoothingValue);
          fullpath += newloop ? addpath : addpath.replace(/^M/, "L");
          startsleft.splice(startsleft.indexOf(i), 1);
          endptData = currentPath[currentPath.length - 1];
          nexti = -1;
          for (cnt = 0; cnt < 4; cnt++) {
            if (!endptData)
              break;
            newendptData = null;
            if (isDataTop(endptData) && !isDataRight(endptData))
              newendptData = dataCorners[1];
            else if (isDataLeft(endptData))
              newendptData = dataCorners[0];
            else if (isDataBottom(endptData))
              newendptData = dataCorners[3];
            else if (isDataRight(endptData))
              newendptData = dataCorners[2];
            else {
              break;
            }
            if (!newendptData)
              break;
            for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
              if (!edgepaths[possiblei] || !Array.isArray(edgepaths[possiblei]) || edgepaths[possiblei].length === 0 || !edgepaths[possiblei][0]) {
                continue;
              }
              var ptNewData = edgepaths[possiblei][0];
              if (!ptNewData || isNaN(ptNewData[0]) || isNaN(ptNewData[1]))
                continue;
              if (Math.abs(endptData[0] - newendptData[0]) < tolX) {
                if (Math.abs(endptData[0] - ptNewData[0]) < tolX && (ptNewData[1] - endptData[1]) * (newendptData[1] - ptNewData[1]) >= 0) {
                  newendptData = ptNewData;
                  nexti = possiblei;
                }
              } else if (Math.abs(endptData[1] - newendptData[1]) < tolY) {
                if (Math.abs(endptData[1] - ptNewData[1]) < tolY && (ptNewData[0] - endptData[0]) * (newendptData[0] - ptNewData[0]) >= 0) {
                  newendptData = ptNewData;
                  nexti = possiblei;
                }
              }
            }
            if (!newendptData)
              break;
            endptData = newendptData;
            if (nexti >= 0)
              break;
            var canvasPt = scalePoint(style, newendptData);
            if (canvasPt && !isNaN(canvasPt[0]) && !isNaN(canvasPt[1])) {
              fullpath += "L" + canvasPt[0] + " " + canvasPt[1];
            }
          }
          if (nexti === edgepaths.length || nexti < 0)
            break;
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
          var scaledPath = pathInfo.paths[i].filter(function(pt) {
            return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
          }).map(function(pt) {
            return scalePoint(style, pt);
          }).filter(function(pt) {
            return pt && !isNaN(pt[0]) && !isNaN(pt[1]);
          });
          if (scaledPath.length >= 3) {
            var smoothingValue = style.smoothing !== void 0 ? style.smoothing : pathInfo.smoothing || 0;
            fullpath += smooth.smoothclosed(scaledPath, smoothingValue);
          }
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
        if (n === 0)
          return "rgba(100, 100, 100, 0.5)";
        if (n === 1)
          return colorScale[0][1];
        for (var i = 0; i < n - 1; i++) {
          if (value >= colorScale[i][0] && value <= colorScale[i + 1][0]) {
            var t = (value - colorScale[i][0]) / (colorScale[i + 1][0] - colorScale[i][0]);
            return interpolateColor(colorScale[i][1], colorScale[i + 1][1], t);
          }
        }
        if (value < colorScale[0][0])
          return colorScale[0][1];
        if (value > colorScale[n - 1][0])
          return colorScale[n - 1][1];
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
      function getColorFromScaleSegmented(value, colorScale) {
        if (!colorScale || !Array.isArray(colorScale) || colorScale.length === 0) {
          return "rgba(100, 100, 100, 0.5)";
        }
        var n = colorScale.length;
        if (value < colorScale[0][0]) {
          return colorScale[0][1];
        }
        for (var i = 0; i < n - 1; i++) {
          if (value >= colorScale[i][0] && value < colorScale[i + 1][0]) {
            return colorScale[i][1];
          }
        }
        return colorScale[n - 1][1];
      }
      function getColorForLevel(level, levelIndex, levels, colorScale, hasCustomLevels, stepSize, valueColorMap) {
        if (valueColorMap && Array.isArray(valueColorMap) && valueColorMap.length > 0) {
          return getColorForSegmentedValue(level, valueColorMap);
        }
        if (!colorScale || colorScale.length === 0) {
          return "rgba(100, 100, 100, 0.5)";
        }
        if (!levels || levels.length === 0) {
          return colorScale[0][1] || "rgba(100, 100, 100, 0.5)";
        }
        var firstVal = colorScale[0][0];
        var lastVal = colorScale[colorScale.length - 1][0];
        var isNormalizedFormat = firstVal >= 0 && firstVal <= 1 && lastVal >= 0 && lastVal <= 1;
        if (!isNormalizedFormat) {
          return getColorFromScaleSegmented(level, colorScale);
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
        if (!paths || paths.length === 0)
          return;
        var width = style.width || ctx.canvas.width;
        var height = style.height || ctx.canvas.height;
        var smoothing = style.smoothing || 0;
        var perimeter = createPerimeter(style);
        if (!perimeter || !Array.isArray(perimeter) || perimeter.length < 4) {
          console.warn("drawFilledPaths: Invalid perimeter structure");
          return;
        }
        var validPerimeter = perimeter.every(function(pt) {
          return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
        });
        if (!validPerimeter) {
          console.warn("drawFilledPaths: Invalid perimeter points");
          return;
        }
        if (paths.length === 0)
          return;
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
        for (var i = 0; i < paths.length; i++) {
          var pathInfo = paths[i];
          var fillColor = getColorForLevel(pathInfo.level, i, levels, colorScale, hasCustomLevels, stepSize, valueColorMap);
          ctx.fillStyle = fillColor;
          var dataPerimeter = createDataPerimeter(style);
          var boundaryPath = "M" + dataPerimeter.map(function(pt) {
            var canvasPt = scalePoint(style, pt);
            return canvasPt.join(" ");
          }).join("L") + "Z";
          var joinedPaths = joinAllPaths(pathInfo, perimeter, style);
          var fullpath = pathInfo.prefixBoundary ? boundaryPath + joinedPaths : joinedPaths;
          if (fullpath) {
            ctx.beginPath();
            drawSVGPath(ctx, fullpath);
            ctx.fill();
          }
        }
      }
      function drawStrokePaths(ctx, contourResult, style) {
        var paths = contourResult.paths;
        var levels = contourResult.levels;
        var smoothing = style.smoothing || 0;
        var colorScale = style.colorScale;
        var useColorScale = colorScale && Array.isArray(colorScale) && colorScale.length > 0;
        var coloring = style.coloring || "lines";
        ctx.lineWidth = style.lineWidth || 1.5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        if (!paths || paths.length === 0) {
          return;
        }
        var useFixedLineColor = coloring !== "lines";
        for (var i = 0; i < paths.length; i++) {
          var pathInfo = paths[i];
          if (useFixedLineColor) {
            ctx.strokeStyle = style.lineColor || "#333";
          } else if (useColorScale) {
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
        if (!path || path.length < 2)
          return;
        var validPath = path.filter(function(pt) {
          return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
        });
        if (validPath.length < 2)
          return;
        ctx.beginPath();
        var scaledPath = validPath.map(scalePoint.bind(null, style));
        scaledPath = scaledPath.filter(function(pt) {
          return pt && !isNaN(pt[0]) && !isNaN(pt[1]);
        });
        if (scaledPath.length < 2)
          return;
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
        var xMin, xMax, yMin, yMax;
        if (style.visibleRange) {
          xMin = style.visibleRange.xMin;
          xMax = style.visibleRange.xMax;
          yMin = style.visibleRange.yMin;
          yMax = style.visibleRange.yMax;
        } else {
          xMin = x && x.length > 0 ? Math.min.apply(Math, x) : 0;
          xMax = x && x.length > 0 ? Math.max.apply(Math, x) : 10;
          yMin = y && y.length > 0 ? Math.min.apply(Math, y) : 0;
          yMax = y && y.length > 0 ? Math.max.apply(Math, y) : 10;
        }
        var xRange = xMax - xMin || 1;
        var yRange = yMax - yMin || 1;
        var canvasX, canvasY;
        if (style.drawArea) {
          var drawArea = style.drawArea;
          canvasX = drawArea.x + (pt[0] - xMin) / xRange * drawArea.width;
          canvasY = drawArea.y + drawArea.height - (pt[1] - yMin) / yRange * drawArea.height;
        } else {
          var width = style.width || 500;
          var height = style.height || 400;
          var padding = style.padding || 30;
          canvasX = padding + (pt[0] - xMin) / xRange * (width - 2 * padding);
          canvasY = padding + (pt[1] - yMin) / yRange * (height - 2 * padding);
          canvasY = height - padding - (canvasY - padding);
        }
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
        if (det === 0)
          return null;
        var t = (b * f - c * e) / det;
        var u = (b * d - a * e) / det;
        if (u < 0 || u > 1 || t < 0 || t > 1)
          return null;
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
        if (normX < 1 || normY < 1)
          return Infinity;
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
            if (dist <= distOffset)
              return Infinity;
            var distFactor = COST_CONSTANTS.NEIGHBORCOST * (sameLevel ? COST_CONSTANTS.SAMELEVELFACTOR : 1);
            cost += distFactor / (dist - distOffset);
          }
        }
        return cost;
      }
      function segmentDistance(x1, y1, x2, y2, x3, y3, x4, y4) {
        if (segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4))
          return 0;
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
        } else if (totalPathLen > textWidth * 1.2) {
          dp = (totalPathLen - textWidth) / (COST_CONSTANTS.INITIALSEARCHPOINTS - 1);
          p0 = textWidth / 2;
          pMax = totalPathLen - textWidth / 2;
        } else if (totalPathLen > textWidth * 0.5) {
          dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
          p0 = totalPathLen / 4;
          pMax = totalPathLen * 3 / 4;
        } else {
          return null;
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
          if (bestCost > COST_CONSTANTS.MAXCOST * 2)
            break;
          if (j > 0)
            dp /= 2;
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
        LABELDISTANCE: 0.5,
        // Each label occupies this length (multiplier of plot diagonal) - reduced for more labels
        LABELMIN: 2,
        // Minimum path length (multiplier of text width) - reduced threshold
        LABELMAX: 15,
        // Maximum labels per contour line - increased for long paths
        LABELINCREASE: 15
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
        if (min === null)
          return null;
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
        if (max === null)
          max = totalLen;
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
        if (!path || path.length < 2)
          return false;
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
        if (!showLabels || !paths || !paths.length)
          return;
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
            if (path.length < 3)
              continue;
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
            if (maxLabels === 0)
              continue;
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
              if (!labelPos)
                break;
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
              if (tooClose)
                break;
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
        var xData = style.x;
        var yData = style.y;
        var visibleRange = style.visibleRange;
        for (var i = 0; i < labelsToDraw.length; i++) {
          var label = labelsToDraw[i];
          var scaled = scalePoint(label.pos, n, m, width, height, padding, visibleRange, xData, yData);
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
      function scalePoint(pt, n, m, width, height, padding, visibleRange, xData, yData) {
        var plotWidth = width - 2 * padding;
        var plotHeight = height - 2 * padding;
        if (visibleRange) {
          var dataX, dataY;
          if (xData && xData.length > 0) {
            var xIdx = pt.x;
            var xIdx0 = Math.floor(xIdx);
            var xFrac = xIdx - xIdx0;
            if (xIdx0 >= xData.length - 1) {
              dataX = xData[xData.length - 1];
            } else if (xIdx0 < 0) {
              dataX = xData[0];
            } else {
              dataX = xData[xIdx0] + xFrac * (xData[xIdx0 + 1] - xData[xIdx0]);
            }
          } else {
            dataX = pt.x;
          }
          if (yData && yData.length > 0) {
            var yIdx = pt.y;
            var yIdx0 = Math.floor(yIdx);
            var yFrac = yIdx - yIdx0;
            if (yIdx0 >= yData.length - 1) {
              dataY = yData[yData.length - 1];
            } else if (yIdx0 < 0) {
              dataY = yData[0];
            } else {
              dataY = yData[yIdx0] + yFrac * (yData[yIdx0 + 1] - yData[yIdx0]);
            }
          } else {
            dataY = pt.y;
          }
          var xRange = visibleRange.xMax - visibleRange.xMin;
          var yRange = visibleRange.yMax - visibleRange.yMin;
          var canvasX = padding + (dataX - visibleRange.xMin) / xRange * plotWidth;
          var canvasY = padding + plotHeight - (dataY - visibleRange.yMin) / yRange * plotHeight;
          return {
            x: canvasX,
            y: canvasY
          };
        }
        var scaleX = plotWidth / (n - 1);
        var scaleY = plotHeight / (m - 1);
        return {
          x: padding + pt.x * scaleX,
          y: padding + (m - 1 - pt.y) * scaleY
        };
      }
      module.exports = drawLabels;
    }
  });

  // colorbar/discrete.js
  var require_discrete = __commonJS({
    "colorbar/discrete.js"(exports, module) {
      "use strict";
      function computeDiscreteColorbar(blocks, options) {
        options = options || {};
        if (!blocks || blocks.length === 0) {
          return { blocks: [], min: 0, max: 1 };
        }
        var tickInterval = options.tickInterval || 0;
        var result = {
          blocks: [],
          min: blocks[0][1],
          max: blocks[blocks.length - 1][1]
        };
        for (var i = 0; i < blocks.length; i++) {
          var block = blocks[i];
          var showLabel = tickInterval === 0 || i === 0 || i === blocks.length - 1 || i % tickInterval === 0;
          result.blocks.push({
            color: block[0],
            value: block[1],
            index: i,
            showLabel
          });
        }
        return result;
      }
      function calculateColorbarDimensions(options) {
        var position = options.position || "right";
        var thickness = options.thickness || 25;
        var padding = options.padding || 10;
        var width = options.width;
        var height = options.height;
        var blockCount = options.blockCount || 10;
        var isVertical = position === "left" || position === "right";
        var x, y, length;
        if (isVertical) {
          length = height * 0.8;
          y = (height - length) / 2;
          if (position === "right") {
            x = width - thickness - padding;
          } else {
            x = padding;
          }
        } else {
          length = width * 0.8;
          x = (width - length) / 2;
          if (position === "bottom") {
            y = height - thickness - padding;
          } else {
            y = padding;
          }
        }
        return {
          x,
          y,
          thickness,
          length,
          isVertical,
          blockThickness: isVertical ? length / blockCount : length / blockCount
        };
      }
      module.exports = {
        computeDiscreteColorbar,
        calculateColorbarDimensions
      };
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
        if (!isFinite(value))
          return String(value);
        if (Math.abs(value) < Math.pow(10, -precision)) {
          return "0";
        }
        return value.toFixed(precision);
      }
      function formatExponential(value, precision, uppercase) {
        if (!isFinite(value))
          return String(value);
        if (value === 0)
          return "0e+0";
        let str = value.toExponential(precision);
        if (uppercase) {
          str = str.replace("e", "E");
        }
        return str;
      }
      function formatPercent(value, precision) {
        if (!isFinite(value))
          return String(value);
        return (value * 100).toFixed(precision) + "%";
      }
      function autoFormatValue(value) {
        if (!isFinite(value))
          return String(value);
        if (value === 0)
          return "0";
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
        if (fraction < 1.5)
          niceFraction = 1;
        else if (fraction < 3)
          niceFraction = 2;
        else if (fraction < 7)
          niceFraction = 5;
        else
          niceFraction = 10;
        const step = niceFraction * Math.pow(10, exponent);
        const values = [];
        const positions = [];
        let firstTick = Math.ceil(start / step) * step;
        if (firstTick > start)
          firstTick -= step;
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
      var discrete = require_discrete();
      module.exports = {
        computeColorbar: require_compute2(),
        computeTicks: require_ticks(),
        mapColors: colors.mapColors,
        buildColorScale: colors.buildColorScale,
        COLOR_SCALES: colors.COLOR_SCALES,
        // Discrete colorbar
        computeDiscreteColorbar: discrete.computeDiscreteColorbar,
        calculateColorbarDimensions: discrete.calculateColorbarDimensions
      };
    }
  });

  // renderers/canvas/colorbar.js
  var require_colorbar2 = __commonJS({
    "renderers/canvas/colorbar.js"(exports, module) {
      "use strict";
      var colorbar = require_colorbar();
      var mapColors = colorbar.mapColors;
      var computeDiscreteColorbar = colorbar.computeDiscreteColorbar;
      var calculateColorbarDimensions = colorbar.calculateColorbarDimensions;
      function drawColorbar(ctx, contourResult, style) {
        style = style || {};
        var colorbarConfig = style.colorbar || {};
        var blocks = colorbarConfig.blocks || style.colorScale;
        if (blocks && Array.isArray(blocks) && blocks.length > 0 && Array.isArray(blocks[0])) {
          var normalizedBlocks = normalizeBlocks(blocks);
          drawDiscreteColorbar(ctx, normalizedBlocks, style);
        } else {
          drawGradientColorbar(ctx, contourResult, style);
        }
      }
      function normalizeBlocks(blocks) {
        if (!blocks || !blocks.length)
          return blocks;
        var first = blocks[0];
        if (!Array.isArray(first) || first.length < 2)
          return blocks;
        if (typeof first[0] === "string") {
          return blocks;
        } else {
          return blocks.map(function(b) {
            return [b[1], b[0]];
          });
        }
      }
      function drawDiscreteColorbar(ctx, blocks, style) {
        style = style || {};
        var colorbarConfig = style.colorbar || {};
        ctx.save();
        var width = style.width || ctx.canvas.width;
        var height = style.height || ctx.canvas.height;
        var position = colorbarConfig.position || "right";
        var thickness = colorbarConfig.thickness || 25;
        var padding = colorbarConfig.padding || 10;
        var tickInterval = colorbarConfig.tickInterval || 0;
        var blockGap = colorbarConfig.blockGap || 1;
        var dims = calculateColorbarDimensions({
          position,
          thickness,
          padding,
          width,
          height,
          blockCount: blocks.length
        });
        var discreteData = computeDiscreteColorbar(blocks, {
          tickInterval
        });
        var blockCount = discreteData.blocks.length;
        for (var i = 0; i < blockCount; i++) {
          var block = discreteData.blocks[i];
          var bx, by, bw, bh;
          if (dims.isVertical) {
            var reversedIndex = blockCount - 1 - i;
            bx = dims.x;
            by = dims.y + reversedIndex * dims.blockThickness;
            bw = dims.thickness;
            bh = dims.blockThickness - blockGap;
            if (by + bh > dims.y + dims.length) {
              bh = dims.y + dims.length - by;
            }
          } else {
            bx = dims.x + i * dims.blockThickness;
            by = dims.y;
            bw = dims.blockThickness - blockGap;
            bh = dims.thickness;
            if (bx + bw > dims.x + dims.length) {
              bw = dims.x + dims.length - bx;
            }
          }
          ctx.fillStyle = block.color;
          ctx.fillRect(bx, by, bw, bh);
        }
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1;
        if (dims.isVertical) {
          ctx.strokeRect(dims.x, dims.y, dims.thickness, dims.length);
        } else {
          ctx.strokeRect(dims.x, dims.y, dims.length, dims.thickness);
        }
        ctx.fillStyle = "#333";
        ctx.font = "10px Arial";
        ctx.textBaseline = "middle";
        for (var j = 0; j < discreteData.blocks.length; j++) {
          var block = discreteData.blocks[j];
          if (!block.showLabel)
            continue;
          var labelX, labelY;
          var label = formatValue(block.value);
          if (dims.isVertical) {
            var reversedIndex = blockCount - 1 - j;
            labelX = dims.x + dims.thickness + 5;
            labelY = dims.y + reversedIndex * dims.blockThickness + dims.blockThickness / 2;
            if (position === "left") {
              ctx.textAlign = "right";
              labelX = dims.x - 5;
            } else {
              ctx.textAlign = "left";
            }
          } else {
            labelX = dims.x + j * dims.blockThickness + dims.blockThickness / 2;
            labelY = dims.y + dims.thickness + 12;
            if (position === "top") {
              labelY = dims.y - 5;
            }
            ctx.textAlign = "center";
          }
          ctx.fillText(label, labelX, labelY);
        }
        if (colorbarConfig.title) {
          ctx.fillStyle = "#333";
          ctx.font = "12px Arial";
          ctx.textAlign = "center";
          if (dims.isVertical) {
            ctx.save();
            ctx.translate(dims.x + dims.thickness / 2, dims.y - 15);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(colorbarConfig.title, 0, 0);
            ctx.restore();
          } else {
            ctx.fillText(colorbarConfig.title, dims.x + dims.length / 2, dims.y - 10);
          }
        }
        ctx.restore();
      }
      function normalizeBlocks(blocks) {
        if (!blocks || !blocks.length)
          return blocks;
        var first = blocks[0];
        if (!Array.isArray(first) || first.length < 2)
          return blocks;
        if (typeof first[0] === "string") {
          return blocks;
        } else {
          return blocks.map(function(b) {
            return [b[1], b[0]];
          });
        }
      }
      function formatValue(value) {
        if (typeof value !== "number" || isNaN(value)) {
          return String(value);
        }
        if (Math.abs(value) < 0.01 || Math.abs(value) >= 1e3) {
          return value.toExponential(1);
        }
        return value.toFixed(2);
      }
      function drawGradientColorbar(ctx, contourResult, style) {
        style = style || {};
        var levels = contourResult.levels;
        if (!levels || levels.length === 0)
          return;
        ctx.save();
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
        ctx.restore();
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
        if (!nullMask)
          return;
        style = style || {};
        var nullRegion = style.nullRegion || {};
        var visible = nullRegion.visible !== false;
        if (!visible)
          return;
        var m = nullMask.length;
        var n = nullMask[0].length;
        var xData = style.x || [];
        var yData = style.y || [];
        var visibleRange = style.visibleRange;
        var width = style.width || 500;
        var height = style.height || 400;
        var padding = style.padding || 30;
        var drawArea = {
          x: padding,
          y: padding,
          width: width - 2 * padding,
          height: height - 2 * padding
        };
        var xMin, xMax, yMin, yMax;
        if (visibleRange) {
          xMin = visibleRange.xMin;
          xMax = visibleRange.xMax;
          yMin = visibleRange.yMin;
          yMax = visibleRange.yMax;
        } else {
          xMin = xData.length > 0 ? Math.min.apply(Math, xData) : 0;
          xMax = xData.length > 0 ? Math.max.apply(Math, xData) : n - 1;
          yMin = yData.length > 0 ? Math.min.apply(Math, yData) : 0;
          yMax = yData.length > 0 ? Math.max.apply(Math, yData) : m - 1;
        }
        var xRange = xMax - xMin || 1;
        var yRange = yMax - yMin || 1;
        function dataToCanvas(dataX2, dataY2) {
          var canvasX = drawArea.x + (dataX2 - xMin) / xRange * drawArea.width;
          var canvasY = drawArea.y + drawArea.height - (dataY2 - yMin) / yRange * drawArea.height;
          return [canvasX, canvasY];
        }
        function getXCoord(j2) {
          return xData.length > j2 ? xData[j2] : j2;
        }
        function getYCoord(i2) {
          return yData.length > i2 ? yData[i2] : i2;
        }
        var cellSizeX, cellSizeY;
        if (xData.length >= 2) {
          cellSizeX = Math.abs(dataToCanvas(xData[1], 0)[0] - dataToCanvas(xData[0], 0)[0]);
        } else {
          cellSizeX = drawArea.width / (n - 1);
        }
        if (yData.length >= 2) {
          cellSizeY = Math.abs(dataToCanvas(0, yData[1])[1] - dataToCanvas(0, yData[0])[1]);
        } else {
          cellSizeY = drawArea.height / (m - 1);
        }
        cellSizeX = Math.max(cellSizeX, 1);
        cellSizeY = Math.max(cellSizeY, 1);
        ctx.save();
        var fillColor = nullRegion.fill || nullRegion.bgColor || "#ffffff";
        if (fillColor !== "transparent") {
          ctx.fillStyle = fillColor;
          for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
              if (nullMask[i][j]) {
                var dataX = getXCoord(j);
                var dataY = getYCoord(i);
                var pt = dataToCanvas(dataX, dataY);
                ctx.fillRect(pt[0] - cellSizeX / 2, pt[1] - cellSizeY / 2, cellSizeX, cellSizeY);
              }
            }
          }
        } else {
          ctx.globalCompositeOperation = "destination-out";
          for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
              if (nullMask[i][j]) {
                var dataX = getXCoord(j);
                var dataY = getYCoord(i);
                var pt = dataToCanvas(dataX, dataY);
                ctx.fillRect(pt[0] - cellSizeX / 2, pt[1] - cellSizeY / 2, cellSizeX, cellSizeY);
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
                var dataX = getXCoord(j);
                var dataY = getYCoord(i);
                var pt = dataToCanvas(dataX, dataY);
                ctx.strokeRect(pt[0] - cellSizeX / 2, pt[1] - cellSizeY / 2, cellSizeX, cellSizeY);
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
      var isNodeJS = typeof window === "undefined" || typeof document === "undefined";
      var createCanvasElement;
      if (isNodeJS) {
        try {
          createCanvasElement = __require("@napi-rs/canvas").createCanvas;
        } catch (e) {
          createCanvasElement = function(width, height) {
            throw new Error("Canvas rendering in Node.js requires @napi-rs/canvas. Install it with: npm install @napi-rs/canvas");
          };
        }
      } else {
        createCanvasElement = function(width, height) {
          var canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          return canvas;
        };
      }
      function drawHeatmapBackground(ctx, grid, style) {
        if (!grid || !grid.z || !ctx) {
          return;
        }
        ctx.save();
        var z = grid.z;
        var m = z.length;
        var n = z[0].length;
        if (m === 0 || n === 0) {
          ctx.restore();
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
                if (val < minVal)
                  minVal = val;
                if (val > maxVal)
                  maxVal = val;
              }
            }
          }
          zmin = minVal;
          zmax = maxVal;
        }
        if (!isFinite(zmin) || !isFinite(zmax)) {
          ctx.restore();
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
        ctx.restore();
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
                if (val < minVal)
                  minVal = val;
                if (val > maxVal)
                  maxVal = val;
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
        var hiresCanvas = createCanvasElement(n * scaleFactor, m * scaleFactor);
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
        var absValue = Math.abs(value);
        if (absValue > 0 && absValue < 1e10) {
          var magnitude = Math.floor(Math.log10(absValue));
          var precision = 10 - magnitude;
          value = Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
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
            if (val < min)
              min = val;
            if (val > max)
              max = val;
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
      function calcDynamicTicks(visibleRange, options) {
        options = options || {};
        var xMin = visibleRange.xMin;
        var xMax = visibleRange.xMax;
        var yMin = visibleRange.yMin;
        var yMax = visibleRange.yMax;
        var width = options.width || 500;
        var height = options.height || 400;
        var xNTicks = Math.max(3, Math.min(10, Math.floor(width / 80)));
        var yNTicks = Math.max(3, Math.min(10, Math.floor(height / 60)));
        var xOptions = options.x || {};
        var yOptions = options.y || {};
        if (xOptions.nticks)
          xNTicks = xOptions.nticks;
        if (yOptions.nticks)
          yNTicks = yOptions.nticks;
        var xResult = autoTicks.autoTicks(xMin, xMax, xNTicks, xOptions.tick0);
        var yResult = autoTicks.autoTicks(yMin, yMax, yNTicks, yOptions.tick0);
        var formatOptions = {
          exponentformat: xOptions.exponentformat || "auto"
        };
        var xTexts = tickFormat.formatTickLabelsUniform(xResult.values, xResult.dtick, formatOptions);
        formatOptions.exponentformat = yOptions.exponentformat || "auto";
        var yTexts = tickFormat.formatTickLabelsUniform(yResult.values, yResult.dtick, formatOptions);
        return {
          x: {
            values: xResult.values,
            dtick: xResult.dtick,
            texts: xTexts,
            tick0: xResult.tick0
          },
          y: {
            values: yResult.values,
            dtick: yResult.dtick,
            texts: yTexts,
            tick0: yResult.tick0
          }
        };
      }
      module.exports = {
        calcTicks,
        calcAxesTicks,
        calcDynamicTicks,
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
            if (showLabels)
              margins.top += 15;
            if (title)
              margins.top += 20;
          } else {
            margins.bottom = tickLength;
            if (showLabels)
              margins.bottom += 15;
            if (title)
              margins.bottom += 20;
          }
        } else {
          if (axis.side === "right") {
            margins.right = tickLength;
            if (showLabels)
              margins.right += 30;
            if (title)
              margins.right += 20;
          } else {
            margins.left = tickLength;
            if (showLabels)
              margins.left += 30;
            if (title)
              margins.left += 20;
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
        var drawingArea;
        if (config.margins) {
          drawingArea = {
            x: config.margins.left,
            y: config.margins.top,
            width: width - config.margins.left - config.margins.right,
            height: height - config.margins.top - config.margins.bottom,
            margins: config.margins
          };
        } else {
          drawingArea = position.calculateDrawingArea(
            width,
            height,
            config.x || {},
            config.y || {}
          );
        }
        var xConfig = config.x || {};
        var yConfig = config.y || {};
        var xRange, yRange;
        var visibleRange = config.visibleRange;
        if (visibleRange) {
          xRange = [visibleRange.xMin, visibleRange.xMax];
          yRange = [visibleRange.yMin, visibleRange.yMax];
        } else {
          if (!xConfig.range && config.xData) {
            xConfig.range = calcTicks.inferRangeFromData(config.xData);
          }
          if (!yConfig.range && config.yData) {
            yConfig.range = calcTicks.inferRangeFromData(config.yData);
          }
          xRange = xConfig.range || [0, width];
          yRange = yConfig.range || [0, height];
        }
        var ticksResult;
        if (visibleRange) {
          ticksResult = calcTicks.calcDynamicTicks(visibleRange, {
            width: drawingArea.width,
            height: drawingArea.height,
            x: xConfig,
            y: yConfig
          });
          ticksResult = {
            xTicks: ticksResult.x.values.map(function(value, i) {
              return {
                value,
                text: ticksResult.x.texts[i],
                index: i
              };
            }),
            yTicks: ticksResult.y.values.map(function(value, i) {
              return {
                value,
                text: ticksResult.y.texts[i],
                index: i
              };
            })
          };
        } else {
          ticksResult = calcTicks.calcAxesTicks({
            x: xConfig,
            y: yConfig
          });
        }
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
        var fullRange = config.fullRange || {
          xMin: xRange[0],
          xMax: xRange[1],
          yMin: yRange[0],
          yMax: yRange[1]
        };
        return {
          // Drawing area
          drawingArea,
          // Visible range (for dynamic mode)
          visibleRange,
          // Full data range
          fullRange,
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
        calcDynamicTicks: calcTicks.calcDynamicTicks,
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
        if (axesConfig.drawGridOnly) {
          drawGrid(ctx, axisSetup, true);
          drawGrid(ctx, axisSetup, false);
          return axisSetup;
        }
        drawGrid(ctx, axisSetup, true);
        drawGrid(ctx, axisSetup, false);
        drawXAxis(ctx, axisSetup);
        drawYAxis(ctx, axisSetup);
        return axisSetup;
      }
      function drawAxesFromSetup(ctx, axisSetup, includeGrid) {
        if (includeGrid) {
          drawGrid(ctx, axisSetup, true);
          drawGrid(ctx, axisSetup, false);
        }
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

  // renderers/canvas/overlay/core/overlay.js
  var require_overlay = __commonJS({
    "renderers/canvas/overlay/core/overlay.js"(exports, module) {
      "use strict";
      function Overlay() {
        this._items = /* @__PURE__ */ new Map();
        this._hidden = /* @__PURE__ */ new Set();
        this._indices = {
          text: /* @__PURE__ */ new Set(),
          point: /* @__PURE__ */ new Set(),
          line: /* @__PURE__ */ new Set(),
          polygon: /* @__PURE__ */ new Set()
        };
        this._idCounter = 0;
      }
      Overlay.prototype = {
        // ========================================
        // 增删改查 (CRUD)
        // ========================================
        /**
         * 添加一个元素
         * @param {string} type - 元素类型 ('text', 'point', 'line', 'polygon')
         * @param {Object} data - 元素数据
         * @returns {string} 元素ID
         */
        add: function(type, data) {
          var id = this._generateId();
          var item = Object.assign({ id, type }, data);
          this._items.set(id, item);
          if (this._indices[type]) {
            this._indices[type].add(id);
          }
          return id;
        },
        /**
         * 获取单个元素
         * @param {string} id - 元素ID
         * @returns {Object|null} 元素数据
         */
        get: function(id) {
          return this._items.get(id) || null;
        },
        /**
         * 获取某类型的所有元素
         * @param {string} type - 元素类型
         * @returns {Array} 元素数组
         */
        getByType: function(type) {
          var self = this;
          if (!this._indices[type])
            return [];
          return Array.from(this._indices[type]).map(function(id) {
            return self._items.get(id);
          }).filter(function(item) {
            return item !== void 0;
          });
        },
        /**
         * 获取所有元素
         * @returns {Array} 所有元素数组
         */
        getAll: function() {
          return Array.from(this._items.values());
        },
        /**
         * 更新元素
         * @param {string} id - 元素ID
         * @param {Object} data - 更新数据
         * @returns {Object|null} 更新后的元素
         */
        update: function(id, data) {
          var item = this._items.get(id);
          if (item) {
            Object.assign(item, data);
          }
          return item || null;
        },
        /**
         * 删除元素
         * @param {string} id - 元素ID
         * @returns {boolean} 是否删除成功
         */
        remove: function(id) {
          var item = this._items.get(id);
          if (item) {
            this._items.delete(id);
            if (this._indices[item.type]) {
              this._indices[item.type].delete(id);
            }
            return true;
          }
          return false;
        },
        /**
         * 清空某类型或所有元素
         * @param {string} [type] - 元素类型，不传则清空所有
         */
        clear: function(type) {
          var self = this;
          if (type) {
            if (this._indices[type]) {
              this._indices[type].forEach(function(id) {
                self._items.delete(id);
              });
              this._indices[type].clear();
            }
          } else {
            this._items.clear();
            Object.keys(this._indices).forEach(function(key) {
              self._indices[key].clear();
            });
          }
        },
        /**
         * 获取元素数量
         * @param {string} [type] - 元素类型，不传则返回总数
         * @returns {number} 元素数量
         */
        count: function(type) {
          if (type) {
            return this._indices[type] ? this._indices[type].size : 0;
          }
          return this._items.size;
        },
        // ========================================
        // 显示/隐藏
        // ========================================
        /**
         * 隐藏元素
         * @param {string} id - 元素ID
         * @returns {boolean} 是否成功隐藏
         */
        hide: function(id) {
          if (this._items.has(id)) {
            this._hidden.add(id);
            return true;
          }
          return false;
        },
        /**
         * 显示元素
         * @param {string} id - 元素ID
         * @returns {boolean} 是否成功显示
         */
        show: function(id) {
          if (this._hidden.has(id)) {
            this._hidden.delete(id);
            return true;
          }
          return false;
        },
        /**
         * 切换元素的显示/隐藏状态
         * @param {string} id - 元素ID
         * @returns {boolean} 切换后的状态 (true=隐藏, false=显示)
         */
        toggle: function(id) {
          if (this._hidden.has(id)) {
            this._hidden.delete(id);
            return false;
          } else if (this._items.has(id)) {
            this._hidden.add(id);
            return true;
          }
          return false;
        },
        /**
         * 检查元素是否隐藏
         * @param {string} id - 元素ID
         * @returns {boolean} 是否隐藏
         */
        isHidden: function(id) {
          return this._hidden.has(id);
        },
        /**
         * 隐藏所有元素
         */
        hideAll: function() {
          var self = this;
          this._items.forEach(function(_, id) {
            self._hidden.add(id);
          });
        },
        /**
         * 显示所有元素
         */
        showAll: function() {
          this._hidden.clear();
        },
        /**
         * 隐藏某类型的所有元素
         * @param {string} type - 元素类型
         */
        hideByType: function(type) {
          var self = this;
          if (this._indices[type]) {
            this._indices[type].forEach(function(id) {
              self._hidden.add(id);
            });
          }
        },
        /**
         * 显示某类型的所有元素
         * @param {string} type - 元素类型
         */
        showByType: function(type) {
          var self = this;
          if (this._indices[type]) {
            this._indices[type].forEach(function(id) {
              self._hidden.delete(id);
            });
          }
        },
        /**
         * 获取所有可见元素
         * @returns {Array} 可见元素数组
         */
        getVisible: function() {
          var self = this;
          return this._items.values().filter(function(item) {
            return !self._hidden.has(item.id);
          });
        },
        /**
         * 获取所有隐藏元素
         * @returns {Array} 隐藏元素数组
         */
        getHidden: function() {
          var self = this;
          return Array.from(this._hidden).map(function(id) {
            return self._items.get(id);
          }).filter(function(item) {
            return item !== void 0;
          });
        },
        // ========================================
        // 内部方法
        // ========================================
        _generateId: function() {
          var timestamp = Date.now().toString(36);
          var random = Math.random().toString(36).substring(2, 8);
          return "overlay_" + timestamp + "_" + random + "_" + ++this._idCounter;
        }
      };
      module.exports = Overlay;
    }
  });

  // renderers/canvas/overlay/core/coord_system.js
  var require_coord_system = __commonJS({
    "renderers/canvas/overlay/core/coord_system.js"(exports, module) {
      "use strict";
      function CoordSystem(getDrawingArea, getVisibleRange) {
        this._getDrawingArea = getDrawingArea;
        this._getVisibleRange = getVisibleRange;
      }
      CoordSystem.prototype = {
        /**
         * 数据坐标 → 画布坐标
         * @param {number} x - 数据 X 坐标
         * @param {number} y - 数据 Y 坐标
         * @returns {Object} 画布坐标 {x, y}
         */
        toCanvas: function(x, y) {
          if (!this._isValidNumber(x) || !this._isValidNumber(y)) {
            return null;
          }
          var area = this._getDrawingArea();
          var range = this._getVisibleRange();
          if (!area || !range) {
            return { x, y };
          }
          var xRange = range.xMax - range.xMin;
          var yRange = range.yMax - range.yMin;
          var xScale = xRange !== 0 ? area.width / xRange : 1;
          var yScale = yRange !== 0 ? area.height / yRange : 1;
          return {
            x: area.x + (x - range.xMin) * xScale,
            y: area.y + area.height - (y - range.yMin) * yScale
          };
        },
        /**
         * 画布坐标 → 数据坐标
         * @param {number} canvasX - 画布 X 坐标
         * @param {number} canvasY - 画布 Y 坐标
         * @returns {Object} 数据坐标 {x, y}
         */
        toData: function(canvasX, canvasY) {
          if (!this._isValidNumber(canvasX) || !this._isValidNumber(canvasY)) {
            return null;
          }
          var area = this._getDrawingArea();
          var range = this._getVisibleRange();
          if (!area || !range) {
            return { x: canvasX, y: canvasY };
          }
          var xRange = range.xMax - range.xMin;
          var yRange = range.yMax - range.yMin;
          var xScale = xRange !== 0 ? area.width / xRange : 1;
          var yScale = yRange !== 0 ? area.height / yRange : 1;
          return {
            x: range.xMin + (canvasX - area.x) / xScale,
            y: range.yMin + (area.y + area.height - canvasY) / yScale
          };
        },
        /**
         * 批量转换到画布坐标
         * @param {Array} points - 点数组 [{x, y} 或 [x, y]]
         * @returns {Array} 画布坐标数组
         */
        toCanvasBatch: function(points) {
          var self = this;
          return points.map(function(p) {
            var x = p.x !== void 0 ? p.x : p[0];
            var y = p.y !== void 0 ? p.y : p[1];
            return self.toCanvas(x, y);
          }).filter(function(p) {
            return p !== null;
          });
        },
        /**
         * 检查是否在绘制区域内
         * @param {number} canvasX - 画布 X 坐标
         * @param {number} canvasY - 画布 Y 坐标
         * @returns {boolean} 是否在区域内
         */
        isInBounds: function(canvasX, canvasY) {
          var area = this._getDrawingArea();
          if (!area)
            return true;
          return canvasX >= area.x && canvasX <= area.x + area.width && canvasY >= area.y && canvasY <= area.y + area.height;
        },
        /**
         * 获取当前缩放比例
         * @returns {Object} 缩放比例 {x, y}
         */
        getScale: function() {
          var area = this._getDrawingArea();
          var range = this._getVisibleRange();
          if (!area || !range) {
            return { x: 1, y: 1 };
          }
          var xRange = range.xMax - range.xMin;
          var yRange = range.yMax - range.yMin;
          return {
            x: xRange !== 0 ? area.width / xRange : 1,
            y: yRange !== 0 ? area.height / yRange : 1
          };
        },
        /**
         * 获取绘制区域
         * @returns {Object} 绘制区域
         */
        getDrawingArea: function() {
          return this._getDrawingArea();
        },
        /**
         * 获取可见范围
         * @returns {Object} 可见范围
         */
        getVisibleRange: function() {
          return this._getVisibleRange();
        },
        // ========================================
        // 内部方法
        // ========================================
        _isValidNumber: function(value) {
          return typeof value === "number" && isFinite(value) && !isNaN(value);
        }
      };
      module.exports = CoordSystem;
    }
  });

  // renderers/canvas/overlay/core/event_emitter.js
  var require_event_emitter = __commonJS({
    "renderers/canvas/overlay/core/event_emitter.js"(exports, module) {
      "use strict";
      function EventEmitter() {
        this._events = {};
      }
      EventEmitter.prototype = {
        /**
         * 订阅事件
         * @param {string} event - 事件名称
         * @param {Function} handler - 处理函数
         */
        on: function(event, handler) {
          if (!this._events[event]) {
            this._events[event] = [];
          }
          this._events[event].push(handler);
          return this;
        },
        /**
         * 取消订阅
         * @param {string} event - 事件名称
         * @param {Function} handler - 处理函数
         */
        off: function(event, handler) {
          if (!this._events[event])
            return this;
          if (handler) {
            this._events[event] = this._events[event].filter(function(h) {
              return h !== handler;
            });
          } else {
            delete this._events[event];
          }
          return this;
        },
        /**
         * 订阅一次
         * @param {string} event - 事件名称
         * @param {Function} handler - 处理函数
         */
        once: function(event, handler) {
          var self = this;
          var wrapper = function(data) {
            handler(data);
            self.off(event, wrapper);
          };
          return this.on(event, wrapper);
        },
        /**
         * 发射事件
         * @param {string} event - 事件名称
         * @param {*} data - 事件数据
         */
        emit: function(event, data) {
          if (!this._events[event])
            return this;
          var handlers = this._events[event].slice();
          for (var i = 0; i < handlers.length; i++) {
            handlers[i](data);
          }
          return this;
        },
        /**
         * 清除所有事件
         */
        clear: function() {
          this._events = {};
        }
      };
      module.exports = EventEmitter;
    }
  });

  // renderers/canvas/overlay/services/static_drawer.js
  var require_static_drawer = __commonJS({
    "renderers/canvas/overlay/services/static_drawer.js"(exports, module) {
      "use strict";
      function StaticDrawer(overlay, refreshCallback) {
        this._overlay = overlay;
        this._refresh = refreshCallback || function() {
        };
      }
      StaticDrawer.prototype = {
        /**
         * 绘制点
         * @param {number} x - X 坐标（数据坐标）
         * @param {number} y - Y 坐标（数据坐标）
         * @param {Object} options - 点选项
         * @returns {string} 元素ID
         */
        drawPoint: function(x, y, options) {
          var id = this._overlay.add("point", {
            x,
            y,
            options: options || {}
          });
          this._refresh();
          return id;
        },
        /**
         * 绘制线
         * @param {Array} points - 点数组 [{x, y} 或 [x, y]]
         * @param {Object} options - 线选项
         * @returns {string} 元素ID
         */
        drawLine: function(points, options) {
          var id = this._overlay.add("line", {
            points: this._normalizePoints(points),
            options: options || {}
          });
          this._refresh();
          return id;
        },
        /**
         * 绘制多边形
         * @param {Array} points - 点数组 [{x, y} 或 [x, y]]
         * @param {Object} options - 多边形选项
         * @returns {string} 元素ID
         */
        drawPolygon: function(points, options) {
          var id = this._overlay.add("polygon", {
            points: this._normalizePoints(points),
            options: options || {}
          });
          this._refresh();
          return id;
        },
        /**
         * 绘制文本
         * @param {number} x - X 坐标（数据坐标）
         * @param {number} y - Y 坐标（数据坐标）
         * @param {string} content - 文本内容
         * @param {Object} options - 文本选项
         * @returns {string} 元素ID
         */
        drawText: function(x, y, content, options) {
          var id = this._overlay.add("text", {
            x,
            y,
            content,
            options: options || {}
          });
          this._refresh();
          return id;
        },
        /**
         * 批量绘制（性能优化：只触发一次 refresh）
         * @param {Array} items - 元素数组 [{type, data}]
         * @returns {Array} 元素ID数组
         */
        drawBatch: function(items) {
          var ids = [];
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            ids.push(this._drawWithoutRefresh(item.type, item.data));
          }
          this._refresh();
          return ids;
        },
        /**
         * 更新元素
         * @param {string} id - 元素ID
         * @param {Object} data - 更新数据
         * @returns {Object|null} 更新后的元素
         */
        update: function(id, data) {
          var result = this._overlay.update(id, data);
          this._refresh();
          return result;
        },
        /**
         * 删除元素
         * @param {string} id - 元素ID
         * @returns {boolean} 是否删除成功
         */
        remove: function(id) {
          var result = this._overlay.remove(id);
          this._refresh();
          return result;
        },
        /**
         * 只更新样式（不影响数据）
         * @param {string} id - 元素ID
         * @param {Object} style - 样式对象
         * @returns {Object|null} 更新后的元素
         */
        updateStyle: function(id, style) {
          var item = this._overlay.get(id);
          if (!item)
            return null;
          if (!item.options) {
            item.options = {};
          }
          var styleProps = [
            // 通用样式
            "color",
            "opacity",
            "visible",
            // 点样式
            "size",
            "shape",
            "strokeColor",
            "strokeWidth",
            // 线样式
            "width",
            "lineWidth",
            "lineDash",
            "lineCap",
            "lineJoin",
            // 多边形样式
            "fill",
            "fillColor",
            "stroke",
            "strokeColor",
            // 文字样式
            "fontSize",
            "fontFamily",
            "fontWeight",
            "fontStyle",
            "textAlign",
            "textBaseline",
            "angle",
            "offsetX",
            "offsetY",
            "backgroundColor",
            "padding",
            "borderRadius",
            "borderColor",
            "borderWidth"
          ];
          for (var i = 0; i < styleProps.length; i++) {
            var prop = styleProps[i];
            if (style[prop] !== void 0) {
              item.options[prop] = style[prop];
            }
          }
          if (style.options) {
            Object.assign(item.options, style.options);
          }
          this._refresh();
          return item;
        },
        /**
         * 只更新数据（不影响样式）
         * @param {string} id - 元素ID
         * @param {Object} data - 数据对象
         * @returns {Object|null} 更新后的元素
         */
        updateData: function(id, data) {
          var item = this._overlay.get(id);
          if (!item)
            return null;
          switch (item.type) {
            case "point":
              if (data.x !== void 0)
                item.x = data.x;
              if (data.y !== void 0)
                item.y = data.y;
              break;
            case "line":
            case "polygon":
              if (data.points !== void 0) {
                item.points = this._normalizePoints(data.points);
              }
              break;
            case "text":
              if (data.x !== void 0)
                item.x = data.x;
              if (data.y !== void 0)
                item.y = data.y;
              if (data.content !== void 0)
                item.content = data.content;
              break;
          }
          this._refresh();
          return item;
        },
        /**
         * 批量更新样式
         * @param {Array} ids - 元素ID数组
         * @param {Object} style - 样式对象
         * @returns {Array} 更新成功的元素数组
         */
        updateStyles: function(ids, style) {
          var self = this;
          var updated = [];
          for (var i = 0; i < ids.length; i++) {
            var item = this.updateStyle(ids[i], style);
            if (item)
              updated.push(item);
          }
          return updated;
        },
        /**
         * 批量更新数据
         * @param {Array} dataList - 数据列表 [{id, ...data}]
         * @returns {Array} 更新成功的元素数组
         */
        updateDataList: function(dataList) {
          var updated = [];
          for (var i = 0; i < dataList.length; i++) {
            var data = dataList[i];
            var id = data.id;
            if (id) {
              var item = this._overlay.get(id);
              if (item) {
                var updateData = Object.assign({}, data);
                delete updateData.id;
                this.updateData(id, updateData);
                updated.push(item);
              }
            }
          }
          this._refresh();
          return updated;
        },
        // ========================================
        // 内部方法
        // ========================================
        _drawWithoutRefresh: function(type, data) {
          return this._overlay.add(type, data);
        },
        _normalizePoints: function(points) {
          if (!Array.isArray(points))
            return [];
          return points.filter(function(p) {
            if (!p)
              return false;
            var x = p.x !== void 0 ? p.x : p[0];
            var y = p.y !== void 0 ? p.y : p[1];
            return typeof x === "number" && isFinite(x) && typeof y === "number" && isFinite(y);
          }).map(function(p) {
            if (Array.isArray(p)) {
              return { x: p[0], y: p[1] };
            }
            return { x: p.x, y: p.y };
          });
        }
      };
      module.exports = StaticDrawer;
    }
  });

  // renderers/canvas/overlay/services/interactive_drawer.js
  var require_interactive_drawer = __commonJS({
    "renderers/canvas/overlay/services/interactive_drawer.js"(exports, module) {
      "use strict";
      var EventEmitter = require_event_emitter();
      function InteractiveDrawer(config) {
        this._overlay = config.overlay;
        this._coordSystem = config.coordSystem;
        this._refresh = config.refresh || function() {
        };
        this._state = {
          mode: null,
          // 'point' | 'line' | 'polygon' | 'text' | null
          status: "idle",
          // 'idle' | 'drawing' | 'completed'
          tempPoints: [],
          options: {},
          mousePos: null
        };
        this._events = new EventEmitter();
        this._canvas = null;
        this._boundHandlers = {};
      }
      InteractiveDrawer.prototype = {
        // ========================================
        // 生命周期
        // ========================================
        /**
         * 开始交互绘制
         * @param {string} mode - 绘制模式
         * @param {Object} options - 绘制选项
         * @param {HTMLCanvasElement} canvas - 画布元素
         * @param {Function} onComplete - 完成回调
         */
        start: function(mode, options, canvas, onComplete) {
          this.stop();
          this._state.mode = mode;
          this._state.status = "drawing";
          this._state.options = options || {};
          this._state.tempPoints = [];
          this._state.mousePos = null;
          this._canvas = canvas;
          if (onComplete) {
            this._events.once("complete", onComplete);
          }
          this._bindEvents();
          this._events.emit("start", { mode });
        },
        /**
         * 停止交互绘制
         */
        stop: function() {
          this._unbindEvents();
          this._state.mode = null;
          this._state.status = "idle";
          this._state.tempPoints = [];
          this._state.mousePos = null;
          this._canvas = null;
          this._events.emit("stop");
        },
        // ========================================
        // 状态查询
        // ========================================
        /**
         * 获取当前绘制状态（用于渲染预览）
         * @returns {Object} 状态对象
         */
        getState: function() {
          return {
            mode: this._state.mode,
            status: this._state.status,
            points: this._state.tempPoints.slice(),
            mousePos: this._state.mousePos ? {
              x: this._state.mousePos.x,
              y: this._state.mousePos.y
            } : null,
            options: Object.assign({}, this._state.options)
          };
        },
        /**
         * 是否正在绘制
         * @returns {boolean}
         */
        isDrawing: function() {
          return this._state.status === "drawing";
        },
        /**
         * 获取当前模式
         * @returns {string|null}
         */
        getMode: function() {
          return this._state.mode;
        },
        /**
         * 获取临时点
         * @returns {Array}
         */
        getTempPoints: function() {
          return this._state.tempPoints.slice();
        },
        // ========================================
        // 事件订阅
        // ========================================
        /**
         * 订阅事件
         * @param {string} event - 事件名称
         * @param {Function} handler - 处理函数
         */
        on: function(event, handler) {
          this._events.on(event, handler);
          return this;
        },
        /**
         * 取消订阅
         * @param {string} event - 事件名称
         * @param {Function} handler - 处理函数
         */
        off: function(event, handler) {
          this._events.off(event, handler);
          return this;
        },
        // ========================================
        // 内部方法 - 事件处理
        // ========================================
        _bindEvents: function() {
          if (!this._canvas)
            return;
          var self = this;
          this._boundHandlers = {
            click: function(e) {
              self._handleClick(e);
            },
            dblclick: function(e) {
              self._handleDblClick(e);
            },
            mousemove: function(e) {
              self._handleMouseMove(e);
            },
            keydown: function(e) {
              self._handleKeyDown(e);
            }
          };
          this._canvas.addEventListener("click", this._boundHandlers.click);
          this._canvas.addEventListener("dblclick", this._boundHandlers.dblclick);
          this._canvas.addEventListener("mousemove", this._boundHandlers.mousemove);
          document.addEventListener("keydown", this._boundHandlers.keydown);
        },
        _unbindEvents: function() {
          if (this._canvas) {
            this._canvas.removeEventListener("click", this._boundHandlers.click);
            this._canvas.removeEventListener("dblclick", this._boundHandlers.dblclick);
            this._canvas.removeEventListener("mousemove", this._boundHandlers.mousemove);
          }
          document.removeEventListener("keydown", this._boundHandlers.keydown);
          this._boundHandlers = {};
        },
        _handleClick: function(e) {
          var pos = this._getCanvasPos(e);
          if (!this._coordSystem.isInBounds(pos.x, pos.y))
            return;
          var dataPos = this._coordSystem.toData(pos.x, pos.y);
          if (!dataPos)
            return;
          switch (this._state.mode) {
            case "point":
              this._completePoint(dataPos);
              break;
            case "line":
            case "polygon":
              this._addTempPoint(dataPos);
              break;
            case "text":
              this._completeText(dataPos);
              break;
          }
        },
        _handleDblClick: function(e) {
          if (this._state.mode === "line" || this._state.mode === "polygon") {
            this._completeMultiPoint();
          }
        },
        _handleMouseMove: function(e) {
          if (!this.isDrawing())
            return;
          if (this._state.mode !== "line" && this._state.mode !== "polygon")
            return;
          var pos = this._getCanvasPos(e);
          if (!this._coordSystem.isInBounds(pos.x, pos.y))
            return;
          var dataPos = this._coordSystem.toData(pos.x, pos.y);
          if (!dataPos)
            return;
          this._state.mousePos = dataPos;
          this._events.emit("preview", this.getState());
          this._refresh();
        },
        _handleKeyDown: function(e) {
          if (e.key === "Escape") {
            this.stop();
            this._refresh();
          } else if (e.key === "Enter") {
            if (this._state.mode === "line" || this._state.mode === "polygon") {
              this._completeMultiPoint();
            }
          }
        },
        // ========================================
        // 内部方法 - 状态转换
        // ========================================
        _addTempPoint: function(dataPos) {
          this._state.tempPoints.push([dataPos.x, dataPos.y]);
          this._events.emit("point", {
            index: this._state.tempPoints.length - 1,
            position: dataPos
          });
          this._refresh();
        },
        _completePoint: function(dataPos) {
          var id = this._overlay.add("point", {
            x: dataPos.x,
            y: dataPos.y,
            options: this._state.options
          });
          this._state.status = "completed";
          this._events.emit("complete", {
            type: "point",
            id,
            x: dataPos.x,
            y: dataPos.y
          });
          this.stop();
          this._refresh();
        },
        _completeText: function(dataPos) {
          var text = this._state.options.text || this._state.options.content || "";
          if (!text) {
            this.stop();
            return;
          }
          var textOptions = Object.assign({}, this._state.options);
          delete textOptions.text;
          delete textOptions.content;
          var id = this._overlay.add("text", {
            x: dataPos.x,
            y: dataPos.y,
            content: text,
            options: textOptions
          });
          this._state.status = "completed";
          this._events.emit("complete", {
            type: "text",
            id,
            x: dataPos.x,
            y: dataPos.y,
            content: text
          });
          this.stop();
          this._refresh();
        },
        _completeMultiPoint: function() {
          if (this._state.tempPoints.length < 2) {
            this.stop();
            return;
          }
          var type = this._state.mode;
          var id;
          if (type === "line") {
            id = this._overlay.add("line", {
              points: this._state.tempPoints.slice(),
              options: this._state.options
            });
            this._state.status = "completed";
            this._events.emit("complete", {
              type: "line",
              id,
              points: this._state.tempPoints.slice()
            });
          } else if (type === "polygon" && this._state.tempPoints.length >= 3) {
            id = this._overlay.add("polygon", {
              points: this._state.tempPoints.slice(),
              options: this._state.options
            });
            this._state.status = "completed";
            this._events.emit("complete", {
              type: "polygon",
              id,
              points: this._state.tempPoints.slice()
            });
          }
          this.stop();
          this._refresh();
        },
        _getCanvasPos: function(e) {
          var rect = this._canvas.getBoundingClientRect();
          return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
        }
      };
      module.exports = InteractiveDrawer;
    }
  });

  // renderers/canvas/overlay/renderers/text.js
  var require_text = __commonJS({
    "renderers/canvas/overlay/renderers/text.js"(exports, module) {
      "use strict";
      var DEFAULT_OPTIONS = {
        fontSize: 12,
        fontFamily: "Arial",
        fontWeight: "normal",
        color: "#000000",
        rotation: 0,
        align: "center",
        baseline: "middle",
        background: null
      };
      function mergeOptions(userOptions) {
        if (!userOptions) {
          return Object.assign({}, DEFAULT_OPTIONS);
        }
        return Object.assign({}, DEFAULT_OPTIONS, userOptions);
      }
      function buildFontString(options) {
        var fontWeight = options.fontWeight || "normal";
        var fontSize = options.fontSize || 12;
        var fontFamily = options.fontFamily || "Arial";
        return fontWeight + " " + fontSize + "px " + fontFamily;
      }
      function drawBackground(ctx, x, y, text, options) {
        if (!options.background) {
          return;
        }
        var padding = 2;
        var metrics = ctx.measureText(text);
        var textWidth = metrics.width;
        var textHeight = options.fontSize || 12;
        var boxX = x;
        var boxY = y;
        if (options.align === "center") {
          boxX = x - textWidth / 2;
        } else if (options.align === "right") {
          boxX = x - textWidth;
        }
        if (options.baseline === "middle") {
          boxY = y - textHeight / 2;
        } else if (options.baseline === "bottom") {
          boxY = y - textHeight;
        }
        ctx.fillStyle = options.background;
        ctx.fillRect(
          boxX - padding,
          boxY - padding,
          textWidth + padding * 2,
          textHeight + padding * 2
        );
      }
      function render(ctx, items, coordSystem) {
        if (!items || items.length === 0) {
          return;
        }
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var coords = coordSystem.toCanvas(item.x, item.y);
          if (!coords)
            continue;
          var options = mergeOptions(item.options);
          ctx.save();
          var fontString = buildFontString(options);
          ctx.font = fontString;
          ctx.fillStyle = options.color;
          ctx.textAlign = options.align;
          ctx.textBaseline = options.baseline;
          if (options.rotation !== 0) {
            ctx.translate(coords.x, coords.y);
            ctx.rotate(options.rotation);
            ctx.translate(-coords.x, -coords.y);
          }
          drawBackground(ctx, coords.x, coords.y, item.content, options);
          ctx.fillText(item.content, coords.x, coords.y);
          ctx.restore();
        }
      }
      function drawText(ctx, x, y, content, options) {
        if (!content)
          return;
        var opts = mergeOptions(options);
        ctx.save();
        ctx.font = buildFontString(opts);
        ctx.fillStyle = opts.color;
        ctx.textAlign = opts.align;
        ctx.textBaseline = opts.baseline;
        ctx.translate(x, y);
        if (opts.rotation) {
          ctx.rotate(opts.rotation);
        }
        if (opts.background) {
          var metrics = ctx.measureText(content);
          var bgWidth = metrics.width + 6;
          var bgHeight = opts.fontSize + 4;
          ctx.fillStyle = opts.background;
          var bgX = 0;
          var bgY = 0;
          if (opts.align === "center") {
            bgX = -bgWidth / 2;
          } else if (opts.align === "right") {
            bgX = -bgWidth;
          }
          if (opts.baseline === "middle") {
            bgY = -bgHeight / 2;
          } else if (opts.baseline === "bottom") {
            bgY = -bgHeight;
          }
          ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
          ctx.fillStyle = opts.color;
        }
        ctx.fillText(content, 0, 0);
        ctx.restore();
      }
      module.exports = {
        DEFAULT_OPTIONS,
        mergeOptions,
        render,
        drawText
      };
    }
  });

  // renderers/canvas/overlay/renderers/line.js
  var require_line = __commonJS({
    "renderers/canvas/overlay/renderers/line.js"(exports, module) {
      "use strict";
      var textDrawer = require_text();
      var DEFAULTS = {
        color: "#000000",
        width: 1,
        style: "solid",
        cap: "round",
        join: "round"
      };
      function mergeOptions(options) {
        var result = {};
        for (var key in DEFAULTS) {
          result[key] = options && options[key] !== void 0 ? options[key] : DEFAULTS[key];
        }
        return result;
      }
      function setLineStyle(ctx, style, width) {
        switch (style) {
          case "dashed":
            ctx.setLineDash([width * 3, width * 2]);
            break;
          case "dotted":
            ctx.setLineDash([width, width * 2]);
            break;
          default:
            ctx.setLineDash([]);
        }
      }
      function getAngleAtPoint(points, index) {
        var prev = Math.max(0, index - 1);
        var next = Math.min(points.length - 1, index + 1);
        var dx = points[next].x - points[prev].x;
        var dy = points[next].y - points[prev].y;
        return Math.atan2(dy, dx);
      }
      function getPointAtPosition(points, position) {
        if (position === "start") {
          return { index: 0, point: points[0] };
        }
        if (position === "end") {
          return { index: points.length - 1, point: points[points.length - 1] };
        }
        if (position === "middle" || typeof position === "undefined") {
          var midIndex = Math.floor(points.length / 2);
          return { index: midIndex, point: points[midIndex] };
        }
        var idx = Math.min(Math.max(0, position), points.length - 1);
        return { index: idx, point: points[idx] };
      }
      function drawLine(ctx, points, options, coordSystem) {
        if (!points || points.length < 2)
          return;
        var opts = mergeOptions(options);
        ctx.save();
        var canvasPoints = [];
        for (var i = 0; i < points.length; i++) {
          var p = points[i];
          var x = p.x !== void 0 ? p.x : p[0];
          var y = p.y !== void 0 ? p.y : p[1];
          var canvasPos = coordSystem.toCanvas(x, y);
          if (canvasPos) {
            canvasPoints.push(canvasPos);
          }
        }
        if (canvasPoints.length < 2) {
          ctx.restore();
          return;
        }
        ctx.strokeStyle = opts.color;
        ctx.lineWidth = opts.width;
        ctx.lineCap = opts.cap;
        ctx.lineJoin = opts.join;
        setLineStyle(ctx, opts.style, opts.width);
        ctx.beginPath();
        ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
        for (var j = 1; j < canvasPoints.length; j++) {
          ctx.lineTo(canvasPoints[j].x, canvasPoints[j].y);
        }
        ctx.stroke();
        ctx.restore();
        if (options && options.text && options.text.content) {
          var textOpts = options.text;
          var posInfo = getPointAtPosition(canvasPoints, textOpts.position);
          var angle = textOpts.rotation === "auto" ? getAngleAtPoint(canvasPoints, posInfo.index) : textOpts.rotation || 0;
          var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
          var offsetY = textOpts.offset ? textOpts.offset[1] : -opts.width - 10;
          var perpAngle = angle + Math.PI / 2;
          var perpOffsetX = Math.cos(perpAngle) * Math.abs(offsetY);
          var perpOffsetY = Math.sin(perpAngle) * Math.abs(offsetY);
          ctx.save();
          ctx.translate(posInfo.point.x + perpOffsetX + offsetX, posInfo.point.y + perpOffsetY);
          ctx.rotate(angle);
          textDrawer.drawText(ctx, 0, 0, textOpts.content, {
            fontSize: textOpts.fontSize,
            fontFamily: textOpts.fontFamily,
            fontWeight: textOpts.fontWeight,
            color: textOpts.color,
            background: textOpts.background,
            align: "center",
            baseline: "middle"
          });
          ctx.restore();
        }
      }
      function render(ctx, items, coordSystem) {
        if (!items || items.length === 0)
          return;
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          drawLine(ctx, item.points, item.options, coordSystem);
        }
      }
      module.exports = {
        render,
        drawLine,
        DEFAULTS
      };
    }
  });

  // renderers/canvas/overlay/renderers/shapes.js
  var require_shapes = __commonJS({
    "renderers/canvas/overlay/renderers/shapes.js"(exports, module) {
      "use strict";
      function drawCircle(ctx, x, y, size) {
        var radius = size / 2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.closePath();
      }
      function drawSquare(ctx, x, y, size) {
        var half = size / 2;
        ctx.beginPath();
        ctx.rect(x - half, y - half, size, size);
        ctx.closePath();
      }
      function drawTriangle(ctx, x, y, size) {
        var half = size / 2;
        ctx.beginPath();
        ctx.moveTo(x, y - half);
        ctx.lineTo(x + half, y + half);
        ctx.lineTo(x - half, y + half);
        ctx.closePath();
      }
      function drawDiamond(ctx, x, y, size) {
        var half = size / 2;
        ctx.beginPath();
        ctx.moveTo(x, y - half);
        ctx.lineTo(x + half, y);
        ctx.lineTo(x, y + half);
        ctx.lineTo(x - half, y);
        ctx.closePath();
      }
      function drawStar(ctx, x, y, size) {
        var outerRadius = size / 2;
        var innerRadius = outerRadius * 0.4;
        var points = 5;
        ctx.beginPath();
        for (var i = 0; i < points * 2; i++) {
          var radius = i % 2 === 0 ? outerRadius : innerRadius;
          var angle = i * Math.PI / points - Math.PI / 2;
          var px = x + Math.cos(angle) * radius;
          var py = y + Math.sin(angle) * radius;
          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
      }
      function drawCross(ctx, x, y, size) {
        var half = size / 2;
        var thick = size / 4;
        ctx.beginPath();
        ctx.rect(x - thick / 2, y - half, thick, size);
        ctx.rect(x - half, y - thick / 2, size, thick);
        ctx.closePath();
      }
      function getShapeDrawer(shape) {
        var shapeMap = {
          "circle": drawCircle,
          "square": drawSquare,
          "triangle": drawTriangle,
          "diamond": drawDiamond,
          "star": drawStar,
          "cross": drawCross
        };
        return shapeMap[shape] || drawCircle;
      }
      function isCustomShape(shape) {
        return typeof shape === "object" && (shape.svg || shape.image);
      }
      module.exports = {
        drawCircle,
        drawSquare,
        drawTriangle,
        drawDiamond,
        drawStar,
        drawCross,
        getShapeDrawer,
        isCustomShape
      };
    }
  });

  // renderers/canvas/overlay/renderers/point.js
  var require_point = __commonJS({
    "renderers/canvas/overlay/renderers/point.js"(exports, module) {
      "use strict";
      var shapes = require_shapes();
      var textDrawer = require_text();
      var DEFAULTS = {
        size: 8,
        color: "#ff0000",
        strokeColor: null,
        strokeWidth: 0,
        shape: "circle"
      };
      function mergeOptions(options) {
        var result = {};
        for (var key in DEFAULTS) {
          result[key] = options && options[key] !== void 0 ? options[key] : DEFAULTS[key];
        }
        return result;
      }
      function drawCustomImage(ctx, x, y, size, customShape, callback) {
        if (typeof Image === "undefined") {
          if (callback)
            callback();
          return;
        }
        var img = new Image();
        var src = customShape.svg || customShape.image;
        img.onload = function() {
          ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
          if (callback)
            callback();
        };
        img.onerror = function() {
          shapes.drawCircle(ctx, x, y, size);
          ctx.fillStyle = "#ff0000";
          ctx.fill();
          if (callback)
            callback();
        };
        img.src = src;
      }
      function drawPoint(ctx, x, y, options) {
        if (!ctx || x === null || y === null)
          return;
        var opts = mergeOptions(options);
        ctx.save();
        if (shapes.isCustomShape(opts.shape)) {
          drawCustomImage(ctx, x, y, opts.size, opts.shape);
        } else {
          var shapeDrawer = shapes.getShapeDrawer(opts.shape);
          shapeDrawer(ctx, x, y, opts.size);
          ctx.fillStyle = opts.color;
          ctx.fill();
          if (opts.strokeColor && opts.strokeWidth > 0) {
            ctx.strokeStyle = opts.strokeColor;
            ctx.lineWidth = opts.strokeWidth;
            ctx.stroke();
          }
        }
        ctx.restore();
        if (options && options.text && options.text.content) {
          var textOpts = options.text;
          var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
          var offsetY = textOpts.offset ? textOpts.offset[1] : -opts.size / 2 - 10;
          textDrawer.drawText(ctx, x + offsetX, y + offsetY, textOpts.content, {
            fontSize: textOpts.fontSize,
            fontFamily: textOpts.fontFamily,
            fontWeight: textOpts.fontWeight,
            color: textOpts.color,
            background: textOpts.background
          });
        }
      }
      function render(ctx, items, coordSystem) {
        if (!items || items.length === 0)
          return;
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var canvasPos = coordSystem.toCanvas(item.x, item.y);
          if (!canvasPos)
            continue;
          drawPoint(ctx, canvasPos.x, canvasPos.y, item.options);
        }
      }
      module.exports = {
        render,
        drawPoint,
        DEFAULTS
      };
    }
  });

  // renderers/canvas/overlay/renderers/patterns.js
  var require_patterns = __commonJS({
    "renderers/canvas/overlay/renderers/patterns.js"(exports, module) {
      "use strict";
      var patternCache = {};
      var isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
      function createCanvas(size) {
        if (isBrowser) {
          var canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          return canvas;
        } else {
          try {
            var nodeCanvas = __require("canvas");
            return nodeCanvas.createCanvas(size, size);
          } catch (e) {
            console.warn("node-canvas not available, patterns will not work in SSR");
            return null;
          }
        }
      }
      function createGridPattern(size, color, lineWidth, targetCtx) {
        var cacheKey = "grid_" + size + "_" + color + "_" + lineWidth;
        if (patternCache[cacheKey]) {
          return patternCache[cacheKey];
        }
        var canvas = createCanvas(size);
        if (!canvas)
          return null;
        var ctx = canvas.getContext("2d");
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth || 1;
        ctx.beginPath();
        ctx.moveTo(size / 2, 0);
        ctx.lineTo(size / 2, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, size / 2);
        ctx.lineTo(size, size / 2);
        ctx.stroke();
        var patternCtx = targetCtx || ctx;
        var pattern = patternCtx.createPattern(canvas, "repeat");
        patternCache[cacheKey] = pattern;
        return pattern;
      }
      function createHashPattern(size, color, lineWidth, angle, targetCtx) {
        var cacheKey = "hash_" + size + "_" + color + "_" + lineWidth + "_" + angle;
        if (patternCache[cacheKey]) {
          return patternCache[cacheKey];
        }
        var canvas = createCanvas(size);
        if (!canvas)
          return null;
        var ctx = canvas.getContext("2d");
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth || 1;
        var rad = (angle || 45) * Math.PI / 180;
        var offset = size / 2;
        ctx.beginPath();
        ctx.moveTo(0, offset);
        ctx.lineTo(size, offset + size * Math.tan(rad));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset + size * Math.tan(rad), size);
        ctx.stroke();
        var patternCtx = targetCtx || ctx;
        var pattern = patternCtx.createPattern(canvas, "repeat");
        patternCache[cacheKey] = pattern;
        return pattern;
      }
      function createDiagonalPattern(size, color, lineWidth, angle, targetCtx) {
        var cacheKey = "diagonal_" + size + "_" + color + "_" + lineWidth + "_" + angle;
        if (patternCache[cacheKey]) {
          return patternCache[cacheKey];
        }
        var canvas = createCanvas(size);
        if (!canvas)
          return null;
        var ctx = canvas.getContext("2d");
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth || 1;
        var rad = (angle || 45) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(0, size);
        ctx.lineTo(size, 0);
        ctx.stroke();
        var patternCtx = targetCtx || ctx;
        var pattern = patternCtx.createPattern(canvas, "repeat");
        patternCache[cacheKey] = pattern;
        return pattern;
      }
      function createDotsPattern(size, color, dotSize, targetCtx) {
        var cacheKey = "dots_" + size + "_" + color + "_" + dotSize;
        if (patternCache[cacheKey]) {
          return patternCache[cacheKey];
        }
        var canvas = createCanvas(size);
        if (!canvas)
          return null;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, dotSize || size / 6, 0, Math.PI * 2);
        ctx.fill();
        var patternCtx = targetCtx || ctx;
        var pattern = patternCtx.createPattern(canvas, "repeat");
        patternCache[cacheKey] = pattern;
        return pattern;
      }
      function createSVGPattern(svgSource, size, targetCtx, callback) {
        if (typeof Image === "undefined") {
          if (callback)
            callback(null);
          return;
        }
        var img = new Image();
        img.onload = function() {
          var canvas = createCanvas(size);
          if (!canvas) {
            if (callback)
              callback(null);
            return;
          }
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, size, size);
          var patternCtx = targetCtx || ctx;
          var pattern = patternCtx.createPattern(canvas, "repeat");
          if (callback)
            callback(pattern);
        };
        img.onerror = function() {
          if (callback)
            callback(null);
        };
        img.src = svgSource;
      }
      function getPattern(fillConfig, ctx) {
        if (!fillConfig || fillConfig.type !== "pattern") {
          return null;
        }
        var pattern = fillConfig.pattern;
        var color = fillConfig.patternColor || fillConfig.color || "#000000";
        var size = fillConfig.patternSize || 10;
        var lineWidth = fillConfig.patternLineWidth || 1;
        if (typeof pattern === "string") {
          switch (pattern) {
            case "grid":
              return createGridPattern(size, color, lineWidth, ctx);
            case "hash":
              return createHashPattern(size, color, lineWidth, fillConfig.patternAngle, ctx);
            case "diagonal":
              return createDiagonalPattern(size, color, lineWidth, fillConfig.patternAngle, ctx);
            case "dots":
              return createDotsPattern(size, color, fillConfig.patternDotSize, ctx);
          }
        }
        if (typeof pattern === "object" && pattern.svg) {
          return null;
        }
        return null;
      }
      function clearCache() {
        patternCache = {};
      }
      module.exports = {
        createGridPattern,
        createHashPattern,
        createDiagonalPattern,
        createDotsPattern,
        createSVGPattern,
        getPattern,
        clearCache
      };
    }
  });

  // renderers/canvas/overlay/renderers/polygon.js
  var require_polygon = __commonJS({
    "renderers/canvas/overlay/renderers/polygon.js"(exports, module) {
      "use strict";
      var patterns = require_patterns();
      var textDrawer = require_text();
      var DEFAULT_FILL = {
        type: "color",
        color: "rgba(0, 0, 0, 0.3)"
      };
      var DEFAULT_STROKE = {
        color: "#000000",
        width: 1,
        style: "solid"
      };
      function normalizeOptions(options) {
        options = options || {};
        var fill, stroke;
        if (options.fill) {
          fill = options.fill;
        } else if (options.fillColor) {
          fill = {
            type: "color",
            color: options.fillColor
          };
        } else if (options.color && !options.strokeColor && !options.stroke) {
          fill = {
            type: "color",
            color: options.color
          };
        } else {
          fill = DEFAULT_FILL;
        }
        if (options.stroke !== void 0) {
          stroke = options.stroke;
        } else if (options.strokeColor !== void 0 || options.strokeWidth !== void 0) {
          stroke = {
            color: options.strokeColor || DEFAULT_STROKE.color,
            width: options.strokeWidth !== void 0 ? options.strokeWidth : DEFAULT_STROKE.width,
            style: options.strokeStyle || DEFAULT_STROKE.style
          };
        } else if (options.color && (options.strokeColor !== void 0 || options.width !== void 0)) {
          stroke = {
            color: options.color,
            width: options.width !== void 0 ? options.width : DEFAULT_STROKE.width,
            style: options.strokeStyle || DEFAULT_STROKE.style
          };
        } else if (options.color && options.fill) {
          stroke = {
            color: options.color,
            width: options.width !== void 0 ? options.width : DEFAULT_STROKE.width,
            style: options.strokeStyle || DEFAULT_STROKE.style
          };
        } else if (options.stroke === null) {
          stroke = null;
        } else {
          stroke = null;
        }
        return {
          fill,
          stroke,
          opacity: options.opacity,
          text: options.text
        };
      }
      function calculateCenter(points) {
        if (!points || points.length === 0) {
          return { x: 0, y: 0 };
        }
        var sumX = 0, sumY = 0;
        for (var i = 0; i < points.length; i++) {
          var p = points[i];
          sumX += p.x !== void 0 ? p.x : p[0];
          sumY += p.y !== void 0 ? p.y : p[1];
        }
        return {
          x: sumX / points.length,
          y: sumY / points.length
        };
      }
      function drawPolygon(ctx, points, options, coordSystem) {
        if (!points || points.length < 3)
          return;
        var opts = normalizeOptions(options);
        var canvasPoints = [];
        for (var i = 0; i < points.length; i++) {
          var p = points[i];
          var x = p.x !== void 0 ? p.x : p[0];
          var y = p.y !== void 0 ? p.y : p[1];
          var canvasPos = coordSystem.toCanvas(x, y);
          if (canvasPos) {
            canvasPoints.push(canvasPos);
          }
        }
        if (canvasPoints.length < 3) {
          return;
        }
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
        for (var j = 1; j < canvasPoints.length; j++) {
          ctx.lineTo(canvasPoints[j].x, canvasPoints[j].y);
        }
        ctx.closePath();
        if (opts.opacity !== void 0) {
          ctx.globalAlpha = opts.opacity;
        }
        var fill = opts.fill || DEFAULT_FILL;
        if (fill.type === "pattern") {
          var pattern = patterns.getPattern(fill, ctx);
          if (pattern) {
            ctx.fillStyle = pattern;
          } else {
            ctx.fillStyle = fill.color || DEFAULT_FILL.color;
          }
        } else {
          ctx.fillStyle = fill.color || DEFAULT_FILL.color;
        }
        ctx.fill();
        var stroke = opts.stroke;
        if (stroke && stroke.color) {
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width || DEFAULT_STROKE.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          switch (stroke.style) {
            case "dashed":
              ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
              break;
            case "dotted":
              ctx.setLineDash([ctx.lineWidth, ctx.lineWidth * 2]);
              break;
            default:
              ctx.setLineDash([]);
          }
          ctx.stroke();
        }
        ctx.restore();
        if (opts.text && opts.text.content) {
          var textOpts = opts.text;
          var center;
          if (textOpts.position === "center" || !textOpts.position) {
            center = calculateCenter(canvasPoints);
          } else if (Array.isArray(textOpts.position)) {
            center = coordSystem.toCanvas(textOpts.position[0], textOpts.position[1]);
          } else {
            center = calculateCenter(canvasPoints);
          }
          if (center) {
            var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
            var offsetY = textOpts.offset ? textOpts.offset[1] : 0;
            textDrawer.drawText(ctx, center.x + offsetX, center.y + offsetY, textOpts.content, {
              fontSize: textOpts.fontSize,
              fontFamily: textOpts.fontFamily,
              fontWeight: textOpts.fontWeight,
              color: textOpts.color,
              background: textOpts.background
            });
          }
        }
      }
      function render(ctx, items, coordSystem) {
        if (!items || items.length === 0)
          return;
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          drawPolygon(ctx, item.points, item.options, coordSystem);
        }
      }
      module.exports = {
        render,
        drawPolygon,
        calculateCenter,
        DEFAULT_FILL,
        DEFAULT_STROKE
      };
    }
  });

  // renderers/canvas/overlay/services/renderer.js
  var require_renderer = __commonJS({
    "renderers/canvas/overlay/services/renderer.js"(exports, module) {
      "use strict";
      var lineRenderer = require_line();
      var pointRenderer = require_point();
      var polygonRenderer = require_polygon();
      var textRenderer = require_text();
      function OverlayRenderer(coordSystem) {
        this._coordSystem = coordSystem;
      }
      OverlayRenderer.prototype = {
        /**
         * 渲染所有元素（应用裁剪)
         * @param {CanvasRenderingContext2D} ctx - 画布上下文
         * @param {Overlay} overlay - 数据容器
         * @param {Object} drawingArea - 绘制区域 {x, y, width, height}
         */
        render: function(ctx, overlay, drawingArea) {
          var self = this;
          ctx.save();
          if (drawingArea) {
            ctx.beginPath();
            ctx.rect(drawingArea.x, drawingArea.y, drawingArea.width, drawingArea.height);
            ctx.clip();
          }
          function filterVisible(items) {
            return items.filter(function(item) {
              return !overlay.isHidden(item.id);
            });
          }
          polygonRenderer.render(ctx, filterVisible(overlay.getByType("polygon")), self._coordSystem);
          lineRenderer.render(ctx, filterVisible(overlay.getByType("line")), self._coordSystem);
          pointRenderer.render(ctx, filterVisible(overlay.getByType("point")), self._coordSystem);
          textRenderer.render(ctx, filterVisible(overlay.getByType("text")), self._coordSystem);
          ctx.restore();
        },
        /**
         * 渲染临时状态（绘制过程中的预览）
         * @param {CanvasRenderingContext2D} ctx - 画布上下文
         * @param {Object} drawState - InteractiveDrawer 的状态
         */
        renderTemp: function(ctx, drawState) {
          if (!drawState || !drawState.mode || drawState.points.length === 0) {
            return;
          }
          var self = this;
          var points = drawState.points.slice();
          if (drawState.mousePos) {
            points.push([drawState.mousePos.x, drawState.mousePos.y]);
          }
          ctx.save();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = drawState.options.color || "#0066ff";
          ctx.lineWidth = drawState.options.width || 2;
          var canvasPoints = points.map(function(p) {
            return self._coordSystem.toCanvas(p[0], p[1]);
          }).filter(function(p) {
            return p !== null;
          });
          if (canvasPoints.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
            for (var i = 1; i < canvasPoints.length; i++) {
              ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
            }
            if (drawState.mode === "polygon" && canvasPoints.length >= 3) {
              ctx.closePath();
              var fillColor = drawState.options.fill && drawState.options.fill.color;
              ctx.fillStyle = fillColor || "rgba(0,100,255,0.2)";
              ctx.fill();
            }
            ctx.stroke();
          }
          canvasPoints.forEach(function(p) {
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.fillStyle = "#0066ff";
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();
        }
      };
      module.exports = OverlayRenderer;
    }
  });

  // renderers/canvas/overlay/services/overlay_manager.js
  var require_overlay_manager = __commonJS({
    "renderers/canvas/overlay/services/overlay_manager.js"(exports, module) {
      "use strict";
      function OverlayManager(config) {
        this._overlay = config.overlay;
        this._staticDrawer = config.staticDrawer;
        this._coordSystem = config.coordSystem;
        this._viewManager = config.viewManager;
        this._refresh = config.refresh || function() {
        };
        this._highlights = /* @__PURE__ */ new Map();
      }
      OverlayManager.prototype = {
        // ========================================
        // 视图管理器引用更新
        // ========================================
        /**
         * 更新视图管理器引用
         * @param {Object|Function} viewManager - 视图管理器或获取函数
         */
        setViewManager: function(viewManager) {
          this._viewManager = viewManager;
        },
        /**
         * 获取视图管理器实例
         * @returns {Object|null}
         * @private
         */
        _getViewManager: function() {
          if (typeof this._viewManager === "function") {
            return this._viewManager();
          }
          return this._viewManager;
        },
        // ========================================
        // 显示/隐藏管理
        // ========================================
        /**
         * 隐藏元素
         * @param {string} id - 元素ID
         * @returns {boolean} 是否成功
         */
        hide: function(id) {
          var result = this._overlay.hide(id);
          if (result)
            this._refresh();
          return result;
        },
        /**
         * 显示元素
         * @param {string} id - 元素ID
         * @returns {boolean} 是否成功
         */
        show: function(id) {
          var result = this._overlay.show(id);
          if (result)
            this._refresh();
          return result;
        },
        /**
         * 切换元素显示/隐藏
         * @param {string} id - 元素ID
         * @returns {boolean} 切换后的状态 (true=隐藏)
         */
        toggle: function(id) {
          var result = this._overlay.toggle(id);
          this._refresh();
          return result;
        },
        /**
         * 检查元素是否隐藏
         * @param {string} id - 元素ID
         * @returns {boolean}
         */
        isHidden: function(id) {
          return this._overlay.isHidden(id);
        },
        /**
         * 隐藏所有元素
         */
        hideAll: function() {
          this._overlay.hideAll();
          this._refresh();
        },
        /**
         * 显示所有元素
         */
        showAll: function() {
          this._overlay.showAll();
          this._refresh();
        },
        /**
         * 隐藏某类型的所有元素
         * @param {string} type - 元素类型
         */
        hideByType: function(type) {
          this._overlay.hideByType(type);
          this._refresh();
        },
        /**
         * 显示某类型的所有元素
         * @param {string} type - 元素类型
         */
        showByType: function(type) {
          this._overlay.showByType(type);
          this._refresh();
        },
        /**
         * 获取所有可见元素
         * @returns {Array}
         */
        getVisibleItems: function() {
          return this._overlay.getVisible();
        },
        /**
         * 获取所有隐藏元素
         * @returns {Array}
         */
        getHiddenItems: function() {
          return this._overlay.getHidden();
        },
        // ========================================
        // 定位/聚焦管理
        // ========================================
        /**
         * 聚焦到指定元素（调整视图使元素可见）
         * @param {string} id - 元素ID
         * @param {Object} options - 选项
         * @param {number} options.padding - 边距（像素），默认 50
         * @returns {boolean} 是否成功
         */
        focusTo: function(id, options) {
          var item = this._overlay.get(id);
          if (!item)
            return false;
          options = options || {};
          var bounds = this._calculateFocusBounds([item], options.padding || 50);
          if (!bounds)
            return false;
          return this._applyFocusBounds(bounds);
        },
        /**
         * 聚焦到多个元素（调整视图使所有元素可见）
         * @param {Array} ids - 元素ID数组
         * @param {Object} options - 选项
         * @returns {boolean} 是否成功
         */
        focusToBounds: function(ids, options) {
          if (!Array.isArray(ids) || ids.length === 0)
            return false;
          options = options || {};
          var items = [];
          for (var i = 0; i < ids.length; i++) {
            var item = this._overlay.get(ids[i]);
            if (item)
              items.push(item);
          }
          if (items.length === 0)
            return false;
          var bounds = this._calculateFocusBounds(items, options.padding || 50);
          if (!bounds)
            return false;
          return this._applyFocusBounds(bounds);
        },
        /**
         * 计算聚焦边界
         * @param {Array} items - 元素数组
         * @param {number} padding - 边距
         * @returns {Object|null}
         * @private
         */
        _calculateFocusBounds: function(items, padding) {
          if (!items || items.length === 0)
            return null;
          var bounds = {
            xMin: Infinity,
            xMax: -Infinity,
            yMin: Infinity,
            yMax: -Infinity
          };
          for (var i = 0; i < items.length; i++) {
            var itemBounds = this._getItemBounds(items[i]);
            if (itemBounds) {
              bounds.xMin = Math.min(bounds.xMin, itemBounds.xMin);
              bounds.xMax = Math.max(bounds.xMax, itemBounds.xMax);
              bounds.yMin = Math.min(bounds.yMin, itemBounds.yMin);
              bounds.yMax = Math.max(bounds.yMax, itemBounds.yMax);
            }
          }
          if (!isFinite(bounds.xMin))
            return null;
          var drawingArea = this._coordSystem.getDrawingArea();
          if (!drawingArea)
            return null;
          var xRange = bounds.xMax - bounds.xMin;
          var yRange = bounds.yMax - bounds.yMin;
          if (xRange === 0) {
            xRange = 1;
            bounds.xMin -= 0.5;
            bounds.xMax += 0.5;
          }
          if (yRange === 0) {
            yRange = 1;
            bounds.yMin -= 0.5;
            bounds.yMax += 0.5;
          }
          var paddingRatioX = padding / drawingArea.width;
          var paddingRatioY = padding / drawingArea.height;
          return {
            xMin: bounds.xMin - xRange * paddingRatioX,
            xMax: bounds.xMax + xRange * paddingRatioX,
            yMin: bounds.yMin - yRange * paddingRatioY,
            yMax: bounds.yMax + yRange * paddingRatioY
          };
        },
        /**
         * 应用聚焦边界
         * @param {Object} bounds - 边界
         * @returns {boolean}
         * @private
         */
        _applyFocusBounds: function(bounds) {
          var viewManager = this._getViewManager();
          if (viewManager && viewManager.setRange) {
            viewManager.setRange(bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax);
          }
          this._refresh();
          return true;
        },
        // ========================================
        // 高亮管理
        // ========================================
        /**
         * 高亮元素
         * @param {string} id - 元素ID
         * @param {Object} options - 选项
         * @param {string} options.color - 高亮颜色，默认 '#ff0000'
         * @param {number} options.duration - 持续时间(ms)，0 表示持续，默认 0
         * @param {number} options.lineWidth - 高亮时的线宽（线/多边形）
         * @param {number} options.size - 高亮时的大小（点）
         * @returns {boolean} 是否成功
         */
        highlight: function(id, options) {
          var item = this._overlay.get(id);
          if (!item)
            return false;
          options = options || {};
          var originalStyle = this._saveOriginalStyle(item);
          this._highlights.set(id, originalStyle);
          this._applyHighlightStyle(item, options);
          this._refresh();
          if (options.duration && options.duration > 0) {
            var self = this;
            setTimeout(function() {
              self.clearHighlight(id);
            }, options.duration);
          }
          return true;
        },
        /**
         * 保存元素的原始样式（支持扁平格式和嵌套格式）
         * @param {Object} item - 元素对象
         * @returns {Object} 原始样式
         * @private
         */
        _saveOriginalStyle: function(item) {
          var opts = item.options || {};
          var style = {
            // 扁平格式
            color: opts.color,
            fillColor: opts.fillColor,
            strokeColor: opts.strokeColor,
            strokeWidth: opts.strokeWidth,
            width: opts.width,
            lineWidth: opts.lineWidth,
            size: opts.size,
            // 嵌套格式（polygon）
            fill: opts.fill ? this._cloneObject(opts.fill) : void 0,
            stroke: opts.stroke ? this._cloneObject(opts.stroke) : void 0
          };
          return style;
        },
        /**
         * 应用高亮样式（支持扁平格式和嵌套格式）
         * @param {Object} item - 元素对象
         * @param {Object} options - 高亮选项
         * @private
         */
        _applyHighlightStyle: function(item, options) {
          if (!item.options)
            return;
          var highlightColor = options.color || "#ff0000";
          if (item.type === "polygon") {
            if (item.options.color !== void 0 || item.options.fillColor !== void 0) {
              item.options.color = highlightColor;
              item.options.fillColor = highlightColor;
            }
            if (item.options.fill && item.options.fill.color) {
              item.options.fill = {
                type: item.options.fill.type || "color",
                color: highlightColor
              };
            }
            if (!options.strokeColor) {
              item.options.strokeColor = highlightColor;
              if (item.options.stroke) {
                item.options.stroke = this._cloneObject(item.options.stroke);
                item.options.stroke.color = highlightColor;
              }
            }
            if (options.lineWidth !== void 0) {
              item.options.strokeWidth = options.lineWidth;
              item.options.lineWidth = options.lineWidth;
              if (item.options.stroke) {
                item.options.stroke = item.options.stroke || {};
                item.options.stroke.width = options.lineWidth;
              }
            }
          } else if (item.type === "line") {
            item.options.color = highlightColor;
            if (options.lineWidth !== void 0) {
              item.options.lineWidth = options.lineWidth;
              item.options.width = options.lineWidth;
            }
          } else if (item.type === "point") {
            item.options.color = highlightColor;
            if (options.size !== void 0) {
              item.options.size = options.size;
            }
          } else if (item.type === "text") {
            item.options.color = highlightColor;
          }
          if (options.strokeColor) {
            item.options.strokeColor = options.strokeColor;
          }
        },
        /**
         * 克隆对象（浅拷贝）
         * @param {Object} obj - 要克隆的对象
         * @returns {Object} 克隆后的对象
         * @private
         */
        _cloneObject: function(obj) {
          if (!obj)
            return obj;
          var clone = {};
          for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
              clone[key] = obj[key];
            }
          }
          return clone;
        },
        /**
         * 取消高亮
         * @param {string} id - 元素ID
         * @returns {boolean} 是否成功
         */
        clearHighlight: function(id) {
          var originalStyle = this._highlights.get(id);
          if (!originalStyle)
            return false;
          var item = this._overlay.get(id);
          if (item && item.options) {
            this._restoreOriginalStyle(item, originalStyle);
          }
          this._highlights.delete(id);
          this._refresh();
          return true;
        },
        /**
         * 恢复元素的原始样式（支持扁平格式和嵌套格式）
         * @param {Object} item - 元素对象
         * @param {Object} originalStyle - 原始样式
         * @private
         */
        _restoreOriginalStyle: function(item, originalStyle) {
          var opts = item.options;
          if (!opts)
            return;
          if (originalStyle.color !== void 0) {
            opts.color = originalStyle.color;
          } else {
            delete opts.color;
          }
          if (originalStyle.fillColor !== void 0) {
            opts.fillColor = originalStyle.fillColor;
          } else {
            delete opts.fillColor;
          }
          if (originalStyle.strokeColor !== void 0) {
            opts.strokeColor = originalStyle.strokeColor;
          } else {
            delete opts.strokeColor;
          }
          if (originalStyle.strokeWidth !== void 0) {
            opts.strokeWidth = originalStyle.strokeWidth;
          } else {
            delete opts.strokeWidth;
          }
          if (originalStyle.width !== void 0) {
            opts.width = originalStyle.width;
          }
          if (originalStyle.lineWidth !== void 0) {
            opts.lineWidth = originalStyle.lineWidth;
          }
          if (originalStyle.size !== void 0) {
            opts.size = originalStyle.size;
          }
          if (originalStyle.fill !== void 0) {
            opts.fill = originalStyle.fill ? this._cloneObject(originalStyle.fill) : void 0;
          }
          if (originalStyle.stroke !== void 0) {
            opts.stroke = originalStyle.stroke ? this._cloneObject(originalStyle.stroke) : void 0;
          }
        },
        /**
         * 取消所有高亮
         */
        clearAllHighlights: function() {
          var self = this;
          var ids = Array.from(this._highlights.keys());
          ids.forEach(function(id) {
            self.clearHighlight(id);
          });
        },
        /**
         * 检查元素是否处于高亮状态
         * @param {string} id - 元素ID
         * @returns {boolean}
         */
        isHighlighted: function(id) {
          return this._highlights.has(id);
        },
        /**
         * 获取所有高亮的元素ID
         * @returns {Array}
         */
        getHighlightedIds: function() {
          return Array.from(this._highlights.keys());
        },
        // ========================================
        // 样式/数据更新管理
        // ========================================
        /**
         * 只更新样式（不影响数据）
         * @param {string} id - 元素ID
         * @param {Object} style - 样式对象
         * @returns {Object|null} 更新后的元素
         */
        updateStyle: function(id, style) {
          return this._staticDrawer.updateStyle(id, style);
        },
        /**
         * 只更新数据（不影响样式）
         * @param {string} id - 元素ID
         * @param {Object} data - 数据对象
         * @returns {Object|null} 更新后的元素
         */
        updateData: function(id, data) {
          return this._staticDrawer.updateData(id, data);
        },
        /**
         * 批量更新样式
         * @param {Array} ids - 元素ID数组
         * @param {Object} style - 样式对象
         * @returns {Array} 更新成功的元素数组
         */
        updateStyles: function(ids, style) {
          return this._staticDrawer.updateStyles(ids, style);
        },
        /**
         * 批量更新数据
         * @param {Array} dataList - 数据列表 [{id, ...data}]
         * @returns {Array} 更新成功的元素数组
         */
        updateDataList: function(dataList) {
          return this._staticDrawer.updateDataList(dataList);
        },
        // ========================================
        // 内部工具方法
        // ========================================
        /**
         * 获取元素的边界
         * @param {Object} item - 元素对象
         * @returns {Object|null} { xMin, xMax, yMin, yMax }
         * @private
         */
        _getItemBounds: function(item) {
          if (!item)
            return null;
          var bounds = {
            xMin: Infinity,
            xMax: -Infinity,
            yMin: Infinity,
            yMax: -Infinity
          };
          switch (item.type) {
            case "point":
            case "text":
              if (typeof item.x === "number" && typeof item.y === "number") {
                bounds.xMin = bounds.xMax = item.x;
                bounds.yMin = bounds.yMax = item.y;
              }
              break;
            case "line":
            case "polygon":
              if (Array.isArray(item.points)) {
                for (var i = 0; i < item.points.length; i++) {
                  var p = item.points[i];
                  if (p && typeof p.x === "number" && typeof p.y === "number") {
                    bounds.xMin = Math.min(bounds.xMin, p.x);
                    bounds.xMax = Math.max(bounds.xMax, p.x);
                    bounds.yMin = Math.min(bounds.yMin, p.y);
                    bounds.yMax = Math.max(bounds.yMax, p.y);
                  }
                }
              }
              break;
          }
          if (!isFinite(bounds.xMin))
            return null;
          return bounds;
        }
      };
      module.exports = OverlayManager;
    }
  });

  // renderers/canvas/overlay/index.js
  var require_overlay2 = __commonJS({
    "renderers/canvas/overlay/index.js"(exports, module) {
      "use strict";
      var Overlay = require_overlay();
      var CoordSystem = require_coord_system();
      var EventEmitter = require_event_emitter();
      var StaticDrawer = require_static_drawer();
      var InteractiveDrawer = require_interactive_drawer();
      var OverlayRenderer = require_renderer();
      var OverlayManager = require_overlay_manager();
      function createOverlaySystem(renderer) {
        var overlay = new Overlay();
        var coordSystem = new CoordSystem(
          function getDrawingArea() {
            if (!renderer)
              return null;
            return typeof renderer._drawingArea === "function" ? renderer._drawingArea() : renderer._drawingArea;
          },
          function getVisibleRange() {
            if (!renderer)
              return null;
            if (renderer.getViewManager) {
              var vm = renderer.getViewManager();
              if (vm && vm.getState)
                return vm.getState();
            }
            return typeof renderer._fullRange === "function" ? renderer._fullRange() : renderer._fullRange;
          }
        );
        var overlayRenderer = new OverlayRenderer(coordSystem);
        var refresh = function() {
          if (renderer && typeof renderer.refresh === "function") {
            renderer.refresh();
          }
        };
        var staticDrawer = new StaticDrawer(overlay, refresh);
        var interactiveDrawer = new InteractiveDrawer({
          overlay,
          coordSystem,
          refresh
        });
        var getViewManager = function() {
          if (!renderer)
            return null;
          if (renderer.getViewManager)
            return renderer.getViewManager();
          return null;
        };
        var overlayManager = new OverlayManager({
          overlay,
          staticDrawer,
          coordSystem,
          viewManager: getViewManager,
          refresh
        });
        return {
          // 核心组件访问（只读）
          overlay,
          coordSystem,
          manager: overlayManager,
          // ========================================
          // 绘制 API（委托给 StaticDrawer）
          // ========================================
          drawPoint: function(x, y, options) {
            return staticDrawer.drawPoint(x, y, options);
          },
          drawLine: function(points, options) {
            return staticDrawer.drawLine(points, options);
          },
          drawPolygon: function(points, options) {
            return staticDrawer.drawPolygon(points, options);
          },
          drawText: function(x, y, content, options) {
            return staticDrawer.drawText(x, y, content, options);
          },
          drawBatch: function(items) {
            return staticDrawer.drawBatch(items);
          },
          // ========================================
          // 交互绘制 API（委托给 InteractiveDrawer）
          // ========================================
          startDrawing: function(mode, options, canvas, onComplete) {
            return interactiveDrawer.start(mode, options, canvas, onComplete);
          },
          stopDrawing: function() {
            return interactiveDrawer.stop();
          },
          isDrawing: function() {
            return interactiveDrawer.isDrawing();
          },
          getDrawMode: function() {
            return interactiveDrawer.getMode();
          },
          getDrawState: function() {
            return interactiveDrawer.getState();
          },
          getTempPoints: function() {
            return interactiveDrawer.getTempPoints();
          },
          // ========================================
          // 数据操作 API（委托给 Overlay + StaticDrawer）
          // ========================================
          getItem: function(id) {
            return overlay.get(id);
          },
          getItemsByType: function(type) {
            return overlay.getByType(type);
          },
          getAllItems: function() {
            return overlay.getAll();
          },
          updateItem: function(id, data) {
            return staticDrawer.update(id, data);
          },
          removeItem: function(id) {
            return staticDrawer.remove(id);
          },
          clear: function(type) {
            overlay.clear(type);
            refresh();
          },
          count: function(type) {
            return overlay.count(type);
          },
          // ========================================
          // 管理 API（委托给 OverlayManager）
          // ========================================
          hide: function(id) {
            return overlayManager.hide(id);
          },
          show: function(id) {
            return overlayManager.show(id);
          },
          toggle: function(id) {
            return overlayManager.toggle(id);
          },
          isHidden: function(id) {
            return overlayManager.isHidden(id);
          },
          hideAll: function() {
            overlayManager.hideAll();
          },
          showAll: function() {
            overlayManager.showAll();
          },
          hideByType: function(type) {
            overlayManager.hideByType(type);
          },
          showByType: function(type) {
            overlayManager.showByType(type);
          },
          getVisibleItems: function() {
            return overlayManager.getVisibleItems();
          },
          getHiddenItems: function() {
            return overlayManager.getHiddenItems();
          },
          focusTo: function(id, options) {
            overlayManager.setViewManager(getViewManager);
            return overlayManager.focusTo(id, options);
          },
          focusToBounds: function(ids, options) {
            overlayManager.setViewManager(getViewManager);
            return overlayManager.focusToBounds(ids, options);
          },
          highlight: function(id, options) {
            return overlayManager.highlight(id, options);
          },
          clearHighlight: function(id) {
            return overlayManager.clearHighlight(id);
          },
          clearAllHighlights: function() {
            overlayManager.clearAllHighlights();
          },
          isHighlighted: function(id) {
            return overlayManager.isHighlighted(id);
          },
          getHighlightedIds: function() {
            return overlayManager.getHighlightedIds();
          },
          updateStyle: function(id, style) {
            return overlayManager.updateStyle(id, style);
          },
          updateData: function(id, data) {
            return overlayManager.updateData(id, data);
          },
          updateStyles: function(ids, style) {
            return overlayManager.updateStyles(ids, style);
          },
          updateDataList: function(dataList) {
            return overlayManager.updateDataList(dataList);
          },
          // ========================================
          // 渲染 API
          // ========================================
          render: function(ctx) {
            overlayRenderer.render(ctx, overlay, coordSystem.getDrawingArea());
            overlayRenderer.renderTemp(ctx, interactiveDrawer.getState(), coordSystem.getDrawingArea());
          },
          refresh,
          // ========================================
          // 坐标转换 API
          // ========================================
          dataToCanvas: function(x, y) {
            return coordSystem.toCanvas(x, y);
          },
          canvasToData: function(x, y) {
            return coordSystem.toData(x, y);
          },
          getScale: function() {
            return coordSystem.getScale();
          },
          isInBounds: function(x, y) {
            return coordSystem.isInBounds(x, y);
          },
          // ========================================
          // 事件订阅 API
          // ========================================
          on: function(event, handler) {
            return interactiveDrawer.on(event, handler);
          },
          off: function(event, handler) {
            return interactiveDrawer.off(event, handler);
          }
        };
      }
      module.exports = createOverlaySystem;
      module.exports.Overlay = Overlay;
      module.exports.CoordSystem = CoordSystem;
      module.exports.EventEmitter = EventEmitter;
      module.exports.StaticDrawer = StaticDrawer;
      module.exports.InteractiveDrawer = InteractiveDrawer;
      module.exports.OverlayRenderer = OverlayRenderer;
      module.exports.OverlayManager = OverlayManager;
      module.exports.renderers = {
        line: require_line(),
        point: require_point(),
        polygon: require_polygon(),
        text: require_text(),
        shapes: require_shapes(),
        patterns: require_patterns()
      };
    }
  });

  // interaction/view_state.js
  var require_view_state = __commonJS({
    "interaction/view_state.js"(exports, module) {
      "use strict";
      function createViewManager(fullRange, options) {
        options = options || {};
        var minZoom = options.minZoom || 0.1;
        var maxZoom = options.maxZoom || 10;
        var fullXMin = fullRange.xMin;
        var fullXMax = fullRange.xMax;
        var fullYMin = fullRange.yMin;
        var fullYMax = fullRange.yMax;
        var fullXRange = fullXMax - fullXMin;
        var fullYRange = fullYMax - fullYMin;
        var visibleXMin = fullXMin;
        var visibleXMax = fullXMax;
        var visibleYMin = fullYMin;
        var visibleYMax = fullYMax;
        function getState() {
          var xRange = visibleXMax - visibleXMin;
          var yRange = visibleYMax - visibleYMin;
          var zoomX = fullXRange / xRange;
          var zoomY = fullYRange / yRange;
          return {
            xMin: visibleXMin,
            xMax: visibleXMax,
            yMin: visibleYMin,
            yMax: visibleYMax,
            zoom: Math.min(zoomX, zoomY),
            // Report the smaller zoom (less zoomed in)
            zoomX,
            zoomY
          };
        }
        function getFullRange() {
          return {
            xMin: fullXMin,
            xMax: fullXMax,
            yMin: fullYMin,
            yMax: fullYMax
          };
        }
        function zoomAt(factor, centerX, centerY, drawArea) {
          var currentState = getState();
          var newZoom = currentState.zoom * factor;
          if (newZoom < minZoom) {
            factor = minZoom / currentState.zoom;
          } else if (newZoom > maxZoom) {
            factor = maxZoom / currentState.zoom;
          }
          var xRange = visibleXMax - visibleXMin;
          var yRange = visibleYMax - visibleYMin;
          var newXRange = xRange / factor;
          var newYRange = yRange / factor;
          var xRatio = (centerX - visibleXMin) / xRange;
          var yRatio = (centerY - visibleYMin) / yRange;
          visibleXMin = centerX - xRatio * newXRange;
          visibleXMax = centerX + (1 - xRatio) * newXRange;
          visibleYMin = centerY - yRatio * newYRange;
          visibleYMax = centerY + (1 - yRatio) * newYRange;
          _clampToBounds();
        }
        function pan(dx, dy, drawArea) {
          var xRange = visibleXMax - visibleXMin;
          var yRange = visibleYMax - visibleYMin;
          var dataDx = -dx * (xRange / drawArea.width);
          var dataDy = dy * (yRange / drawArea.height);
          visibleXMin += dataDx;
          visibleXMax += dataDx;
          visibleYMin += dataDy;
          visibleYMax += dataDy;
          _clampToBounds();
        }
        function setRange(xMin, xMax, yMin, yMax) {
          visibleXMin = xMin;
          visibleXMax = xMax;
          visibleYMin = yMin;
          visibleYMax = yMax;
          _clampToBounds();
        }
        function reset() {
          visibleXMin = fullXMin;
          visibleXMax = fullXMax;
          visibleYMin = fullYMin;
          visibleYMax = fullYMax;
        }
        function _clampToBounds() {
          var xRange = visibleXMax - visibleXMin;
          var yRange = visibleYMax - visibleYMin;
          var maxRange = Math.max(fullXRange, fullYRange) / minZoom;
          if (xRange > maxRange) {
            var xCenter = (visibleXMin + visibleXMax) / 2;
            visibleXMin = xCenter - maxRange / 2;
            visibleXMax = xCenter + maxRange / 2;
          }
          if (yRange > maxRange) {
            var yCenter = (visibleYMin + visibleYMax) / 2;
            visibleYMin = yCenter - maxRange / 2;
            visibleYMax = yCenter + maxRange / 2;
          }
          var overflowX = xRange * 0.5;
          var overflowY = yRange * 0.5;
          if (visibleXMax < fullXMin - overflowX) {
            var shift = fullXMin - overflowX - visibleXMax;
            visibleXMin += shift;
            visibleXMax += shift;
          }
          if (visibleXMin > fullXMax + overflowX) {
            var shift = fullXMax + overflowX - visibleXMin;
            visibleXMin += shift;
            visibleXMax += shift;
          }
          if (visibleYMax < fullYMin - overflowY) {
            var shift = fullYMin - overflowY - visibleYMax;
            visibleYMin += shift;
            visibleYMax += shift;
          }
          if (visibleYMin > fullYMax + overflowY) {
            var shift = fullYMax + overflowY - visibleYMin;
            visibleYMin += shift;
            visibleYMax += shift;
          }
        }
        function dataToPixel(x, y, drawArea) {
          var xRange = visibleXMax - visibleXMin;
          var yRange = visibleYMax - visibleYMin;
          var px = drawArea.x + (x - visibleXMin) / xRange * drawArea.width;
          var py = drawArea.y + drawArea.height - (y - visibleYMin) / yRange * drawArea.height;
          return { px, py };
        }
        function pixelToData(px, py, drawArea) {
          var xRange = visibleXMax - visibleXMin;
          var yRange = visibleYMax - visibleYMin;
          var x = visibleXMin + (px - drawArea.x) / drawArea.width * xRange;
          var y = visibleYMin + (1 - (py - drawArea.y) / drawArea.height) * yRange;
          return { x, y };
        }
        return {
          getState,
          getFullRange,
          zoomAt,
          pan,
          setRange,
          reset,
          dataToPixel,
          pixelToData
        };
      }
      module.exports = {
        createViewManager
      };
    }
  });

  // renderers/canvas/index.js
  var require_canvas = __commonJS({
    "renderers/canvas/index.js"(exports, module) {
      "use strict";
      var compute = require_compute();
      var drawPaths = require_paths();
      var drawLabels = require_labels2();
      var drawColorbar = require_colorbar2();
      var drawNulls = require_nulls();
      var drawHeatmap = require_heatmap();
      var axesRenderer = require_axes2();
      var nullHandling = require_null_handling();
      var axes = require_axes();
      var createOverlaySystem = require_overlay2();
      function calculateAspectRatioDrawingArea(baseArea, fullRange, aspectRatio) {
        if (aspectRatio !== "equal" && aspectRatio !== 1 && aspectRatio !== "1:1") {
          return baseArea;
        }
        var xRange = fullRange.xMax - fullRange.xMin;
        var yRange = fullRange.yMax - fullRange.yMin;
        if (xRange === 0 || yRange === 0) {
          return baseArea;
        }
        var dataRatio = xRange / yRange;
        var canvasRatio = baseArea.width / baseArea.height;
        var adjustedArea = Object.assign({}, baseArea);
        if (dataRatio > canvasRatio) {
          var idealHeight = baseArea.width / dataRatio;
          var heightDiff = baseArea.height - idealHeight;
          adjustedArea.height = idealHeight;
          adjustedArea.y = baseArea.y + heightDiff / 2;
          adjustedArea.margins = Object.assign({}, baseArea.margins, {
            top: baseArea.margins.top + heightDiff / 2,
            bottom: baseArea.margins.bottom + heightDiff / 2
          });
        } else if (dataRatio < canvasRatio) {
          var idealWidth = baseArea.height * dataRatio;
          var widthDiff = baseArea.width - idealWidth;
          adjustedArea.width = idealWidth;
          adjustedArea.x = baseArea.x + widthDiff / 2;
          adjustedArea.margins = Object.assign({}, baseArea.margins, {
            left: baseArea.margins.left + widthDiff / 2,
            right: baseArea.margins.right + widthDiff / 2
          });
        }
        return adjustedArea;
      }
      function drawContours(ctx, contourResult, style) {
        style = style || {};
        var width = style.width || ctx.canvas.width;
        var height = style.height || ctx.canvas.height;
        var coloring = style.coloring || "lines";
        var showLines = style.showLines !== false;
        var smoothing = style.smoothing || 0;
        var useClipMask = style.useClipMask !== false;
        var hasAxes = style.axes !== void 0 && style.axes !== null;
        var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
        if (pathInfo) {
          style = Object.assign({
            x: pathInfo.x,
            y: pathInfo.y,
            z: pathInfo.z
          }, style);
        }
        var interactionConfig = style.interaction;
        if (interactionConfig) {
          return createInteractiveRenderer(ctx.canvas, contourResult, style, interactionConfig);
        }
        renderStatic(ctx, contourResult, style, width, height, coloring, showLines, useClipMask, hasAxes, pathInfo);
        return null;
      }
      function renderStatic(ctx, contourResult, style, width, height, coloring, showLines, useClipMask, hasAxes, pathInfo) {
        var padding = style.padding || 50;
        var baseDrawingArea = {
          x: padding,
          y: padding,
          width: width - 2 * padding,
          height: height - 2 * padding,
          margins: {
            left: padding,
            right: padding,
            top: padding,
            bottom: padding
          }
        };
        var fullRange = getFullRange(pathInfo);
        var aspectRatio = style.aspectRatio || "auto";
        var drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, aspectRatio);
        ctx.clearRect(0, 0, width, height);
        if (style.backgroundColor) {
          ctx.fillStyle = style.backgroundColor;
          ctx.fillRect(0, 0, width, height);
        }
        var showGrid = style.showGrid !== false && hasAxes;
        if (showGrid) {
          renderGridLayer(ctx, drawingArea, fullRange, style);
        }
        renderContourLayer(ctx, drawingArea, fullRange, fullRange, contourResult, style, useClipMask, coloring, showLines, pathInfo);
        if (hasAxes) {
          renderAxesLayer(ctx, drawingArea, fullRange, fullRange, style);
        }
        var showColorbar = style.showColorbar !== false && (style.colorbar === void 0 || style.colorbar === true || style.colorbar.show !== false);
        if (showColorbar && (coloring === "fill" || coloring === "fill+lines" || coloring === "heatmap")) {
          drawColorbar(ctx, contourResult, style);
        }
      }
      function createInteractiveRenderer(canvas, contourResult, style, interactionConfig) {
        var width = style.width || canvas.width;
        var height = style.height || canvas.height;
        var padding = style.padding || 50;
        var baseDrawingArea = {
          x: padding,
          y: padding,
          width: width - 2 * padding,
          height: height - 2 * padding,
          margins: {
            left: padding,
            right: padding,
            top: padding,
            bottom: padding
          }
        };
        var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
        var fullRange = getFullRange(pathInfo);
        var aspectRatio = style.aspectRatio || "auto";
        var drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, aspectRatio);
        var viewState = require_view_state();
        var viewManager = viewState.createViewManager(fullRange, {
          minZoom: interactionConfig.minZoom || 0.1,
          maxZoom: interactionConfig.maxZoom || 10
        });
        var currentStyle = Object.assign({}, style);
        var hasAxes = currentStyle.axes !== void 0 && currentStyle.axes !== null;
        var currentAspectRatio = aspectRatio;
        var _overlay = null;
        var _fullRange = fullRange;
        var _drawingArea = drawingArea;
        var _gridData = {
          z: style.z,
          x: style.x,
          y: style.y
        };
        var _computeOptions = {
          autocontour: style.autocontour !== false,
          ncontours: style.ncontours || 15,
          smoothing: style.smoothing !== void 0 ? style.smoothing : 0.5,
          start: style.start,
          end: style.end,
          size: style.size,
          valueColorMap: style.valueColorMap
        };
        function render() {
          var ctx = canvas.getContext("2d");
          var visibleRange = viewManager.getState();
          ctx.clearRect(0, 0, width, height);
          if (currentStyle.backgroundColor) {
            ctx.fillStyle = currentStyle.backgroundColor;
            ctx.fillRect(0, 0, width, height);
          }
          var showGrid = currentStyle.showGrid === true;
          if (showGrid) {
            renderGridLayer(ctx, drawingArea, visibleRange, currentStyle);
          }
          renderContourLayer(ctx, drawingArea, visibleRange, fullRange, contourResult, currentStyle, currentStyle.useClipMask !== false, currentStyle.coloring || "lines", currentStyle.showLines !== false, pathInfo);
          if (hasAxes) {
            renderAxesLayer(ctx, drawingArea, visibleRange, fullRange, currentStyle);
          }
          var showColorbarInteractive = currentStyle.showColorbar !== false && (currentStyle.colorbar === void 0 || currentStyle.colorbar === true || currentStyle.colorbar.show !== false);
          if (showColorbarInteractive && (currentStyle.coloring === "fill" || currentStyle.coloring === "fill+lines" || currentStyle.coloring === "heatmap")) {
            drawColorbar(ctx, contourResult, currentStyle);
          }
          if (_overlay) {
            _overlay.render(ctx);
          }
        }
        render();
        var interactionConfig = Object.assign({}, interactionConfig, {
          contourResult
          // Pass contour result for hover detection
        });
        var interaction = createInteractionManagerInternal(canvas, drawingArea, viewManager, render, interactionConfig);
        return {
          getViewState: function() {
            return viewManager.getState();
          },
          setViewRange: function(xMin, xMax, yMin, yMax) {
            viewManager.setRange(xMin, xMax, yMin, yMax);
            render();
          },
          resetView: function() {
            viewManager.reset();
            render();
            if (interactionConfig.onReset) {
              interactionConfig.onReset();
            }
          },
          updateStyle: function(newStyle) {
            currentStyle = Object.assign(currentStyle, newStyle);
            hasAxes = currentStyle.axes !== void 0 && currentStyle.axes !== null;
            var newAspectRatio = currentStyle.aspectRatio || "auto";
            if (newAspectRatio !== currentAspectRatio) {
              currentAspectRatio = newAspectRatio;
              drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
            }
            render();
          },
          resize: function(newWidth, newHeight) {
            width = newWidth;
            height = newHeight;
            canvas.width = width;
            canvas.height = height;
            baseDrawingArea = {
              x: padding,
              y: padding,
              width: width - 2 * padding,
              height: height - 2 * padding,
              margins: {
                left: padding,
                right: padding,
                top: padding,
                bottom: padding
              }
            };
            drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
            render();
          },
          getContourResult: function() {
            return contourResult;
          },
          getViewManager: function() {
            return viewManager;
          },
          getDrawingArea: function() {
            return drawingArea;
          },
          /**
           * Get overlay manager for drawing overlay elements
           * @returns {Object} Overlay system instance
           */
          getOverlay: function() {
            if (!_overlay) {
              var rendererLike = {
                _fullRange,
                _drawingArea: drawingArea,
                getViewManager: function() {
                  return viewManager;
                },
                refresh: render
              };
              _overlay = createOverlaySystem(rendererLike);
            }
            return _overlay;
          },
          destroy: function() {
            interaction.destroy();
          },
          render,
          // ========================================
          // 数据更新 API
          // ========================================
          /**
           * 更新数据（重新计算等值线）
           * @param {Object} newData - 新数据
           * @param {Array} newData.z - Z 值矩阵
           * @param {Array} [newData.x] - X 坐标数组
           * @param {Array} [newData.y] - Y 坐标数组
           */
          updateData: function(newData) {
            if (!newData)
              return;
            if (newData.z)
              _gridData.z = newData.z;
            if (newData.x)
              _gridData.x = newData.x;
            if (newData.y)
              _gridData.y = newData.y;
            contourResult = compute.computeContours(_gridData, _computeOptions);
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            fullRange = getFullRange(pathInfo);
            _fullRange = fullRange;
            currentStyle.z = _gridData.z;
            currentStyle.x = _gridData.x;
            currentStyle.y = _gridData.y;
            drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
            _drawingArea = drawingArea;
            render();
          },
          /**
           * 更新 ColorScale（重新计算等值线，因为 levels 会变化）
           * @param {Array} valueColorMap - 颜色映射数组 [[value, color], ...]
           */
          updateColorScale: function(valueColorMap) {
            if (!Array.isArray(valueColorMap))
              return;
            _computeOptions.valueColorMap = valueColorMap;
            currentStyle.valueColorMap = valueColorMap;
            contourResult = compute.computeContours(_gridData, _computeOptions);
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            render();
          },
          /**
           * 更新 ColorBar
           * @param {Object} config - ColorBar 配置
           * @param {Array} [config.valueColorMap] - 颜色映射数组
           * @param {string} [config.title] - 标题
           * @param {number} [config.thickness] - 厚度
           * @param {string} [config.position] - 位置 ('left' | 'right')
           * @param {number} [config.tickInterval] - 刻度间隔
           */
          updateColorbar: function(config) {
            if (!config)
              return;
            if (config.valueColorMap && Array.isArray(config.valueColorMap)) {
              _computeOptions.valueColorMap = config.valueColorMap;
              currentStyle.valueColorMap = config.valueColorMap;
              contourResult = compute.computeContours(_gridData, _computeOptions);
              pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            }
            if (!currentStyle.colorbar) {
              currentStyle.colorbar = {};
            }
            Object.assign(currentStyle.colorbar, config);
            render();
          },
          /**
           * 更新等值线参数（重新计算）
           * @param {Object} options - 等值线参数
           * @param {number} [options.smoothing] - 平滑度 0-1
           * @param {boolean} [options.autocontour] - 是否自动计算等值线
           * @param {number} [options.ncontours] - 等值线数量
           * @param {number} [options.start] - 起始值
           * @param {number} [options.end] - 结束值
           * @param {number} [options.size] - 步长
           */
          updateContours: function(options) {
            if (!options)
              return;
            if (options.smoothing !== void 0)
              _computeOptions.smoothing = options.smoothing;
            if (options.autocontour !== void 0)
              _computeOptions.autocontour = options.autocontour;
            if (options.ncontours !== void 0)
              _computeOptions.ncontours = options.ncontours;
            if (options.start !== void 0)
              _computeOptions.start = options.start;
            if (options.end !== void 0)
              _computeOptions.end = options.end;
            if (options.size !== void 0)
              _computeOptions.size = options.size;
            contourResult = compute.computeContours(_gridData, _computeOptions);
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            fullRange = getFullRange(pathInfo);
            _fullRange = fullRange;
            currentStyle.smoothing = _computeOptions.smoothing;
            render();
          },
          /**
           * 批量更新（智能合并）
           * @param {Object} config - 配置对象
           * @param {Object} [config.data] - 数据更新
           * @param {Array} [config.colorScale] - 颜色映射
           * @param {Object} [config.contours] - 等值线参数
           * @param {Object} [config.colorbar] - ColorBar 配置
           */
          update: function(config) {
            if (!config)
              return;
            if (config.data) {
              if (config.data.z)
                _gridData.z = config.data.z;
              if (config.data.x)
                _gridData.x = config.data.x;
              if (config.data.y)
                _gridData.y = config.data.y;
            }
            if (config.colorScale && Array.isArray(config.colorScale)) {
              _computeOptions.valueColorMap = config.colorScale;
              currentStyle.valueColorMap = config.colorScale;
            }
            if (config.contours) {
              var opts = config.contours;
              if (opts.smoothing !== void 0)
                _computeOptions.smoothing = opts.smoothing;
              if (opts.autocontour !== void 0)
                _computeOptions.autocontour = opts.autocontour;
              if (opts.ncontours !== void 0)
                _computeOptions.ncontours = opts.ncontours;
              if (opts.start !== void 0)
                _computeOptions.start = opts.start;
              if (opts.end !== void 0)
                _computeOptions.end = opts.end;
              if (opts.size !== void 0)
                _computeOptions.size = opts.size;
            }
            contourResult = compute.computeContours(_gridData, _computeOptions);
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            fullRange = getFullRange(pathInfo);
            _fullRange = fullRange;
            currentStyle.z = _gridData.z;
            currentStyle.x = _gridData.x;
            currentStyle.y = _gridData.y;
            currentStyle.smoothing = _computeOptions.smoothing;
            if (config.colorbar) {
              if (!currentStyle.colorbar) {
                currentStyle.colorbar = {};
              }
              Object.assign(currentStyle.colorbar, config.colorbar);
            }
            drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
            _drawingArea = drawingArea;
            render();
          },
          /**
           * 获取当前数据
           * @returns {Object} 数据对象 { z, x, y }
           */
          getData: function() {
            return {
              z: _gridData.z,
              x: _gridData.x,
              y: _gridData.y
            };
          },
          /**
           * 获取当前 ColorScale
           * @returns {Array} valueColorMap
           */
          getColorScale: function() {
            return currentStyle.valueColorMap;
          }
        };
      }
      function getFullRange(pathInfo) {
        if (pathInfo) {
          var xData = pathInfo.x || [];
          var yData = pathInfo.y || [];
          return {
            xMin: xData.length > 0 ? Math.min.apply(Math, xData) : 0,
            xMax: xData.length > 0 ? Math.max.apply(Math, xData) : 1,
            yMin: yData.length > 0 ? Math.min.apply(Math, yData) : 0,
            yMax: yData.length > 0 ? Math.max.apply(Math, yData) : 1
          };
        }
        return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
      }
      function renderGridLayer(ctx, drawArea, visibleRange, style) {
        var gridColor = style.gridColor || "#e0e0e0";
        var gridWidth = style.gridWidth || 1;
        var xRange = visibleRange.xMax - visibleRange.xMin;
        var yRange = visibleRange.yMax - visibleRange.yMin;
        var numXLines = 10;
        var numYLines = 10;
        var xStep = xRange / numXLines;
        var yStep = yRange / numYLines;
        xStep = Math.pow(10, Math.floor(Math.log10(xStep))) * Math.ceil(xStep / Math.pow(10, Math.floor(Math.log10(xStep))));
        yStep = Math.pow(10, Math.floor(Math.log10(yStep))) * Math.ceil(yStep / Math.pow(10, Math.floor(Math.log10(yStep))));
        var xTicks = [];
        var yTicks = [];
        var xStart = Math.ceil(visibleRange.xMin / xStep) * xStep;
        for (var x = xStart; x <= visibleRange.xMax; x += xStep) {
          xTicks.push(x);
        }
        var yStart = Math.ceil(visibleRange.yMin / yStep) * yStep;
        for (var y = yStart; y <= visibleRange.yMax; y += yStep) {
          yTicks.push(y);
        }
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = gridWidth;
        for (var i = 0; i < xTicks.length; i++) {
          var dataX = xTicks[i];
          var canvasX = drawArea.x + (dataX - visibleRange.xMin) / xRange * drawArea.width;
          if (canvasX >= drawArea.x && canvasX <= drawArea.x + drawArea.width) {
            ctx.moveTo(canvasX, drawArea.y);
            ctx.lineTo(canvasX, drawArea.y + drawArea.height);
          }
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = gridWidth;
        for (var i = 0; i < yTicks.length; i++) {
          var dataY = yTicks[i];
          var canvasY = drawArea.y + drawArea.height - (dataY - visibleRange.yMin) / yRange * drawArea.height;
          if (canvasY >= drawArea.y && canvasY <= drawArea.y + drawArea.height) {
            ctx.moveTo(drawArea.x, canvasY);
            ctx.lineTo(drawArea.x + drawArea.width, canvasY);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
      function renderContourLayer(ctx, drawArea, visibleRange, fullRange, contourResult, style, useClipMask, coloring, showLines, pathInfo) {
        var connectGaps = contourResult.connectgaps !== void 0 ? contourResult.connectgaps : true;
        var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;
        var renderStyle = Object.assign({}, style, {
          visibleRange,
          fullRange,
          drawArea,
          // Pass drawArea for scalePoint to use
          width: drawArea.width + 2 * drawArea.margins.left,
          height: drawArea.height + 2 * drawArea.margins.top,
          padding: drawArea.x,
          // Keep for backward compatibility
          z: style.z || (pathInfo ? pathInfo.z : null),
          x: style.x || (pathInfo ? pathInfo.x : null),
          y: style.y || (pathInfo ? pathInfo.y : null),
          connectgaps: connectGaps
          // Pass connectgaps to drawFilledPaths for correct background color
        });
        ctx.save();
        ctx.beginPath();
        ctx.rect(drawArea.x, drawArea.y, drawArea.width, drawArea.height);
        ctx.clip();
        if (needsClip && useClipMask) {
          var clipPathData = nullHandling.generateClipPath(contourResult, {
            useDataCoordinates: true,
            dataX: pathInfo ? pathInfo.x : null,
            dataY: pathInfo ? pathInfo.y : null,
            // Anti-aliasing options
            smoothingMethod: style.smoothingMethod,
            upsampleScale: style.upsampleScale,
            clipLevel: style.clipLevel,
            clipSmoothing: style.clipSmoothing,
            simplifyTolerance: style.simplifyTolerance
          });
          if (clipPathData) {
            applyCanvasClipPathFromData(ctx, clipPathData, drawArea, visibleRange);
          }
        }
        if (coloring === "heatmap" && pathInfo) {
          drawHeatmap.drawInterpolatedHeatmap(ctx, {
            z: pathInfo.z,
            x: pathInfo.x,
            y: pathInfo.y
          }, renderStyle);
        }
        if (coloring === "fill" || coloring === "fill+lines" || coloring === "heatmap") {
          drawPaths.drawFilledPaths(ctx, contourResult, renderStyle);
        }
        var shouldDrawLines = coloring === "lines" || coloring === "fill+lines";
        if (shouldDrawLines) {
          drawPaths.drawStrokePaths(ctx, contourResult, renderStyle);
        }
        if (needsClip && !useClipMask) {
          drawNulls(ctx, contourResult, renderStyle);
        }
        if (style.showLabels) {
          drawLabels(ctx, contourResult, renderStyle);
        }
        ctx.restore();
      }
      function applyCanvasClipPathFromData(ctx, pathData, drawArea, fullRange) {
        var commands = pathData.split(/[MmLlHhVvAaQqTtCcSsZz]/);
        var types = pathData.match(/[MmLlHhVvAaQqTtCcSsZz]/g) || [];
        var currentX = 0, currentY = 0;
        var startX = 0, startY = 0;
        var xRange = fullRange.xMax - fullRange.xMin;
        var yRange = fullRange.yMax - fullRange.yMin;
        ctx.beginPath();
        function dataToCanvas(dataX, dataY) {
          var cx = drawArea.x + (dataX - fullRange.xMin) / xRange * drawArea.width;
          var cy = drawArea.y + drawArea.height - (dataY - fullRange.yMin) / yRange * drawArea.height;
          return [cx, cy];
        }
        for (var i = 0; i < types.length; i++) {
          var type = types[i];
          var args = commands[i + 1] ? commands[i + 1].trim().split(/[\s,]+/).map(parseFloat) : [];
          switch (type) {
            case "M":
              var pt = dataToCanvas(args[0], args[1]);
              ctx.moveTo(pt[0], pt[1]);
              currentX = args[0];
              currentY = args[1];
              startX = args[0];
              startY = args[1];
              break;
            case "L":
              var pt = dataToCanvas(args[0], args[1]);
              ctx.lineTo(pt[0], pt[1]);
              currentX = args[0];
              currentY = args[1];
              break;
            case "Z":
            case "z":
              ctx.closePath();
              currentX = startX;
              currentY = startY;
              break;
            default:
              if (args.length >= 2) {
                var pt = dataToCanvas(args[args.length - 2], args[args.length - 1]);
                ctx.lineTo(pt[0], pt[1]);
              }
              break;
          }
        }
        ctx.clip();
      }
      function renderAxesLayer(ctx, drawArea, visibleRange, fullRange, style) {
        var axesConfig = style.axes || {};
        var xOptions = axesConfig.x || {};
        var yOptions = axesConfig.y || {};
        var axisSetup = axes.setupAxes({
          width: drawArea.width + 2 * drawArea.x,
          height: drawArea.height + 2 * drawArea.y,
          margins: drawArea.margins,
          visibleRange,
          fullRange,
          x: xOptions,
          y: yOptions
        });
        axesRenderer.drawAxesFromSetup(ctx, axisSetup);
      }
      function createInteractionManagerInternal(canvas, drawingArea, viewManager, render, config) {
        config = config || {};
        var isDragging = false;
        var isBoxZooming = false;
        var lastX = 0;
        var lastY = 0;
        var boxStartX = 0;
        var boxStartY = 0;
        var zoomEnabled = config.zoom !== false;
        var panEnabled = config.pan !== false;
        var dblclickReset = config.dblclickReset !== false;
        var boxZoomEnabled = config.boxZoom === true;
        var zoomSensitivity = 1e-3;
        var hoverEnabled = config.hover === true;
        var hoverHitRadius = config.hoverHitRadius || 8;
        var contourResult = config.contourResult;
        var hoverFormatter = config.hoverFormatter;
        var tooltipElement = null;
        var boundHandlers = {};
        function getMousePos(e) {
          var rect = canvas.getBoundingClientRect();
          return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
        }
        function isInDrawingArea(pos) {
          return pos.x >= drawingArea.x && pos.x <= drawingArea.x + drawingArea.width && pos.y >= drawingArea.y && pos.y <= drawingArea.y + drawingArea.height;
        }
        function handleWheel(e) {
          if (!zoomEnabled)
            return;
          var pos = getMousePos(e);
          if (!isInDrawingArea(pos))
            return;
          e.preventDefault();
          var dataPos = viewManager.pixelToData(pos.x, pos.y, drawingArea);
          var delta = -e.deltaY;
          var factor = 1 + delta * zoomSensitivity;
          factor = Math.max(0.5, Math.min(2, factor));
          viewManager.zoomAt(factor, dataPos.x, dataPos.y, drawingArea);
          render();
          if (config.onZoom) {
            config.onZoom(viewManager.getState());
          }
        }
        function handleMouseDown(e) {
          var pos = getMousePos(e);
          if (!isInDrawingArea(pos))
            return;
          if (e.button === 0) {
            if (e.shiftKey && boxZoomEnabled) {
              isBoxZooming = true;
              boxStartX = pos.x;
              boxStartY = pos.y;
            } else if (panEnabled) {
              isDragging = true;
              lastX = pos.x;
              lastY = pos.y;
              canvas.style.cursor = "grabbing";
            }
          }
        }
        function handleMouseMove(e) {
          var pos = getMousePos(e);
          if (isDragging) {
            e.preventDefault();
            var dx = pos.x - lastX;
            var dy = pos.y - lastY;
            viewManager.pan(dx, dy, drawingArea);
            lastX = pos.x;
            lastY = pos.y;
            render();
            if (config.onPan) {
              config.onPan(viewManager.getState());
            }
          } else if (isBoxZooming) {
          } else if (isInDrawingArea(pos)) {
            canvas.style.cursor = "grab";
            if (hoverEnabled && contourResult) {
              var hoverData = detectContourAtPosition(pos.x, pos.y);
              if (hoverData) {
                showTooltip(pos.x, pos.y, hoverData);
              } else {
                hideTooltip();
              }
            }
          } else {
            canvas.style.cursor = "default";
            hideTooltip();
          }
        }
        function detectContourAtPosition(px, py) {
          if (!contourResult || !contourResult.paths)
            return null;
          var paths = contourResult.paths;
          var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
          if (!pathInfo)
            return null;
          var state = viewManager.getState();
          var xMin = state.xMin;
          var xMax = state.xMax;
          var yMin = state.yMin;
          var yMax = state.yMax;
          var xRange = xMax - xMin || 1;
          var yRange = yMax - yMin || 1;
          for (var i = 0; i < paths.length; i++) {
            var pathData = paths[i];
            var level = pathData.level;
            var allPaths = (pathData.paths || []).concat(pathData.edgepaths || []);
            for (var j = 0; j < allPaths.length; j++) {
              var path = allPaths[j];
              if (!path || path.length < 2)
                continue;
              for (var k = 0; k < path.length - 1; k++) {
                var p1 = path[k];
                var p2 = path[k + 1];
                var px1 = drawingArea.x + (p1[0] - xMin) / xRange * drawingArea.width;
                var py1 = drawingArea.y + drawingArea.height - (p1[1] - yMin) / yRange * drawingArea.height;
                var px2 = drawingArea.x + (p2[0] - xMin) / xRange * drawingArea.width;
                var py2 = drawingArea.y + drawingArea.height - (p2[1] - yMin) / yRange * drawingArea.height;
                var dist = pointToSegmentDistance(px, py, px1, py1, px2, py2);
                if (dist <= hoverHitRadius) {
                  var dataX = xMin + (px - drawingArea.x) / drawingArea.width * xRange;
                  var dataY = yMin + (1 - (py - drawingArea.y) / drawingArea.height) * yRange;
                  return {
                    level,
                    x: dataX,
                    y: dataY,
                    distance: dist
                  };
                }
              }
            }
          }
          return null;
        }
        function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
          var dx = x2 - x1;
          var dy = y2 - y1;
          var lengthSq = dx * dx + dy * dy;
          if (lengthSq === 0) {
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
          }
          var t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
          t = Math.max(0, Math.min(1, t));
          var projX = x1 + t * dx;
          var projY = y1 + t * dy;
          return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
        }
        function showTooltip(px, py, hoverData) {
          if (!tooltipElement) {
            tooltipElement = document.createElement("div");
            tooltipElement.className = "contour-hover-tooltip";
            tooltipElement.style.cssText = [
              "position: absolute",
              "pointer-events: none",
              "display: none",
              "background: rgba(255, 255, 255, 0.95)",
              "border: 1px solid #333",
              "border-radius: 4px",
              "padding: 8px 12px",
              "font-size: 12px",
              "font-family: Arial, sans-serif",
              "color: #333",
              "white-space: nowrap",
              "box-shadow: 0 2px 8px rgba(0,0,0,0.2)",
              "z-index: 10000"
            ].join(";");
            document.body.appendChild(tooltipElement);
          }
          var content;
          if (hoverFormatter && typeof hoverFormatter === "function") {
            content = hoverFormatter(hoverData);
          } else {
            content = "<strong>\u503C:</strong> " + hoverData.level.toFixed(2);
            if (hoverData.x !== void 0 && hoverData.y !== void 0) {
              content += "<br><strong>X:</strong> " + hoverData.x.toFixed(4);
              content += "<br><strong>Y:</strong> " + hoverData.y.toFixed(4);
            }
          }
          tooltipElement.innerHTML = content;
          tooltipElement.style.display = "block";
          var canvasRect = canvas.getBoundingClientRect();
          var tooltipX = canvasRect.left + px + 15;
          var tooltipY = canvasRect.top + py - 40;
          if (tooltipX + 150 > window.innerWidth) {
            tooltipX = canvasRect.left + px - 160;
          }
          if (tooltipY < 5) {
            tooltipY = canvasRect.top + py + 20;
          }
          tooltipElement.style.left = tooltipX + "px";
          tooltipElement.style.top = tooltipY + "px";
        }
        function hideTooltip() {
          if (tooltipElement) {
            tooltipElement.style.display = "none";
          }
        }
        function handleMouseUp(e) {
          if (isDragging) {
            isDragging = false;
            canvas.style.cursor = "grab";
          }
          if (isBoxZooming) {
            isBoxZooming = false;
            var pos = getMousePos(e);
            var x1 = Math.min(boxStartX, pos.x);
            var x2 = Math.max(boxStartX, pos.x);
            var y1 = Math.min(boxStartY, pos.y);
            var y2 = Math.max(boxStartY, pos.y);
            if (x2 - x1 > 10 && y2 - y1 > 10) {
              var dataStart = viewManager.pixelToData(x1, y2, drawingArea);
              var dataEnd = viewManager.pixelToData(x2, y1, drawingArea);
              viewManager.setRange(dataStart.x, dataEnd.x, dataStart.y, dataEnd.y);
              render();
              if (config.onZoom) {
                config.onZoom(viewManager.getState());
              }
            }
          }
        }
        function handleDblClick(e) {
          if (!dblclickReset)
            return;
          var pos = getMousePos(e);
          if (!isInDrawingArea(pos))
            return;
          e.preventDefault();
          viewManager.reset();
          render();
          if (config.onReset) {
            config.onReset();
          }
        }
        function handleTouchStart(e) {
          if (e.touches.length === 1) {
            var touch = e.touches[0];
            var pos = getMousePos(touch);
            if (isInDrawingArea(pos)) {
              isDragging = true;
              lastX = pos.x;
              lastY = pos.y;
            }
          }
        }
        function handleTouchMove(e) {
          if (e.touches.length === 1 && isDragging) {
            e.preventDefault();
            var touch = e.touches[0];
            var pos = getMousePos(touch);
            var dx = pos.x - lastX;
            var dy = pos.y - lastY;
            viewManager.pan(dx, dy, drawingArea);
            lastX = pos.x;
            lastY = pos.y;
            render();
            if (config.onPan) {
              config.onPan(viewManager.getState());
            }
          }
        }
        function handleTouchEnd(e) {
          isDragging = false;
        }
        function bindEvents() {
          boundHandlers.wheel = handleWheel;
          boundHandlers.mousedown = handleMouseDown;
          boundHandlers.mousemove = handleMouseMove;
          boundHandlers.mouseup = handleMouseUp;
          boundHandlers.mouseleave = handleMouseUp;
          boundHandlers.dblclick = handleDblClick;
          boundHandlers.touchstart = handleTouchStart;
          boundHandlers.touchmove = handleTouchMove;
          boundHandlers.touchend = handleTouchEnd;
          canvas.addEventListener("wheel", boundHandlers.wheel, { passive: false });
          canvas.addEventListener("mousedown", boundHandlers.mousedown);
          canvas.addEventListener("mousemove", boundHandlers.mousemove);
          canvas.addEventListener("mouseup", boundHandlers.mouseup);
          canvas.addEventListener("mouseleave", boundHandlers.mouseleave);
          canvas.addEventListener("dblclick", boundHandlers.dblclick);
          canvas.addEventListener("touchstart", boundHandlers.touchstart, { passive: false });
          canvas.addEventListener("touchmove", boundHandlers.touchmove, { passive: false });
          canvas.addEventListener("touchend", boundHandlers.touchend);
        }
        function unbindEvents() {
          canvas.removeEventListener("wheel", boundHandlers.wheel);
          canvas.removeEventListener("mousedown", boundHandlers.mousedown);
          canvas.removeEventListener("mousemove", boundHandlers.mousemove);
          canvas.removeEventListener("mouseup", boundHandlers.mouseup);
          canvas.removeEventListener("mouseleave", boundHandlers.mouseleave);
          canvas.removeEventListener("dblclick", boundHandlers.dblclick);
          canvas.removeEventListener("touchstart", boundHandlers.touchstart);
          canvas.removeEventListener("touchmove", boundHandlers.touchmove);
          canvas.removeEventListener("touchend", boundHandlers.touchend);
        }
        function destroy() {
          unbindEvents();
          if (tooltipElement) {
            tooltipElement.parentNode.removeChild(tooltipElement);
            tooltipElement = null;
          }
        }
        bindEvents();
        return {
          destroy
        };
      }
      module.exports = {
        drawContours,
        drawPaths,
        drawLabels,
        drawColorbar,
        drawNulls,
        drawHeatmap,
        drawAxes: axesRenderer.drawAxes,
        drawAxesFromSetup: axesRenderer.drawAxesFromSetup,
        drawGrid: axesRenderer.drawGrid
      };
    }
  });

  // api.js
  var require_api = __commonJS({
    "api.js"(exports, module) {
      "use strict";
      var compute = require_compute();
      var canvasRenderer = require_canvas();
      var labelUtils = require_labels();
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
        var grid;
        if (Array.isArray(config)) {
          grid = config;
        } else {
          grid = {
            z: config.z,
            x: config.x,
            y: config.y
          };
        }
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
        if (!result.nullMask)
          return;
        config = config || {};
        var visible = config.visible !== false;
        if (!visible)
          return;
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
      function createInteractive(container, config) {
        if (typeof container === "string") {
          container = document.querySelector(container);
        }
        if (!container) {
          throw new Error("Container element not found");
        }
        var isDirectArray = Array.isArray(config);
        if (isDirectArray) {
          config = { z: config };
        } else {
          config = config || {};
        }
        var width = config.width || container.clientWidth || 600;
        var height = config.height || container.clientHeight || 500;
        var renderer = zrenderRenderer.createRenderer(container, {
          width,
          height,
          devicePixelRatio: config.devicePixelRatio
        });
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
        };
        var result = compute.computeContours(grid, options);
        var colors = getColors(config.colorscale, result.levels, config.zmin, config.zmax, config.reversescale);
        var colorScale = buildColorScale(result.levels, colors);
        var style = {
          width,
          height,
          x: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].x : config.x,
          y: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].y : config.y,
          z: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].z : config.z,
          padding: 30,
          // IMPORTANT: zrender needs padding for coordinate scaling
          coloring: config.contours && config.contours.type || "fill",
          showLines: config.contours ? config.contours.type === "lines" || config.contours.type === "heatmap" : true,
          lineWidth: config.lineWidth || 1.5,
          lineColor: config.lineColor || "#666",
          colorScale,
          valueColorMap: config.valueColorMap,
          opacity: config.opacity || 1
        };
        renderer.renderContours(result, style);
        if (config.contours && config.contours.showlabels) {
          renderer.renderLabels(result, style);
        }
        if (config.axes) {
          var axesConfig = Object.assign({}, config.axes, {
            width,
            height
          });
          renderer.renderAxes(axesConfig, style);
        }
        if (config.colorbar && config.colorbar.show !== false && style.coloring !== "lines") {
          renderer.renderColorbar(result, colors, config.colorbar);
        }
        var interactionConfig = config.interaction || {};
        renderer.options.onHoverStart = interactionConfig.hover ? interactionConfig.hover.onHoverStart : null;
        renderer.options.onHoverEnd = interactionConfig.hover ? interactionConfig.hover.onHoverEnd : null;
        renderer.options.onContourClick = interactionConfig.click ? interactionConfig.click.onContourClick : null;
        renderer.options.highlightColor = interactionConfig.highlightColor || "#ffff00";
        if (interactionConfig.zoom !== false) {
          renderer.initZoom(interactionConfig.zoom || {});
        }
        if (interactionConfig.pan !== false) {
          renderer.initPan(interactionConfig.pan || {});
        }
        if (interactionConfig.dblclickReset !== false) {
          renderer.zr.on("dblclick", function() {
            var animate = interactionConfig.animateReset !== false;
            renderer.resetView(animate);
            if (interactionConfig.onReset) {
              interactionConfig.onReset();
            }
          });
        }
        return {
          // Update data
          update: function(newConfig) {
            if (newConfig.z)
              grid.z = newConfig.z;
            if (newConfig.x)
              grid.x = newConfig.x;
            if (newConfig.y)
              grid.y = newConfig.y;
            result = compute.computeContours(grid, options);
            style.x = result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].x : grid.x;
            style.y = result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].y : grid.y;
            style.z = result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].z : grid.z;
            renderer.renderContours(result, style);
            if (config.contours && config.contours.showlabels) {
              renderer.renderLabels(result, style);
            }
          },
          // Set view
          setView: function(xMin, xMax, yMin, yMax) {
          },
          // Get current view
          getView: function() {
            return renderer.getState();
          },
          // Reset view
          resetView: function() {
            renderer.resetView();
          },
          // Zoom
          zoomTo: function(scale, centerX, centerY, animate) {
            renderer.applyZoom(scale, centerX, centerY);
          },
          // Pan
          panTo: function(dx, dy, animate) {
            var group = renderer.mainGroup;
            group.attr({
              x: group.x + dx,
              y: group.y + dy
            });
            renderer.zr.flush();
          },
          // Enable/disable interaction
          enableInteraction: function(enabled) {
            renderer.setInteractionEnabled(enabled);
          },
          // Event registration
          on: function(event, handler) {
            if (event === "hover")
              renderer.options.onHoverStart = handler;
            if (event === "hoverEnd")
              renderer.options.onHoverEnd = handler;
            if (event === "click")
              renderer.options.onContourClick = handler;
          },
          off: function(event) {
            if (event === "hover")
              renderer.options.onHoverStart = null;
            if (event === "hoverEnd")
              renderer.options.onHoverEnd = null;
            if (event === "click")
              renderer.options.onContourClick = null;
          },
          // Resize
          resize: function(newWidth, newHeight) {
            width = newWidth || width;
            height = newHeight || height;
            renderer.resize(width, height);
          },
          // Destroy
          destroy: function() {
            renderer.dispose();
          },
          // Get renderer
          getRenderer: function() {
            return renderer;
          }
        };
      }
      module.exports = {
        render,
        drawTo,
        createInteractive,
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
              if (coords.length < 2)
                continue;
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
              if (edgeCoords.length < 2)
                continue;
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
                if (!nextPath || nextPath.length === 0)
                  continue;
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
          if (!closedPaths[k] || closedPaths[k].length < 3)
            continue;
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
        if (!polygon || polygon.length < 3)
          return false;
        var x = point[0];
        var y = point[1];
        var inside = false;
        for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          var xi = polygon[i][0];
          var yi = polygon[i][1];
          var xj = polygon[j][0];
          var yj = polygon[j][1];
          var intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
          if (intersect)
            inside = !inside;
        }
        return inside;
      }
      function getNextCorner(pt, perimeter, isTop, isBottom, isLeft, isRight) {
        if (isTop(pt) && !isRight(pt))
          return perimeter[1];
        if (isLeft(pt))
          return perimeter[0];
        if (isBottom(pt))
          return perimeter[3];
        if (isRight(pt))
          return perimeter[2];
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
        if (!fromPt || !toPt)
          return;
        var currentPt = fromPt;
        for (var cnt = 0; cnt < 4 && (Math.abs(currentPt[0] - toPt[0]) > 0.1 || Math.abs(currentPt[1] - toPt[1]) > 0.1); cnt++) {
          var nextCorner;
          if (isTop(currentPt) && !isRight(currentPt))
            nextCorner = perimeter[1];
          else if (isLeft(currentPt))
            nextCorner = perimeter[0];
          else if (isBottom(currentPt))
            nextCorner = perimeter[3];
          else if (isRight(currentPt))
            nextCorner = perimeter[2];
          else
            break;
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
        if (!path || path.length === 0)
          return "";
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
        if (!path || !Array.isArray(path) || path.length === 0) {
          return path;
        }
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
        var edgepaths = pathInfo.edgepaths || [];
        var paths = pathInfo.paths || [];
        if (!edgepaths || !paths) {
          return "";
        }
        if (edgepaths.length === 0 && paths.length === 0) {
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
            if (!endpt)
              break;
            newendpt = null;
            if (istop(endpt) && !isright(endpt))
              newendpt = perimeter[1];
            else if (isleft(endpt))
              newendpt = perimeter[0];
            else if (isbottom(endpt))
              newendpt = perimeter[3];
            else if (isright(endpt))
              newendpt = perimeter[2];
            if (!newendpt)
              break;
            for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
              var scaled = scalePath(edgepaths[possiblei], options);
              if (!scaled || scaled.length === 0)
                continue;
              var ptNew = scaled[0];
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
            if (nexti >= 0)
              break;
            fullpath += "L" + newendpt[0] + " " + newendpt[1];
          }
          if (nexti === edgepaths.length || nexti < 0)
            break;
          i = nexti;
          newloop = startsleft.indexOf(i) === -1;
          if (newloop) {
            if (startsleft.length > 0) {
              i = startsleft[0];
            }
            fullpath += "Z";
          }
        }
        for (i = 0; i < paths.length; i++) {
          var scaledPath = scalePath(paths[i], options);
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
          var boundaryPath = "M" + perimeter.map(function(pt) {
            return pt.join(" ");
          }).join("L") + "Z";
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
        if (!paths || !paths.length)
          return "";
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
            if (path.length < 3)
              continue;
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
            if (maxLabels === 0)
              continue;
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
              if (!labelPos)
                break;
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
              if (tooClose)
                break;
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
      module.exports = createLabels;
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
        if (!levels || levels.length === 0)
          return "";
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
        if (!nullMask)
          return "";
        options = options || {};
        var nullRegion = options.nullRegion || {};
        var visible = nullRegion.visible !== false;
        if (!visible)
          return "";
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

  // renderers/svg/axes.js
  var require_axes3 = __commonJS({
    "renderers/svg/axes.js"(exports, module) {
      "use strict";
      var axes = require_axes();
      function createXAxis(axisSetup) {
        var xAxis = axisSetup.x;
        var config = xAxis.config;
        var ticks = xAxis.ticks;
        var drawingArea = axisSetup.drawingArea;
        if (config.show === false) {
          return "";
        }
        var parts = [];
        var side = config.side || "bottom";
        var tickLength = config.ticklen || 5;
        var tickColor = config.tickcolor || "#666666";
        var tickWidth = config.tickwidth || 1;
        var showLabels = config.showticklabels !== false;
        var lineColor = config.linecolor || "#333";
        var lineWidth = config.linewidth || 1;
        var axisY;
        var labelY;
        var labelBaseline = "start";
        if (side === "top") {
          axisY = drawingArea.margins.top;
          labelY = axisY - tickLength - 5;
        } else {
          axisY = drawingArea.y + drawingArea.height;
          labelY = axisY + tickLength + 5;
        }
        parts.push('<line class="axis-line x-axis-line" x1="' + drawingArea.x + '" y1="' + axisY + '" x2="' + (drawingArea.x + drawingArea.width) + '" y2="' + axisY + '" stroke="' + lineColor + '" stroke-width="' + lineWidth + '"/>');
        for (var i = 0; i < ticks.length; i++) {
          var tick = ticks[i];
          var x = drawingArea.x + tick.pixel;
          if (tick.pixel < -10 || tick.pixel > drawingArea.width + 10) {
            continue;
          }
          var tickY2 = side === "top" ? axisY - tickLength : axisY + tickLength;
          parts.push('<line class="axis-tick x-axis-tick" x1="' + x + '" y1="' + axisY + '" x2="' + x + '" y2="' + tickY2 + '" stroke="' + tickColor + '" stroke-width="' + tickWidth + '"/>');
          if (showLabels) {
            parts.push('<text class="axis-label x-axis-label" x="' + x + '" y="' + labelY + '" text-anchor="middle">' + tick.text + "</text>");
          }
        }
        if (config.title) {
          var titleY;
          if (side === "top") {
            titleY = labelY - 25;
          } else {
            titleY = labelY + 20;
          }
          parts.push('<text class="axis-title x-axis-title" x="' + (drawingArea.x + drawingArea.width / 2) + '" y="' + titleY + '" text-anchor="middle">' + config.title + "</text>");
        }
        return parts.join("\n");
      }
      function createYAxis(axisSetup) {
        var yAxis = axisSetup.y;
        var config = yAxis.config;
        var ticks = yAxis.ticks;
        var drawingArea = axisSetup.drawingArea;
        if (config.show === false) {
          return "";
        }
        var parts = [];
        var side = config.side || "left";
        var tickLength = config.ticklen || 5;
        var tickColor = config.tickcolor || "#666666";
        var tickWidth = config.tickwidth || 1;
        var showLabels = config.showticklabels !== false;
        var lineColor = config.linecolor || "#333";
        var lineWidth = config.linewidth || 1;
        var axisX;
        var labelX;
        var labelAnchor = "end";
        if (side === "right") {
          axisX = drawingArea.x + drawingArea.width;
          labelX = axisX + tickLength + 5;
          labelAnchor = "start";
        } else {
          axisX = drawingArea.margins.left;
          labelX = axisX - tickLength - 5;
          labelAnchor = "end";
        }
        parts.push('<line class="axis-line y-axis-line" x1="' + axisX + '" y1="' + drawingArea.y + '" x2="' + axisX + '" y2="' + (drawingArea.y + drawingArea.height) + '" stroke="' + lineColor + '" stroke-width="' + lineWidth + '"/>');
        for (var i = 0; i < ticks.length; i++) {
          var tick = ticks[i];
          var y = drawingArea.y + tick.pixel;
          if (tick.pixel < -10 || tick.pixel > drawingArea.height + 10) {
            continue;
          }
          var tickX2 = side === "right" ? axisX + tickLength : axisX - tickLength;
          parts.push('<line class="axis-tick y-axis-tick" x1="' + axisX + '" y1="' + y + '" x2="' + tickX2 + '" y2="' + y + '" stroke="' + tickColor + '" stroke-width="' + tickWidth + '"/>');
          if (showLabels) {
            parts.push('<text class="axis-label y-axis-label" x="' + labelX + '" y="' + (y + 4) + '" text-anchor="' + labelAnchor + '">' + tick.text + "</text>");
          }
        }
        if (config.title) {
          var titleX;
          var titleY = drawingArea.y + drawingArea.height / 2;
          if (side === "right") {
            titleX = labelX + 30;
          } else {
            titleX = labelX - 25;
          }
          parts.push('<text class="axis-title y-axis-title" x="' + titleX + '" y="' + titleY + '" text-anchor="middle" transform="rotate(-90, ' + titleX + ", " + titleY + ')">' + config.title + "</text>");
        }
        return parts.join("\n");
      }
      function createGrid(axisSetup, isXAxis) {
        var axis = isXAxis ? axisSetup.x : axisSetup.y;
        var config = axis.config;
        var ticks = axis.ticks;
        var drawingArea = axisSetup.drawingArea;
        if (!config.showgrid) {
          return "";
        }
        var parts = [];
        var gridColor = config.gridcolor || "#e0e0e0";
        var gridWidth = config.gridwidth || 1;
        var dashArray = config.griddash || "";
        var strokeDasharray = "";
        if (dashArray) {
          if (typeof dashArray === "string") {
            strokeDasharray = 'stroke-dasharray="' + dashArray + '"';
          } else if (Array.isArray(dashArray)) {
            strokeDasharray = 'stroke-dasharray="' + dashArray.join(",") + '"';
          }
        }
        for (var i = 0; i < ticks.length; i++) {
          var tick = ticks[i];
          if (tick.pixel < 0 || tick.pixel > (isXAxis ? drawingArea.width : drawingArea.height)) {
            continue;
          }
          if (isXAxis) {
            var x = drawingArea.x + tick.pixel;
            parts.push('<line class="axis-grid x-grid-line" x1="' + x + '" y1="' + drawingArea.y + '" x2="' + x + '" y2="' + (drawingArea.y + drawingArea.height) + '" stroke="' + gridColor + '" stroke-width="' + gridWidth + '" ' + strokeDasharray + "/>");
          } else {
            var y = drawingArea.y + tick.pixel;
            parts.push('<line class="axis-grid y-grid-line" x1="' + drawingArea.x + '" y1="' + y + '" x2="' + (drawingArea.x + drawingArea.width) + '" y2="' + y + '" stroke="' + gridColor + '" stroke-width="' + gridWidth + '" ' + strokeDasharray + "/>");
          }
        }
        return parts.join("\n");
      }
      function createAxes(axesConfig) {
        axesConfig = axesConfig || {};
        var axisSetup = axes.setupAxes(axesConfig);
        var parts = [];
        if (axesConfig.gridOnly) {
          parts.push(createGrid(axisSetup, true));
          parts.push(createGrid(axisSetup, false));
          return {
            svg: parts.join("\n"),
            axisSetup
          };
        }
        parts.push(createGrid(axisSetup, true));
        parts.push(createGrid(axisSetup, false));
        parts.push(createXAxis(axisSetup));
        parts.push(createYAxis(axisSetup));
        return {
          svg: parts.join("\n"),
          axisSetup
        };
      }
      function createAxesFromSetup(axisSetup, includeGrid) {
        var parts = [];
        if (includeGrid !== false) {
          parts.push(createGrid(axisSetup, true));
          parts.push(createGrid(axisSetup, false));
        }
        parts.push(createXAxis(axisSetup));
        parts.push(createYAxis(axisSetup));
        return parts.join("\n");
      }
      module.exports = {
        createAxes,
        createAxesFromSetup,
        createXAxis,
        createYAxis,
        createGrid
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
      var createAxes = require_axes3();
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
          svgParts.push(createLabels(contourResult, options));
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
        createNulls,
        createAxes: createAxes.createAxes,
        createAxesFromSetup: createAxes.createAxesFromSetup,
        createXAxis: createAxes.createXAxis,
        createYAxis: createAxes.createYAxis,
        createGrid: createAxes.createGrid
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

  // interaction/interaction_manager.js
  var require_interaction_manager = __commonJS({
    "interaction/interaction_manager.js"(exports, module) {
      "use strict";
      function createInteractionManager(canvas, layeredRenderer, config) {
        config = config || {};
        var viewManager = layeredRenderer.getViewManager();
        var drawingArea = layeredRenderer.getDrawingArea();
        var isDragging = false;
        var isBoxZooming = false;
        var lastX = 0;
        var lastY = 0;
        var boxStartX = 0;
        var boxStartY = 0;
        var zoomEnabled = config.zoom !== false;
        var panEnabled = config.pan !== false;
        var dblclickReset = config.dblclickReset !== false;
        var boxZoomEnabled = config.boxZoom === true;
        var zoomSensitivity = 1e-3;
        var boundHandlers = {};
        function getMousePos(e) {
          var rect = canvas.getBoundingClientRect();
          return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
        }
        function isInDrawingArea(pos) {
          return pos.x >= drawingArea.x && pos.x <= drawingArea.x + drawingArea.width && pos.y >= drawingArea.y && pos.y <= drawingArea.y + drawingArea.height;
        }
        function handleWheel(e) {
          if (!zoomEnabled)
            return;
          var pos = getMousePos(e);
          if (!isInDrawingArea(pos))
            return;
          e.preventDefault();
          var dataPos = viewManager.pixelToData(pos.x, pos.y, drawingArea);
          var delta = -e.deltaY;
          var factor = 1 + delta * zoomSensitivity;
          factor = Math.max(0.5, Math.min(2, factor));
          viewManager.zoomAt(factor, dataPos.x, dataPos.y, drawingArea);
          layeredRenderer.render();
          if (config.onZoom) {
            config.onZoom(viewManager.getState());
          }
        }
        function handleMouseDown(e) {
          var pos = getMousePos(e);
          if (!isInDrawingArea(pos))
            return;
          if (e.button === 0) {
            if (e.shiftKey && boxZoomEnabled) {
              isBoxZooming = true;
              boxStartX = pos.x;
              boxStartY = pos.y;
            } else if (panEnabled) {
              isDragging = true;
              lastX = pos.x;
              lastY = pos.y;
              canvas.style.cursor = "grabbing";
            }
          }
        }
        function handleMouseMove(e) {
          var pos = getMousePos(e);
          if (isDragging) {
            e.preventDefault();
            var dx = pos.x - lastX;
            var dy = pos.y - lastY;
            viewManager.pan(dx, dy, drawingArea);
            lastX = pos.x;
            lastY = pos.y;
            layeredRenderer.render();
            if (config.onPan) {
              config.onPan(viewManager.getState());
            }
          } else if (isBoxZooming) {
          } else if (isInDrawingArea(pos)) {
            canvas.style.cursor = "grab";
          } else {
            canvas.style.cursor = "default";
          }
        }
        function handleMouseUp(e) {
          if (isDragging) {
            isDragging = false;
            canvas.style.cursor = "grab";
          }
          if (isBoxZooming) {
            isBoxZooming = false;
            var pos = getMousePos(e);
            var x1 = Math.min(boxStartX, pos.x);
            var x2 = Math.max(boxStartX, pos.x);
            var y1 = Math.min(boxStartY, pos.y);
            var y2 = Math.max(boxStartY, pos.y);
            if (x2 - x1 > 10 && y2 - y1 > 10) {
              var dataStart = viewManager.pixelToData(x1, y2, drawingArea);
              var dataEnd = viewManager.pixelToData(x2, y1, drawingArea);
              viewManager.setRange(dataStart.x, dataEnd.x, dataStart.y, dataEnd.y);
              layeredRenderer.render();
              if (config.onZoom) {
                config.onZoom(viewManager.getState());
              }
            }
          }
        }
        function handleDblClick(e) {
          if (!dblclickReset)
            return;
          var pos = getMousePos(e);
          if (!isInDrawingArea(pos))
            return;
          e.preventDefault();
          viewManager.reset();
          layeredRenderer.render();
          if (config.onReset) {
            config.onReset();
          }
        }
        function handleTouchStart(e) {
          if (e.touches.length === 1) {
            var touch = e.touches[0];
            var pos = getMousePos(touch);
            if (isInDrawingArea(pos)) {
              isDragging = true;
              lastX = pos.x;
              lastY = pos.y;
            }
          }
        }
        function handleTouchMove(e) {
          if (e.touches.length === 1 && isDragging) {
            e.preventDefault();
            var touch = e.touches[0];
            var pos = getMousePos(touch);
            var dx = pos.x - lastX;
            var dy = pos.y - lastY;
            viewManager.pan(dx, dy, drawingArea);
            lastX = pos.x;
            lastY = pos.y;
            layeredRenderer.render();
            if (config.onPan) {
              config.onPan(viewManager.getState());
            }
          }
        }
        function handleTouchEnd(e) {
          isDragging = false;
        }
        function getViewState() {
          return viewManager.getState();
        }
        function setViewRange(xMin, xMax, yMin, yMax) {
          viewManager.setRange(xMin, xMax, yMin, yMax);
          layeredRenderer.render();
        }
        function resetView() {
          viewManager.reset();
          layeredRenderer.render();
          if (config.onReset) {
            config.onReset();
          }
        }
        function bindEvents() {
          boundHandlers.wheel = handleWheel.bind(this);
          boundHandlers.mousedown = handleMouseDown.bind(this);
          boundHandlers.mousemove = handleMouseMove.bind(this);
          boundHandlers.mouseup = handleMouseUp.bind(this);
          boundHandlers.mouseleave = handleMouseUp.bind(this);
          boundHandlers.dblclick = handleDblClick.bind(this);
          boundHandlers.touchstart = handleTouchStart.bind(this);
          boundHandlers.touchmove = handleTouchMove.bind(this);
          boundHandlers.touchend = handleTouchEnd.bind(this);
          canvas.addEventListener("wheel", boundHandlers.wheel, { passive: false });
          canvas.addEventListener("mousedown", boundHandlers.mousedown);
          canvas.addEventListener("mousemove", boundHandlers.mousemove);
          canvas.addEventListener("mouseup", boundHandlers.mouseup);
          canvas.addEventListener("mouseleave", boundHandlers.mouseleave);
          canvas.addEventListener("dblclick", boundHandlers.dblclick);
          canvas.addEventListener("touchstart", boundHandlers.touchstart, { passive: false });
          canvas.addEventListener("touchmove", boundHandlers.touchmove, { passive: false });
          canvas.addEventListener("touchend", boundHandlers.touchend);
        }
        function unbindEvents() {
          canvas.removeEventListener("wheel", boundHandlers.wheel);
          canvas.removeEventListener("mousedown", boundHandlers.mousedown);
          canvas.removeEventListener("mousemove", boundHandlers.mousemove);
          canvas.removeEventListener("mouseup", boundHandlers.mouseup);
          canvas.removeEventListener("mouseleave", boundHandlers.mouseleave);
          canvas.removeEventListener("dblclick", boundHandlers.dblclick);
          canvas.removeEventListener("touchstart", boundHandlers.touchstart);
          canvas.removeEventListener("touchmove", boundHandlers.touchmove);
          canvas.removeEventListener("touchend", boundHandlers.touchend);
        }
        function destroy() {
          unbindEvents();
        }
        bindEvents();
        return {
          getViewState,
          setViewRange,
          resetView,
          destroy
        };
      }
      module.exports = {
        createInteractionManager
      };
    }
  });

  // interaction/index.js
  var require_interaction = __commonJS({
    "interaction/index.js"(exports, module) {
      "use strict";
      var viewState = require_view_state();
      var interactionManager = require_interaction_manager();
      module.exports = {
        createViewManager: viewState.createViewManager,
        createInteractionManager: interactionManager.createInteractionManager
      };
    }
  });

  // index.js
  var require_contour_core = __commonJS({
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
        interaction: require_interaction(),
        Overlay: require_overlay2(),
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
  return require_contour_core();
})();
