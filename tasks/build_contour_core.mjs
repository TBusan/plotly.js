#!/usr/bin/env node

/**
 * Build standalone contour-core bundle
 * 创建独立的 contour-core 打包文件
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=== Building contour-core Standalone Bundle ===\n');

const distDir = 'dist';
const contourDir = 'src/contour-core';

// 确保目录存在
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// 创建 browser 版本的 contour-core
const browserCode = `
// contour-core - Standalone Contour Calculation Library
// Built from Plotly.js contour module
// License: MIT

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ContourCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // Constants
    const CONSTANTS = {
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
        CHOOSESADDLE: { 104: [4, 1], 208: [2, 8], 713: [7, 13], 1114: [11, 14] },
        SADDLEREMAINDER: {1: 4, 2: 8, 4: 1, 7: 13, 8: 2, 11: 14, 13: 7, 14: 11}
    };

    // Marching Squares
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
                const corners = [[z[yi][xi], z[yi][xi + 1]], [z[yi + 1][xi], z[yi + 1][xi + 1]]];

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

    function getMarchingIndex(val, corners) {
        let mi = (corners[0][0] > val ? 0 : 1) +
                 (corners[0][1] > val ? 0 : 2) +
                 (corners[1][1] > val ? 0 : 4) +
                 (corners[1][0] > val ? 0 : 8);

        if (mi === 5 || mi === 10) {
            const avg = (corners[0][0] + corners[0][1] + corners[1][0] + corners[1][1]) / 4;
            if (val > avg) return (mi === 5) ? 713 : 1114;
            return (mi === 5) ? 104 : 208;
        }
        return (mi === 15) ? 0 : mi;
    }

    // Path Finding
    function findAllPaths(pathinfo, xtol, ytol) {
        xtol = xtol || 0.01;
        ytol = ytol || 0.01;

        for (let i = 0; i < pathinfo.length; i++) {
            const pi = pathinfo[i];

            for (let j = 0; j < pi.starts.length; j++) {
                makePath(pi, pi.starts[j], 'edge', xtol, ytol);
            }

            let cnt = 0;
            while (Object.keys(pi.crossings).length && cnt < 10000) {
                cnt++;
                const startLoc = Object.keys(pi.crossings)[0].split(',').map(Number);
                makePath(pi, startLoc, undefined, xtol, ytol);
            }
        }
    }

    function equalPts(pt1, pt2, xtol, ytol) {
        return Math.abs(pt1[0] - pt2[0]) < xtol && Math.abs(pt1[1] - pt2[1]) < ytol;
    }

    function makePath(pi, loc, edgeflag, xtol, ytol) {
        const locStr = loc.join(',');
        let mi = pi.crossings[locStr];
        const marchStep = getStartStep(mi, edgeflag, loc);
        const pts = [getInterpPx(pi, loc, [-marchStep[0], -marchStep[1]])];
        const m = pi.z.length;
        const n = pi.z[0].length;
        const startLoc = loc.slice();
        const startStep = marchStep.slice();

        for (let cnt = 0; cnt < 10000; cnt++) {
            if (mi > 20) {
                mi = CONSTANTS.CHOOSESADDLE[mi][(marchStep[0] || marchStep[1]) < 0 ? 0 : 1];
                pi.crossings[locStr] = CONSTANTS.SADDLEREMAINDER[mi];
            } else {
                delete pi.crossings[locStr];
            }

            marchStep = CONSTANTS.NEWDELTA[mi];
            if (!marchStep) break;

            pts.push(getInterpPx(pi, loc, marchStep));
            loc[0] += marchStep[0];
            loc[1] += marchStep[1];
            locStr = loc.join(',');

            if (equalPts(pts[pts.length - 1], pts[pts.length - 2], xtol, ytol)) {
                pts.pop();
            }

            const atEdge = (marchStep[0] && (loc[0] < 0 || loc[0] > n - 2)) ||
                    (marchStep[1] && (loc[1] < 0 || loc[1] > m - 2));
            const closedLoop = loc[0] === startLoc[0] && loc[1] === startLoc[1] &&
                    marchStep[0] === startStep[0] && marchStep[1] === startStep[1];

            if (closedLoop || (edgeflag && atEdge)) break;

            mi = pi.crossings[locStr];
        }

        const closedpath = equalPts(pts[0], pts[pts.length - 1], xtol, ytol);

        // Remove index parts
        for (let cnt = 0; cnt < pts.length; cnt++) {
            pts[cnt].length = 2;
        }

        if (pts.length < 2) return;

        if (closedpath) {
            pts.pop();
            pi.paths.push(pts);
        } else {
            pi.edgepaths.push(pts);
        }
    }

    function getStartStep(mi, edgeflag, loc) {
        let dx = 0, dy = 0;

        if (mi > 20 && edgeflag) {
            if (mi === 208 || mi === 1114) {
                dx = loc[0] === 0 ? 1 : -1;
            } else {
                dy = loc[1] === 0 ? 1 : -1;
            }
        } else if (CONSTANTS.BOTTOMSTART.indexOf(mi) !== -1) {
            dy = 1;
        } else if (CONSTANTS.LEFTSTART.indexOf(mi) !== -1) {
            dx = 1;
        } else if (CONSTANTS.TOPSTART.indexOf(mi) !== -1) {
            dy = -1;
        } else {
            dx = -1;
        }
        return [dx, dy];
    }

    function getInterpPx(pi, loc, step) {
        const locx = loc[0] + Math.max(step[0], 0);
        const locy = loc[1] + Math.max(step[1], 0);
        const zxy = pi.z[locy][locx];

        if (step[1]) {
            const dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);
            return [locx + dx, locy, locx + dx, locy];
        } else {
            const dy = (pi.level - zxy) / (pi.z[locy + 1][locx] - zxy);
            return [locx, locy + dy, locx, locy + dy];
        }
    }

    // Level Calculation
    function setContours(options, vals) {
        let levels = [];

        if (options.thresholds && Array.isArray(options.thresholds) && options.thresholds.length > 0) {
            levels = options.thresholds.slice().sort((a, b) => a - b);
            levels = levels.filter(val => typeof val === 'number' && !isNaN(val) && isFinite(val));

            if (levels.length > 0) {
                return levels;
            }
        }

        if (options.autocontour) {
            const zmin = Math.min.apply(Math, vals.flat());
            const zmax = Math.max.apply(Math, vals.flat());
            const ncontours = options.ncontours || 15;
            const size = (zmax - zmin) / (ncontours - 1);

            for (let val = zmin; val <= zmax + size * 0.0001; val += size) {
                levels.push(Math.round(val * 10000) / 10000);
            }

            levels = uniqueSorted(levels);
        } else {
            const start = options.start || 0;
            const end = options.end || 100;
            const size = options.size || 1;

            for (let val = start; val <= end + size * 0.0001; val += size) {
                levels.push(Math.round(val * 10000) / 10000);
            }

            levels = uniqueSorted(levels);
        }

        return levels;
    }

    function uniqueSorted(arr) {
        const seen = {};
        const out = [];
        for (let i = 0; i < arr.length; i++) {
            const val = arr[i];
            if (!seen[val]) {
                seen[val] = true;
                out.push(val);
            }
        }
        return out.sort((a, b) => a - b);
    }

    // Main computeContours function
    function computeContours(grid, options) {
        options = options || {};

        if (!grid || !grid.z || !Array.isArray(grid.z)) {
            throw new Error('Invalid grid: must have z property as 2D array');
        }

        const z = grid.z;
        const m = z.length;
        const n = z[0].length;

        // Create x and y coordinate arrays if not provided
        const x = grid.x || [];
        const y = grid.y || [];
        if (x.length === 0) {
            for (let i = 0; i < n; i++) x.push(i);
        }
        if (y.length === 0) {
            for (let j = 0; j < m; j++) y.push(j);
        }

        // Compute contour levels
        const contourLevels = setContours(options, z);

        if (contourLevels.length === 0) {
            return { levels: [], paths: [] };
        }

        // Limit to maximum of 1000 contours
        if (contourLevels.length > 1000) {
            console.warn('Too many contours, clipping at 1000');
            contourLevels = contourLevels.slice(0, 1000);
        }

        // Create pathinfo array
        const pathinfo = [];
        for (let i = 0; i < contourLevels.length; i++) {
            pathinfo.push({
                level: contourLevels[i],
                crossings: {},
                starts: [],
                edgepaths: [],
                paths: [],
                z: z,
                x: x,
                y: y,
                smoothing: options.smoothing || 0
            });
        }

        // Run marching squares algorithm
        makeCrossings(pathinfo);

        // Find all paths
        findAllPaths(pathinfo, 0.01, 0.01);

        return {
            levels: contourLevels,
            paths: pathinfo.map(pi => ({
                level: pi.level,
                edgepaths: pi.edgepaths,
                paths: pi.paths
            }))
        };
    }

    // Export
    return {
        version: '1.0.0',
        computeContours: computeContours,
        CONSTANTS: CONSTANTS
    };
}));
`;

// 写入文件
fs.writeFileSync(path.join(distDir, 'contour-core.js'), browserCode);
fs.writeFileSync(path.join(distDir, 'contour-core.min.js'), browserCode.replace(/\s+/g, ' '));

console.log('✓ Built dist/contour-core.js');
console.log('✓ Built dist/contour-core.min.js');
console.log('\n使用方法:');
console.log('  <script src="dist/contour-core.js"></script>');
console.log('  <script>');
console.log('    var result = ContourCore.computeContours({');
console.log('      z: [[0,1,2],[1,2,3],[2,3,4]]');
console.log('    }, { autocontour: true, ncontours: 5 });');
console.log('  </script>');
