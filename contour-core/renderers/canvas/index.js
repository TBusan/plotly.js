'use strict';

/**
 * Canvas renderer for contour-core
 * Main entry point for canvas rendering
 */

var drawPaths = require('./paths');
var drawLabels = require('./labels');
var drawColorbar = require('./colorbar');
var drawNulls = require('./nulls');
var drawHeatmap = require('./heatmap');
var axesRenderer = require('./axes');
var nullHandling = require('../../null_handling');

/**
 * Draw contours on a canvas context
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} style - Rendering options
 * @param {boolean} style.showAxes - Show X/Y axes (default: false)
 * @param {Object} style.axes - Axes configuration (optional, used when showAxes is true)
 */
function drawContours(ctx, contourResult, style) {
    style = style || {};

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var coloring = style.coloring || 'lines';
    var showLines = style.showLines !== false;
    var smoothing = style.smoothing || 0;
    var useClipMask = style.useClipMask !== false; // Enable clipPath by default for smoother null masking
    var showAxes = style.showAxes === true;

    // Extract data coordinates from contourResult for scalePoint function
    var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
    if (pathInfo) {
        // Merge x, y, z into style if not already provided
        style = Object.assign({
            x: pathInfo.x,
            y: pathInfo.y,
            z: pathInfo.z
        }, style);
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid lines first (behind everything) if axes are enabled
    if (showAxes) {
        var axesConfig = buildAxesConfig(style, contourResult, width, height);
        axesRenderer.drawAxes(ctx, Object.assign({}, axesConfig, { drawGridOnly: true }));
    }

    var connectGaps = contourResult.connectgaps !== undefined ? contourResult.connectgaps : true;
    var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;

    // Apply clip path if needed (using marching squares for smooth boundary)
    if (needsClip && useClipMask) {
        var clipPathData = nullHandling.generateClipPath(contourResult, style);
        if (clipPathData) {
            applyCanvasClip(ctx, clipPathData, width, height);
        }
    }

    // Draw heatmap background if coloring mode is 'heatmap'
    if (coloring === 'heatmap') {
        drawHeatmap.drawInterpolatedHeatmap(ctx, {
            z: contourResult.pathinfo[0].z,
            x: contourResult.pathinfo[0].x,
            y: contourResult.pathinfo[0].y
        }, style);
    }

    // Draw filled contours
    if (coloring === 'fill' || coloring === 'heatmap') {
        drawPaths.drawFilledPaths(ctx, contourResult, style);
    }

    // Draw contour lines
    // For 'lines' mode: draw lines only
    // For 'fill'/'heatmap' mode: draw lines on top of fills if showLines is true
    if (showLines && (coloring === 'lines' || coloring === 'fill' || coloring === 'heatmap')) {
        drawPaths.drawStrokePaths(ctx, contourResult, style);
    }

    // Restore context (remove clip)
    if (needsClip && useClipMask) {
        ctx.restore();
    }

    // Draw labels (if enabled)
    if (style.showLabels) {
        drawLabels(ctx, contourResult, style);
    }

    // Draw colorbar (if enabled)
    if (style.colorbar !== false && coloring !== 'lines') {
        drawColorbar(ctx, contourResult, style);
    }

    // Draw null regions as fallback (rectangles) when clipPath is not used
    // IMPORTANT: Only mask when connectgaps is false (like plotly.js does)
    if (needsClip && !useClipMask) {
        drawNulls(ctx, contourResult, style);
    }

    // Draw axes on top (axis lines, ticks, labels) if enabled
    if (showAxes) {
        var axesConfig = buildAxesConfig(style, contourResult, width, height);
        axesRenderer.drawAxes(ctx, axesConfig);
    }
}

/**
 * Build axes configuration from style and contour result
 * @private
 */
function buildAxesConfig(style, contourResult, width, height) {
    var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];

    // Get padding from style (same as used by contour rendering)
    var padding = style.padding || 50;

    // Base axes config from style
    var axesConfig = style.axes || {};

    // Set dimensions
    axesConfig.width = width;
    axesConfig.height = height;

    // Override margins to match contour rendering area
    // This ensures axes align with the contour plot
    axesConfig.margins = {
        left: padding,
        right: padding,
        top: padding,
        bottom: padding
    };

    // Auto-infer data ranges from contour result if not provided
    if (pathInfo) {
        if (!axesConfig.xData && pathInfo.x) {
            axesConfig.xData = pathInfo.x;
        }
        if (!axesConfig.yData && pathInfo.y) {
            axesConfig.yData = pathInfo.y;
        }
    }

    // Default axis visibility
    if (!axesConfig.x) axesConfig.x = {};
    if (!axesConfig.y) axesConfig.y = {};
    if (axesConfig.x.show === undefined) axesConfig.x.show = true;
    if (axesConfig.y.show === undefined) axesConfig.y.show = true;

    return axesConfig;
}

/**
 * Apply SVG path data as a clipping region to canvas context
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {String} pathData - SVG path data string
 * @param {Number} width - Canvas width
 * @param {Number} height - Canvas height
 */
function applyCanvasClip(ctx, pathData, width, height) {
    ctx.save();

    // Parse SVG path data and create canvas path
    parseSVGPathToCanvas(ctx, pathData);

    // Apply clipping
    ctx.clip();
}

/**
 * Parse SVG path data and draw it on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {String} pathData - SVG path data string
 */
function parseSVGPathToCanvas(ctx, pathData) {
    var commands = pathData.split(/[MmLlHhVvAaQqTtCcSsZz]/);
    var types = pathData.match(/[MmLlHhVvAaQqTtCcSsZz]/g) || [];

    var currentX = 0, currentY = 0;
    var startX = 0, startY = 0;

    ctx.beginPath();

    for (var i = 0; i < types.length; i++) {
        var type = types[i];
        var args = commands[i + 1] ? commands[i + 1].trim().split(/[\s,]+/).map(parseFloat) : [];

        switch (type) {
            case 'M':
                ctx.moveTo(args[0], args[1]);
                currentX = args[0];
                currentY = args[1];
                startX = args[0];
                startY = args[1];
                break;
            case 'm':
                ctx.moveTo(currentX + args[0], currentY + args[1]);
                currentX += args[0];
                currentY += args[1];
                startX = currentX;
                startY = currentY;
                break;
            case 'L':
                ctx.lineTo(args[0], args[1]);
                currentX = args[0];
                currentY = args[1];
                break;
            case 'l':
                ctx.lineTo(currentX + args[0], currentY + args[1]);
                currentX += args[0];
                currentY += args[1];
                break;
            case 'H':
                ctx.lineTo(args[0], currentY);
                currentX = args[0];
                break;
            case 'h':
                ctx.lineTo(currentX + args[0], currentY);
                currentX += args[0];
                break;
            case 'V':
                ctx.lineTo(currentX, args[0]);
                currentY = args[0];
                break;
            case 'v':
                ctx.lineTo(currentX, currentY + args[0]);
                currentY += args[0];
                break;
            case 'Z':
            case 'z':
                ctx.closePath();
                currentX = startX;
                currentY = startY;
                break;
            default:
                // For arc and bezier commands, simplify to line to for now
                if (args.length >= 2) {
                    ctx.lineTo(args[args.length - 2], args[args.length - 1]);
                }
                break;
        }
    }
}

// Import layered renderer and interaction manager
var layers = require('./layers');
var interactionManager = require('../../interaction/interaction_manager');
var compute = require('../../compute');

/**
 * Create an interactive contour renderer
 * This is the recommended way to use contour-core with zoom/pan support
 *
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} config - Configuration
 * @param {Object} config.data - Data {z, x, y}
 * @param {Object} config.contourOptions - Contour calculation options
 * @param {Object} config.style - Rendering style
 * @param {Object} config.axes - Axes configuration
 * @param {Object} config.interaction - Interaction configuration
 * @returns {Object} Interactive renderer API
 */
function createInteractiveRenderer(canvas, config) {
    config = config || {};

    var data = config.data;
    var contourOptions = config.contourOptions || {};
    var style = config.style || {};
    var axesConfig = config.axes || {};
    var interactionConfig = config.interaction || {};

    // Compute contours
    var contourResult = compute.computeContours(data, contourOptions);

    // Create layered renderer
    var renderer = layers.createLayeredRenderer(canvas, {
        width: config.width || canvas.width,
        height: config.height || canvas.height,
        padding: style.padding || 50,
        style: style,
        axes: axesConfig,
        interaction: interactionConfig
    });

    // Initialize renderer
    renderer.init(contourResult);

    // Create interaction manager
    var interaction = interactionManager.createInteractionManager(canvas, renderer, interactionConfig);

    // Initial render
    renderer.render(contourResult, style);

    return {
        /**
         * Update data and re-render
         * @param {Object} newData - New data {z, x, y}
         */
        updateData: function(newData) {
            data = newData;
            contourResult = compute.computeContours(data, contourOptions);
            renderer.init(contourResult);
            renderer.render(contourResult, style);
        },

        /**
         * Get current view state
         * @returns {Object} {xMin, xMax, yMin, yMax, zoom}
         */
        getViewState: function() {
            return interaction.getViewState();
        },

        /**
         * Set view range programmatically
         * @param {number} xMin - X minimum
         * @param {number} xMax - X maximum
         * @param {number} yMin - Y minimum
         * @param {number} yMax - Y maximum
         */
        setViewRange: function(xMin, xMax, yMin, yMax) {
            interaction.setViewRange(xMin, xMax, yMin, yMax);
        },

        /**
         * Reset view to full range
         */
        resetView: function() {
            interaction.resetView();
        },

        /**
         * Update style and re-render
         * @param {Object} newStyle - New style options
         */
        updateStyle: function(newStyle) {
            style = Object.assign(style, newStyle);
            renderer.updateStyle(style);
            renderer.render();
        },

        /**
         * Resize canvas
         * @param {number} newWidth - New width
         * @param {number} newHeight - New height
         */
        resize: function(newWidth, newHeight) {
            renderer.resize(newWidth, newHeight);
        },

        /**
         * Get contour result
         * @returns {Object} Contour computation result
         */
        getContourResult: function() {
            return contourResult;
        },

        /**
         * Get layered renderer
         * @returns {Object} Layered renderer instance
         */
        getRenderer: function() {
            return renderer;
        },

        /**
         * Get interaction manager
         * @returns {Object} Interaction manager instance
         */
        getInteraction: function() {
            return interaction;
        },

        /**
         * Destroy the renderer and cleanup
         */
        destroy: function() {
            interaction.destroy();
        }
    };
}

module.exports = {
    drawContours: drawContours,
    drawPaths: drawPaths,
    drawLabels: drawLabels,
    drawColorbar: drawColorbar,
    drawNulls: drawNulls,
    drawHeatmap: drawHeatmap,
    drawAxes: axesRenderer.drawAxes,
    drawAxesFromSetup: axesRenderer.drawAxesFromSetup,
    drawGrid: axesRenderer.drawGrid,
    createInteractiveRenderer: createInteractiveRenderer,
    createLayeredRenderer: layers.createLayeredRenderer
};
