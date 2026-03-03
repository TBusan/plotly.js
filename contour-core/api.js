'use strict';

/**
 * Simplified rendering API for contour-core
 * Provides easy-to-use functions similar to Plotly's API
 */

var compute = require('./compute');
var canvasRenderer = require('./renderers/canvas');
var zrenderRenderer = require('./renderers/zrender');
var labelUtils = require('./labels');

// Preset color scales
var COLOR_SCALES = {
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
 * One-step contour rendering - compute and render in one call
 * Similar to Plotly's API: just pass data and options
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Object} config - Configuration object
 * @param {Array} config.z - 2D array of z values (supports null/undefined/NaN)
 * @param {Array} config.x - Optional x coordinates
 * @param {Array} config.y - Optional y coordinates
 * @param {Object} config.contours - Contour configuration
 * @param {String} config.contours.type - 'fill', 'lines', 'heatmap', or 'none'
 * @param {Boolean} config.contours.showlabels - Show contour labels (future)
 * @param {Number} config.contours.start - Start value for manual contours
 * @param {Number} config.contours.end - End value for manual contours
 * @param {Number} config.contours.size - Step size for manual contours
 * @param {Boolean} config.autocontour - Auto-generate contours (default: true)
 * @param {Number} config.ncontours - Number of auto contours (default: 15)
 * @param {Number} config.smoothing - Smoothing factor 0-1 (default: 0.5)
 * @param {String|Array} config.colorscale - Color scale name or array of colors
 * @param {Array} config.valueColorMap - Segmented color mapping in [[value, color], ...] format
 *                                    Example: [[10, '#ff0000'], [20, '#00ff00'], [30, '#0000ff']]
 *                                    value < 10 uses '#ff0000', 10-20 uses '#00ff00', >= 30 uses '#0000ff'
 * @param {Number} config.zmin - Minimum z value for color mapping
 * @param {Number} config.zmax - Maximum z value for color mapping
 * @param {Boolean} config.reversescale - Reverse the color scale
 * @param {Object} config.colorbar - Colorbar configuration
 * @param {Boolean} config.colorbar.show - Show colorbar (default: true)
 * @param {String} config.colorbar.title - Colorbar title
 * @param {Number} config.colorbar.thickness - Colorbar thickness (default: 20)
 * @param {Number} config.colorbar.len - Colorbar length (0-1, default: 0.8)
 * @param {Object} config.nullRegion - Null region configuration
 * @param {Boolean} config.nullRegion.visible - Show null regions (default: true)
 * @param {String} config.nullRegion.fill - Fill color for null regions (default: '#ffffff')
 * @param {String} config.nullRegion.stroke - Stroke color for null regions (default: '#cccccc')
 * @param {Number} config.nullRegion.strokeWidth - Stroke width (default: 1)
 * @param {Object} config.axes - Axes configuration
 * @param {Object} config.axes.x - X-axis configuration
 * @param {Boolean} config.axes.x.show - Show X-axis (default: true)
 * @param {Array<number>} config.axes.x.range - X-axis range [min, max] (inferred from data if not provided)
 * @param {String} config.axes.x.title - X-axis title
 * @param {String} config.axes.x.tickmode - 'auto' | 'linear' | 'array'
 * @param {Number} config.axes.x.dtick - Tick interval (for linear mode)
 * @param {Number} config.axes.x.nticks - Target number of ticks (for auto mode)
 * @param {Array} config.axes.x.tickvals - Custom tick values (for array mode)
 * @param {Array} config.axes.x.ticktext - Custom tick labels (for array mode)
 * @param {Number} config.axes.x.ticklen - Tick line length (default: 5)
 * @param {String} config.axes.x.tickcolor - Tick line color (default: '#666')
 * @param {Number} config.axes.x.tickwidth - Tick line width (default: 1)
 * @param {String} config.axes.x.side - 'bottom' | 'top' (default: 'bottom')
 * @param {Boolean} config.axes.x.showgrid - Show X-axis grid lines (default: false)
 * @param {String} config.axes.x.gridcolor - Grid line color (default: '#e0e0e0')
 * @param {Number} config.axes.x.gridwidth - Grid line width (default: 1)
 * @param {Object} config.axes.y - Y-axis configuration (similar to x)
 * @param {String} config.axes.y.side - 'left' | 'right' (default: 'left')
 * @param {Number} config.width - Canvas width (default: canvas.width)
 * @param {Number} config.height - Canvas height (default: canvas.height)
 */
function render(canvas, config) {
    if (!canvas) {
        throw new Error('Canvas element is required');
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context from canvas');
    }

    config = config || {};

    // Extract data
    var grid = {
        z: config.z,
        x: config.x,
        y: config.y
    };

    // Compute options
    var options = {
        autocontour: config.autocontour !== false,
        ncontours: config.ncontours || 15,
        start: config.contours ? config.contours.start : undefined,
        end: config.contours ? config.contours.end : undefined,
        size: config.contours ? config.contours.size : undefined,
        smoothing: config.smoothing !== undefined ? config.smoothing : 0.5,
        valueColorMap: config.valueColorMap // Segmented color mapping [[value, color], ...]
    };

    // Compute contours
    var result = compute.computeContours(grid, options);

    // Get canvas dimensions
    var width = config.width || canvas.width || 600;
    var height = config.height || canvas.height || 500;

    // Determine contour type
    var contourType = 'lines';
    if (config.contours && config.contours.type) {
        contourType = config.contours.type;
    }

    // Get color scale (not used if valueColorMap is provided)
    var colors = getColors(config.colorscale, result.levels, config.zmin, config.zmax, config.reversescale);

    // Build color scale array for renderer (for non-valueColorMap modes)
    var colorScale = buildColorScale(result.levels, colors);

    // For valueColorMap, build a direct mapping format
    var valueColorMap = config.valueColorMap;

    // Rendering style
    var style = {
        width: width,
        height: height,
        x: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].x : config.x,
        y: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].y : config.y,
        z: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].z : config.z,
        coloring: contourType,
        showLines: contourType === 'lines' || contourType === 'heatmap',
        lineWidth: 1.5,
        lineColor: contourType === 'lines' ? '#666' : 'rgba(255,255,255,0.5)',
        colorScale: colorScale,
        valueColorMap: valueColorMap, // Segmented color mapping
        smoothing: options.smoothing
    };

    // Draw contours
    canvasRenderer.drawContours(ctx, result, style);

    // Draw null regions if present
    if (result.nullMask && result.nullCount > 0) {
        drawNullRegions(ctx, result, style, config.nullRegion);
    }

    // Draw axes if configured
    if (config.axes) {
        // Set up axes configuration with dimensions
        var axesConfig = config.axes;
        axesConfig.width = width;
        axesConfig.height = height;

        // Pass x and y data for range inference
        if (config.x) {
            axesConfig.xData = config.x;
        }
        if (config.y) {
            axesConfig.yData = config.y;
        }

        // Draw axes (grid lines are drawn automatically if enabled)
        canvasRenderer.drawAxes(ctx, axesConfig);
    }

    // Draw colorbar if requested
    if (config.colorbar && config.colorbar.show !== false && contourType !== 'lines') {
        drawColorbar(ctx, result, colors, config.colorbar, width, height);
    }

    return result;
}

/**
 * Two-step rendering: compute first, then render
 * Useful when you need to reuse computation results
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Object} result - Result from computeContours()
 * @param {Object} options - Rendering options
 * @param {Array} options.valueColorMap - Segmented color mapping [[value, color], ...]
 */
function drawTo(canvas, result, options) {
    if (!canvas) {
        throw new Error('Canvas element is required');
    }

    if (!result || !result.paths) {
        throw new Error('Invalid contour result');
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context from canvas');
    }

    options = options || {};

    var width = options.width || canvas.width || 600;
    var height = options.height || canvas.height || 500;

    // Get color scale (not used if valueColorMap is provided)
    var colors = getColors(
        options.colorscale,
        result.levels,
        options.zmin,
        options.zmax,
        options.reversescale
    );

    var colorScale = buildColorScale(result.levels, colors);
    var valueColorMap = options.valueColorMap;

    var style = {
        width: width,
        height: height,
        coloring: options.coloring || 'fill',
        showLines: options.showLines !== false,
        lineWidth: options.lineWidth || 1.5,
        lineColor: options.lineColor || '#666',
        colorScale: colorScale,
        valueColorMap: valueColorMap,
        smoothing: options.smoothing || 0
    };

    // Draw contours
    canvasRenderer.drawContours(ctx, result, style);

    // Draw null regions if present
    if (result.nullMask && result.nullCount > 0) {
        drawNullRegions(ctx, result, style, options.nullRegion);
    }

    // Draw colorbar if requested
    if (options.showColorbar !== false) {
        drawColorbar(ctx, result, colors, options.colorbar, width, height);
    }
}

/**
 * Get color array from config
 */
function getColors(colorscale, levels, zmin, zmax, reverse) {
    var colors;

    if (Array.isArray(colorscale)) {
        // Custom color array
        colors = colorscale;
    } else if (typeof colorscale === 'string') {
        // Preset color scale
        var name = colorscale.charAt(0).toUpperCase() + colorscale.slice(1).toLowerCase();
        colors = COLOR_SCALES[name] || COLOR_SCALES.Viridis;
    } else {
        // Default to Viridis
        colors = COLOR_SCALES.Viridis;
    }

    if (reverse) {
        colors = colors.slice().reverse();
    }

    return colors;
}

/**
 * Build color scale array for rendering
 */
function buildColorScale(levels, colors) {
    var scale = [];
    var min = levels[0];
    var max = levels[levels.length - 1];

    for (var i = 0; i < levels.length; i++) {
        var t = (levels.length > 1) ? (i / (levels.length - 1)) : 0;
        var colorIdx = Math.floor(t * (colors.length - 1));
        colorIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));
        scale.push([levels[i], colors[colorIdx]]);
    }

    return scale;
}

/**
 * Draw null regions on canvas
 */
function drawNullRegions(ctx, result, style, config) {
    if (!result.nullMask) return;

    config = config || {};
    var visible = config.visible !== false;
    if (!visible) return;

    var nullMask = result.nullMask;
    var m = nullMask.length;
    var n = nullMask[0].length;

    var width = style.width;
    var height = style.height;
    var padding = 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    ctx.fillStyle = config.fill || '#ffffff';
    ctx.strokeStyle = config.stroke || '#cccccc';
    ctx.lineWidth = config.strokeWidth || 1;

    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
                var x = padding + j * scaleX;
                var y = padding + (m - 1 - i) * scaleY;
                var sizeX = scaleX + 1;
                var sizeY = scaleY + 1;

                ctx.fillRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
                ctx.strokeRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
            }
        }
    }
}

/**
 * Draw colorbar on canvas
 */
function drawColorbar(ctx, result, colors, config, canvasWidth, canvasHeight) {
    config = config || {};
    var thickness = config.thickness || 20;
    var len = config.len || 0.8;
    var barHeight = canvasHeight * len;
    var x = canvasWidth - thickness - 10;
    var y = (canvasHeight - barHeight) / 2;

    // Draw gradient
    for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var colorIdx = Math.floor(t * (colors.length - 1));
        colorIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));

        ctx.fillStyle = colors[colorIdx];
        ctx.fillRect(x, y + i, thickness, 1);
    }

    // Draw border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, thickness, barHeight);

    // Draw title (future)
    if (config.title) {
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(x + thickness / 2, y - 10);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(config.title, 0, 0);
        ctx.restore();
    }

    // Draw tick labels (simplified)
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    var levels = result.levels;
    var tickCount = Math.min(5, levels.length);
    for (var i = 0; i < tickCount; i++) {
        var idx = Math.floor(i * (levels.length - 1) / (tickCount - 1));
        var level = levels[idx];
        var t = (level - levels[0]) / (levels[levels.length - 1] - levels[0]);
        var tickY = y + barHeight * (1 - t);

        ctx.fillText(level.toFixed(1), x + thickness + 5, tickY);
    }
}

/**
 * Create interactive contour using zrender
 * @param {String|HTMLElement} container - Container selector or element
 * @param {Object} config - Configuration object
 * @returns {Object} Interactive contour instance with control methods
 */
function createInteractive(container, config) {
    if (typeof container === 'string') {
        container = document.querySelector(container);
    }

    if (!container) {
        throw new Error('Container element not found');
    }

    config = config || {};

    // Get or infer dimensions
    var width = config.width || container.clientWidth || 600;
    var height = config.height || container.clientHeight || 500;

    // Create renderer
    var renderer = zrenderRenderer.createRenderer(container, {
        width: width,
        height: height,
        devicePixelRatio: config.devicePixelRatio
    });

    // Compute contours
    var grid = {
        z: config.z,
        x: config.x,
        y: config.y
    };

    var options = {
        autocontour: config.autocontour !== false,
        ncontours: config.ncontours || 15,
        start: config.contours ? config.contours.start : undefined,
        end: config.contours ? config.contours.end : undefined,
        size: config.contours ? config.contours.size : undefined,
        smoothing: config.smoothing !== undefined ? config.smoothing : 0.5,
        valueColorMap: config.valueColorMap
    };

    var result = compute.computeContours(grid, options);

    // Build style
    var colors = getColors(config.colorscale, result.levels, config.zmin, config.zmax, config.reversescale);
    var colorScale = buildColorScale(result.levels, colors);

    var style = {
        width: width,
        height: height,
        x: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].x : config.x,
        y: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].y : config.y,
        z: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].z : config.z,
        padding: 30,  // IMPORTANT: zrender needs padding for coordinate scaling
        coloring: (config.contours && config.contours.type) || 'fill',
        showLines: config.contours ? (config.contours.type === 'lines' || config.contours.type === 'heatmap') : true,
        lineWidth: config.lineWidth || 1.5,
        lineColor: config.lineColor || '#666',
        colorScale: colorScale,
        valueColorMap: config.valueColorMap,
        opacity: config.opacity || 1
    };

    // Render contours
    renderer.renderContours(result, style);

    // Render labels if configured
    if (config.contours && config.contours.showlabels) {
        renderer.renderLabels(result, style);
    }

    // Render axes if configured
    if (config.axes) {
        var axesConfig = Object.assign({}, config.axes, {
            width: width,
            height: height
        });
        renderer.renderAxes(axesConfig, style);
    }

    // Render colorbar if configured
    if (config.colorbar && config.colorbar.show !== false && style.coloring !== 'lines') {
        renderer.renderColorbar(result, colors, config.colorbar);
    }

    // Initialize interaction
    var interactionConfig = config.interaction || {};

    // Merge callbacks into renderer options
    renderer.options.onHoverStart = interactionConfig.hover ? interactionConfig.hover.onHoverStart : null;
    renderer.options.onHoverEnd = interactionConfig.hover ? interactionConfig.hover.onHoverEnd : null;
    renderer.options.onContourClick = interactionConfig.click ? interactionConfig.click.onContourClick : null;
    renderer.options.highlightColor = interactionConfig.highlightColor || '#ffff00';

    if (interactionConfig.zoom !== false) {
        renderer.initZoom(interactionConfig.zoom || {});
    }

    if (interactionConfig.pan !== false) {
        renderer.initPan(interactionConfig.pan || {});
    }

    // Double click to reset
    if (interactionConfig.dblclickReset !== false) {
        renderer.zr.on('dblclick', function() {
            var animate = interactionConfig.animateReset !== false;
            renderer.resetView(animate);
            if (interactionConfig.onReset) {
                interactionConfig.onReset();
            }
        });
    }

    // Return API object
    return {
        // Update data
        update: function(newConfig) {
            if (newConfig.z) grid.z = newConfig.z;
            if (newConfig.x) grid.x = newConfig.x;
            if (newConfig.y) grid.y = newConfig.y;

            result = compute.computeContours(grid, options);

            style.x = result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].x : grid.x;
            style.y = result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].y : grid.y;
            style.z = result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].z : grid.z;

            renderer.renderContours(result, style);

            if (config.contours && config.contours.showlabels) {
                renderer.renderLabels(result, style);
            }
        },

        // Set view
        setView: function(xMin, xMax, yMin, yMax) {
            // TODO: Implement view range setting
        },

        // Get current view
        getView: function() {
            return renderer.getState();
        },

        // Reset view
        resetView: function() {
            renderer.resetView();
        },

        // Zoom
        zoomTo: function(scale, centerX, centerY, animate) {
            renderer.applyZoom(scale, centerX, centerY);
        },

        // Pan
        panTo: function(dx, dy, animate) {
            var group = renderer.mainGroup;
            group.attr({
                x: group.x + dx,
                y: group.y + dy
            });
            renderer.zr.flush();
        },

        // Enable/disable interaction
        enableInteraction: function(enabled) {
            renderer.setInteractionEnabled(enabled);
        },

        // Event registration
        on: function(event, handler) {
            if (event === 'hover') renderer.options.onHoverStart = handler;
            if (event === 'hoverEnd') renderer.options.onHoverEnd = handler;
            if (event === 'click') renderer.options.onContourClick = handler;
        },

        off: function(event) {
            if (event === 'hover') renderer.options.onHoverStart = null;
            if (event === 'hoverEnd') renderer.options.onHoverEnd = null;
            if (event === 'click') renderer.options.onContourClick = null;
        },

        // Resize
        resize: function(newWidth, newHeight) {
            width = newWidth || width;
            height = newHeight || height;
            renderer.resize(width, height);
        },

        // Destroy
        destroy: function() {
            renderer.dispose();
        },

        // Get renderer
        getRenderer: function() {
            return renderer;
        }
    };
}

module.exports = {
    render: render,
    drawTo: drawTo,
    createInteractive: createInteractive,
    COLOR_SCALES: COLOR_SCALES
};
