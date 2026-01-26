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
    SAMELEVELDISTANCE: 5
};

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
 * Simplified version of segmentDistance
 */
function segmentDistance(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Find the closest points on the two segments
    var dist = Infinity;

    // Check all endpoints
    dist = Math.min(dist, pointToSegmentDistance(x1, y1, x3, y3, x4, y4));
    dist = Math.min(dist, pointToSegmentDistance(x2, y2, x3, y3, x4, y4));
    dist = Math.min(dist, pointToSegmentDistance(x3, y3, x1, y1, x2, y2));
    dist = Math.min(dist, pointToSegmentDistance(x4, y4, x1, y1, x2, y2));

    return dist;
}

/**
 * Distance from point to line segment
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len2 = dx * dx + dy * dy;

    if (len2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));

    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    var projX = x1 + t * dx;
    var projY = y1 + t * dy;

    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
}

module.exports = locationCost;
