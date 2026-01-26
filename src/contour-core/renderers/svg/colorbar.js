'use strict';

/**
 * SVG colorbar rendering
 */

var computeTicks = require('../../colorbar').computeTicks;

/**
 * Create SVG colorbar
 * @param {Object} contourResult - Contour result
 * @param {Object} options - Style options
 * @returns {String} SVG string
 */
function createColorbar(contourResult, options) {
    options = options || {};

    var levels = contourResult.levels;
    if (!levels || levels.length === 0) return '';

    var width = options.width || 500;
    var height = options.height || 400;

    var thickness = options.colorbarThickness || 20;
    var len = options.colorbarLen || 0.8;
    var barHeight = height * len;
    var x = width - thickness - 10;
    var y = (height - barHeight) / 2;

    var colorscale = options.colorscale || 'Viridis';
    var zmin = options.zmin !== undefined ? options.zmin : levels[0];
    var zmax = options.zmax !== undefined ? options.zmax : levels[levels.length - 1];

    var svgParts = [];

    // Create gradient definition
    var gradientId = 'colorbar-gradient-' + Date.now();
    var gradientStops = [];

    for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var value = zmin + t * (zmax - zmin);
        var color = mapColors(value, zmin, zmax, colorscale, options.reversescale);
        gradientStops.push('<stop offset="' + (i / barHeight * 100).toFixed(1) + '%" stop-color="' + color + '" />');
    }

    svgParts.push(
        '<defs>' +
        '<linearGradient id="' + gradientId + '" x1="0%" y1="100%" x2="0%" y2="0%">' +
        gradientStops.join('') +
        '</linearGradient>' +
        '</defs>'
    );

    // Draw colorbar rectangle
    svgParts.push(
        '<rect x="' + x + '" y="' + y + '" width="' + thickness + '" height="' + barHeight + '" ' +
        'fill="url(#' + gradientId + ')" ' +
        'stroke="#666" stroke-width="1" />'
    );

    // Draw title
    if (options.colorbarTitle) {
        svgParts.push(
            '<text x="' + (x + thickness / 2) + '" y="' + (y - 10) + '" ' +
            'font-family="Arial" font-size="12" fill="#000" ' +
            'text-anchor="middle" ' +
            'transform="rotate(-90, ' + (x + thickness / 2) + ', ' + (y - 10) + ')">' +
            options.colorbarTitle +
            '</text>'
        );
    }

    // Draw tick labels
    var tickCount = Math.min(5, levels.length);
    for (i = 0; i < tickCount; i++) {
        var idx = Math.floor(i * (levels.length - 1) / (tickCount - 1));
        var level = levels[idx];
        var t = (level - levels[0]) / (levels[levels.length - 1] - levels[0]);
        var tickY = y + barHeight * (1 - t);

        svgParts.push(
            '<text x="' + (x + thickness + 5) + '" y="' + tickY + '" ' +
            'font-family="Arial" font-size="10" fill="#666" ' +
            'text-anchor="start" dominant-baseline="middle">' +
            level.toFixed(1) +
            '</text>'
        );
    }

    return svgParts.join('\n');
}

/**
 * Map a value to a color from a color scale
 */
function mapColors(value, min, max, colorscale, reverse) {
    var colors = require('../../colorbar/colors').COLOR_SCALES;

    var colorArray = Array.isArray(colorscale) ? colorscale :
                      (colors[colorscale] || colors.Viridis);

    if (reverse) {
        colorArray = colorArray.slice().reverse();
    }

    var t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    var idx = Math.floor(t * (colorArray.length - 1));
    return colorArray[Math.max(0, Math.min(colorArray.length - 1, idx))];
}

module.exports = {
    createColorbar: createColorbar
};
