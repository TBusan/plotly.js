'use strict';

/**
 * contour-core performance benchmark
 *
 * Measures where time actually goes across the pipeline, for both the
 * browser-interactive and SSR profiles. Run BEFORE and AFTER each optimization
 * to quantify the gain.
 *
 * Usage:
 *   node bench/bench.js            # full matrix (default)
 *   node bench/bench.js 200        # only 200x200 datasets
 *   node bench/bench.js 50,200     # 50 and 200
 */

var fs = require('fs');
var path = require('path');
var { createCanvas } = require('@napi-rs/canvas');

var cc = require('../index.js');
var nullHandling = require('../null_handling');
var levels = require('../levels');
var marchingSquares = require('../marchingsquares');
var pathFinding = require('../pathfinding');
var closeBoundaries = require('../close_boundaries');

// ---------------------------------------------------------------------------
// Dataset generation
// ---------------------------------------------------------------------------

function makeGrid(rows, cols, nullPct) {
    var grid = [];
    for (var i = 0; i < rows; i++) {
        var row = [];
        for (var j = 0; j < cols; j++) {
            var x = j / cols;
            var y = i / rows;
            var base = 50;
            var ridge = Math.exp(-Math.pow((x - 0.3) * 2, 2)) * 30 * (1 - y);
            var valley = -Math.exp(-Math.pow((x - 0.7) * 3, 2)) * 20;
            var hill1 = Math.exp(-((x - 0.2) * (x - 0.2) + (y - 0.8) * (y - 0.8)) * 20) * 40;
            var hill2 = Math.exp(-((x - 0.8) * (x - 0.8) + (y - 0.2) * (y - 0.2)) * 15) * 35;
            var noise = Math.sin(x * 30) * Math.cos(y * 25) * 3;
            var v = base + ridge + valley + hill1 + hill2 + noise;
            if (nullPct && (i * cols + j) % Math.round(100 / nullPct) === 0) {
                v = null;
            }
            row.push(v);
        }
        grid.push(row);
    }
    return grid;
}

function makeCoords(grid) {
    var cols = grid[0].length;
    var rows = grid.length;
    var x = [];
    var y = [];
    for (var j = 0; j < cols; j++) x.push(j * 10);
    for (var i = 0; i < rows; i++) y.push(i * 10);
    return { x: x, y: y };
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

var hrtime = process.hrtime.bigint;

function msSince(t0) {
    return Number(hrtime() - t0) / 1e6;
}

// Median of `runs` executions of fn(), after `warmup` unmeasured runs.
function time(fn, opts) {
    opts = opts || {};
    var warmup = opts.warmup !== undefined ? opts.warmup : 2;
    var runs = opts.runs !== undefined ? opts.runs : 5;
    for (var w = 0; w < warmup; w++) fn();
    var samples = [];
    for (var r = 0; r < runs; r++) {
        var t0 = hrtime();
        fn();
        samples.push(msSince(t0));
    }
    samples.sort(function(a, b) { return a - b; });
    return samples[Math.floor(samples.length / 2)];
}

function fmt(ms) {
    return ms.toFixed(2) + 'ms';
}

// ---------------------------------------------------------------------------
// Compute-pipeline sub-stage timing.
// Every iteration builds a FRESH pathinfo so no stage observes mutated state
// left behind by a previous iteration (makeCrossings/findAllPaths mutate).
// ---------------------------------------------------------------------------

function pipelineTimings(z, coords, options, iterations) {
    var totals = {
        normalize: 0, findEmpties: 0, interp2d: 0, setContours: 0,
        makeCrossings: 0, findAllPaths: 0, closeBoundaries: 0
    };
    var xTol = Math.max(1e-10, (coords.x[coords.x.length - 1] - coords.x[0]) * 0.001);
    var yTol = Math.max(1e-10, (coords.y[coords.y.length - 1] - coords.y[0]) * 0.001);
    var contourOptions = options.contours || {};
    if (!contourOptions.type && !contourOptions.coloring) contourOptions.coloring = 'fill';

    var lastPathinfo = null;
    for (var it = 0; it < iterations; it++) {
        var t0 = hrtime();
        var normalization = nullHandling.normalizeNullValues(z);
        totals.normalize += msSince(t0);
        var cleanedZ = normalization.cleanedGrid;
        var nullMask = normalization.nullMask;

        t0 = hrtime();
        var empties = nullHandling.findEmpties(cleanedZ);
        totals.findEmpties += msSince(t0);

        t0 = hrtime();
        if (empties.length > 0) cleanedZ = nullHandling.interp2d(cleanedZ, empties);
        totals.interp2d += msSince(t0);

        t0 = hrtime();
        var lv = levels.setContours(options, cleanedZ);
        totals.setContours += msSince(t0);

        var pathinfo = lv.map(function(level) {
            return {
                level: level, crossings: {}, starts: [], edgepaths: [], paths: [],
                z: cleanedZ, x: coords.x, y: coords.y, nullMask: nullMask,
                smoothing: options.smoothing || 0
            };
        });

        t0 = hrtime();
        marchingSquares.makeCrossings(pathinfo);
        totals.makeCrossings += msSince(t0);

        t0 = hrtime();
        pathFinding.findAllPaths(pathinfo, xTol, yTol);
        totals.findAllPaths += msSince(t0);

        t0 = hrtime();
        closeBoundaries(pathinfo, contourOptions);
        totals.closeBoundaries += msSince(t0);

        lastPathinfo = pathinfo;
    }

    var avg = {};
    Object.keys(totals).forEach(function(k) { avg[k] = totals[k] / iterations; });
    return { avg: avg, pathinfo: lastPathinfo, nullMask: nullMask };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function makeCanvas(w, h) {
    var canvas = createCanvas(w, h);
    return { canvas: canvas, ctx: canvas.getContext('2d') };
}

var BENCH_COLORSCALE = [
    [20, '#313695'], [35, '#4575b4'], [50, '#74add1'],
    [65, '#e0f3f8'], [80, '#fee090'], [95, '#f46d43'], [110, '#a50026']
];

function renderStyle(w, h, coloring) {
    return {
        width: w, height: h, coloring: coloring, showLines: true,
        showLabels: true, showColorbar: true, colorbar: true,
        colorScale: BENCH_COLORSCALE
    };
}

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

var sizes = process.argv[2] ? process.argv[2].split(',').map(Number) : [50, 200, 500];

function benchSize(size) {
    var nullPcts = [0, 10];
    var opts = { autocontour: true, ncontours: 15, smoothing: 0.6 };
    var W = 900;
    var H = 600;

    for (var p = 0; p < nullPcts.length; p++) {
        var nullPct = nullPcts[p];
        var z = makeGrid(size, size, nullPct);
        var coords = makeCoords(z);
        var grid = { z: z, x: coords.x, y: coords.y };

        console.log('\n============== grid ' + size + 'x' + size + ', nulls ' + nullPct + '% ==============');

        // Full compute (SSR cold path); connectgaps:false when nulls -> exercises clip mask
        var computeOpts = { autocontour: true, ncontours: 15, smoothing: 0.6 };
        if (nullPct) computeOpts.connectgaps = false;

        var tFull = time(function() { cc.computeContours(grid, computeOpts); });
        console.log('computeContours (full)  : ' + fmt(tFull));

        var pt = pipelineTimings(z, coords, opts, 6);
        var a = pt.avg;
        var subSum = a.normalize + a.findEmpties + a.interp2d + a.setContours +
            a.makeCrossings + a.findAllPaths + a.closeBoundaries;
        console.log('  normalize             : ' + fmt(a.normalize));
        console.log('  findEmpties           : ' + fmt(a.findEmpties));
        console.log('  interp2d              : ' + fmt(a.interp2d));
        console.log('  setContours           : ' + fmt(a.setContours));
        console.log('  makeCrossings         : ' + fmt(a.makeCrossings));
        console.log('  findAllPaths          : ' + fmt(a.findAllPaths));
        console.log('  closeBoundaries       : ' + fmt(a.closeBoundaries));
        console.log('  [sub-stage sum]       : ' + fmt(subSum) + ' (' +
            Math.round(subSum / tFull * 100) + '% of full compute)');

        // Full result for rendering
        var result = cc.computeContours(grid, computeOpts);
        var pathCount = result.paths.reduce(function(s, pi) {
            return s + (pi.paths ? pi.paths.length : 0) + (pi.edgepaths ? pi.edgepaths.length : 0);
        }, 0);
        var labelable = result.paths.reduce(function(s, pi) {
            var n = 0;
            (pi.paths || []).concat(pi.edgepaths || []).forEach(function(p) {
                if (p.length >= 3) n++;
            });
            return s + n;
        }, 0);
        console.log('  levels=' + result.levels.length + ' paths=' + pathCount + ' labelable=' + labelable);

        // Render: label cost delta
        var lab = makeCanvas(W, H);
        var styleNo = renderStyle(W, H, 'lines');
        styleNo.showLabels = false;
        var styleYes = renderStyle(W, H, 'lines');
        var tNoLabels = time(function() {
            cc.renderers.canvas.drawContours(lab.ctx, result, styleNo);
        });
        var tLabels = time(function() {
            cc.renderers.canvas.drawContours(lab.ctx, result, styleYes);
        });
        console.log('render lines  (no lab)  : ' + fmt(tNoLabels));
        console.log('render lines  (labels)  : ' + fmt(tLabels) + '  (label cost ~ ' +
            fmt(tLabels - tNoLabels) + ')');

        ['fill', 'heatmap'].forEach(function(coloring) {
            var c = makeCanvas(W, H);
            var s = renderStyle(W, H, coloring);
            var tR = time(function() {
                cc.renderers.canvas.drawContours(c.ctx, result, s);
            });
            console.log('render ' + coloring.padEnd(7) + '  : ' + fmt(tR));
        });

        // SSR outputs
        var tSvg = time(function() {
            cc.renderers.svg.renderSVG(result, {
                width: W, height: H, coloring: 'fill', showLines: true, colorbar: true,
                colorScale: BENCH_COLORSCALE
            });
        });
        console.log('SSR svg string (fill)  : ' + fmt(tSvg));

        var tGeo = time(function() { cc.toGeoJSON(result, { type: 'lines', propertyName: 'z' }); });
        console.log('SSR toGeoJSON (lines)  : ' + fmt(tGeo));

        var tGeoFill = time(function() { cc.toFilledGeoJSON(result, { propertyName: 'z', clip: true }); });
        console.log('SSR toFilledGeoJSON    : ' + fmt(tGeoFill));
    }
}

console.log('contour-core benchmark — ' + new Date().toISOString());
console.log('node ' + process.version + ', napi-rs/canvas');

sizes.forEach(function(size) { benchSize(size); });

fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'results', 'bench-' + Date.now() + '.json'),
    JSON.stringify({ ranAt: new Date().toISOString(), sizes: sizes }, null, 2));
console.log('\nbenchmark complete');
