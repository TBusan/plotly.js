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
var axes = require('../../axes');

/**
 * Draw contours on a canvas context
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} style - Rendering options
 * @param {Object} style.axes - Axes configuration (when provided, axes will be shown)
 * @param {string} style.axes.x.title - X axis title
 * @param {string} style.axes.y.title - Y axis title
 * @param {string} style.axes.x.color - X axis color
 * @param {string} style.axes.y.color - Y axis color
 * @param {boolean} style.showGrid - Show grid lines (default: true when axes is provided)
 * @param {string} style.gridColor - Grid line color (default: '#e0e0e0')
 * @param {number} style.gridWidth - Grid line width (default: 1)
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
    var useClipMask = style.useClipMask !== false;
    var hasAxes = style.axes !== undefined && style.axes !== null;

    // Extract data coordinates from contourResult for scalePoint function
    var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
    if (pathInfo) {
        style = Object.assign({
            x: pathInfo.x,
            y: pathInfo.y,
            z: pathInfo.z
        }, style);
    }

    // Check if interaction is enabled
    var interactionConfig = style.interaction;
    if (interactionConfig) {
        // Use interactive renderer
        return createInteractiveRenderer(ctx.canvas, contourResult, style, interactionConfig);
    }

    // Static rendering mode
    renderStatic(ctx, contourResult, style, width, height, coloring, showLines, useClipMask, hasAxes, pathInfo);

    return null;
}

/**
 * Static rendering
 * @private
 */
function renderStatic(ctx, contourResult, style, width, height, coloring, showLines, useClipMask, hasAxes, pathInfo) {
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
    var fullRange = getFullRange(pathInfo);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    if (style.backgroundColor) {
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(0, 0, width, height);
    }

    // Layer 1: Grid (if axes configured and showGrid is true)
    var showGrid = style.showGrid !== false && hasAxes;
    if (showGrid) {
        renderGridLayer(ctx, drawingArea, fullRange, style);
    }

    // Layer 2: Contour content
    renderContourLayer(ctx, drawingArea, fullRange, fullRange, contourResult, style, useClipMask, coloring, showLines, pathInfo);

    // Layer 3: Axes (if configured)
    if (hasAxes) {
        renderAxesLayer(ctx, drawingArea, fullRange, fullRange, style);
    }

    // Draw colorbar (if enabled)
    if (style.colorbar !== false && (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap')) {
        drawColorbar(ctx, contourResult, style);
    }
}

/**
 * Create interactive renderer
 * @private
 */
function createInteractiveRenderer(canvas, contourResult, style, interactionConfig) {
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
    var fullRange = getFullRange(pathInfo);

    // Create view state manager
    var viewState = require('../../interaction/view_state');
    var viewManager = viewState.createViewManager(fullRange, {
        minZoom: interactionConfig.minZoom || 0.1,
        maxZoom: interactionConfig.maxZoom || 10
    });

    // Store state
    var currentStyle = Object.assign({}, style);
    var hasAxes = currentStyle.axes !== undefined && currentStyle.axes !== null;

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

        // Layer 1: Grid (if showGrid is true)
        // Grid can be shown independently of axes
        var showGrid = currentStyle.showGrid === true;
        if (showGrid) {
            renderGridLayer(ctx, drawingArea, visibleRange, currentStyle);
        }

        // Layer 2: Contour content
        renderContourLayer(ctx, drawingArea, visibleRange, fullRange, contourResult, currentStyle, currentStyle.useClipMask !== false, currentStyle.coloring || 'lines', currentStyle.showLines !== false, pathInfo);

        // Layer 3: Axes (if configured)
        if (hasAxes) {
            renderAxesLayer(ctx, drawingArea, visibleRange, fullRange, currentStyle);
        }

        // Draw colorbar
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
        getViewState: function() {
            return viewManager.getState();
        },

        setViewRange: function(xMin, xMax, yMin, yMax) {
            viewManager.setRange(xMin, xMax, yMin, yMax);
            render();
        },

        resetView: function() {
            viewManager.reset();
            render();
            if (interactionConfig.onReset) {
                interactionConfig.onReset();
            }
        },

        updateStyle: function(newStyle) {
            currentStyle = Object.assign(currentStyle, newStyle);
            hasAxes = currentStyle.axes !== undefined && currentStyle.axes !== null;
            render();
        },

        resize: function(newWidth, newHeight) {
            width = newWidth;
            height = newHeight;
            canvas.width = width;
            canvas.height = height;

            drawingArea.width = width - 2 * padding;
            drawingArea.height = height - 2 * padding;

            render();
        },

        getContourResult: function() {
            return contourResult;
        },

        getViewManager: function() {
            return viewManager;
        },

        getDrawingArea: function() {
            return drawingArea;
        },

        destroy: function() {
            interaction.destroy();
        },

        render: render
    };
}

/**
 * Get full data range from path info
 * @private
 */
function getFullRange(pathInfo) {
    if (pathInfo) {
        var xData = pathInfo.x || [];
        var yData = pathInfo.y || [];
        return {
            xMin: xData.length > 0 ? Math.min.apply(Math, xData) : 0,
            xMax: xData.length > 0 ? Math.max.apply(Math, xData) : 1,
            yMin: yData.length > 0 ? Math.min.apply(Math, yData) : 0,
            yMax: yData.length > 0 ? Math.max.apply(Math, yData) : 1
        };
    }
    return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
}

/**
 * Render grid layer
 * @private
 */
function renderGridLayer(ctx, drawArea, visibleRange, style) {
    var gridColor = style.gridColor || '#e0e0e0';
    var gridWidth = style.gridWidth || 1;

    // Calculate grid lines based on visible range
    var xRange = visibleRange.xMax - visibleRange.xMin;
    var yRange = visibleRange.yMax - visibleRange.yMin;

    // Generate tick values for grid lines
    var numXLines = 10;
    var numYLines = 10;

    var xStep = xRange / numXLines;
    var yStep = yRange / numYLines;

    // Round step to nice values
    xStep = Math.pow(10, Math.floor(Math.log10(xStep))) * Math.ceil(xStep / Math.pow(10, Math.floor(Math.log10(xStep))));
    yStep = Math.pow(10, Math.floor(Math.log10(yStep))) * Math.ceil(yStep / Math.pow(10, Math.floor(Math.log10(yStep))));

    // Generate tick values
    var xTicks = [];
    var yTicks = [];

    var xStart = Math.ceil(visibleRange.xMin / xStep) * xStep;
    for (var x = xStart; x <= visibleRange.xMax; x += xStep) {
        xTicks.push(x);
    }

    var yStart = Math.ceil(visibleRange.yMin / yStep) * yStep;
    for (var y = yStart; y <= visibleRange.yMax; y += yStep) {
        yTicks.push(y);
    }

    ctx.save();

    // Draw X grid lines
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = gridWidth;

    for (var i = 0; i < xTicks.length; i++) {
        var dataX = xTicks[i];
        var canvasX = drawArea.x + (dataX - visibleRange.xMin) / xRange * drawArea.width;

        if (canvasX >= drawArea.x && canvasX <= drawArea.x + drawArea.width) {
            ctx.moveTo(canvasX, drawArea.y);
            ctx.lineTo(canvasX, drawArea.y + drawArea.height);
        }
    }
    ctx.stroke();

    // Draw Y grid lines
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = gridWidth;

    for (var i = 0; i < yTicks.length; i++) {
        var dataY = yTicks[i];
        var canvasY = drawArea.y + drawArea.height - (dataY - visibleRange.yMin) / yRange * drawArea.height;

        if (canvasY >= drawArea.y && canvasY <= drawArea.y + drawArea.height) {
            ctx.moveTo(drawArea.x, canvasY);
            ctx.lineTo(drawArea.x + drawArea.width, canvasY);
        }
    }
    ctx.stroke();

    ctx.restore();
}

/**
 * Render contour content layer
 * @private
 */
function renderContourLayer(ctx, drawArea, visibleRange, fullRange, contourResult, style, useClipMask, coloring, showLines, pathInfo) {
    var connectGaps = contourResult.connectgaps !== undefined ? contourResult.connectgaps : true;
    var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;

    // Create style with visibleRange for proper coordinate scaling
    var renderStyle = Object.assign({}, style, {
        visibleRange: visibleRange,
        fullRange: fullRange,
        width: drawArea.width + 2 * drawArea.x,
        height: drawArea.height + 2 * drawArea.y,
        padding: drawArea.x,
        z: style.z || (pathInfo ? pathInfo.z : null),
        x: style.x || (pathInfo ? pathInfo.x : null),
        y: style.y || (pathInfo ? pathInfo.y : null),
        connectgaps: connectGaps  // Pass connectgaps to drawFilledPaths for correct background color
    });

    ctx.save();

    // Clip to drawing area
    ctx.beginPath();
    ctx.rect(drawArea.x, drawArea.y, drawArea.width, drawArea.height);
    ctx.clip();

    // Apply clip path for null handling (if needed)
    // Use visibleRange for coordinate conversion to match contour rendering
    // This ensures clip mask stays consistent with contours during zoom/pan
    if (needsClip && useClipMask) {
        // Pass real data coordinates for proper coordinate transformation
        var clipPathData = nullHandling.generateClipPath(contourResult, {
            useDataCoordinates: true,
            dataX: pathInfo ? pathInfo.x : null,
            dataY: pathInfo ? pathInfo.y : null
        });
        if (clipPathData) {
            applyCanvasClipPathFromData(ctx, clipPathData, drawArea, visibleRange);
        }
    }

    // Draw heatmap background if coloring mode is 'heatmap'
    if (coloring === 'heatmap' && pathInfo) {
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
    if (needsClip && !useClipMask) {
        drawNulls(ctx, contourResult, renderStyle);
    }

    // Draw labels (if enabled)
    if (style.showLabels) {
        drawLabels(ctx, contourResult, renderStyle);
    }

    ctx.restore();
}

/**
 * Apply clip path from data coordinates
 * Uses regular clip (nonzero rule) to show the data region defined by the path
 * @private
 */
function applyCanvasClipPathFromData(ctx, pathData, drawArea, fullRange) {
    var commands = pathData.split(/[MmLlHhVvAaQqTtCcSsZz]/);
    var types = pathData.match(/[MmLlHhVvAaQqTtCcSsZz]/g) || [];

    var currentX = 0, currentY = 0;
    var startX = 0, startY = 0;

    var xRange = fullRange.xMax - fullRange.xMin;
    var yRange = fullRange.yMax - fullRange.yMin;

    ctx.beginPath();

    function dataToCanvas(dataX, dataY) {
        var cx = drawArea.x + (dataX - fullRange.xMin) / xRange * drawArea.width;
        var cy = drawArea.y + drawArea.height - (dataY - fullRange.yMin) / yRange * drawArea.height;
        return [cx, cy];
    }

    for (var i = 0; i < types.length; i++) {
        var type = types[i];
        var args = commands[i + 1] ? commands[i + 1].trim().split(/[\s,]+/).map(parseFloat) : [];

        switch (type) {
            case 'M':
                var pt = dataToCanvas(args[0], args[1]);
                ctx.moveTo(pt[0], pt[1]);
                currentX = args[0];
                currentY = args[1];
                startX = args[0];
                startY = args[1];
                break;
            case 'L':
                var pt = dataToCanvas(args[0], args[1]);
                ctx.lineTo(pt[0], pt[1]);
                currentX = args[0];
                currentY = args[1];
                break;
            case 'Z':
            case 'z':
                ctx.closePath();
                currentX = startX;
                currentY = startY;
                break;
            default:
                if (args.length >= 2) {
                    var pt = dataToCanvas(args[args.length - 2], args[args.length - 1]);
                    ctx.lineTo(pt[0], pt[1]);
                }
                break;
        }
    }

    // Use regular clip (nonzero rule) - the path defines the visible data region
    ctx.clip();
}

/**
 * Render axes layer
 * @private
 */
function renderAxesLayer(ctx, drawArea, visibleRange, fullRange, style) {
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
 * Apply SVG path data as a clipping region to canvas context (for static mode)
 * @private
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
 * @private
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
