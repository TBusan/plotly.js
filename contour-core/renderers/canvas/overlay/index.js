'use strict';

/**
 * Overlay manager for contour-core
 * Supports drawing text, points, lines, and polygons on contour plots
 */

var textRenderer = require('./text');
var pointRenderer = require('./point');
var lineRenderer = require('./line');
var polygonRenderer = require('./polygon');

/**
 * Overlay Manager constructor
 * @param {Object} renderer - The parent canvas renderer
 */
function Overlay(renderer) {
    this._renderer = renderer;

    // Storage for different graphic types
    this._texts = [];
    this._points = [];
    this._lines = [];
    this._polygons = [];

    // ID counter for unique identifiers
    this._idCounter = 0;

    // Interactive drawing state
    this._drawMode = null;  // 'point', 'line', 'polygon', 'text', null
    this._tempPoints = [];  // Temporary points for line/polygon drawing
    this._drawOptions = {};  // Options for current drawing operation
    this._eventHandlers = {};  // Bound event handlers
    this._canvas = null;  // Canvas element reference
    this._onDrawComplete = null;  // Callback when drawing is complete
    this._currentMousePos = null;  // Current mouse position for preview
}

/**
 * Generate a unique ID for overlay items
 * @returns {string} Unique identifier
 */
Overlay.prototype._generateId = function() {
    this._idCounter++;
    // Use timestamp + random number + counter for more reliable uniqueness
    var timestamp = Date.now().toString(36);
    var randomPart = Math.random().toString(36).substring(2, 10);
    var counter = this._idCounter.toString(36);
    return 'overlay_' + timestamp + '_' + randomPart + '_' + counter;
};

/**
 * Check if a value is a valid number
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a valid finite number
 */
Overlay.prototype._isValidNumber = function(value) {
    return typeof value === 'number' && isFinite(value) && !isNaN(value);
};

/**
 * Validate points array - check if each point has valid x and y coordinates
 * Supports both object format {x, y} and array format [x, y]
 * @param {Array} points - Array of points (either {x, y} or [x, y] format)
 * @returns {Array} Filtered array with only valid points (normalized to {x, y} format)
 */
Overlay.prototype._filterValidPoints = function(points) {
    if (!Array.isArray(points)) {
        return [];
    }
    return points.filter(function(point) {
        if (!point) return false;

        // Support both {x, y} object format and [x, y] array format
        var x, y;
        if (Array.isArray(point)) {
            x = point[0];
            y = point[1];
        } else {
            x = point.x;
            y = point.y;
        }

        return this._isValidNumber(x) && this._isValidNumber(y);
    }.bind(this));
};

/**
 * Convert data coordinates to canvas coordinates
 * Uses visibleRange for proper coordinate transformation during zoom/pan
 * @param {number} x - Data x coordinate
 * @param {number} y - Data y coordinate
 * @returns {Object} Canvas coordinates {x, y} or null if input is invalid
 */
Overlay.prototype._toCanvasCoords = function(x, y) {
    // Validate input coordinates
    if (!this._isValidNumber(x) || !this._isValidNumber(y)) {
        return null;
    }

    if (!this._renderer) {
        return { x: x, y: y };
    }

    // Get drawing area
    var drawingArea = typeof this._renderer._drawingArea === 'function'
        ? this._renderer._drawingArea()
        : this._renderer._drawingArea;

    if (!drawingArea) {
        return { x: x, y: y };
    }

    // Get visible range from view manager (for zoom/pan support)
    // Fall back to fullRange if view manager is not available
    var visibleRange;
    if (this._renderer.getViewManager) {
        var viewManager = this._renderer.getViewManager();
        if (viewManager && viewManager.getState) {
            visibleRange = viewManager.getState();
        }
    }

    // Fall back to fullRange if no visible range
    if (!visibleRange) {
        visibleRange = typeof this._renderer._fullRange === 'function'
            ? this._renderer._fullRange()
            : this._renderer._fullRange;
    }

    if (!visibleRange) {
        return { x: x, y: y };
    }

    // Protect against division by zero
    var xRange = visibleRange.xMax - visibleRange.xMin;
    var yRange = visibleRange.yMax - visibleRange.yMin;

    // If range is zero, use default scale of 1
    var xScale = xRange !== 0 ? drawingArea.width / xRange : 1;
    var yScale = yRange !== 0 ? drawingArea.height / yRange : 1;

    var canvasX = drawingArea.x + (x - visibleRange.xMin) * xScale;
    var canvasY = drawingArea.y + drawingArea.height - (y - visibleRange.yMin) * yScale;

    return { x: canvasX, y: canvasY };
};

/**
 * Get current scale ratio
 * @returns {Object} Scale information {xScale, yScale}
 */
Overlay.prototype._getScale = function() {
    if (!this._renderer) {
        return { xScale: 1, yScale: 1 };
    }

    // Support both direct values and getter functions
    var fullRange = typeof this._renderer._fullRange === 'function'
        ? this._renderer._fullRange()
        : this._renderer._fullRange;
    var drawingArea = typeof this._renderer._drawingArea === 'function'
        ? this._renderer._drawingArea()
        : this._renderer._drawingArea;

    if (!fullRange || !drawingArea) {
        return { xScale: 1, yScale: 1 };
    }

    // Protect against division by zero
    var xRange = fullRange.xMax - fullRange.xMin;
    var yRange = fullRange.yMax - fullRange.yMin;

    // If range is zero, use default scale of 1
    var xScale = xRange !== 0 ? drawingArea.width / xRange : 1;
    var yScale = yRange !== 0 ? drawingArea.height / yRange : 1;

    return { xScale: xScale, yScale: yScale };
};

/**
 * Draw text at specified position
 * @param {number} x - X coordinate (data coordinates)
 * @param {number} y - Y coordinate (data coordinates)
 * @param {string} content - Text content
 * @param {Object} options - Text options (font, color, size, align, etc.)
 * @returns {string} Item ID
 */
Overlay.prototype.drawText = function(x, y, content, options) {
    var id = this._generateId();
    var item = {
        id: id,
        x: x,
        y: y,
        content: content,
        options: options || {}
    };
    this._texts.push(item);
    this.refresh();
    return id;
};

/**
 * Draw a point at specified position
 * @param {number} x - X coordinate (data coordinates)
 * @param {number} y - Y coordinate (data coordinates)
 * @param {Object} options - Point options (color, size, shape, etc.)
 * @returns {string} Item ID
 */
Overlay.prototype.drawPoint = function(x, y, options) {
    var id = this._generateId();
    var item = {
        id: id,
        x: x,
        y: y,
        options: options || {}
    };
    this._points.push(item);
    this.refresh();
    return id;
};

/**
 * Draw a line through multiple points
 * @param {Array} points - Array of {x, y} points (data coordinates)
 * @param {Object} options - Line options (color, width, dash, etc.)
 * @returns {string} Item ID
 */
Overlay.prototype.drawLine = function(points, options) {
    var id = this._generateId();
    // Filter out invalid points
    var validPoints = this._filterValidPoints(points);
    var item = {
        id: id,
        points: validPoints,
        options: options || {}
    };
    this._lines.push(item);
    this.refresh();
    return id;
};

/**
 * Draw a polygon (filled area)
 * @param {Array} points - Array of {x, y} points (data coordinates)
 * @param {Object} options - Polygon options (fillColor, strokeColor, strokeWidth, etc.)
 * @returns {string} Item ID
 */
Overlay.prototype.drawPolygon = function(points, options) {
    var id = this._generateId();
    // Filter out invalid points
    var validPoints = this._filterValidPoints(points);
    var item = {
        id: id,
        points: validPoints,
        options: options || {}
    };
    this._polygons.push(item);
    this.refresh();
    return id;
};

/**
 * Clear overlay items
 * @param {string} type - Optional type to clear ('text', 'point', 'line', 'polygon').
 *                        If not specified, clears all types.
 */
Overlay.prototype.clear = function(type) {
    if (!type) {
        // Clear all
        this._texts = [];
        this._points = [];
        this._lines = [];
        this._polygons = [];
    } else {
        switch (type) {
            case 'text':
                this._texts = [];
                break;
            case 'point':
                this._points = [];
                break;
            case 'line':
                this._lines = [];
                break;
            case 'polygon':
                this._polygons = [];
                break;
        }
    }
    this.refresh();
};

/**
 * Render all overlay items
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 */
Overlay.prototype.render = function(ctx) {
    // Render in order: polygons (bottom), lines, points, text (top)
    polygonRenderer.render(ctx, this._polygons, this);
    lineRenderer.render(ctx, this._lines, this);
    pointRenderer.render(ctx, this._points, this);
    textRenderer.render(ctx, this._texts, this);

    // Render temporary drawing elements
    this._renderTempElements(ctx);
};

/**
 * Render temporary elements during drawing
 * @private
 */
Overlay.prototype._renderTempElements = function(ctx) {
    if (!this._drawMode || this._tempPoints.length === 0) return;

    ctx.save();

    if (this._drawMode === 'line' && this._tempPoints.length >= 1) {
        this._renderTempLine(ctx);
    } else if (this._drawMode === 'polygon' && this._tempPoints.length >= 1) {
        this._renderTempPolygon(ctx);
    }

    ctx.restore();
};

/**
 * Render temporary line during drawing
 * @private
 */
Overlay.prototype._renderTempLine = function(ctx) {
    if (this._tempPoints.length < 1) return;

    var self = this;
    var points = this._tempPoints.slice();

    // Add current mouse position if available
    if (this._currentMousePos) {
        points.push(this._currentMousePos);
    }

    // Convert all points to canvas coordinates
    var canvasPoints = points.map(function(p) {
        return self._toCanvasCoords(p[0], p[1]);
    }).filter(function(p) {
        return p !== null;
    });

    if (canvasPoints.length < 2) return;

    // Draw the temporary line
    ctx.beginPath();
    ctx.strokeStyle = this._drawOptions.color || '#0066ff';
    ctx.lineWidth = this._drawOptions.width || 2;
    ctx.setLineDash([5, 5]); // Dashed line for preview

    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (var i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
    }

    ctx.stroke();

    // Draw point markers at each vertex
    canvasPoints.forEach(function(p) {
        ctx.beginPath();
        ctx.fillStyle = self._drawOptions.color || '#0066ff';
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
};

/**
 * Render temporary polygon during drawing
 * @private
 */
Overlay.prototype._renderTempPolygon = function(ctx) {
    if (this._tempPoints.length < 1) return;

    var self = this;
    var points = this._tempPoints.slice();

    // Add current mouse position if available
    if (this._currentMousePos) {
        points.push(this._currentMousePos);
    }

    // Convert all points to canvas coordinates
    var canvasPoints = points.map(function(p) {
        return self._toCanvasCoords(p[0], p[1]);
    }).filter(function(p) {
        return p !== null;
    });

    if (canvasPoints.length < 2) return;

    // Draw the temporary polygon
    ctx.beginPath();
    ctx.strokeStyle = this._drawOptions.stroke && this._drawOptions.stroke.color || '#008800';
    ctx.lineWidth = this._drawOptions.stroke && this._drawOptions.stroke.width || 2;
    ctx.setLineDash([5, 5]);

    // Fill with semi-transparent color
    var fillHex = this._drawOptions.fill && this._drawOptions.fill.color || 'rgba(0,255,0,0.3)';
    ctx.fillStyle = fillHex;

    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (var i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
    }

    // Close the path for polygon
    if (canvasPoints.length >= 3) {
        ctx.closePath();
        ctx.fill();
    }

    ctx.stroke();

    // Draw point markers at each vertex
    canvasPoints.forEach(function(p) {
        ctx.beginPath();
        ctx.fillStyle = '#008800';
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
};

/**
 * Trigger a refresh/redraw of the parent renderer
 */
Overlay.prototype.refresh = function() {
    if (this._renderer && typeof this._renderer.refresh === 'function') {
        this._renderer.refresh();
    }
};

/**
 * Convert canvas coordinates to data coordinates
 * @param {number} canvasX - Canvas X coordinate
 * @param {number} canvasY - Canvas Y coordinate
 * @returns {Object|null} Data coordinates {x, y} or null if invalid
 */
Overlay.prototype._toDataCoords = function(canvasX, canvasY) {
    if (!this._isValidNumber(canvasX) || !this._isValidNumber(canvasY)) {
        return null;
    }

    if (!this._renderer) {
        return { x: canvasX, y: canvasY };
    }

    // Get drawing area
    var drawingArea = typeof this._renderer._drawingArea === 'function'
        ? this._renderer._drawingArea()
        : this._renderer._drawingArea;

    if (!drawingArea) {
        return { x: canvasX, y: canvasY };
    }

    // Get visible range
    var visibleRange;
    if (this._renderer.getViewManager) {
        var viewManager = this._renderer.getViewManager();
        if (viewManager && viewManager.getState) {
            visibleRange = viewManager.getState();
        }
    }

    if (!visibleRange) {
        visibleRange = typeof this._renderer._fullRange === 'function'
            ? this._renderer._fullRange()
            : this._renderer._fullRange;
    }

    if (!visibleRange) {
        return { x: canvasX, y: canvasY };
    }

    // Calculate scale
    var xRange = visibleRange.xMax - visibleRange.xMin;
    var yRange = visibleRange.yMax - visibleRange.yMin;
    var xScale = xRange !== 0 ? drawingArea.width / xRange : 1;
    var yScale = yRange !== 0 ? drawingArea.height / yRange : 1;

    // Convert to data coordinates
    var dataX = visibleRange.xMin + (canvasX - drawingArea.x) / xScale;
    var dataY = visibleRange.yMin + (drawingArea.y + drawingArea.height - canvasY) / yScale;

    return { x: dataX, y: dataY };
};

/**
 * Check if a canvas position is within the drawing area
 * @param {number} canvasX - Canvas X coordinate
 * @param {number} canvasY - Canvas Y coordinate
 * @returns {boolean} True if within drawing area
 */
Overlay.prototype._isInDrawingArea = function(canvasX, canvasY) {
    var drawingArea = typeof this._renderer._drawingArea === 'function'
        ? this._renderer._drawingArea()
        : this._renderer._drawingArea;

    if (!drawingArea) return true;

    return canvasX >= drawingArea.x &&
           canvasX <= drawingArea.x + drawingArea.width &&
           canvasY >= drawingArea.y &&
           canvasY <= drawingArea.y + drawingArea.height;
};

/**
 * Start interactive drawing mode
 * @param {string} mode - Drawing mode: 'point', 'line', 'polygon', 'text'
 * @param {Object} options - Drawing options
 * @param {HTMLCanvasElement} canvas - Canvas element to attach events
 * @param {Function} onComplete - Callback when drawing is complete (receives item ID)
 */
Overlay.prototype.startDrawing = function(mode, options, canvas, onComplete) {
    this.stopDrawing();  // Stop any existing drawing mode

    this._drawMode = mode;
    this._drawOptions = options || {};
    this._tempPoints = [];
    this._canvas = canvas;
    this._onDrawComplete = onComplete;

    this._bindDrawEvents();
};

/**
 * Stop interactive drawing mode
 */
Overlay.prototype.stopDrawing = function() {
    this._unbindDrawEvents();
    this._drawMode = null;
    this._tempPoints = [];
    this._canvas = null;
    this._onDrawComplete = null;
};

/**
 * Bind mouse/touch events for drawing
 * @private
 */
Overlay.prototype._bindDrawEvents = function() {
    if (!this._canvas) return;

    var self = this;

    this._eventHandlers.click = function(e) {
        self._handleDrawClick(e);
    };

    this._eventHandlers.dblclick = function(e) {
        self._handleDrawDblClick(e);
    };

    this._eventHandlers.mousemove = function(e) {
        self._handleDrawMouseMove(e);
    };

    this._eventHandlers.keydown = function(e) {
        self._handleDrawKeyDown(e);
    };

    this._canvas.addEventListener('click', this._eventHandlers.click);
    this._canvas.addEventListener('dblclick', this._eventHandlers.dblclick);
    this._canvas.addEventListener('mousemove', this._eventHandlers.mousemove);
    document.addEventListener('keydown', this._eventHandlers.keydown);
};

/**
 * Unbind mouse/touch events
 * @private
 */
Overlay.prototype._unbindDrawEvents = function() {
    if (this._canvas) {
        this._canvas.removeEventListener('click', this._eventHandlers.click);
        this._canvas.removeEventListener('dblclick', this._eventHandlers.dblclick);
        this._canvas.removeEventListener('mousemove', this._eventHandlers.mousemove);
    }
    document.removeEventListener('keydown', this._eventHandlers.keydown);
    this._eventHandlers = {};
};

/**
 * Handle click during drawing
 * @private
 */
Overlay.prototype._handleDrawClick = function(e) {
    var rect = this._canvas.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;

    if (!this._isInDrawingArea(canvasX, canvasY)) return;

    var dataCoords = this._toDataCoords(canvasX, canvasY);
    if (!dataCoords) return;

    switch (this._drawMode) {
        case 'point':
            this._completePointDrawing(dataCoords);
            break;
        case 'line':
        case 'polygon':
            this._tempPoints.push([dataCoords.x, dataCoords.y]);
            this._showTempFeedback();
            break;
        case 'text':
            this._completeTextDrawing(dataCoords);
            break;
    }
};

/**
 * Handle double-click during drawing (complete line/polygon)
 * @private
 */
Overlay.prototype._handleDrawDblClick = function(e) {
    if (this._drawMode === 'line' || this._drawMode === 'polygon') {
        this._completeMultiPointDrawing();
    }
};

/**
 * Handle mouse move during drawing
 * @private
 */
Overlay.prototype._handleDrawMouseMove = function(e) {
    if (this._drawMode !== 'line' && this._drawMode !== 'polygon') return;
    if (this._tempPoints.length === 0) return;

    var rect = this._canvas.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;

    if (!this._isInDrawingArea(canvasX, canvasY)) return;

    var dataCoords = this._toDataCoords(canvasX, canvasY);
    if (!dataCoords) return;

    this._showTempFeedback(dataCoords);
};

/**
 * Handle key down during drawing
 * @private
 */
Overlay.prototype._handleDrawKeyDown = function(e) {
    // Escape key cancels drawing
    if (e.key === 'Escape') {
        this.stopDrawing();
    }
    // Enter key completes line/polygon
    if (e.key === 'Enter' && (this._drawMode === 'line' || this._drawMode === 'polygon')) {
        this._completeMultiPointDrawing();
    }
};

/**
 * Complete point drawing
 * @private
 */
Overlay.prototype._completePointDrawing = function(dataCoords) {
    var id = this.drawPoint(dataCoords.x, dataCoords.y, this._drawOptions);

    if (this._onDrawComplete) {
        this._onDrawComplete({ type: 'point', id: id, x: dataCoords.x, y: dataCoords.y });
    }

    this.stopDrawing();
};

/**
 * Complete text drawing
 * @private
 */
Overlay.prototype._completeTextDrawing = function(dataCoords) {
    // Support both 'text' and 'content' properties
    var text = this._drawOptions.text || this._drawOptions.content || '';
    if (!text) {
        this.stopDrawing();
        return;
    }

    var textOptions = Object.assign({}, this._drawOptions);
    delete textOptions.text;
    delete textOptions.content;

    var id = this.drawText(dataCoords.x, dataCoords.y, text, textOptions);

    if (this._onDrawComplete) {
        this._onDrawComplete({ type: 'text', id: id, x: dataCoords.x, y: dataCoords.y, text: text });
    }

    this.stopDrawing();
};

/**
 * Complete line or polygon drawing
 * @private
 */
Overlay.prototype._completeMultiPointDrawing = function() {
    if (this._tempPoints.length < 2) {
        this.stopDrawing();
        return;
    }

    var id;
    if (this._drawMode === 'line') {
        id = this.drawLine(this._tempPoints, this._drawOptions);
        if (this._onDrawComplete) {
            this._onDrawComplete({ type: 'line', id: id, points: this._tempPoints.slice() });
        }
    } else if (this._drawMode === 'polygon') {
        if (this._tempPoints.length >= 3) {
            id = this.drawPolygon(this._tempPoints, this._drawOptions);
            if (this._onDrawComplete) {
                this._onDrawComplete({ type: 'polygon', id: id, points: this._tempPoints.slice() });
            }
        }
    }

    this.stopDrawing();
};

/**
 * Show temporary visual feedback during drawing
 * @private
 */
Overlay.prototype._showTempFeedback = function(currentPos) {
    // Store current mouse position for rendering
    if (currentPos) {
        this._currentMousePos = [currentPos.x, currentPos.y];
    } else {
        this._currentMousePos = null;
    }

    // Trigger a refresh to render temporary elements
    this.refresh();
};

/**
 * Get current drawing mode
 * @returns {string|null} Current drawing mode or null
 */
Overlay.prototype.getDrawMode = function() {
    return this._drawMode;
};

/**
 * Check if currently drawing
 * @returns {boolean} True if in drawing mode
 */
Overlay.prototype.isDrawing = function() {
    return this._drawMode !== null;
};

/**
 * Get temporary points for current drawing (useful for UI feedback)
 * @returns {Array} Array of temporary points
 */
Overlay.prototype.getTempPoints = function() {
    return this._tempPoints.slice();
};

/**
 * Set draw complete callback
 * @param {Function} callback - Callback function to be called when drawing completes
 */
Overlay.prototype.onDrawComplete = function(callback) {
    this._drawCompleteCallback = callback;
};

/**
 * Set drawing options (can be called during drawing to update options)
 * @param {Object} options - New drawing options
 */
Overlay.prototype.setDrawOptions = function(options) {
    if (options) {
        this._drawOptions = Object.assign({}, this._drawOptions, options);
    }
};

/**
 * Get the canvas element currently being used for drawing
 * @returns {HTMLCanvasElement|null} Canvas element or null
 */
Overlay.prototype.getCanvas = function() {
    return this._canvas;
};

/**
 * Convert data coordinates to canvas coordinates (public method)
 * @param {number} x - Data x coordinate
 * @param {number} y - Data y coordinate
 * @returns {Object|null} Canvas coordinates {x, y} or null if invalid
 */
Overlay.prototype.dataToCanvas = function(x, y) {
    return this._toCanvasCoords(x, y);
};

/**
 * Convert canvas coordinates to data coordinates (public method)
 * @param {number} canvasX - Canvas x coordinate
 * @param {number} canvasY - Canvas y coordinate
 * @returns {Object|null} Data coordinates {x, y} or null if invalid
 */
Overlay.prototype.canvasToData = function(canvasX, canvasY) {
    return this._toDataCoords(canvasX, canvasY);
};

module.exports = Overlay;
