'use strict';

/**
 * Layered Canvas Renderer
 * Handles the separation between:
 * - Layer 1: Grid (transforms with content)
 * - Layer 2: Contour content (transforms with zoom/pan)
 * - Layer 3: Axes (fixed position, dynamic ticks)
 *
 * The key insight is that we use data coordinates for everything,
 * but apply transforms only to the content layer while keeping
 * axes fixed at the drawing area boundaries.
 */

var drawPaths = require('./paths');
var drawLabels = require('./labels');
var drawColorbar = require('./colorbar');
var drawNulls = require('./nulls');
var drawHeatmap = require('./heatmap');
var axesRenderer = require('./axes');
var axes = require('../../axes');
var nullHandling = require('../../null_handling');
var viewState = require('../../interaction/view_state');

/**
 * Create a layered renderer
 *
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} config - Configuration
 * @param {Object} config.data - Data {z, x, y}
 * @param {Object} config.contourOptions - Contour calculation options
 * @param {Object} config.style - Rendering style
 * @param {Object} config.axes - Axes configuration
 * @param {Object} config.interaction - Interaction configuration
 * @returns {Object} Layered renderer API
 */
function createLayeredRenderer(canvas, config) {
    config = config || {};

    var ctx = canvas.getContext('2d');
    var width = config.width || canvas.width;
    var height = config.height || canvas.height;
    var padding = config.padding || 50;

    // Store original config for re-rendering
    var contourResult = null;
    var style = config.style || {};
    var axesConfig = config.axes || {};

    // Calculate drawing area
    var drawingArea = {
        x: padding,
        y: padding,
        width: width - 2 * padding,
        height: height - 2 * padding,
        margins: {
            left: padding,
            right: padding,
            top: padding,
            bottom: padding
        }
    };

    // View state manager (initialized when init() is called)
    var viewManager = null;
    var fullRange = null;

    /**
     * Initialize with contour result
     * @param {Object} result - Contour computation result
     */
    function init(result) {
        contourResult = result;

        // Get full data range from contour result
        var pathInfo = result.pathinfo && result.pathinfo[0];
        if (pathInfo) {
            var xData = pathInfo.x || [];
            var yData = pathInfo.y || [];

            // Use Math.min/max to handle both ascending and descending data
            fullRange = {
                xMin: xData.length > 0 ? Math.min.apply(Math, xData) : 0,
                xMax: xData.length > 0 ? Math.max.apply(Math, xData) : 1,
                yMin: yData.length > 0 ? Math.min.apply(Math, yData) : 0,
                yMax: yData.length > 0 ? Math.max.apply(Math, yData) : 1
            };
        } else {
            fullRange = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
        }

        // Create view manager
        viewManager = viewState.createViewManager(fullRange, {
            minZoom: config.interaction ? config.interaction.minZoom : 0.1,
            maxZoom: config.interaction ? config.interaction.maxZoom : 10
        });
    }

    /**
     * Render all layers
     * @param {Object} result - Contour result (optional if already initialized)
     * @param {Object} renderStyle - Rendering style (optional)
     */
    function render(result, renderStyle) {
        if (result) {
            contourResult = result;
        }
        if (renderStyle) {
            style = renderStyle;
        }

        if (!contourResult || !viewManager) {
            console.warn('LayeredRenderer: Not initialized');
            return;
        }

        var visibleRange = viewManager.getState();

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        if (style.backgroundColor) {
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(0, 0, width, height);
        }

        // Layer 1: Grid (transforms with content)
        if (style.showGrid !== false && style.showAxes !== false) {
            renderGrid(drawingArea, visibleRange);
        }

        // Layer 2: Contour content (transforms with zoom/pan)
        renderContours(drawingArea, visibleRange);

        // Layer 3: Axes (fixed position, dynamic ticks)
        if (style.showAxes !== false) {
            renderAxes(drawingArea, visibleRange);
        }

        // Draw colorbar (always fixed position)
        if (style.colorbar !== false && (style.coloring === 'fill' || style.coloring === 'fill+lines' || style.coloring === 'heatmap')) {
            drawColorbar(ctx, contourResult, style);
        }
    }

    /**
     * Render grid layer
     * Grid lines are drawn in canvas coordinates using visibleRange for positioning
     */
    function renderGrid(drawArea, visibleRange) {
        var axisSetup = setupAxesForRange(visibleRange);

        // Draw grid in canvas coordinates
        ctx.save();

        var xTicks = axisSetup.x.ticks;
        var yTicks = axisSetup.y.ticks;
        var xConfig = axisSetup.x.config;
        var yConfig = axisSetup.y.config;

        // Calculate scale factors for data to canvas conversion
        var xRange = visibleRange.xMax - visibleRange.xMin;
        var yRange = visibleRange.yMax - visibleRange.yMin;

        if (xConfig.showgrid) {
            ctx.beginPath();
            ctx.strokeStyle = xConfig.gridcolor || '#e0e0e0';
            ctx.lineWidth = xConfig.gridwidth || 1;

            for (var i = 0; i < xTicks.length; i++) {
                // Convert data X to canvas X
                var dataX = xTicks[i].value;
                var canvasX = drawArea.x + (dataX - visibleRange.xMin) / xRange * drawArea.width;

                // Only draw if within drawing area
                if (canvasX >= drawArea.x && canvasX <= drawArea.x + drawArea.width) {
                    ctx.moveTo(canvasX, drawArea.y);
                    ctx.lineTo(canvasX, drawArea.y + drawArea.height);
                }
            }
            ctx.stroke();
        }

        if (yConfig.showgrid) {
            ctx.beginPath();
            ctx.strokeStyle = yConfig.gridcolor || '#e0e0e0';
            ctx.lineWidth = yConfig.gridwidth || 1;

            for (var i = 0; i < yTicks.length; i++) {
                // Convert data Y to canvas Y (inverted)
                var dataY = yTicks[i].value;
                var canvasY = drawArea.y + drawArea.height - (dataY - visibleRange.yMin) / yRange * drawArea.height;

                // Only draw if within drawing area
                if (canvasY >= drawArea.y && canvasY <= drawArea.y + drawArea.height) {
                    ctx.moveTo(drawArea.x, canvasY);
                    ctx.lineTo(drawArea.x + drawArea.width, canvasY);
                }
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Render contour content layer
     * Content transforms with zoom/pan via visibleRange in style
     */
    function renderContours(drawArea, visibleRange) {
        var coloring = style.coloring || 'lines';
        var showLines = style.showLines !== false;
        var connectGaps = contourResult.connectgaps !== undefined ? contourResult.connectgaps : true;
        var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;

        ctx.save();

        // Clip to drawing area
        ctx.beginPath();
        ctx.rect(drawArea.x, drawArea.y, drawArea.width, drawArea.height);
        ctx.clip();

        // Get data from contour result
        var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];

        // Create style with visibleRange and data for proper coordinate scaling
        var renderStyle = Object.assign({}, style, {
            visibleRange: visibleRange,
            fullRange: fullRange,  // Add fullRange for boundary checks in joinAllPaths
            width: width,
            height: height,
            padding: padding,
            // Ensure z, x, y are available for scalePoint and createPerimeter
            z: style.z || (pathInfo ? pathInfo.z : null),
            x: style.x || (pathInfo ? pathInfo.x : null),
            y: style.y || (pathInfo ? pathInfo.y : null),
            connectgaps: connectGaps  // Pass connectgaps to drawFilledPaths for correct background color
        });

        // Apply clip path for null handling (if needed)
        if (needsClip && style.useClipMask !== false) {
            var clipPathData = nullHandling.generateClipPath(contourResult, renderStyle);
            if (clipPathData) {
                // Parse and apply clip path
                applyCanvasClipPath(ctx, clipPathData, renderStyle);
            }
        }

        // Draw heatmap background if coloring mode is 'heatmap'
        if (coloring === 'heatmap') {
            drawHeatmap.drawInterpolatedHeatmap(ctx, {
                z: pathInfo.z,
                x: pathInfo.x,
                y: pathInfo.y
            }, renderStyle);
        }

        // Draw filled contours (for fill, fill+lines, or heatmap modes)
        if (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap') {
            drawPaths.drawFilledPaths(ctx, contourResult, renderStyle);
        }

        // Draw contour lines
        // - 'lines' mode: ALWAYS draw lines
        // - 'fill+lines' mode: ALWAYS draw lines on top of fills
        // - 'fill' mode: NO lines (just fill)
        // - 'heatmap' mode: NO lines (just heatmap + optional fill)
        var shouldDrawLines = (coloring === 'lines') || (coloring === 'fill+lines');
        if (shouldDrawLines) {
            drawPaths.drawStrokePaths(ctx, contourResult, renderStyle);
        }

        // Draw null regions as fallback
        if (needsClip && !style.useClipMask) {
            drawNulls(ctx, contourResult, renderStyle);
        }

        // Draw labels (if enabled)
        if (style.showLabels) {
            drawLabels(ctx, contourResult, renderStyle);
        }

        ctx.restore();
    }

    /**
     * Render axes layer
     * Axes stay fixed at drawing area boundaries
     */
    function renderAxes(drawArea, visibleRange) {
        var axisSetup = setupAxesForRange(visibleRange);

        // Draw axes at fixed positions (no content transform)
        axesRenderer.drawAxesFromSetup(ctx, axisSetup);
    }

    /**
     * Apply the content transformation to context
     * Maps data coordinates to canvas coordinates
     */
    function applyContentTransform(ctx, drawArea, visibleRange) {
        var xRange = visibleRange.xMax - visibleRange.xMin;
        var yRange = visibleRange.yMax - visibleRange.yMin;

        var scaleX = drawArea.width / xRange;
        var scaleY = drawArea.height / yRange;

        // Move to drawing area origin
        ctx.translate(drawArea.x, drawArea.y + drawArea.height);

        // Scale (note: Y is inverted for canvas coordinates)
        ctx.scale(scaleX, -scaleY);

        // Translate to data origin
        ctx.translate(-visibleRange.xMin, -visibleRange.yMin);
    }

    /**
     * Setup axes for a given visible range
     */
    function setupAxesForRange(visibleRange) {
        var xOptions = axesConfig.x || {};
        var yOptions = axesConfig.y || {};

        return axes.setupAxes({
            width: width,
            height: height,
            margins: drawingArea.margins,
            visibleRange: visibleRange,
            fullRange: fullRange,
            x: xOptions,
            y: yOptions
        });
    }

    /**
     * Apply clip path in canvas coordinates
     * Converts data coordinates to canvas coordinates using visibleRange
     */
    function applyCanvasClipPath(ctx, pathData, renderStyle) {
        var commands = pathData.split(/[MmLlHhVvAaQqTtCcSsZz]/);
        var types = pathData.match(/[MmLlHhVvAaQqTtCcSsZz]/g) || [];

        var currentX = 0, currentY = 0;
        var startX = 0, startY = 0;

        // Get visible range for coordinate conversion
        var vr = renderStyle.visibleRange || fullRange;
        var xRange = vr.xMax - vr.xMin;
        var yRange = vr.yMax - vr.yMin;

        ctx.beginPath();

        for (var i = 0; i < types.length; i++) {
            var type = types[i];
            var args = commands[i + 1] ? commands[i + 1].trim().split(/[\s,]+/).map(parseFloat) : [];

            // Helper to convert data coords to canvas coords
            function toCanvas(dx, dy) {
                var cx = drawingArea.x + (dx - vr.xMin) / xRange * drawingArea.width;
                var cy = drawingArea.y + drawingArea.height - (dy - vr.yMin) / yRange * drawingArea.height;
                return [cx, cy];
            }

            switch (type) {
                case 'M':
                    var pt = toCanvas(args[0], args[1]);
                    ctx.moveTo(pt[0], pt[1]);
                    currentX = args[0];
                    currentY = args[1];
                    startX = args[0];
                    startY = args[1];
                    break;
                case 'm':
                    currentX += args[0];
                    currentY += args[1];
                    var pt = toCanvas(currentX, currentY);
                    ctx.moveTo(pt[0], pt[1]);
                    startX = currentX;
                    startY = currentY;
                    break;
                case 'L':
                    var pt = toCanvas(args[0], args[1]);
                    ctx.lineTo(pt[0], pt[1]);
                    currentX = args[0];
                    currentY = args[1];
                    break;
                case 'l':
                    currentX += args[0];
                    currentY += args[1];
                    var pt = toCanvas(currentX, currentY);
                    ctx.lineTo(pt[0], pt[1]);
                    break;
                case 'H':
                    var pt = toCanvas(args[0], currentY);
                    ctx.lineTo(pt[0], pt[1]);
                    currentX = args[0];
                    break;
                case 'h':
                    currentX += args[0];
                    var pt = toCanvas(currentX, currentY);
                    ctx.lineTo(pt[0], pt[1]);
                    break;
                case 'V':
                    var pt = toCanvas(currentX, args[0]);
                    ctx.lineTo(pt[0], pt[1]);
                    currentY = args[0];
                    break;
                case 'v':
                    currentY += args[0];
                    var pt = toCanvas(currentX, currentY);
                    ctx.lineTo(pt[0], pt[1]);
                    break;
                case 'Z':
                case 'z':
                    ctx.closePath();
                    currentX = startX;
                    currentY = startY;
                    break;
                default:
                    if (args.length >= 2) {
                        var pt = toCanvas(args[args.length - 2], args[args.length - 1]);
                        ctx.lineTo(pt[0], pt[1]);
                    }
                    break;
            }
        }

        ctx.clip();
    }

    /**
     * Get the view manager
     */
    function getViewManager() {
        return viewManager;
    }

    /**
     * Get the drawing area
     */
    function getDrawingArea() {
        return drawingArea;
    }

    /**
     * Update style
     */
    function updateStyle(newStyle) {
        style = Object.assign(style, newStyle);
    }

    /**
     * Resize the renderer
     */
    function resize(newWidth, newHeight) {
        width = newWidth;
        height = newHeight;
        canvas.width = width;
        canvas.height = height;

        drawingArea.width = width - 2 * padding;
        drawingArea.height = height - 2 * padding;

        if (contourResult) {
            render();
        }
    }

    return {
        init: init,
        render: render,
        renderGrid: renderGrid,
        renderContours: renderContours,
        renderAxes: renderAxes,
        getViewManager: getViewManager,
        getDrawingArea: getDrawingArea,
        updateStyle: updateStyle,
        resize: resize
    };
}

module.exports = {
    createLayeredRenderer: createLayeredRenderer
};
