'use strict';

var Axes = require('../../plots/cartesian/axes');
var Lib = require('../../lib');

module.exports = function setContours(trace, vals) {
    var contours = trace.contours;

    // check if we have custom thresholds - this takes highest priority
    if(contours.thresholds && Lib.isArrayOrTypedArray(contours.thresholds) && contours.thresholds.length > 0) {
        // validate and sort thresholds
        var thresholds = contours.thresholds.slice().sort(function(a, b) {
            return a - b;
        });
        
        // filter out non-numeric values but keep all numeric values regardless of data range
        thresholds = thresholds.filter(function(val) {
            return typeof val === 'number' && !isNaN(val) && isFinite(val);
        });
        
        if(thresholds.length > 0) {
            var dataMin = Lib.aggNums(Math.min, null, vals);
            var dataMax = Lib.aggNums(Math.max, null, vals);
            
            // set contour parameters based on thresholds
            contours.start = thresholds[0];
            contours.end = thresholds[thresholds.length - 1];
            contours.size = null; // size is not applicable for custom thresholds
            contours._levels = thresholds; // store ALL custom levels for later use
            
            // Debug: log the custom thresholds being used (including restyle updates)
            if(typeof console !== 'undefined' && console.log) {
                console.log('=== Custom Thresholds Processing (including restyle) ===');
                console.log('Using custom thresholds:', thresholds);
                console.log('Data range:', dataMin, 'to', dataMax);
                console.log('Input start/end:', contours.start, '/', contours.end);
                console.log('Trace zmin/zmax:', trace.zmin, '/', trace.zmax);
                console.log('Thresholds within data range:', thresholds.filter(function(t) {
                    return t >= dataMin && t <= dataMax;
                }));
                console.log('Thresholds outside data range:', thresholds.filter(function(t) {
                    return t < dataMin || t > dataMax;
                }));
                console.log('=== End Custom Thresholds Processing ===');
            }
            
            // copy thresholds info back to input
            if(!trace._input.contours) trace._input.contours = {};
            trace._input.contours.thresholds = thresholds;
            trace._input.autocontour = false;
            
            return; // skip auto/manual contour generation
        }
    }

    // check if we need to auto-choose contour levels
    if(trace.autocontour) {
        // N.B. do not try to use coloraxis cmin/cmax,
        // these values here are meant to remain "per-trace" for now
        var zmin = trace.zmin;
        var zmax = trace.zmax;
        if(trace.zauto || zmin === undefined) {
            zmin = Lib.aggNums(Math.min, null, vals);
        }
        if(trace.zauto || zmax === undefined) {
            zmax = Lib.aggNums(Math.max, null, vals);
        }

        var dummyAx = autoContours(zmin, zmax, trace.ncontours);
        contours.size = dummyAx.dtick;
        contours.start = Axes.tickFirst(dummyAx);
        dummyAx.range.reverse();
        contours.end = Axes.tickFirst(dummyAx);

        if(contours.start === zmin) contours.start += contours.size;
        if(contours.end === zmax) contours.end -= contours.size;

        // if you set a small ncontours, *and* the ends are exactly on zmin/zmax
        // there's an edge case where start > end now. Make sure there's at least
        // one meaningful contour, put it midway between the crossed values
        if(contours.start > contours.end) {
            contours.start = contours.end = (contours.start + contours.end) / 2;
        }

        // copy auto-contour info back to the source data.
        // previously we copied the whole contours object back, but that had
        // other info (coloring, showlines) that should be left to supplyDefaults
        if(!trace._input.contours) trace._input.contours = {};
        Lib.extendFlat(trace._input.contours, {
            start: contours.start,
            end: contours.end,
            size: contours.size
        });
        trace._input.autocontour = true;
    } else if(contours.type !== 'constraint') {
        // sanity checks on manually-supplied start/end/size
        var start = contours.start;
        var end = contours.end;
        var inputContours = trace._input.contours;

        if(start > end) {
            contours.start = inputContours.start = end;
            end = contours.end = inputContours.end = start;
            start = contours.start;
        }

        if(!(contours.size > 0)) {
            var sizeOut;
            if(start === end) sizeOut = 1;
            else sizeOut = autoContours(start, end, trace.ncontours).dtick;

            inputContours.size = contours.size = sizeOut;
        }
    }
};


/*
 * autoContours: make a dummy axis object with dtick we can use
 * as contours.size, and if needed we can use Axes.tickFirst
 * with this axis object to calculate the start and end too
 *
 * start: the value to start the contours at
 * end: the value to end at (must be > start)
 * ncontours: max number of contours to make, like roughDTick
 *
 * returns: an axis object
 */
function autoContours(start, end, ncontours) {
    var dummyAx = {
        type: 'linear',
        range: [start, end]
    };

    Axes.autoTicks(
        dummyAx,
        (end - start) / (ncontours || 15)
    );

    return dummyAx;
}
