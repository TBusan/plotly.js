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
            // Find the min and max non-null values on the data boundary
            // boundaryMin is needed for the original "all data above level" check
            // boundaryMax is needed for the "all data below level" check
            var na = pi0.x.length;
            var nb = pi0.y.length;
            var boundaryMin = Infinity;
            var boundaryMax = -Infinity;

            // Check all boundary cells for min and max non-null values
            for(i = 0; i < nb; i++) {
                if(z[i][0] !== null) {
                    if(z[i][0] < boundaryMin) boundaryMin = z[i][0];
                    if(z[i][0] > boundaryMax) boundaryMax = z[i][0];
                }
                if(z[i][na - 1] !== null) {
                    if(z[i][na - 1] < boundaryMin) boundaryMin = z[i][na - 1];
                    if(z[i][na - 1] > boundaryMax) boundaryMax = z[i][na - 1];
                }
            }
            for(i = 1; i < na - 1; i++) {
                if(z[0][i] !== null) {
                    if(z[0][i] < boundaryMin) boundaryMin = z[0][i];
                    if(z[0][i] > boundaryMax) boundaryMax = z[0][i];
                }
                if(z[nb - 1][i] !== null) {
                    if(z[nb - 1][i] < boundaryMin) boundaryMin = z[nb - 1][i];
                    if(z[nb - 1][i] > boundaryMax) boundaryMax = z[nb - 1][i];
                }
            }

            // Fallback to z[0][0] and z[0][1] if no valid boundary values found
            if(boundaryMin === Infinity) {
                boundaryMin = Math.min(z[0][0] || Infinity, z[0][1] || Infinity);
            }
            if(boundaryMax === -Infinity) {
                boundaryMax = Math.max(z[0][0] || -Infinity, z[0][1] || -Infinity);
            }

            for(i = 0; i < pathinfo.length; i++) {
                var pi = pathinfo[i];
                // All boundary data is below this level — only the first level (i===0)
                // should fill the entire area, so the lowest color is shown.
                var allDataBelow = boundaryMax < pi.level;

                pi.prefixBoundary = !pi.edgepaths.length &&
                    (boundaryMin > pi.level ||
                     (allDataBelow && i === 0) ||
                     pi.starts.length && boundaryMin === pi.level);
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

module.exports = closeBoundaries;
