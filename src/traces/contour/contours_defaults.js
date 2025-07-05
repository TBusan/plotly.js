'use strict';

module.exports = function handleContourDefaults(traceIn, traceOut, coerce, coerce2) {
    // Check for custom thresholds first - this takes highest priority
    var contourThresholds = coerce('contours.thresholds');
    var hasThresholds = contourThresholds && contourThresholds.length > 0;
    
    if(hasThresholds) {
        // If thresholds are provided, disable autocontour and don't require start/end/size
        traceOut.autocontour = false;
        
        // Debug for restyle scenarios
        if(typeof console !== 'undefined' && console.log) {
            console.log('Contour defaults: using custom thresholds (' + contourThresholds.length + ' levels)');
        }
        
        return; // Exit early, thresholds handle everything
    }

    var contourStart = coerce2('contours.start');
    var contourEnd = coerce2('contours.end');
    var missingEnd = (contourStart === false) || (contourEnd === false);

    // normally we only need size if autocontour is off. But contour.calc
    // pushes its calculated contour size back to the input trace, so for
    // things like restyle that can call supplyDefaults without calc
    // after the initial draw, we can just reuse the previous calculation
    var contourSize = coerce('contours.size');
    var autoContour;

    if(missingEnd) autoContour = traceOut.autocontour = true;
    else autoContour = coerce('autocontour', false);

    if(autoContour || !contourSize) coerce('ncontours');
};
