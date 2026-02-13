'use strict';

/**
 * CoordinateConverter - Bidirectional coordinate conversion for contour-core
 *
 * Responsibilities:
 * 1. Data coordinates ↔ Screen coordinates conversion
 * 2. Account for current zoom and pan state
 * 3. Support different axis types (linear, log - future)
 */

/**
 * CoordinateConverter constructor
 * @param {Object} options - Configuration options
 */
function CoordinateConverter(options) {
    options = options || {};

    // Data bounds (in data coordinate space)
    this.dataBounds = {
        xMin: options.xMin !== undefined ? options.xMin : 0,
        xMax: options.xMax !== undefined ? options.xMax : 100,
        yMin: options.yMin !== undefined ? options.yMin : 0,
        yMax: options.yMax !== undefined ? options.yMax : 100
    };

    // Screen dimensions (in pixels)
    this.screenSize = {
        width: options.width || 600,
        height: options.height || 500
    };

    // Margins for axes/labels
    this.margins = options.margins || {
        left: 50,
        right: 30,
        top: 20,
        bottom: 50
    };

    // Plot area (excluding margins)
    this.plotArea = {
        x: this.margins.left,
        y: this.margins.top,
        width: this.screenSize.width - this.margins.left - this.margins.right,
        height: this.screenSize.height - this.margins.top - this.margins.bottom
    };

    // Current view range (in data coordinates)
    this.viewRange = {
        xMin: this.dataBounds.xMin,
        xMax: this.dataBounds.xMax,
        yMin: this.dataBounds.yMin,
        yMax: this.dataBounds.yMax
    };

    // Transform (from zoom/pan)
    this.transform = {
        k: 1,  // scale
        x: 0,  // x translation
        y: 0   // y translation
    };

    // Axis types (currently only linear supported)
    this.axisTypes = {
        x: options.xType || 'linear',
        y: options.yType || 'linear'
    };
}

/**
 * Update view range and transform
 * @param {Object} view - View range {xMin, xMax, yMin, yMax}
 * @param {Object} transform - Transform {k, x, y}
 */
CoordinateConverter.prototype.update = function(view, transform) {
    if (view) {
        this.viewRange = {
            xMin: view.xMin,
            xMax: view.xMax,
            yMin: view.yMin,
            yMax: view.yMax
        };
    }

    if (transform) {
        this.transform = {
            k: transform.k,
            x: transform.x,
            y: transform.y
        };
    }
};

/**
 * Update screen dimensions
 * @param {Number} width - Screen width
 * @param {Number} height - Screen height
 */
CoordinateConverter.prototype.updateScreenSize = function(width, height) {
    this.screenSize.width = width;
    this.screenSize.height = height;

    // Recalculate plot area
    this.plotArea = {
        x: this.margins.left,
        y: this.margins.top,
        width: width - this.margins.left - this.margins.right,
        height: height - this.margins.top - this.margins.bottom
    };
};

/**
 * Update margins
 * @param {Object} margins - New margins {left, right, top, bottom}
 */
CoordinateConverter.prototype.updateMargins = function(margins) {
    this.margins = margins || this.margins;

    // Recalculate plot area
    this.plotArea = {
        x: this.margins.left,
        y: this.margins.top,
        width: this.screenSize.width - this.margins.left - this.margins.right,
        height: this.screenSize.height - this.margins.top - this.margins.bottom
    };
};

/**
 * Convert data coordinates to screen coordinates
 * @param {Number} x - Data x coordinate
 * @param {Number} y - Data y coordinate
 * @returns {Object} Screen coordinates {x, y}
 */
CoordinateConverter.prototype.dataToPixel = function(x, y) {
    // First map data to normalized plot area coordinates [0, 1]
    var normX = (x - this.viewRange.xMin) / (this.viewRange.xMax - this.viewRange.xMin);
    var normY = (y - this.viewRange.yMin) / (this.viewRange.yMax - this.viewRange.yMin);

    // Then map to screen coordinates (in plot area)
    var plotX = this.plotArea.x + normX * this.plotArea.width;
    var plotY = this.plotArea.y + (1 - normY) * this.plotArea.height; // Flip Y

    // Apply transform
    var screenX = plotX * this.transform.k + this.transform.x;
    var screenY = plotY * this.transform.k + this.transform.y;

    return {
        x: screenX,
        y: screenY
    };
};

/**
 * Convert screen coordinates to data coordinates
 * @param {Number} px - Screen x coordinate
 * @param {Number} py - Screen y coordinate
 * @returns {Object} Data coordinates {x, y}
 */
CoordinateConverter.prototype.pixelToData = function(px, py) {
    // Reverse transform
    var plotX = (px - this.transform.x) / this.transform.k;
    var plotY = (py - this.transform.y) / this.transform.k;

    // Map from plot area to normalized coordinates
    var normX = (plotX - this.plotArea.x) / this.plotArea.width;
    var normY = 1 - (plotY - this.plotArea.y) / this.plotArea.height; // Flip Y

    // Map to data coordinates
    var dataX = this.viewRange.xMin + normX * (this.viewRange.xMax - this.viewRange.xMin);
    var dataY = this.viewRange.yMin + normY * (this.viewRange.yMax - this.viewRange.yMin);

    return {
        x: dataX,
        y: dataY
    };
};

/**
 * Get the plot area rectangle
 * @returns {Object} Plot area {x, y, width, height}
 */
CoordinateConverter.prototype.getPlotArea = function() {
    return {
        x: this.plotArea.x,
        y: this.plotArea.y,
        width: this.plotArea.width,
        height: this.plotArea.height
    };
};

/**
 * Get screen size
 * @returns {Object} Screen size {width, height}
 */
CoordinateConverter.prototype.getScreenSize = function() {
    return {
        width: this.screenSize.width,
        height: this.screenSize.height
    };
};

/**
 * Get margins
 * @returns {Object} Margins {left, right, top, bottom}
 */
CoordinateConverter.prototype.getMargins = function() {
    return {
        left: this.margins.left,
        right: this.margins.right,
        top: this.margins.top,
        bottom: this.margins.bottom
    };
};

/**
 * Calculate scale factor from data range
 * @returns {Number} Pixels per data unit
 */
CoordinateConverter.prototype.getScale = function() {
    var scaleX = this.plotArea.width / (this.viewRange.xMax - this.viewRange.xMin);
    var scaleY = this.plotArea.height / (this.viewRange.yMax - this.viewRange.yMin);

    return {
        x: scaleX,
        y: scaleY
    };
};

/**
 * Clamp a point to the plot area
 * @param {Number} px - Screen x coordinate
 * @param {Number} py - Screen y coordinate
 * @returns {Object} Clamped screen coordinates {x, y}
 */
CoordinateConverter.prototype.clampToPlotArea = function(px, py) {
    return {
        x: Math.max(this.plotArea.x, Math.min(this.plotArea.x + this.plotArea.width, px)),
        y: Math.max(this.plotArea.y, Math.min(this.plotArea.y + this.plotArea.height, py))
    };
};

/**
 * Check if a screen point is within the plot area
 * @param {Number} px - Screen x coordinate
 * @param {Number} py - Screen y coordinate
 * @returns {Boolean}
 */
CoordinateConverter.prototype.isInPlotArea = function(px, py) {
    return px >= this.plotArea.x &&
           px <= this.plotArea.x + this.plotArea.width &&
           py >= this.plotArea.y &&
           py <= this.plotArea.y + this.plotArea.height;
};

/**
 * Create an inverted converter (for coordinate transformations)
 * @returns {Object} Inverse transformation functions
 */
CoordinateConverter.prototype.createInverse = function() {
    var self = this;
    return {
        toPixel: function(x, y) { return self.dataToPixel(x, y); },
        toData: function(px, py) { return self.pixelToData(px, py); }
    };
};

module.exports = CoordinateConverter;
