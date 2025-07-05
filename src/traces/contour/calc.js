'use strict';

var Colorscale = require('../../components/colorscale');

var heatmapCalc = require('../heatmap/calc');
var setContours = require('./set_contours');
var endPlus = require('./end_plus');

// most is the same as heatmap calc, then adjust it
// though a few things inside heatmap calc still look for
// contour maps, because the makeBoundArray calls are too entangled
module.exports = function calc(gd, trace) {
    var cd = heatmapCalc(gd, trace);

    var zOut = cd[0].z;
    setContours(trace, zOut);

    var contours = trace.contours;
    var cOpts = Colorscale.extractOpts(trace);
    var cVals;

    if(contours.coloring === 'heatmap' && cOpts.auto && trace.autocontour === false) {
        var start = contours.start;
        var end = endPlus(contours);
        var cs = contours.size || 1;
        var nc = Math.floor((end - start) / cs) + 1;

        if(contours._levels && contours._levels.length > 0) {
            // Use custom thresholds for heatmap coloring
            var levels = contours._levels;
            // Calculate an appropriate padding based on the threshold spacing
            var firstGap = levels.length > 1 ? levels[1] - levels[0] : 1;
            var lastGap = levels.length > 1 ? levels[levels.length - 1] - levels[levels.length - 2] : 1;
            var min0 = levels[0] - firstGap / 2;
            var max0 = levels[levels.length - 1] + lastGap / 2;
            cVals = [min0, max0];
        } else {
            if(!isFinite(cs)) {
                cs = 1;
                nc = 1;
            }

            var min0 = start - cs / 2;
            var max0 = min0 + nc * cs;
            cVals = [min0, max0];
        }
    } else {
        cVals = zOut;
    }

    // Debug: log colorscale calculation details
    if(typeof console !== 'undefined' && console.log) {
        console.log('=== Colorscale.calc in contour/calc.js ===');
        console.log('Has custom thresholds:', !!(contours._levels && contours._levels.length > 0));
        console.log('cVals type:', Array.isArray(cVals) ? 'array[' + cVals.length + ']' : typeof cVals);
        console.log('Using cVals:', Array.isArray(cVals) && cVals.length <= 10 ? cVals : 'large array');
    }

    Colorscale.calc(gd, trace, {vals: cVals, cLetter: 'z'});

    return cd;
};
