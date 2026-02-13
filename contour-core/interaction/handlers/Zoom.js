'use strict';

/**
 * ZoomHandler - Handle zoom interactions for contour-core
 *
 * Supports:
 * - Wheel zoom (centered on mouse position)
 * - Box zoom (drag to select area)
 * - Programmatic zoom
 */

/**
 * ZoomHandler constructor
 * @param {Object} options - Configuration options
 */
function ZoomHandler(options) {
    options = options || {};

    this.options = {
        minScale: options.minScale || 0.1,
        maxScale: options.maxScale || 10,
        duration: options.duration || 250,
        wheelEnabled: options.wheelEnabled !== false,
        boxEnabled: options.boxEnabled !== false,
        wheelSensitivity: options.wheelSensitivity || 1 / 150
    };
}

/**
 * Handle wheel zoom event
 * @param {WheelEvent} event - Wheel event
 * @param {StateManager} stateManager - State manager instance
 * @param {CoordinateConverter} converter - Coordinate converter
 * @returns {Object|null} New state if zoom occurred, null otherwise
 */
ZoomHandler.prototype.handleWheel = function(event, stateManager, converter) {
    if (!this.options.wheelEnabled) {
        return null;
    }

    event.preventDefault();

    // Get current state
    var currentState = stateManager.getState();
    var currentTransform = currentState.transform;
    var currentView = currentState.view;

    // Calculate new scale
    var zoomFactor = Math.exp(-event.deltaY * this.options.wheelSensitivity);
    var newScale = currentTransform.k * zoomFactor;

    // Constrain scale
    newScale = Math.max(this.options.minScale, Math.min(this.options.maxScale, newScale));

    if (newScale === currentTransform.k) {
        return null; // No change
    }

    // Get mouse position in plot area coordinates
    var mouseX = event.offsetX;
    var mouseY = event.offsetY;

    // Convert to data coordinates before zoom
    var dataPos = converter.pixelToData(mouseX, mouseY);

    // Calculate new view range maintaining mouse position
    var scaleRatio = newScale / currentTransform.k;
    var viewWidth = currentView.xMax - currentView.xMin;
    var viewHeight = currentView.yMax - currentView.yMin;

    var newViewWidth = viewWidth / scaleRatio;
    var newViewHeight = viewHeight / scaleRatio;

    // Adjust view to keep data position under mouse
    var xRatio = (dataPos.x - currentView.xMin) / viewWidth;
    var yRatio = (dataPos.y - currentView.yMin) / viewHeight;

    var newView = {
        xMin: dataPos.x - newViewWidth * xRatio,
        xMax: dataPos.x + newViewWidth * (1 - xRatio),
        yMin: dataPos.y - newViewHeight * yRatio,
        yMax: dataPos.y + newViewHeight * (1 - yRatio)
    };

    var newTransform = {
        k: newScale,
        x: 0,
        y: 0,
        // Store zoom center in plot area coordinates for rendering
        zoomCenterX: mouseX,
        zoomCenterY: mouseY
    };

    return {
        view: newView,
        transform: newTransform
    };
};

/**
 * Start box zoom selection
 * @param {MouseEvent} event - Mouse down event
 * @param {StateManager} stateManager - State manager instance
 * @returns {Object} Box zoom state
 */
ZoomHandler.prototype.startBoxZoom = function(event, stateManager) {
    if (!this.options.boxEnabled) {
        return null;
    }

    return {
        active: true,
        startX: event.offsetX,
        startY: event.offsetY,
        currentX: event.offsetX,
        currentY: event.offsetY
    };
};

/**
 * Update box zoom selection
 * @param {MouseEvent} event - Mouse move event
 * @param {Object} boxState - Current box zoom state
 * @returns {Object} Updated box state with selection rectangle
 */
ZoomHandler.prototype.updateBoxZoom = function(event, boxState) {
    if (!boxState || !boxState.active) {
        return null;
    }

    return {
        active: true,
        startX: boxState.startX,
        startY: boxState.startY,
        currentX: event.offsetX,
        currentY: event.offsetY
    };
};

/**
 * Finish box zoom and calculate new view
 * @param {MouseEvent} event - Mouse up event
 * @param {Object} boxState - Current box zoom state
 * @param {StateManager} stateManager - State manager instance
 * @param {CoordinateConverter} converter - Coordinate converter
 * @returns {Object|null} New state if box was valid, null otherwise
 */
ZoomHandler.prototype.finishBoxZoom = function(event, boxState, stateManager, converter) {
    if (!boxState || !boxState.active) {
        return null;
    }

    var x1 = Math.min(boxState.startX, event.offsetX);
    var y1 = Math.min(boxState.startY, event.offsetY);
    var x2 = Math.max(boxState.startX, event.offsetX);
    var y2 = Math.max(boxState.startY, event.offsetY);

    // Check if box is large enough (minimum 10x10 pixels)
    if (x2 - x1 < 10 || y2 - y1 < 10) {
        return null; // Box too small, ignore
    }

    // Convert box corners to data coordinates
    var dataMin = converter.pixelToData(x1, y2); // y2 is bottom in screen coords
    var dataMax = converter.pixelToData(x2, y1); // y1 is top

    // Create new view
    var newView = {
        xMin: Math.min(dataMin.x, dataMax.x),
        xMax: Math.max(dataMin.x, dataMax.x),
        yMin: Math.min(dataMin.y, dataMax.y),
        yMax: Math.max(dataMin.y, dataMax.y)
    };

    // Calculate new scale
    var currentView = stateManager.getViewRange();
    var scaleX = (currentView.xMax - currentView.xMin) / (newView.xMax - newView.xMin);
    var currentTransform = stateManager.getTransform();
    var newScale = currentTransform.k * scaleX;

    return {
        view: newView,
        transform: {
            k: newScale,
            x: 0,
            y: 0
        }
    };
};

/**
 * Cancel box zoom operation
 * @returns {Object} Cancelled box state
 */
ZoomHandler.prototype.cancelBoxZoom = function() {
    return {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    };
};

/**
 * Zoom to a specific data range
 * @param {Number} xMin - Minimum x value
 * @param {Number} xMax - Maximum x value
 * @param {Number} yMin - Minimum y value
 * @param {Number} yMax - Maximum y value
 * @param {StateManager} stateManager - State manager instance
 * @param {CoordinateConverter} converter - Coordinate converter
 * @returns {Object} New state
 */
ZoomHandler.prototype.zoomToRange = function(xMin, xMax, yMin, yMax, stateManager, converter) {
    var currentView = stateManager.getViewRange();
    var currentTransform = stateManager.getTransform();

    // Ensure range is valid
    if (xMin >= xMax) {
        var temp = xMin;
        xMin = xMax;
        xMax = temp;
    }
    if (yMin >= yMax) {
        temp = yMin;
        yMin = yMax;
        yMax = temp;
    }

    // Calculate new scale
    var scaleX = (currentView.xMax - currentView.xMin) / (xMax - xMin);
    var scaleY = (currentView.yMax - currentView.yMin) / (yMax - yMin);
    var newScale = currentTransform.k * Math.min(scaleX, scaleY);

    // Constrain scale
    newScale = Math.max(this.options.minScale, Math.min(this.options.maxScale, newScale));

    return {
        view: {
            xMin: xMin,
            xMax: xMax,
            yMin: yMin,
            yMax: yMax
        },
        transform: {
            k: newScale,
            x: 0,
            y: 0
        }
    };
};

/**
 * Zoom by a factor
 * @param {Number} factor - Zoom factor (e.g., 2 for 2x zoom, 0.5 for zoom out)
 * @param {Object} center - Center point {x, y} in data coordinates
 * @param {StateManager} stateManager - State manager instance
 * @returns {Object} New state
 */
ZoomHandler.prototype.zoomByFactor = function(factor, center, stateManager) {
    var currentView = stateManager.getViewRange();
    var currentTransform = stateManager.getTransform();

    var newScale = currentTransform.k * factor;
    newScale = Math.max(this.options.minScale, Math.min(this.options.maxScale, newScale));

    var viewWidth = currentView.xMax - currentView.xMin;
    var viewHeight = currentView.yMax - currentView.yMin;
    var newViewWidth = viewWidth / factor;
    var newViewHeight = viewHeight / factor;

    // Use provided center or view center
    var centerX = center ? center.x : (currentView.xMin + currentView.xMax) / 2;
    var centerY = center ? center.y : (currentView.yMin + currentView.yMax) / 2;

    var xRatio = (centerX - currentView.xMin) / viewWidth;
    var yRatio = (centerY - currentView.yMin) / viewHeight;

    return {
        view: {
            xMin: centerX - newViewWidth * xRatio,
            xMax: centerX + newViewWidth * (1 - xRatio),
            yMin: centerY - newViewHeight * yRatio,
            yMax: centerY + newViewHeight * (1 - yRatio)
        },
        transform: {
            k: newScale,
            x: 0,
            y: 0
        }
    };
};

/**
 * Get box selection rectangle for rendering
 * @param {Object} boxState - Box zoom state
 * @returns {Object|null} Rectangle {x, y, width, height} or null
 */
ZoomHandler.prototype.getBoxRect = function(boxState) {
    if (!boxState || !boxState.active) {
        return null;
    }

    var x = Math.min(boxState.startX, boxState.currentX);
    var y = Math.min(boxState.startY, boxState.currentY);
    var width = Math.abs(boxState.currentX - boxState.startX);
    var height = Math.abs(boxState.currentY - boxState.startY);

    return { x: x, y: y, width: width, height: height };
};

module.exports = ZoomHandler;
