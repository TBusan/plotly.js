'use strict';

/**
 * Canvas renderer for contour-core
 * Main entry point for canvas rendering
 */

var compute = require('../../compute');

/**
 * Normalize padding to support both number and object formats
 * @param {number|Object} padding - Padding value or object
 * @param {number} [defaultVal] - Default padding value (default: 50)
 * @returns {Object} Normalized padding object { top, right, bottom, left }
 */
function normalizePadding(padding, defaultVal) {
    defaultVal = defaultVal || 50;
    if (typeof padding === 'number') {
        return {
            top: padding,
            right: padding,
            bottom: padding,
            left: padding
        };
    }
    if (typeof padding === 'object' && padding !== null) {
        return {
            top: padding.top !== undefined ? padding.top : defaultVal,
            right: padding.right !== undefined ? padding.right : defaultVal,
            bottom: padding.bottom !== undefined ? padding.bottom : defaultVal,
            left: padding.left !== undefined ? padding.left : defaultVal
        };
    }
    // Default case
    return {
        top: defaultVal,
        right: defaultVal,
        bottom: defaultVal,
        left: defaultVal
    };
}
var drawPaths = require('./paths');
var drawLabels = require('./labels');
var drawColorbar = require('./colorbar');
var drawNulls = require('./nulls');
var drawHeatmap = require('./heatmap');
var axesRenderer = require('./axes');
var nullHandling = require('../../null_handling');
var axes = require('../../axes');
var createOverlaySystem = require('../../overlay');

/**
 * Calculate adjusted drawing area based on aspect ratio
 * When aspectRatio is 'equal' or 1, the drawing area is adjusted so that
 * one unit of data in X direction equals one unit of data in Y direction on screen
 *
 * @param {Object} baseArea - Base drawing area { x, y, width, height, margins }
 * @param {Object} fullRange - Data range { xMin, xMax, yMin, yMax }
 * @param {string|number} aspectRatio - 'equal' or 1 for 1:1 ratio, 'auto' or 0 for fill
 * @returns {Object} Adjusted drawing area
 */
function calculateAspectRatioDrawingArea(baseArea, fullRange, aspectRatio) {
    // If aspectRatio is not 'equal' or 1, return base area unchanged
    if (aspectRatio !== 'equal' && aspectRatio !== 1 && aspectRatio !== '1:1') {
        return baseArea;
    }

    var xRange = fullRange.xMax - fullRange.xMin;
    var yRange = fullRange.yMax - fullRange.yMin;

    // Avoid division by zero
    if (xRange === 0 || yRange === 0) {
        return baseArea;
    }

    // Data aspect ratio (width per unit / height per unit)
    var dataRatio = xRange / yRange;

    // Available canvas aspect ratio
    var canvasRatio = baseArea.width / baseArea.height;

    var adjustedArea = Object.assign({}, baseArea);

    if (dataRatio > canvasRatio) {
        // Data is wider than canvas - reduce height (add padding top/bottom)
        var idealHeight = baseArea.width / dataRatio;
        var heightDiff = baseArea.height - idealHeight;
        adjustedArea.height = idealHeight;
        adjustedArea.y = baseArea.y + heightDiff / 2;
        // Update margins for axes positioning
        adjustedArea.margins = Object.assign({}, baseArea.margins, {
            top: baseArea.margins.top + heightDiff / 2,
            bottom: baseArea.margins.bottom + heightDiff / 2
        });
    } else if (dataRatio < canvasRatio) {
        // Data is taller than canvas - reduce width (add padding left/right)
        var idealWidth = baseArea.height * dataRatio;
        var widthDiff = baseArea.width - idealWidth;
        adjustedArea.width = idealWidth;
        adjustedArea.x = baseArea.x + widthDiff / 2;
        // Update margins for axes positioning
        adjustedArea.margins = Object.assign({}, baseArea.margins, {
            left: baseArea.margins.left + widthDiff / 2,
            right: baseArea.margins.right + widthDiff / 2
        });
    }

    return adjustedArea;
}

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
    // Normalize padding to support both number and object formats
    var padding = normalizePadding(style.padding, 50);

    // Calculate colorbar space if shown
    var colorbarSpace = 0;
    var showColorbar = style.showColorbar !== false &&
                       (style.colorbar === undefined || style.colorbar === true || style.colorbar.show !== false);
    if (showColorbar && (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap')) {
        var colorbarConfig = style.colorbar || {};
        var colorbarThickness = colorbarConfig.thickness || 25;
        var colorbarPadding = colorbarConfig.padding || 10;
        var colorbarLabelWidth = colorbarConfig.labelWidth || 45;
        colorbarSpace = colorbarThickness + colorbarPadding + colorbarLabelWidth;
    }

    // Calculate base drawing area (reduce width for colorbar)
    var baseDrawingArea = {
        x: padding.left,
        y: padding.top,
        width: width - padding.left - padding.right - colorbarSpace,
        height: height - padding.top - padding.bottom,
        margins: {
            left: padding.left,
            right: padding.right + colorbarSpace,
            top: padding.top,
            bottom: padding.bottom
        }
    };

    // Get full data range from contour result
    var fullRange = getFullRange(pathInfo);

    // Apply aspect ratio adjustment if needed
    var aspectRatio = style.aspectRatio || 'auto';
    var drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, aspectRatio);

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
    var showColorbar = style.showColorbar !== false &&
                       (style.colorbar === undefined || style.colorbar === true || style.colorbar.show !== false);
    if (showColorbar && (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap')) {
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
    // Normalize padding to support both number and object formats
    var padding = normalizePadding(style.padding, 50);
    var coloring = style.coloring || 'fill';

    // Calculate colorbar space if shown
    var colorbarSpace = 0;
    var showColorbar = style.showColorbar !== false &&
                       (style.colorbar === undefined || style.colorbar === true || style.colorbar.show !== false);
    if (showColorbar && (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap')) {
        var colorbarConfig = style.colorbar || {};
        var colorbarThickness = colorbarConfig.thickness || 25;
        var colorbarPadding = colorbarConfig.padding || 10;
        var colorbarLabelWidth = colorbarConfig.labelWidth || 45;
        colorbarSpace = colorbarThickness + colorbarPadding + colorbarLabelWidth;
    }

    // Calculate base drawing area (reduce width for colorbar)
    var baseDrawingArea = {
        x: padding.left,
        y: padding.top,
        width: width - padding.left - padding.right - colorbarSpace,
        height: height - padding.top - padding.bottom,
        margins: {
            left: padding.left,
            right: padding.right + colorbarSpace,
            top: padding.top,
            bottom: padding.bottom
        }
    };

    // Get full data range from contour result
    var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
    var fullRange = getFullRange(pathInfo);

    // Apply aspect ratio adjustment if needed
    var aspectRatio = style.aspectRatio || 'auto';
    var drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, aspectRatio);

    // Create view state manager
    var viewState = require('../../interaction/view_state');
    var viewManager = viewState.createViewManager(fullRange, {
        minZoom: interactionConfig.minZoom || 0.1,
        maxZoom: interactionConfig.maxZoom || 10
    });

    // Store state
    var currentStyle = Object.assign({}, style);
    var hasAxes = currentStyle.axes !== undefined && currentStyle.axes !== null;
    var currentAspectRatio = aspectRatio;

    // Store state for overlay access
    var _overlay = null;
    var _fullRange = fullRange;
    var _drawingArea = drawingArea;

    // Store original data for dynamic updates
    var _gridData = {
        z: style.z,
        x: style.x,
        y: style.y
    };
    var _computeOptions = {
        autocontour: style.autocontour !== false,
        ncontours: style.ncontours || 15,
        smoothing: style.smoothing !== undefined ? style.smoothing : 0.5,
        start: style.start,
        end: style.end,
        size: style.size,
        valueColorMap: style.valueColorMap
    };

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
        var showColorbarInteractive = currentStyle.showColorbar !== false &&
            (currentStyle.colorbar === undefined || currentStyle.colorbar === true || currentStyle.colorbar.show !== false);
        if (showColorbarInteractive &&
            (currentStyle.coloring === 'fill' || currentStyle.coloring === 'fill+lines' || currentStyle.coloring === 'heatmap')) {
            drawColorbar(ctx, contourResult, currentStyle);
        }

        // Layer 4: Overlay
        if (_overlay) {
            _overlay.render(ctx);
        }
    }

    // Initial render
    render();

    // Create interaction manager
    var interactionConfig = Object.assign({}, interactionConfig, {
        contourResult: contourResult  // Pass contour result for hover detection
    });
    var interaction = createInteractionManagerInternal(canvas, drawingArea, viewManager, render, interactionConfig);
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

            // Recalculate drawing area if aspectRatio changed
            var newAspectRatio = currentStyle.aspectRatio || 'auto';
            if (newAspectRatio !== currentAspectRatio) {
                currentAspectRatio = newAspectRatio;
                drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
            }

            render();
        },

        resize: function(newWidth, newHeight) {
            width = newWidth;
            height = newHeight;
            canvas.width = width;
            canvas.height = height;

            // Recalculate base drawing area
            baseDrawingArea = {
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

            // Recalculate adjusted drawing area
            drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);

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

        /**
         * Get overlay manager for drawing overlay elements
         * @returns {Object} Overlay system instance
         */
        getOverlay: function() {
            if (!_overlay) {
                // Create renderer-like object for the new overlay system
                var rendererLike = {
                    _fullRange: _fullRange,
                    _drawingArea: drawingArea,
                    getViewManager: function() { return viewManager; },
                    refresh: render
                };
                _overlay = createOverlaySystem(rendererLike);
            }
            return _overlay;
        },

        destroy: function() {
            interaction.destroy();
        },

        render: render,

        // ========================================
        // 数据更新 API
        // ========================================

        /**
         * 更新数据（重新计算等值线）
         * @param {Object} newData - 新数据
         * @param {Array} newData.z - Z 值矩阵
         * @param {Array} [newData.x] - X 坐标数组
         * @param {Array} [newData.y] - Y 坐标数组
         */
        updateData: function(newData) {
            if (!newData) return;

            if (newData.z) _gridData.z = newData.z;
            if (newData.x) _gridData.x = newData.x;
            if (newData.y) _gridData.y = newData.y;

            // 重新计算等值线
            contourResult = compute.computeContours(_gridData, _computeOptions);

            // 更新 pathInfo 和 fullRange
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            fullRange = getFullRange(pathInfo);
            _fullRange = fullRange;

            // 更新 currentStyle 中的数据引用
            currentStyle.z = _gridData.z;
            currentStyle.x = _gridData.x;
            currentStyle.y = _gridData.y;

            // 重新计算绘图区域
            drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
            _drawingArea = drawingArea;

            render();
        },

        /**
         * 更新 ColorScale（重新计算等值线，因为 levels 会变化）
         * @param {Array} valueColorMap - 颜色映射数组 [[value, color], ...]
         */
        updateColorScale: function(valueColorMap) {
            if (!Array.isArray(valueColorMap)) return;

            _computeOptions.valueColorMap = valueColorMap;
            currentStyle.valueColorMap = valueColorMap;

            // 重新计算等值线（levels 会根据 valueColorMap 变化）
            contourResult = compute.computeContours(_gridData, _computeOptions);

            // 更新 pathInfo
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];

            render();
        },

        /**
         * 更新 ColorBar
         * @param {Object} config - ColorBar 配置
         * @param {Array} [config.valueColorMap] - 颜色映射数组
         * @param {string} [config.title] - 标题
         * @param {number} [config.thickness] - 厚度
         * @param {string} [config.position] - 位置 ('left' | 'right')
         * @param {number} [config.tickInterval] - 刻度间隔
         */
        updateColorbar: function(config) {
            if (!config) return;

            // 如果提供了新的 valueColorMap，需要重新计算等值线
            if (config.valueColorMap && Array.isArray(config.valueColorMap)) {
                _computeOptions.valueColorMap = config.valueColorMap;
                currentStyle.valueColorMap = config.valueColorMap;
                contourResult = compute.computeContours(_gridData, _computeOptions);
                pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            }

            // 更新 colorbar 配置
            if (!currentStyle.colorbar) {
                currentStyle.colorbar = {};
            }
            Object.assign(currentStyle.colorbar, config);

            render();
        },

        /**
         * 更新等值线参数（重新计算）
         * @param {Object} options - 等值线参数
         * @param {number} [options.smoothing] - 平滑度 0-1
         * @param {boolean} [options.autocontour] - 是否自动计算等值线
         * @param {number} [options.ncontours] - 等值线数量
         * @param {number} [options.start] - 起始值
         * @param {number} [options.end] - 结束值
         * @param {number} [options.size] - 步长
         */
        updateContours: function(options) {
            if (!options) return;

            if (options.smoothing !== undefined) _computeOptions.smoothing = options.smoothing;
            if (options.autocontour !== undefined) _computeOptions.autocontour = options.autocontour;
            if (options.ncontours !== undefined) _computeOptions.ncontours = options.ncontours;
            if (options.start !== undefined) _computeOptions.start = options.start;
            if (options.end !== undefined) _computeOptions.end = options.end;
            if (options.size !== undefined) _computeOptions.size = options.size;

            // 重新计算等值线
            contourResult = compute.computeContours(_gridData, _computeOptions);

            // 更新 pathInfo 和 fullRange
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            fullRange = getFullRange(pathInfo);
            _fullRange = fullRange;

            // 更新 currentStyle
            currentStyle.smoothing = _computeOptions.smoothing;

            render();
        },

        /**
         * 批量更新（智能合并）
         * @param {Object} config - 配置对象
         * @param {Object} [config.data] - 数据更新
         * @param {Array} [config.colorScale] - 颜色映射
         * @param {Object} [config.contours] - 等值线参数
         * @param {Object} [config.colorbar] - ColorBar 配置
         */
        update: function(config) {
            if (!config) return;

            // 数据更新
            if (config.data) {
                if (config.data.z) _gridData.z = config.data.z;
                if (config.data.x) _gridData.x = config.data.x;
                if (config.data.y) _gridData.y = config.data.y;
            }

            // ColorScale 更新
            if (config.colorScale && Array.isArray(config.colorScale)) {
                _computeOptions.valueColorMap = config.colorScale;
                currentStyle.valueColorMap = config.colorScale;
            }

            // 等值线参数更新
            if (config.contours) {
                var opts = config.contours;
                if (opts.smoothing !== undefined) _computeOptions.smoothing = opts.smoothing;
                if (opts.autocontour !== undefined) _computeOptions.autocontour = opts.autocontour;
                if (opts.ncontours !== undefined) _computeOptions.ncontours = opts.ncontours;
                if (opts.start !== undefined) _computeOptions.start = opts.start;
                if (opts.end !== undefined) _computeOptions.end = opts.end;
                if (opts.size !== undefined) _computeOptions.size = opts.size;
            }

            // 统一重新计算等值线
            contourResult = compute.computeContours(_gridData, _computeOptions);

            // 更新 pathInfo 和 fullRange
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            fullRange = getFullRange(pathInfo);
            _fullRange = fullRange;

            // 更新 currentStyle
            currentStyle.z = _gridData.z;
            currentStyle.x = _gridData.x;
            currentStyle.y = _gridData.y;
            currentStyle.smoothing = _computeOptions.smoothing;

            // ColorBar 更新
            if (config.colorbar) {
                if (!currentStyle.colorbar) {
                    currentStyle.colorbar = {};
                }
                Object.assign(currentStyle.colorbar, config.colorbar);
            }

            // 重新计算绘图区域
            drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
            _drawingArea = drawingArea;

            render();
        },

        /**
         * 获取当前数据
         * @returns {Object} 数据对象 { z, x, y }
         */
        getData: function() {
            return {
                z: _gridData.z,
                x: _gridData.x,
                y: _gridData.y
            };
        },

        /**
         * 获取当前 ColorScale
         * @returns {Array} valueColorMap
         */
        getColorScale: function() {
            return currentStyle.valueColorMap;
        }
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
    // Include drawArea for correct coordinate transformation with aspect ratio
    var renderStyle = Object.assign({}, style, {
        visibleRange: visibleRange,
        fullRange: fullRange,
        drawArea: drawArea,  // Pass drawArea for scalePoint to use
        width: drawArea.width + 2 * drawArea.margins.left,
        height: drawArea.height + 2 * drawArea.margins.top,
        padding: drawArea.x,  // Keep for backward compatibility
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
        // Include anti-aliasing options from style
        var clipPathData = nullHandling.generateClipPath(contourResult, {
            useDataCoordinates: true,
            dataX: pathInfo ? pathInfo.x : null,
            dataY: pathInfo ? pathInfo.y : null,
            // Anti-aliasing options
            smoothingMethod: style.smoothingMethod,
            upsampleScale: style.upsampleScale,
            clipLevel: style.clipLevel,
            clipSmoothing: style.clipSmoothing,
            simplifyTolerance: style.simplifyTolerance
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

    // Hover configuration
    var hoverEnabled = config.hover === true;
    var hoverHitRadius = config.hoverHitRadius || 8;
    var contourResult = config.contourResult;
    var hoverFormatter = config.hoverFormatter;  // Custom formatter function
    var tooltipElement = null;

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

            // Hover detection for contour lines
            if (hoverEnabled && contourResult) {
                var hoverData = detectContourAtPosition(pos.x, pos.y);
                if (hoverData) {
                    showTooltip(pos.x, pos.y, hoverData);
                } else {
                    hideTooltip();
                }
            }
        } else {
            canvas.style.cursor = 'default';
            hideTooltip();
        }
    }

    /**
     * Detect contour line at given pixel position
     */
    function detectContourAtPosition(px, py) {
        if (!contourResult || !contourResult.paths) return null;

        var paths = contourResult.paths;
        var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
        if (!pathInfo) return null;

        // Get visible range
        var state = viewManager.getState();
        var xMin = state.xMin;
        var xMax = state.xMax;
        var yMin = state.yMin;
        var yMax = state.yMax;
        var xRange = xMax - xMin || 1;
        var yRange = yMax - yMin || 1;

        // Check each contour level
        for (var i = 0; i < paths.length; i++) {
            var pathData = paths[i];
            var level = pathData.level;

            // Check all paths (both closed and edge paths)
            var allPaths = (pathData.paths || []).concat(pathData.edgepaths || []);

            for (var j = 0; j < allPaths.length; j++) {
                var path = allPaths[j];
                if (!path || path.length < 2) continue;

                // Check each line segment
                for (var k = 0; k < path.length - 1; k++) {
                    var p1 = path[k];
                    var p2 = path[k + 1];

                    // Convert data coordinates to pixel coordinates
                    var px1 = drawingArea.x + (p1[0] - xMin) / xRange * drawingArea.width;
                    var py1 = drawingArea.y + drawingArea.height - (p1[1] - yMin) / yRange * drawingArea.height;
                    var px2 = drawingArea.x + (p2[0] - xMin) / xRange * drawingArea.width;
                    var py2 = drawingArea.y + drawingArea.height - (p2[1] - yMin) / yRange * drawingArea.height;

                    // Calculate distance from point to line segment
                    var dist = pointToSegmentDistance(px, py, px1, py1, px2, py2);

                    if (dist <= hoverHitRadius) {
                        // Convert pixel back to data coordinates for tooltip
                        var dataX = xMin + (px - drawingArea.x) / drawingArea.width * xRange;
                        var dataY = yMin + (1 - (py - drawingArea.y) / drawingArea.height) * yRange;

                        return {
                            level: level,
                            x: dataX,
                            y: dataY,
                            distance: dist
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Calculate distance from point to line segment
     */
    function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            // Segment is a point
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }

        // Calculate projection of point onto line
        var t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));

        // Calculate closest point on segment
        var projX = x1 + t * dx;
        var projY = y1 + t * dy;

        // Return distance
        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }

    /**
     * Show tooltip at position
     */
    function showTooltip(px, py, hoverData) {
        if (!tooltipElement) {
            tooltipElement = document.createElement('div');
            tooltipElement.className = 'contour-hover-tooltip';
            tooltipElement.style.cssText = [
                'position: absolute',
                'pointer-events: none',
                'display: none',
                'background: rgba(255, 255, 255, 0.95)',
                'border: 1px solid #333',
                'border-radius: 4px',
                'padding: 8px 12px',
                'font-size: 12px',
                'font-family: Arial, sans-serif',
                'color: #333',
                'white-space: nowrap',
                'box-shadow: 0 2px 8px rgba(0,0,0,0.2)',
                'z-index: 10000'
            ].join(';');
            document.body.appendChild(tooltipElement);
        }

        // Format tooltip content - use custom formatter or default
        var content;
        if (hoverFormatter && typeof hoverFormatter === 'function') {
            content = hoverFormatter(hoverData);
        } else {
            // Default formatter
            content = '<strong>值:</strong> ' + hoverData.level.toFixed(2);
            if (hoverData.x !== undefined && hoverData.y !== undefined) {
                content += '<br><strong>X:</strong> ' + hoverData.x.toFixed(4);
                content += '<br><strong>Y:</strong> ' + hoverData.y.toFixed(4);
            }
        }

        tooltipElement.innerHTML = content;
        tooltipElement.style.display = 'block';

        // Position tooltip near cursor
        var canvasRect = canvas.getBoundingClientRect();
        var tooltipX = canvasRect.left + px + 10;
        var tooltipY = canvasRect.top + py + 5;

        // Keep tooltip within viewport
        if (tooltipX + 150 > window.innerWidth) {
            tooltipX = canvasRect.left + px - 160;
        }
        // if (tooltipY < 5) {
        //     tooltipY = canvasRect.top + py + 10;
        // }

        tooltipElement.style.left = tooltipX + 'px';
        tooltipElement.style.top = tooltipY + 'px';
    }

    /**
     * Hide tooltip
     */
    function hideTooltip() {
        if (tooltipElement) {
            tooltipElement.style.display = 'none';
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
        // Clean up tooltip
        if (tooltipElement) {
            tooltipElement.parentNode.removeChild(tooltipElement);
            tooltipElement = null;
        }
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
