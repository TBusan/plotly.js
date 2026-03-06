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
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} style - Rendering options
 * @param {boolean} style.showAxes - Show X/Y axes (default: false)
 * @param {Object} style.axes - Axes configuration (optional, used when showAxes is true)
 * @param {Object} style.interaction - Interaction configuration (optional, enables interactive mode when provided)
 * @param {boolean} style.interaction.zoom - Enable zoom (default: true)
 * @param {boolean} style.interaction.pan - Enable pan (default: true)
 * @param {boolean} style.interaction.dblclickReset - Enable double-click reset (default: true)
 * @param {boolean} style.interaction.boxZoom - Enable box zoom (default: false)
 * @param {number} style.interaction.minZoom - Minimum zoom level (default: 0.1)
 * @param {number} style.interaction.maxZoom - Maximum zoom level (default: 10)
 * @param {Function} style.interaction.onZoom - Zoom callback
 * @param {Function} style.interaction.onPan - Pan callback
 * @param {Function} style.interaction.onReset - Reset callback
 * @returns {Object|null} Interactive controller if interaction is enabled, null otherwise
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

    // Check if interaction is enabled
    var interactionConfig = style.interaction;
    if (interactionConfig) {
        // Use layered renderer for interactive mode
        return createInteractiveFromStyle(ctx.canvas, contourResult, style, interactionConfig);
    }

    // Static rendering mode
    renderStatic(ctx, contourResult, style, width, height, coloring, showLines, useClipMask, showAxes, pathInfo);

    return null;
}

/**
 * Static rendering (original drawContours logic)
 * @private
 */
function renderStatic(ctx, contourResult, style, width, height, coloring, showLines, useClipMask, showAxes, pathInfo) {
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

    // Draw filled contours (for fill, fill+lines, or heatmap modes)
    if (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap') {
        drawPaths.drawFilledPaths(ctx, contourResult, style);
    }

    // Draw contour lines
    // - 'lines' mode: ALWAYS draw lines
    // - 'fill+lines' mode: ALWAYS draw lines on top of fills
    // - 'fill' mode: NO lines (just fill)
    // - 'heatmap' mode: NO lines (just heatmap + optional fill)
    var shouldDrawLines = (coloring === 'lines') || (coloring === 'fill+lines');
    if (shouldDrawLines) {
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
    if (style.colorbar !== false && (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap')) {
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
 * Create interactive renderer from style configuration
 * @private
 */
function createInteractiveFromStyle(canvas, contourResult, style, interactionConfig) {
    var layers = require('./layers');
    var interactionManager = require('../../interaction/interaction_manager');

    var width = style.width || canvas.width;
    var height = style.height || canvas.height;
    var padding = style.padding || 50;

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

    // Get full data range from contour result
    var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
    var fullRange;
    if (pathInfo) {
        var xData = pathInfo.x || [];
        var yData = pathInfo.y || [];
        fullRange = {
            xMin: xData.length > 0 ? Math.min.apply(Math, xData) : 0,
            xMax: xData.length > 0 ? Math.max.apply(Math, xData) : 1,
            yMin: yData.length > 0 ? Math.min.apply(Math, yData) : 0,
            yMax: yData.length > 0 ? Math.max.apply(Math, yData) : 1
        };
    } else {
        fullRange = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    }

    // Create view state manager
    var viewState = require('../../interaction/view_state');
    var viewManager = viewState.createViewManager(fullRange, {
        minZoom: interactionConfig.minZoom || 0.1,
        maxZoom: interactionConfig.maxZoom || 10
    });

    // Store state
    var currentStyle = Object.assign({}, style);

    /**
     * Render all layers
     */
    function render() {
        var ctx = canvas.getContext('2d');
        var visibleRange = viewManager.getState();

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        if (currentStyle.backgroundColor) {
            ctx.fillStyle = currentStyle.backgroundColor;
            ctx.fillRect(0, 0, width, height);
        }

        // Layer 1: Grid (transforms with content)
        if (currentStyle.showGrid !== false && currentStyle.showAxes !== false) {
            renderGrid(ctx, drawingArea, visibleRange, currentStyle);
        }

        // Layer 2: Contour content (transforms with zoom/pan)
        renderContours(ctx, drawingArea, visibleRange, fullRange, contourResult, currentStyle);

        // Layer 3: Axes (fixed position, dynamic ticks)
        if (currentStyle.showAxes !== false) {
            renderAxesLayer(ctx, drawingArea, visibleRange, fullRange, currentStyle);
        }

        // Draw colorbar (always fixed position)
        if (currentStyle.colorbar !== false &&
            (currentStyle.coloring === 'fill' || currentStyle.coloring === 'fill+lines' || currentStyle.coloring === 'heatmap')) {
            drawColorbar(ctx, contourResult, currentStyle);
        }
    }

    // Initial render
    render();

    // Create interaction manager
    var interaction = createInteractionManagerInternal(canvas, drawingArea, viewManager, render, interactionConfig);

    // Return controller API
    return {
        /**
         * Get current view state
         * @returns {Object} {xMin, xMax, yMin, yMax, zoom}
         */
        getViewState: function() {
            return viewManager.getState();
        },

        /**
         * Set view range programmatically
         * @param {number} xMin - X minimum
         * @param {number} xMax - X maximum
         * @param {number} yMin - Y minimum
         * @param {number} yMax - Y maximum
         */
        setViewRange: function(xMin, xMax, yMin, yMax) {
            viewManager.setRange(xMin, xMax, yMin, yMax);
            render();
        },

        /**
         * Reset view to full range
         */
        resetView: function() {
            viewManager.reset();
            render();
            if (interactionConfig.onReset) {
                interactionConfig.onReset();
            }
        },

        /**
         * Update style and re-render
         * @param {Object} newStyle - New style options
         */
        updateStyle: function(newStyle) {
            currentStyle = Object.assign(currentStyle, newStyle);
            render();
        },

        /**
         * Resize canvas
         * @param {number} newWidth - New width
         * @param {number} newHeight - New height
         */
        resize: function(newWidth, newHeight) {
            width = newWidth;
            height = newHeight;
            canvas.width = width;
            canvas.height = height;

            drawingArea.width = width - 2 * padding;
            drawingArea.height = height - 2 * padding;

            render();
        },

        /**
         * Get contour result
         * @returns {Object} Contour computation result
         */
        getContourResult: function() {
            return contourResult;
        },

        /**
         * Get view manager
         * @returns {Object} View manager instance
         */
        getViewManager: function() {
            return viewManager;
        },

        /**
         * Get drawing area
         * @returns {Object} Drawing area {x, y, width, height}
         */
        getDrawingArea: function() {
            return drawingArea;
        },

        /**
         * Destroy the renderer and cleanup
         */
        destroy: function() {
            interaction.destroy();
        },

        /**
         * Re-render
         */
        render: render
    };
}

/**
 * Render grid layer for interactive mode
 * @private
 */
function renderGrid(ctx, drawArea, visibleRange, style) {
    var axes = require('../../axes');

    var axesConfig = style.axes || {};
    var xOptions = axesConfig.x || {};
    var yOptions = axesConfig.y || {};

    var axisSetup = axes.setupAxes({
        width: drawArea.width + 2 * drawArea.x,
        height: drawArea.height + 2 * drawArea.y,
        margins: drawArea.margins,
        visibleRange: visibleRange,
        fullRange: visibleRange, // Use visible range for grid
        x: xOptions,
        y: yOptions
    });

    var xTicks = axisSetup.x.ticks;
    var yTicks = axisSetup.y.ticks;
    var xConfig = axisSetup.x.config;
    var yConfig = axisSetup.y.config;

    var xRange = visibleRange.xMax - visibleRange.xMin;
    var yRange = visibleRange.yMax - visibleRange.yMin;

    ctx.save();

    if (xConfig.showgrid) {
        ctx.beginPath();
        ctx.strokeStyle = xConfig.gridcolor || '#e0e0e0';
        ctx.lineWidth = xConfig.gridwidth || 1;

        for (var i = 0; i < xTicks.length; i++) {
            var dataX = xTicks[i].value;
            var canvasX = drawArea.x + (dataX - visibleRange.xMin) / xRange * drawArea.width;

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
            var dataY = yTicks[i].value;
            var canvasY = drawArea.y + drawArea.height - (dataY - visibleRange.yMin) / yRange * drawArea.height;

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
 * Render contour content layer for interactive mode
 * @private
 */
function renderContours(ctx, drawArea, visibleRange, fullRange, contourResult, style) {
    var coloring = style.coloring || 'lines';
    var connectGaps = contourResult.connectgaps !== undefined ? contourResult.connectgaps : true;
    var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;

    var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];

    // Create style with visibleRange for proper coordinate scaling
    var renderStyle = Object.assign({}, style, {
        visibleRange: visibleRange,
        fullRange: fullRange,
        width: drawArea.width + 2 * drawArea.x,
        height: drawArea.height + 2 * drawArea.y,
        padding: drawArea.x,
        z: style.z || (pathInfo ? pathInfo.z : null),
        x: style.x || (pathInfo ? pathInfo.x : null),
        y: style.y || (pathInfo ? pathInfo.y : null)
    });

    ctx.save();

    // Clip to drawing area
    ctx.beginPath();
    ctx.rect(drawArea.x, drawArea.y, drawArea.width, drawArea.height);
    ctx.clip();

    // Apply clip path for null handling (if needed)
    if (needsClip && style.useClipMask !== false) {
        var clipPathData = nullHandling.generateClipPath(contourResult, renderStyle);
        if (clipPathData) {
            applyCanvasClipPathInteractive(ctx, clipPathData, renderStyle, drawArea, visibleRange);
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

    // Draw filled contours
    if (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap') {
        drawPaths.drawFilledPaths(ctx, contourResult, renderStyle);
    }

    // Draw contour lines
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
 * Render axes layer for interactive mode
 * @private
 */
function renderAxesLayer(ctx, drawArea, visibleRange, fullRange, style) {
    var axes = require('../../axes');

    var axesConfig = style.axes || {};
    var xOptions = axesConfig.x || {};
    var yOptions = axesConfig.y || {};

    var axisSetup = axes.setupAxes({
        width: drawArea.width + 2 * drawArea.x,
        height: drawArea.height + 2 * drawArea.y,
        margins: drawArea.margins,
        visibleRange: visibleRange,
        fullRange: fullRange,
        x: xOptions,
        y: yOptions
    });

    axesRenderer.drawAxesFromSetup(ctx, axisSetup);
}

/**
 * Apply clip path in canvas coordinates for interactive mode
 * @private
 */
function applyCanvasClipPathInteractive(ctx, pathData, renderStyle, drawArea, visibleRange) {
    var commands = pathData.split(/[MmLlHhVvAaQqTtCcSsZz]/);
    var types = pathData.match(/[MmLlHhVvAaQqTtCcSsZz]/g) || [];

    var currentX = 0, currentY = 0;
    var startX = 0, startY = 0;

    var vr = visibleRange;
    var xRange = vr.xMax - vr.xMin;
    var yRange = vr.yMax - vr.yMin;

    ctx.beginPath();

    for (var i = 0; i < types.length; i++) {
        var type = types[i];
        var args = commands[i + 1] ? commands[i + 1].trim().split(/[\s,]+/).map(parseFloat) : [];

        function toCanvas(dx, dy) {
            var cx = drawArea.x + (dx - vr.xMin) / xRange * drawArea.width;
            var cy = drawArea.y + drawArea.height - (dy - vr.yMin) / yRange * drawArea.height;
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
 * Create internal interaction manager
 * @private
 */
function createInteractionManagerInternal(canvas, drawingArea, viewManager, render, config) {
    config = config || {};

    var isDragging = false;
    var isBoxZooming = false;
    var lastX = 0;
    var lastY = 0;
    var boxStartX = 0;
    var boxStartY = 0;

    var zoomEnabled = config.zoom !== false;
    var panEnabled = config.pan !== false;
    var dblclickReset = config.dblclickReset !== false;
    var boxZoomEnabled = config.boxZoom === true;
    var zoomSensitivity = 0.001;

    var boundHandlers = {};

    function getMousePos(e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function isInDrawingArea(pos) {
        return pos.x >= drawingArea.x &&
               pos.x <= drawingArea.x + drawingArea.width &&
               pos.y >= drawingArea.y &&
               pos.y <= drawingArea.y + drawingArea.height;
    }

    function handleWheel(e) {
        if (!zoomEnabled) return;

        var pos = getMousePos(e);
        if (!isInDrawingArea(pos)) return;

        e.preventDefault();

        var dataPos = viewManager.pixelToData(pos.x, pos.y, drawingArea);

        var delta = -e.deltaY;
        var factor = 1 + delta * zoomSensitivity;
        factor = Math.max(0.5, Math.min(2, factor));

        viewManager.zoomAt(factor, dataPos.x, dataPos.y, drawingArea);
        render();

        if (config.onZoom) {
            config.onZoom(viewManager.getState());
        }
    }

    function handleMouseDown(e) {
        var pos = getMousePos(e);
        if (!isInDrawingArea(pos)) return;

        if (e.button === 0) {
            if (e.shiftKey && boxZoomEnabled) {
                isBoxZooming = true;
                boxStartX = pos.x;
                boxStartY = pos.y;
            } else if (panEnabled) {
                isDragging = true;
                lastX = pos.x;
                lastY = pos.y;
                canvas.style.cursor = 'grabbing';
            }
        }
    }

    function handleMouseMove(e) {
        var pos = getMousePos(e);

        if (isDragging) {
            e.preventDefault();

            var dx = pos.x - lastX;
            var dy = pos.y - lastY;

            viewManager.pan(dx, dy, drawingArea);

            lastX = pos.x;
            lastY = pos.y;

            render();

            if (config.onPan) {
                config.onPan(viewManager.getState());
            }
        } else if (isBoxZooming) {
            // Box zoom visual feedback could be added here
        } else if (isInDrawingArea(pos)) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
    }

    function handleMouseUp(e) {
        if (isDragging) {
            isDragging = false;
            canvas.style.cursor = 'grab';
        }

        if (isBoxZooming) {
            isBoxZooming = false;

            var pos = getMousePos(e);

            var x1 = Math.min(boxStartX, pos.x);
            var x2 = Math.max(boxStartX, pos.x);
            var y1 = Math.min(boxStartY, pos.y);
            var y2 = Math.max(boxStartY, pos.y);

            if (x2 - x1 > 10 && y2 - y1 > 10) {
                var dataStart = viewManager.pixelToData(x1, y2, drawingArea);
                var dataEnd = viewManager.pixelToData(x2, y1, drawingArea);

                viewManager.setRange(dataStart.x, dataEnd.x, dataStart.y, dataEnd.y);
                render();

                if (config.onZoom) {
                    config.onZoom(viewManager.getState());
                }
            }
        }
    }

    function handleDblClick(e) {
        if (!dblclickReset) return;

        var pos = getMousePos(e);
        if (!isInDrawingArea(pos)) return;

        e.preventDefault();

        viewManager.reset();
        render();

        if (config.onReset) {
            config.onReset();
        }
    }

    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            var touch = e.touches[0];
            var pos = getMousePos(touch);

            if (isInDrawingArea(pos)) {
                isDragging = true;
                lastX = pos.x;
                lastY = pos.y;
            }
        }
    }

    function handleTouchMove(e) {
        if (e.touches.length === 1 && isDragging) {
            e.preventDefault();

            var touch = e.touches[0];
            var pos = getMousePos(touch);

            var dx = pos.x - lastX;
            var dy = pos.y - lastY;

            viewManager.pan(dx, dy, drawingArea);

            lastX = pos.x;
            lastY = pos.y;

            render();

            if (config.onPan) {
                config.onPan(viewManager.getState());
            }
        }
    }

    function handleTouchEnd(e) {
        isDragging = false;
    }

    function bindEvents() {
        boundHandlers.wheel = handleWheel;
        boundHandlers.mousedown = handleMouseDown;
        boundHandlers.mousemove = handleMouseMove;
        boundHandlers.mouseup = handleMouseUp;
        boundHandlers.mouseleave = handleMouseUp;
        boundHandlers.dblclick = handleDblClick;
        boundHandlers.touchstart = handleTouchStart;
        boundHandlers.touchmove = handleTouchMove;
        boundHandlers.touchend = handleTouchEnd;

        canvas.addEventListener('wheel', boundHandlers.wheel, { passive: false });
        canvas.addEventListener('mousedown', boundHandlers.mousedown);
        canvas.addEventListener('mousemove', boundHandlers.mousemove);
        canvas.addEventListener('mouseup', boundHandlers.mouseup);
        canvas.addEventListener('mouseleave', boundHandlers.mouseleave);
        canvas.addEventListener('dblclick', boundHandlers.dblclick);
        canvas.addEventListener('touchstart', boundHandlers.touchstart, { passive: false });
        canvas.addEventListener('touchmove', boundHandlers.touchmove, { passive: false });
        canvas.addEventListener('touchend', boundHandlers.touchend);
    }

    function unbindEvents() {
        canvas.removeEventListener('wheel', boundHandlers.wheel);
        canvas.removeEventListener('mousedown', boundHandlers.mousedown);
        canvas.removeEventListener('mousemove', boundHandlers.mousemove);
        canvas.removeEventListener('mouseup', boundHandlers.mouseup);
        canvas.removeEventListener('mouseleave', boundHandlers.mouseleave);
        canvas.removeEventListener('dblclick', boundHandlers.dblclick);
        canvas.removeEventListener('touchstart', boundHandlers.touchstart);
        canvas.removeEventListener('touchmove', boundHandlers.touchmove);
        canvas.removeEventListener('touchend', boundHandlers.touchend);
    }

    function destroy() {
        unbindEvents();
    }

    bindEvents();

    return {
        destroy: destroy
    };
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

module.exports = {
    drawContours: drawContours,
    drawPaths: drawPaths,
    drawLabels: drawLabels,
    drawColorbar: drawColorbar,
    drawNulls: drawNulls,
    drawHeatmap: drawHeatmap,
    drawAxes: axesRenderer.drawAxes,
    drawAxesFromSetup: axesRenderer.drawAxesFromSetup,
    drawGrid: axesRenderer.drawGrid
};

