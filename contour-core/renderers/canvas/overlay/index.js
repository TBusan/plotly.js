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
        console.log('[Overlay] _toCanvasCoords: no renderer, returning raw coords');
        return { x: x, y: y };
    }

    // Support both direct values and getter functions
    var fullRange = typeof this._renderer._fullRange === 'function'
        ? this._renderer._fullRange()
        : this._renderer._fullRange;
    var drawingArea = typeof this._renderer._drawingArea === 'function'
        ? this._renderer._drawingArea()
        : this._renderer._drawingArea;

    console.log('[Overlay] _toCanvasCoords:');
    console.log('  Input (x, y):', x, y);
    console.log('  fullRange:', JSON.stringify(fullRange));
    console.log('  drawingArea:', JSON.stringify(drawingArea));

    if (!fullRange || !drawingArea) {
        console.log('  Missing fullRange or drawingArea, returning raw coords');
        return { x: x, y: y };
    }

    // Protect against division by zero
    var xRange = fullRange.xMax - fullRange.xMin;
    var yRange = fullRange.yMax - fullRange.yMin;

    // If range is zero, use default scale of 1
    var xScale = xRange !== 0 ? drawingArea.width / xRange : 1;
    var yScale = yRange !== 0 ? drawingArea.height / yRange : 1;

    var canvasX = drawingArea.x + (x - fullRange.xMin) * xScale;
    var canvasY = drawingArea.y + drawingArea.height - (y - fullRange.yMin) * yScale;

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
};

/**
 * Trigger a refresh/redraw of the parent renderer
 */
Overlay.prototype.refresh = function() {
    if (this._renderer && typeof this._renderer.refresh === 'function') {
        this._renderer.refresh();
    }
};

module.exports = Overlay;
