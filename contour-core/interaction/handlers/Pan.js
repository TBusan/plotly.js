'use strict';

/**
 * PanHandler - Handle pan interactions for contour-core
 *
 * Supports:
 * - Drag to pan
 * - Boundary constraints
 * - Inertia (optional)
 */

/**
 * PanHandler constructor
 * @param {Object} options - Configuration options
 */
function PanHandler(options) {
    options = options || {};

    this.options = {
        enabled: options.enabled !== false,
        inertia: options.inertia || false,
        inertiaDuration: options.inertiaDuration || 500,
        friction: options.friction || 0.9
    };
}

/**
 * Start pan operation
 * @param {MouseEvent} event - Mouse down event
 * @param {StateManager} stateManager - State manager instance
 * @returns {Object} Pan state
 */
PanHandler.prototype.startPan = function(event, stateManager) {
    if (!this.options.enabled) {
        return null;
    }

    return {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        velocityX: 0,
        velocityY: 0
    };
}

/**
 * Handle pan move
 * @param {MouseEvent} event - Mouse move event
 * @param {Object} panState - Current pan state
 * @param {StateManager} stateManager - State manager instance
 * @param {CoordinateConverter} converter - Coordinate converter
 * @returns {Object|null} New state if panning occurred, null otherwise
 */
PanHandler.prototype.handlePan = function(event, panState, stateManager, converter) {
    if (!panState || !panState.active || !this.options.enabled) {
        return null;
    }

    event.preventDefault();

    // Calculate delta in screen pixels
    var deltaX = event.clientX - panState.lastX;
    var deltaY = event.clientY - panState.lastY;

    // Update velocity for inertia
    panState.velocityX = deltaX;
    panState.velocityY = deltaY;
    panState.lastX = event.clientX;
    panState.lastY = event.clientY;

    // Get current state
    var currentState = stateManager.getState();
    var currentView = currentState.view;
    var currentTransform = currentState.transform;

    // Calculate scale (pixels per data unit)
    var plotArea = converter.getPlotArea();
    var scaleX = plotArea.width / (currentView.xMax - currentView.xMin);
    var scaleY = plotArea.height / (currentView.yMax - currentView.yMin);

    // Convert pixel delta to data delta (accounting for zoom)
    var dataDeltaX = -deltaX / (scaleX * currentTransform.k);
    var dataDeltaY = deltaY / (scaleY * currentTransform.k); // Y is inverted

    // Calculate new view range
    var newView = {
        xMin: currentView.xMin + dataDeltaX,
        xMax: currentView.xMax + dataDeltaX,
        yMin: currentView.yMin + dataDeltaY,
        yMax: currentView.yMax + dataDeltaY
    };

    // For pan, we keep transform x/y at 0 (no canvas translation)
    // Only use transform.k for zoom scale
    // The view change handles the panning visually
    // Clear zoom center when panning (so future zooms default to center)
    return {
        view: newView,
        transform: {
            k: currentTransform.k,
            x: 0,
            y: 0,
            zoomCenterX: undefined,  // Clear zoom center
            zoomCenterY: undefined
        }
    };
};

/**
 * End pan operation
 * @param {MouseEvent} event - Mouse up event
 * @param {Object} panState - Current pan state
 * @returns {Object} Final pan state with velocity info
 */
PanHandler.prototype.endPan = function(event, panState) {
    if (!panState || !panState.active) {
        return null;
    }

    return {
        active: false,
        velocityX: panState.velocityX,
        velocityY: panState.velocityY
    };
};

/**
 * Calculate inertia step (if inertia is enabled)
 * @param {Object} endState - State from endPan
 * @param {StateManager} stateManager - State manager instance
 * @param {CoordinateConverter} converter - Coordinate converter
 * @param {Number} deltaTime - Time since last frame (ms)
 * @returns {Object|null} New state with inertia applied, or null if inertia ended
 */
PanHandler.prototype.applyInertia = function(endState, stateManager, converter, deltaTime) {
    if (!this.options.inertia || !endState) {
        return null;
    }

    // Check if velocity is negligible
    if (Math.abs(endState.velocityX) < 0.1 && Math.abs(endState.velocityY) < 0.1) {
        return null; // Inertia ended
    }

    // Apply friction
    endState.velocityX *= this.options.friction;
    endState.velocityY *= this.options.friction;

    // Get current state
    var currentState = stateManager.getState();
    var currentView = currentState.view;
    var currentTransform = currentState.transform;

    // Calculate scale
    var plotArea = converter.getPlotArea();
    var scaleX = plotArea.width / (currentView.xMax - currentView.xMin);
    var scaleY = plotArea.height / (currentView.yMax - currentView.yMin);

    // Convert velocity to data delta
    var dataDeltaX = -endState.velocityX / (scaleX * currentTransform.k);
    var dataDeltaY = endState.velocityY / (scaleY * currentTransform.k);

    // Calculate new view
    var newView = {
        xMin: currentView.xMin + dataDeltaX,
        xMax: currentView.xMax + dataDeltaX,
        yMin: currentView.yMin + dataDeltaY,
        yMax: currentView.yMax + dataDeltaY
    };

    return {
        view: newView,
        transform: {
            k: currentTransform.k,
            x: 0,
            y: 0
        },
        inertia: {
            velocityX: endState.velocityX,
            velocityY: endState.velocityY
        }
    };
};

/**
 * Pan by a specific amount in data coordinates
 * @param {Number} dx - X offset in data units
 * @param {Number} dy - Y offset in data units
 * @param {StateManager} stateManager - State manager instance
 * @returns {Object} New state
 */
PanHandler.prototype.panBy = function(dx, dy, stateManager) {
    var currentView = stateManager.getViewRange();
    var currentTransform = stateManager.getTransform();

    return {
        view: {
            xMin: currentView.xMin + dx,
            xMax: currentView.xMax + dx,
            yMin: currentView.yMin + dy,
            yMax: currentView.yMax + dy
        },
        transform: {
            k: currentTransform.k,
            x: 0,
            y: 0
        }
    };
};

/**
 * Pan to center a specific data point
 * @param {Number} x - X coordinate to center
 * @param {Number} y - Y coordinate to center
 * @param {StateManager} stateManager - State manager instance
 * @returns {Object} New state
 */
PanHandler.prototype.panTo = function(x, y, stateManager) {
    var currentView = stateManager.getViewRange();
    var currentTransform = stateManager.getTransform();

    var centerX = (currentView.xMin + currentView.xMax) / 2;
    var centerY = (currentView.yMin + currentView.yMax) / 2;

    var dx = x - centerX;
    var dy = y - centerY;

    return {
        view: {
            xMin: currentView.xMin + dx,
            xMax: currentView.xMax + dx,
            yMin: currentView.yMin + dy,
            yMax: currentView.yMax + dy
        },
        transform: {
            k: currentTransform.k,
            x: 0,
            y: 0
        }
    };
};

/**
 * Check if pan state is active
 * @param {Object} panState - Pan state to check
 * @returns {Boolean}
 */
PanHandler.prototype.isPanning = function(panState) {
    return panState && panState.active;
};

module.exports = PanHandler;
