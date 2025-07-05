'use strict';

var d3 = require('@plotly/d3');

var Colorscale = require('../../components/colorscale');
var endPlus = require('./end_plus');

module.exports = function makeColorMap(trace) {
    var contours = trace.contours;
    var start = contours.start;
    var end = endPlus(contours);
    var cs = contours.size || 1;
    var nc = Math.floor((end - start) / cs) + 1;
    var extra = contours.coloring === 'lines' ? 0 : 1;
    var cOpts = Colorscale.extractOpts(trace);
    
    // Debug: log when makeColorMap is called
    if(typeof console !== 'undefined' && console.log) {
        console.log('=== makeColorMap called ===');
        console.log('Has custom levels:', !!(contours._levels && contours._levels.length > 0));
        console.log('Contours._levels:', contours._levels);
        console.log('Contours coloring:', contours.coloring);
        console.log('Contours start/end/size:', contours.start, contours.end, contours.size);
        console.log('Trace zmin/zmax:', trace.zmin, trace.zmax);
        console.log('Trace input thresholds:', trace._input && trace._input.contours && trace._input.contours.thresholds);
    }

    if(!isFinite(cs)) {
        cs = 1;
        nc = 1;
    }

    var scl = cOpts.reversescale ?
        Colorscale.flipScale(cOpts.colorscale) :
        cOpts.colorscale;

    var len = scl.length;
    var domain = new Array(len);
    var range = new Array(len);

    var si, i;

    var zmin0 = cOpts.min;
    var zmax0 = cOpts.max;

    if(contours.coloring === 'heatmap') {
        for(i = 0; i < len; i++) {
            si = scl[i];
            domain[i] = si[0] * (zmax0 - zmin0) + zmin0;
            range[i] = si[1];
        }

        // do the contours extend beyond the colorscale?
        // if so, extend the colorscale with constants
        var zRange = d3.extent([
            zmin0,
            zmax0,
            contours.start,
            contours.start + cs * (nc - 1)
        ]);
        var zmin = zRange[zmin0 < zmax0 ? 0 : 1];
        var zmax = zRange[zmin0 < zmax0 ? 1 : 0];

        if(zmin !== zmin0) {
            domain.splice(0, 0, zmin);
            range.splice(0, 0, range[0]);
        }

        if(zmax !== zmax0) {
            domain.push(zmax);
            range.push(range[range.length - 1]);
        }
    } else {
        var zRangeInput = trace._input && (
            typeof trace._input.zmin === 'number' && typeof trace._input.zmax === 'number'
        );

        // Check if we have custom thresholds (both from processed _levels and input thresholds)
        var customLevels = contours._levels;
        var inputThresholds = trace._input && trace._input.contours && trace._input.contours.thresholds;
        
        // Fallback: if _levels is not set but input thresholds exist, use input thresholds
        if(!customLevels && inputThresholds && inputThresholds.length > 0) {
            customLevels = inputThresholds.slice().sort(function(a, b) { return a - b; });
            console.log('makeColorMap: Using fallback to input thresholds:', customLevels);
        }
        
        if(customLevels && customLevels.length > 0) {
            // Use custom thresholds for color mapping
            var levels = customLevels;
            var nLevels = levels.length;
            
            // For custom thresholds, we need to map colors directly to the threshold range
            // This is especially important when using custom colorscales
            var minLevel = levels[0];
            var maxLevel = levels[nLevels - 1];
            
            // Use zmin/zmax if they provide a wider range, otherwise use threshold range
            var effectiveMin = zmin0 !== undefined && zmin0 !== null ? Math.min(zmin0, minLevel) : minLevel;
            var effectiveMax = zmax0 !== undefined && zmax0 !== null ? Math.max(zmax0, maxLevel) : maxLevel;
            
            // For custom colorscales with custom thresholds, map the colorscale positions
            // directly to the threshold value range
            for(i = 0; i < len; i++) {
                si = scl[i];
                // Map colorscale positions directly to the value range
                domain[i] = effectiveMin + si[0] * (effectiveMax - effectiveMin);
                range[i] = si[1];
            }
            
            // Debug information (including restyle updates)
            if(typeof console !== 'undefined' && console.log) {
                console.log('=== Custom Thresholds Color Mapping (including restyle) ===');
                console.log('- Levels:', levels);
                console.log('- zmin/zmax from colorscale:', zmin0, zmax0);
                console.log('- Effective range:', effectiveMin, 'to', effectiveMax);
                console.log('- Colorscale length:', len);
                console.log('- Domain values:', domain);
                console.log('- Color mapping details:');
                
                // Show how each colorscale position maps to a value
                for(var j = 0; j < len; j++) {
                    console.log('  Position ' + scl[j][0].toFixed(4) + ' -> Value ' + domain[j].toFixed(2) + ' -> Color ' + range[j]);
                }
                console.log('=== End Color Mapping ===');
            }
        } else {
            // Original logic for regular contours
            // If zmin/zmax are explicitly set, consider case where user specifies a
            // narrower z range than that of the contours start/end.
            if(zRangeInput && (start <= zmin0 || end >= zmax0)) {
                if(start <= zmin0) start = zmin0;
                if(end >= zmax0) end = zmax0;
                nc = Math.floor((end - start) / cs) + 1;
                extra = 0;
            }

            for(i = 0; i < len; i++) {
                si = scl[i];
                domain[i] = (si[0] * (nc + extra - 1) - (extra / 2)) * cs + start;
                range[i] = si[1];
            }
        }

        // Make the colorscale fit the z range except if contours are explicitly
        // set BUT NOT zmin/zmax. Skip this for custom thresholds.
        if(!contours._levels && (zRangeInput || trace.autocontour)) {
            if(domain[0] > zmin0) {
                domain.unshift(zmin0);
                range.unshift(range[0]);
            }
            if(domain[domain.length - 1] < zmax0) {
                domain.push(zmax0);
                range.push(range[range.length - 1]);
            }
        }
    }

    return Colorscale.makeColorScaleFunc(
        {domain: domain, range: range},
        {noNumericCheck: true}
    );
};
