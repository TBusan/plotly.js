'use strict';

/**
 * Color mapping utilities for colorbar
 */

// Preset color scales
const COLOR_SCALES = {
    Viridis: [
        '#440154', '#482878', '#3e4a89', '#31688e', '#26838f',
        '#1f9d8a', '#35b779', '#6dcd59', '#b4de2c', '#fde725'
    ],
    Plasma: [
        '#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786',
        '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'
    ],
    Hot: [
        '#000000', '#4a0000', '#880000', '#c20000', '#ff0000',
        '#ff4a00', '#ff8800', '#ffc200', '#ffff00', '#ffff80'
    ],
    Jet: [
        '#000080', '#0000ff', '#0080ff', '#00ffff', '#80ff80',
        '#ffff00', '#ff8000', '#ff0000', '#800000', '#000000'
    ],
    Earth: [
        '#2a1c0b', '#5c4033', '#8f6b4e', '#c19a6b', '#e5c99b',
        '#f5e6c8', '#8b4513', '#a0522d', '#cd853f', '#deb887'
    ],
    Electric: [
        '#000004', '#1b0c42', '#4a0c6e', '#781c6d', '#a52c60',
        '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'
    ]
};

/**
 * Map a value to a color from a color scale
 * @param {number} value - Value to map
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string|Array} colorscale - Color scale name or array of colors
 * @param {boolean} reverse - Reverse the color scale
 * @returns {string} Hex color code
 */
function mapColors(value, min, max, colorscale, reverse) {
    let colors;

    if (Array.isArray(colorscale)) {
        colors = colorscale;
    } else if (typeof colorscale === 'string') {
        const name = colorscale.charAt(0).toUpperCase() + colorscale.slice(1).toLowerCase();
        colors = COLOR_SCALES[name] || COLOR_SCALES.Viridis;
    } else {
        colors = COLOR_SCALES.Viridis;
    }

    if (reverse) {
        colors = colors.slice().reverse();
    }

    // Normalize value to 0-1 range
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

    // Find color index
    const idx = Math.floor(t * (colors.length - 1));
    const colorIdx = Math.max(0, Math.min(colors.length - 1, idx));

    return colors[colorIdx];
}

/**
 * Build color stop array for rendering
 * @param {Array} levels - Contour levels
 * @param {string|Array} colorscale - Color scale
 * @returns {Array} Array of [value, color] pairs
 */
function buildColorScale(levels, colorscale) {
    const colors = Array.isArray(colorscale) ? colorscale :
                  (COLOR_SCALES[colorscale] || COLOR_SCALES.Viridis);

    const scale = [];
    const min = levels[0];
    const max = levels[levels.length - 1];

    for (let i = 0; i < levels.length; i++) {
        const t = levels.length > 1 ? (i / (levels.length - 1)) : 0;
        const colorIdx = Math.floor(t * (colors.length - 1));
        const finalColorIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));
        scale.push([levels[i], colors[finalColorIdx]]);
    }

    return scale;
}

module.exports = {
    mapColors: mapColors,
    buildColorScale: buildColorScale,
    COLOR_SCALES: COLOR_SCALES
};
