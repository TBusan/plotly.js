'use strict';

/**
 * 2D interpolation to fill in missing values
 * Based on plotly.js src/traces/heatmap/interp2d.js
 *
 * Uses iterative Laplace equation solver (Poisson equation):
 * Each missing point becomes the average of its neighbors
 *
 * Key changes from original contour-core implementation:
 * 1. NEIGHBORSHIFTS is now a module-level constant (not passed as parameter)
 * 2. iterateInterp2d signature matches plotly.js (no neighborShifts parameter)
 * 3. Throws error when no neighbors found (matching plotly.js behavior)
 */

var INTERPTHRESHOLD = 1e-2;
var NEIGHBORSHIFTS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/**
 * Calculate overshoot correction factor for faster convergence
 * Matches plotly.js implementation exactly
 */
function correctionOvershoot(maxFractionalChange) {
    // Start with less overshoot, until we know it's converging,
    // then ramp up the overshoot for faster convergence
    return 0.5 - 0.25 * Math.min(1, maxFractionalChange * 0.5);
}

/**
 * 2D interpolation using iterative Poisson equation solver with zero-derivative BC at edges.
 *
 * @param {Array} z - 2D array with undefined values (will be mutated)
 * @param {Array} emptyPoints - Array of [i, j, neighborCount] from findEmpties
 * @returns {Array} The modified z array with values filled in
 */
function interp2d(z, emptyPoints) {
    var maxFractionalChange = 1;
    var i;

    // One pass to fill in a starting value for all the empties
    iterateInterp2d(z, emptyPoints);

    // Remove points with < 4 neighbors (no need to iterate lone empties)
    for (i = 0; i < emptyPoints.length; i++) {
        if (emptyPoints[i][2] < 4) break;
    }
    // Don't remove these points from the original array,
    // we'll use them for masking, so make a copy.
    emptyPoints = emptyPoints.slice(i);

    // Iterative refinement
    for (i = 0; i < 100 && maxFractionalChange > INTERPTHRESHOLD; i++) {
        maxFractionalChange = iterateInterp2d(z, emptyPoints,
            correctionOvershoot(maxFractionalChange));
    }

    if (maxFractionalChange > INTERPTHRESHOLD) {
        console.warn('interp2d: Did not converge quickly, maxChange =', maxFractionalChange);
    }

    return z;
}

/**
 * Single iteration of interpolation
 * Matches plotly.js signature: iterateInterp2d(z, emptyPoints, overshoot)
 * Note: NEIGHBORSHIFTS is a module-level constant, not passed as parameter
 *
 * @param {Array} z - 2D array being interpolated (mutated)
 * @param {Array} emptyPoints - Array of [i, j, neighborCount]
 * @param {Number} overshoot - Overshoot correction factor
 * @returns {Number} Maximum fractional change in this iteration
 */
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
            if (neighborVal !== undefined) {
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

        // This is the Laplace equation interpolation:
        // each point is just the average of its neighbors
        // Note that this ignores differential x/y scaling
        // which is the right approach, since we don't know what that scaling means
        if (neighborCount === 0) {
            // Matching plotly.js behavior - throw error if no neighbors found
            // This indicates a bug in findEmpties ordering
            throw new Error('iterateInterp2d order is wrong: no defined neighbors for point [' + i + ',' + j + ']');
        }

        z[i][j] = neighborSum / neighborCount;

        if (initialVal === undefined) {
            if (neighborCount < 4) maxFractionalChange = 1;
        } else {
            // We can make large empty regions converge faster
            // if we overshoot the change vs the previous value
            if (overshoot !== undefined && overshoot !== 0) {
                z[i][j] = (1 + overshoot) * z[i][j] - overshoot * initialVal;
            }

            if (maxNeighbor > minNeighbor) {
                maxFractionalChange = Math.max(maxFractionalChange,
                    Math.abs(z[i][j] - initialVal) / (maxNeighbor - minNeighbor));
            }
        }
    }

    return maxFractionalChange;
}

module.exports = interp2d;
module.exports.iterateInterp2d = iterateInterp2d;
module.exports.correctionOvershoot = correctionOvershoot;
