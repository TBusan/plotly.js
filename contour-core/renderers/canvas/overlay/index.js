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
    return 'overlay_' + Date.now() + '_' + this._idCounter;
};

/**
 * Convert data coordinates to canvas coordinates
 * @param {number} x - Data x coordinate
 * @param {number} y - Data y coordinate
 * @returns {Object} Canvas coordinates {x, y}
 */
Overlay.prototype._toCanvasCoords = function(x, y) {
    if (!this._renderer) {
        return { x: x, y: y };
    }

    var fullRange = this._renderer._fullRange;
    var drawingArea = this._renderer._drawingArea;

    if (!fullRange || !drawingArea) {
        return { x: x, y: y };
    }

    var xScale = drawingArea.width / (fullRange.xMax - fullRange.xMin);
    var yScale = drawingArea.height / (fullRange.yMax - fullRange.yMin);

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

    var fullRange = this._renderer._fullRange;
    var drawingArea = this._renderer._drawingArea;

    if (!fullRange || !drawingArea) {
        return { xScale: 1, yScale: 1 };
    }

    var xScale = drawingArea.width / (fullRange.xMax - fullRange.xMin);
    var yScale = drawingArea.height / (fullRange.yMax - fullRange.yMin);

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
    var item = {
        id: id,
        points: points || [],
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
    var item = {
        id: id,
        points: points || [],
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
