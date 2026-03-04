'use strict';

/**
 * View State Manager
 * Manages the visible data range for interactive zoom/pan operations
 *
 * The view state uses data coordinates (not pixels) to represent what's visible.
 * This allows for clean separation between data transformations and rendering.
 */

/**
 * Create a view state manager
 *
 * @param {Object} fullRange - The complete data range
 * @param {number} fullRange.xMin - Minimum X value
 * @param {number} fullRange.xMax - Maximum X value
 * @param {number} fullRange.yMin - Minimum Y value
 * @param {number} fullRange.yMax - Maximum Y value
 * @param {Object} options - Configuration options
 * @param {number} options.minZoom - Minimum zoom level (default: 0.1, max 10x zoom out)
 * @param {number} options.maxZoom - Maximum zoom level (default: 10, max 10x zoom in)
 * @returns {Object} View state manager
 */
function createViewManager(fullRange, options) {
    options = options || {};

    var minZoom = options.minZoom || 0.1;  // Max 10x zoom out
    var maxZoom = options.maxZoom || 10;    // Max 10x zoom in

    // Full data range (never changes)
    var fullXMin = fullRange.xMin;
    var fullXMax = fullRange.xMax;
    var fullYMin = fullRange.yMin;
    var fullYMax = fullRange.yMax;

    var fullXRange = fullXMax - fullXMin;
    var fullYRange = fullYMax - fullYMin;

    // Current visible range (changes with zoom/pan)
    var visibleXMin = fullXMin;
    var visibleXMax = fullXMax;
    var visibleYMin = fullYMin;
    var visibleYMax = fullYMax;

    /**
     * Get the current visible range
     * @returns {Object} { xMin, xMax, yMin, yMax, zoom }
     */
    function getState() {
        var xRange = visibleXMax - visibleXMin;
        var yRange = visibleYMax - visibleYMin;
        var zoomX = fullXRange / xRange;
        var zoomY = fullYRange / yRange;

        return {
            xMin: visibleXMin,
            xMax: visibleXMax,
            yMin: visibleYMin,
            yMax: visibleYMax,
            zoom: Math.min(zoomX, zoomY),  // Report the smaller zoom (less zoomed in)
            zoomX: zoomX,
            zoomY: zoomY
        };
    }

    /**
     * Get the full data range
     * @returns {Object} { xMin, xMax, yMin, yMax }
     */
    function getFullRange() {
        return {
            xMin: fullXMin,
            xMax: fullXMax,
            yMin: fullYMin,
            yMax: fullYMax
        };
    }

    /**
     * Zoom at a specific point (data coordinates)
     * The point stays at the same pixel position after zoom
     *
     * @param {number} factor - Zoom factor (>1 zoom in, <1 zoom out)
     * @param {number} centerX - X coordinate to zoom around (data coords)
     * @param {number} centerY - Y coordinate to zoom around (data coords)
     * @param {Object} drawArea - Drawing area { x, y, width, height }
     */
    function zoomAt(factor, centerX, centerY, drawArea) {
        // Clamp zoom factor
        var currentState = getState();
        var newZoom = currentState.zoom * factor;

        if (newZoom < minZoom) {
            factor = minZoom / currentState.zoom;
        } else if (newZoom > maxZoom) {
            factor = maxZoom / currentState.zoom;
        }

        // Calculate new range centered on the zoom point
        var xRange = visibleXMax - visibleXMin;
        var yRange = visibleYMax - visibleYMin;

        var newXRange = xRange / factor;
        var newYRange = yRange / factor;

        // Calculate how far centerX/centerY is from the visible center (0-1)
        var xRatio = (centerX - visibleXMin) / xRange;
        var yRatio = (centerY - visibleYMin) / yRange;

        // New visible range, keeping the zoom point at the same relative position
        visibleXMin = centerX - xRatio * newXRange;
        visibleXMax = centerX + (1 - xRatio) * newXRange;
        visibleYMin = centerY - yRatio * newYRange;
        visibleYMax = centerY + (1 - yRatio) * newYRange;

        // Clamp to reasonable bounds (allow some overflow for panning)
        _clampToBounds();
    }

    /**
     * Pan the view by delta pixels
     *
     * @param {number} dx - X pan in pixels
     * @param {number} dy - Y pan in pixels
     * @param {Object} drawArea - Drawing area { x, y, width, height }
     */
    function pan(dx, dy, drawArea) {
        // Convert pixel delta to data delta
        var xRange = visibleXMax - visibleXMin;
        var yRange = visibleYMax - visibleYMin;

        var dataDx = -dx * (xRange / drawArea.width);
        var dataDy = dy * (yRange / drawArea.height);  // Invert Y for canvas coords

        visibleXMin += dataDx;
        visibleXMax += dataDx;
        visibleYMin += dataDy;
        visibleYMax += dataDy;

        _clampToBounds();
    }

    /**
     * Set the visible range directly
     *
     * @param {number} xMin - New X minimum
     * @param {number} xMax - New X maximum
     * @param {number} yMin - New Y minimum
     * @param {number} yMax - New Y maximum
     */
    function setRange(xMin, xMax, yMin, yMax) {
        visibleXMin = xMin;
        visibleXMax = xMax;
        visibleYMin = yMin;
        visibleYMax = yMax;

        _clampToBounds();
    }

    /**
     * Reset to full range
     */
    function reset() {
        visibleXMin = fullXMin;
        visibleXMax = fullXMax;
        visibleYMin = fullYMin;
        visibleYMax = fullYMax;
    }

    /**
     * Clamp visible range to reasonable bounds
     * @private
     */
    function _clampToBounds() {
        var xRange = visibleXMax - visibleXMin;
        var yRange = visibleYMax - visibleYMin;

        // Max zoom out: can't show more than 1/minZoom times the full range
        var maxRange = Math.max(fullXRange, fullYRange) / minZoom;
        if (xRange > maxRange) {
            var xCenter = (visibleXMin + visibleXMax) / 2;
            visibleXMin = xCenter - maxRange / 2;
            visibleXMax = xCenter + maxRange / 2;
        }
        if (yRange > maxRange) {
            var yCenter = (visibleYMin + visibleYMax) / 2;
            visibleYMin = yCenter - maxRange / 2;
            visibleYMax = yCenter + maxRange / 2;
        }

        // Allow some panning beyond full range (up to 50% overflow)
        var overflowX = xRange * 0.5;
        var overflowY = yRange * 0.5;

        if (visibleXMax < fullXMin - overflowX) {
            var shift = (fullXMin - overflowX) - visibleXMax;
            visibleXMin += shift;
            visibleXMax += shift;
        }
        if (visibleXMin > fullXMax + overflowX) {
            var shift = (fullXMax + overflowX) - visibleXMin;
            visibleXMin += shift;
            visibleXMax += shift;
        }
        if (visibleYMax < fullYMin - overflowY) {
            var shift = (fullYMin - overflowY) - visibleYMax;
            visibleYMin += shift;
            visibleYMax += shift;
        }
        if (visibleYMin > fullYMax + overflowY) {
            var shift = (fullYMax + overflowY) - visibleYMin;
            visibleYMin += shift;
            visibleYMax += shift;
        }
    }

    /**
     * Convert data coordinates to pixel coordinates
     *
     * @param {number} x - Data X coordinate
     * @param {number} y - Data Y coordinate
     * @param {Object} drawArea - Drawing area { x, y, width, height }
     * @returns {Object} { px, py } pixel coordinates
     */
    function dataToPixel(x, y, drawArea) {
        var xRange = visibleXMax - visibleXMin;
        var yRange = visibleYMax - visibleYMin;

        var px = drawArea.x + (x - visibleXMin) / xRange * drawArea.width;
        var py = drawArea.y + drawArea.height - (y - visibleYMin) / yRange * drawArea.height;

        return { px: px, py: py };
    }

    /**
     * Convert pixel coordinates to data coordinates
     *
     * @param {number} px - Pixel X coordinate
     * @param {number} py - Pixel Y coordinate
     * @param {Object} drawArea - Drawing area { x, y, width, height }
     * @returns {Object} { x, y } data coordinates
     */
    function pixelToData(px, py, drawArea) {
        var xRange = visibleXMax - visibleXMin;
        var yRange = visibleYMax - visibleYMin;

        var x = visibleXMin + (px - drawArea.x) / drawArea.width * xRange;
        var y = visibleYMin + (1 - (py - drawArea.y) / drawArea.height) * yRange;

        return { x: x, y: y };
    }

    return {
        getState: getState,
        getFullRange: getFullRange,
        zoomAt: zoomAt,
        pan: pan,
        setRange: setRange,
        reset: reset,
        dataToPixel: dataToPixel,
        pixelToData: pixelToData
    };
}

module.exports = {
    createViewManager: createViewManager
};
