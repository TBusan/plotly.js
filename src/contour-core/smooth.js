'use strict';

/**
 * Path smoothing utilities using Catmull-Rom splines
 * Based on: http://www.cemyuksel.com/research/catmullrom_param/catmullrom.pdf
 */

// Catmull-Rom exponent (0.5 is the standard value)
var CatmullRomExp = 0.5;

/**
 * Smooth an open path (not closed) using Catmull-Rom splines
 * @param {Array} pts - Array of [x, y] points
 * @param {Number} smoothness - Smoothing factor (0-1)
 * @returns {String} SVG path string
 */
function smoothopen(pts, smoothness) {
    if (pts.length < 3) {
        return 'M' + pts.join('L');
    }
    var path = 'M' + pts[0];
    var tangents = [];
    var i;
    for (i = 1; i < pts.length - 1; i++) {
        tangents.push(makeTangent(pts[i - 1], pts[i], pts[i + 1], smoothness));
    }
    path += 'Q' + tangents[0][0] + ' ' + pts[1];
    for (i = 2; i < pts.length - 1; i++) {
        path += 'C' + tangents[i - 2][1] + ' ' + tangents[i - 1][0] + ' ' + pts[i];
    }
    path += 'Q' + tangents[pts.length - 3][1] + ' ' + pts[pts.length - 1];
    return path;
}

/**
 * Smooth a closed path using Catmull-Rom splines
 * @param {Array} pts - Array of [x, y] points
 * @param {Number} smoothness - Smoothing factor (0-1)
 * @returns {String} SVG path string
 */
function smoothclosed(pts, smoothness) {
    if (pts.length < 3) {
        return 'M' + pts.join('L') + 'Z';
    }
    var path = 'M' + pts[0];
    var pLast = pts.length - 1;
    var tangents = [makeTangent(pts[pLast], pts[0], pts[1], smoothness)];
    var i;
    for (i = 1; i < pLast; i++) {
        tangents.push(makeTangent(pts[i - 1], pts[i], pts[i + 1], smoothness));
    }
    tangents.push(makeTangent(pts[pLast - 1], pts[pLast], pts[0], smoothness));

    for (i = 1; i <= pLast; i++) {
        path += 'C' + tangents[i - 1][1] + ' ' + tangents[i][0] + ' ' + pts[i];
    }
    path += 'C' + tangents[pLast][1] + ' ' + tangents[0][0] + ' ' + pts[0] + 'Z';
    return path;
}

/**
 * Create tangent points for Catmull-Rom spline interpolation
 * @param {Array} prevpt - Previous point [x, y]
 * @param {Array} thispt - Current point [x, y]
 * @param {Array} nextpt - Next point [x, y]
 * @param {Number} smoothness - Smoothing factor
 * @returns {Array} Array of two tangent points [[x1, y1], [x2, y2]]
 */
function makeTangent(prevpt, thispt, nextpt, smoothness) {
    var d1x = prevpt[0] - thispt[0];
    var d1y = prevpt[1] - thispt[1];
    var d2x = nextpt[0] - thispt[0];
    var d2y = nextpt[1] - thispt[1];
    var d1a = Math.pow(d1x * d1x + d1y * d1y, CatmullRomExp / 2);
    var d2a = Math.pow(d2x * d2x + d2y * d2y, CatmullRomExp / 2);
    var numx = (d2a * d2a * d1x - d1a * d1a * d2x) * smoothness;
    var numy = (d2a * d2a * d1y - d1a * d1a * d2y) * smoothness;
    var denom1 = 3 * d2a * (d1a + d2a);
    var denom2 = 3 * d1a * (d1a + d2a);
    return [
        [
            round(thispt[0] + (denom1 && numx / denom1)),
            round(thispt[1] + (denom1 && numy / denom1))
        ],
        [
            round(thispt[0] - (denom2 && numx / denom2)),
            round(thispt[1] - (denom2 && numy / denom2))
        ]
    ];
}

/**
 * Round a number to 2 decimal places
 */
function round(v) {
    return Math.round(v * 100) / 100;
}

module.exports = {
    smoothopen: smoothopen,
    smoothclosed: smoothclosed
};
