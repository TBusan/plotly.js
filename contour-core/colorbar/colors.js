'use strict';

/**
 * Color mapping utilities for colorbar
 * Enhanced version with support for custom thresholds and heatmap mode
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
 * Parse colorscale into normalized format
 * Handles both simple color arrays and Plotly-style [[position, color], ...] format
 *
 * @param {string|Array} colorscale - Color scale name or array
 * @returns {Array} Normalized colorscale as [[position, color], ...]
 */
function parseColorscale(colorscale) {
    let colors;

    if (Array.isArray(colorscale)) {
        // Check if it's already in [[position, color], ...] format
        if (colorscale.length > 0 && Array.isArray(colorscale[0]) && colorscale[0].length === 2) {
            return colorscale; // Already in correct format
        }
        colors = colorscale;
    } else if (typeof colorscale === 'string') {
        const name = colorscale.charAt(0).toUpperCase() + colorscale.slice(1).toLowerCase();
        colors = COLOR_SCALES[name] || COLOR_SCALES.Viridis;
    } else {
        colors = COLOR_SCALES.Viridis;
    }

    // Convert simple color array to [[position, color], ...] format
    // Special-case length === 1 to avoid 0/0 = NaN — a single-color
    // scale occupies the entire [0, 1] range by definition.
    if (colors.length === 1) {
        return [[0, colors[0]]];
    }
    return colors.map((color, i) => [i / (colors.length - 1), color]);
}

/**
 * Interpolate between two colors
 *
 * @param {string} color1 - Start color (hex)
 * @param {string} color2 - End color (hex)
 * @param {number} t - Interpolation factor (0-1)
 * @returns {string} Interpolated color (hex)
 */
function interpolateColor(color1, color2, t) {
    // Parse hex colors
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    // Convert back to hex
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Get color at a specific position from a colorscale
 *
 * @param {Array} colorscale - Normalized colorscale [[position, color], ...]
 * @param {number} position - Position (0-1)
 * @returns {string} Color at position
 */
function getColorAtPosition(colorscale, position) {
    // Clamp position to [0, 1]
    const t = Math.max(0, Math.min(1, position));

    // Find the two colors to interpolate between
    let i = 0;
    while (i < colorscale.length - 1 && colorscale[i + 1][0] < t) {
        i++;
    }

    if (i >= colorscale.length - 1) {
        return colorscale[colorscale.length - 1][1];
    }

    const pos1 = colorscale[i][0];
    const pos2 = colorscale[i + 1][0];
    const color1 = colorscale[i][1];
    const color2 = colorscale[i + 1][1];

    // Interpolate between the two colors. Guard against duplicate stop
    // positions (pos2 === pos1 would yield NaN; the extend/unshift paths
    // in mapColors/buildColorScale can create these).
    const localT = (pos2 === pos1) ? 0 : (t - pos1) / (pos2 - pos1);
    return interpolateColor(color1, color2, localT);
}

/**
 * Map a value to a color from a color scale
 * Enhanced version with support for custom thresholds and data range extension
 *
 * @param {number} value - Value to map
 * @param {number} min - Minimum value (can be extended with dataMin)
 * @param {number} max - Maximum value (can be extended with dataMax)
 * @param {string|Array} colorscale - Color scale name or array
 * @param {Object} options - Optional parameters
 * @param {number} options.dataMin - Actual data minimum (for heatmap mode extension)
 * @param {number} options.dataMax - Actual data maximum (for heatmap mode extension)
 * @param {boolean} options.reverse - Reverse the color scale
 * @returns {string} Hex color code
 */
function mapColors(value, min, max, colorscale, options) {
    options = options || {};

    // Parse colorscale
    let scale = parseColorscale(colorscale);

    // Reverse if needed
    if (options.reverse) {
        scale = scale.slice().reverse();
        // Re-normalize positions
        scale = scale.map(([pos, color]) => [1 - pos, color]).sort((a, b) => a[0] - b[0]);
    }

    // Extend colorscale for heatmap mode if data range is larger
    if (options.dataMin !== undefined && options.dataMin < min) {
        const firstColor = scale[0][1];
        scale.unshift([options.dataMin, firstColor]);
        min = options.dataMin;
    }
    if (options.dataMax !== undefined && options.dataMax > max) {
        const lastColor = scale[scale.length - 1][1];
        scale.push([options.dataMax, lastColor]);
        max = options.dataMax;
    }

    // Normalize value to 0-1 range. Guard against zero data range
    // (max === min) which would otherwise yield 0/0 = NaN; in that case
    // there is only one color stop in the scale, so saturate at t=0.
    let t;
    if (max === min) {
        t = 0;
    } else {
        t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    }

    return getColorAtPosition(scale, t);
}

/**
 * Build color stop array for rendering
 * Enhanced version with support for custom thresholds
 *
 * @param {Array} levels - Contour levels (custom thresholds allowed)
 * @param {string|Array} colorscale - Color scale
 * @param {Object} options - Optional parameters
 * @param {number} options.dataMin - Actual data minimum
 * @param {number} options.dataMax - Actual data maximum
 * @param {boolean} options.extend - Extend colorscale to data range (heatmap mode)
 * @returns {Array} Array of [value, color] pairs
 */
function buildColorScale(levels, colorscale, options) {
    options = options || {};

    if (levels.length === 0) {
        return [];
    }

    // Parse colorscale
    let scale = parseColorscale(colorscale);

    // Reverse if needed
    if (options.reverse) {
        scale = scale.slice().reverse();
        scale = scale.map(([pos, color]) => [1 - pos, color]).sort((a, b) => a[0] - b[0]);
    }

    const levelMin = levels[0];
    const levelMax = levels[levels.length - 1];

    // For custom thresholds, map colors directly to threshold values
    // This ensures each threshold gets a distinct color
    const colorStops = [];

    for (let i = 0; i < levels.length; i++) {
        const level = levels[i];

        // Map level to colorscale position. Special-casing length===1 is
        // not enough — all-identical levels like [5, 5, 5] would still
        // (level-levelMin)/(levelMax-levelMin) = 0/0 = NaN. Guard the full
        // zero-range case so degenerate input returns a deterministic
        // stop in the middle of the scale.
        let t;
        if (levels.length === 1 || levelMax === levelMin) {
            t = 0.5;
        } else {
            t = (level - levelMin) / (levelMax - levelMin);
        }

        const color = getColorAtPosition(scale, t);
        colorStops.push([level, color]);
    }

    // Extend colorscale for heatmap mode if requested
    if (options.extend && options.dataMin !== undefined && options.dataMin < levelMin) {
        const firstColor = colorStops[0][1];
        colorStops.unshift([options.dataMin, firstColor]);
    }
    if (options.extend && options.dataMax !== undefined && options.dataMax > levelMax) {
        const lastColor = colorStops[colorStops.length - 1][1];
        colorStops.push([options.dataMax, lastColor]);
    }

    return colorStops;
}

/**
 * Create a color mapping function from a colorscale
 * Useful for efficient repeated color lookups
 *
 * @param {Array} levels - Contour levels
 * @param {string|Array} colorscale - Color scale
 * @param {Object} options - Optional parameters
 * @returns {Function} Function that takes a value and returns a color
 */
function createColorMapper(levels, colorscale, options) {
    const colorStops = buildColorScale(levels, colorscale, options);

    return function(value) {
        // Find the color stop that contains this value
        for (let i = 0; i < colorStops.length - 1; i++) {
            const stop1 = colorStops[i];
            const stop2 = colorStops[i + 1];

            if (value >= stop1[0] && value <= stop2[0]) {
                // Interpolate between stops. The extend path in
                // buildColorScale can create duplicate-value stops
                // (stop2[0] === stop1[0]); guard the div-by-zero.
                const t = (stop2[0] === stop1[0]) ? 0 : (value - stop1[0]) / (stop2[0] - stop1[0]);
                return interpolateColor(stop1[1], stop2[1], t);
            }
        }

        // Value is outside the range, use closest color
        if (value < colorStops[0][0]) {
            return colorStops[0][1];
        }
        return colorStops[colorStops.length - 1][1];
    };
}

/**
 * Get a gradient definition for Canvas/SVG rendering
 *
 * @param {Array} levels - Contour levels
 * @param {string|Array} colorscale - Color scale
 * @param {boolean} horizontal - Horizontal gradient (default: vertical)
 * @returns {Array} Array of {offset, color} objects
 */
function getGradientStops(levels, colorscale, horizontal) {
    const colorStops = buildColorScale(levels, colorscale);
    const min = colorStops[0][0];
    const max = colorStops[colorStops.length - 1][0];

    return colorStops.map(([value, color]) => ({
        // Zero-range gradient (max === min, e.g. single level) yields
        // 0/0 otherwise — fall back to offset 0 in that degenerate case.
        offset: (max === min) ? 0 : (value - min) / (max - min),
        color: color
    }));
}

module.exports = {
    mapColors: mapColors,
    buildColorScale: buildColorScale,
    createColorMapper: createColorMapper,
    getGradientStops: getGradientStops,
    parseColorscale: parseColorscale,
    getColorAtPosition: getColorAtPosition,
    interpolateColor: interpolateColor,
    COLOR_SCALES: COLOR_SCALES
};
