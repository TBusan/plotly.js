'use strict';

/**
 * Calculate cost for label placement
 * Complete implementation based on Plotly's algorithm
 */

// Cost constants (must match position.js)
var COST_CONSTANTS = {
    EDGECOST: 1,
    ANGLECOST: 1,
    NEIGHBORCOST: 5,
    SAMELEVELFACTOR: 10,
    SAMELEVELDISTANCE: 5,
    MAXCOST: 100
};

/**
 * Check if two line segments intersect
 * Based on Plotly's segmentsIntersect function
 * @param {number} x1, y1, x2, y2 - First segment endpoints
 * @param {number} x3, y3, x4, y4 - Second segment endpoints
 * @returns {Object|null} Intersection point or null
 */
function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    var a = x2 - x1, b = x3 - x1, c = x4 - x3;
    var d = y2 - y1, e = y3 - y1, f = y4 - y3;
    var det = a * f - c * d; // Determinant

    if (det === 0) return null; // Parallel lines

    var t = (b * f - c * e) / det;
    var u = (b * d - a * e) / det;

    // Segments intersect when both t and u are in [0, 1]
    if (u < 0 || u > 1 || t < 0 || t > 1) return null;

    return { x: x1 + a * t, y: y1 + d * t };
}

/**
 * Calculate squared perpendicular distance from point to line segment
 * Using dot product to determine if point projects onto segment
 * Based on Plotly's perpDistance2 function
 * @param {number} xab, yab - Vector from point A to B
 * @param {number} llab - Squared length of AB
 * @param {number} xac, yac - Vector from point A to C (point to check)
 * @returns {number} Squared distance
 */
function perpDistance2(xab, yab, llab, xac, yac) {
    // Degenerate segment (A === B): the perpendicular "distance" collapses
    // to the squared distance from C to the degenerate point. Without this
    // guard we'd divide by zero at the cross-product branch below,
    // returning NaN that propagates through segmentDistance → locationCost,
    // silently dropping any label that happens to hit a duplicate-point
    // segment (simplifyPath produces these).
    if (llab === 0) {
        return xac * xac + yac * yac;
    }

    var fcAB = (xac * xab + yac * yab); // Dot product

    if (fcAB < 0) {
        // Point C is outside segment AB at A end
        return xac * xac + yac * yac;
    } else if (fcAB > llab) {
        // Point C is outside segment AB at B end
        var xbc = xac - xab;
        var ybc = yac - yab;
        return xbc * xbc + ybc * ybc;
    } else {
        // Point C projects onto segment AB - perpendicular distance
        var crossProduct = xac * yab - yac * xab;
        return crossProduct * crossProduct / llab;
    }
}

/**
 * Calculate placement cost for a label at a given position
 * Based on Plotly's locationCost function
 *
 * @param {Object} loc - Label position {x, y, theta, level}
 * @param {Object} textOpts - Text options {width, height, level}
 * @param {Array} labelData - Array of existing labels
 * @param {Object} bounds - Plot boundaries {left, right, top, bottom, center, middle}
 * @returns {number} Cost value (lower is better, Infinity if invalid)
 */
function locationCost(loc, textOpts, labelData, bounds) {
    var halfWidth = textOpts.width / 2;
    var halfHeight = textOpts.height / 2;
    var x = loc.x;
    var y = loc.y;
    var theta = loc.theta || 0;
    var dx = Math.cos(theta) * halfWidth;
    var dy = Math.sin(theta) * halfWidth;

    // Calculate bounds with default values
    bounds = bounds || {};
    var left = bounds.left !== undefined ? bounds.left : x - 100;
    var right = bounds.right !== undefined ? bounds.right : x + 100;
    var top = bounds.top !== undefined ? bounds.top : y - 100;
    var bottom = bounds.bottom !== undefined ? bounds.bottom : y + 100;
    var center = bounds.center !== undefined ? bounds.center : (left + right) / 2;
    var middle = bounds.middle !== undefined ? bounds.middle : (top + bottom) / 2;

    // Cost for being near an edge
    var normX = ((x > center) ? (right - x) : (x - left)) /
        (dx + Math.abs(Math.sin(theta) * halfHeight));
    var normY = ((y > middle) ? (bottom - y) : (y - top)) /
        (Math.abs(dy) + Math.cos(theta) * halfHeight);

    if (normX < 1 || normY < 1) return Infinity;
    var cost = COST_CONSTANTS.EDGECOST * (1 / (normX - 1) + 1 / (normY - 1));

    // Cost for not being horizontal
    cost += COST_CONSTANTS.ANGLECOST * theta * theta;

    // Cost for being close to other labels
    if (labelData && labelData.length > 0) {
        var x1 = x - dx;
        var y1 = y - dy;
        var x2 = x + dx;
        var y2 = y + dy;

        for (var i = 0; i < labelData.length; i++) {
            var labeli = labelData[i];
            var dxd = Math.cos(labeli.theta || 0) * labeli.width / 2;
            var dyd = Math.sin(labeli.theta || 0) * labeli.width / 2;

            // Simple distance check (segmentDistance would be more accurate)
            var dist = segmentDistance(
                x1, y1,
                x2, y2,
                labeli.x - dxd, labeli.y - dyd,
                labeli.x + dxd, labeli.y + dyd
            ) * 2 / (textOpts.height + labeli.height);

            var sameLevel = (textOpts.level === labeli.level);
            var distOffset = sameLevel ? COST_CONSTANTS.SAMELEVELDISTANCE : 1;

            if (dist <= distOffset) return Infinity;

            var distFactor = COST_CONSTANTS.NEIGHBORCOST *
                (sameLevel ? COST_CONSTANTS.SAMELEVELFACTOR : 1);

            cost += distFactor / (dist - distOffset);
        }
    }

    return cost;
}

/**
 * Calculate distance between two line segments
 * Complete implementation based on Plotly's segmentDistance
 * @param {number} x1, y1, x2, y2 - First segment endpoints
 * @param {number} x3, y3, x4, y4 - Second segment endpoints
 * @returns {number} Minimum distance between segments (0 if intersecting)
 */
function segmentDistance(x1, y1, x2, y2, x3, y3, x4, y4) {
    // 1. If segments intersect, distance is 0
    if (segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4)) return 0;

    // 2. Calculate segment vectors and squared lengths
    var x12 = x2 - x1, y12 = y2 - y1;
    var x34 = x4 - x3, y34 = y4 - y3;
    var ll12 = x12 * x12 + y12 * y12;
    var ll34 = x34 * x34 + y34 * y34;

    // 3. Calculate minimum distance from all four endpoints to the other segment
    var dist2 = Math.min(
        perpDistance2(x12, y12, ll12, x3 - x1, y3 - y1),  // Point 3 to segment 12
        perpDistance2(x12, y12, ll12, x4 - x1, y4 - y1),  // Point 4 to segment 12
        perpDistance2(x34, y34, ll34, x1 - x3, y1 - y3),  // Point 1 to segment 34
        perpDistance2(x34, y34, ll34, x2 - x3, y2 - y3)   // Point 2 to segment 34
    );

    return Math.sqrt(dist2);
}

module.exports = locationCost;
