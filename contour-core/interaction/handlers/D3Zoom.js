'use strict';

/**
 * D3ZoomHandler - Optional d3-zoom integration
 *
 * This module provides enhanced zoom/pan behavior using d3-zoom
 * when the library is available. Falls back to basic behavior otherwise.
 */

var d3Zoom = null;
var d3Select = null;

// Try to require d3 modules (optional)
try {
    d3Zoom = require('d3-zoom');
    d3Select = require('d3-selection');
} catch (e) {
    // d3 not available, will use fallback
}

/**
 * Check if d3-zoom is available
 * @returns {Boolean}
 */
function isAvailable() {
    return d3Zoom !== null && d3Select !== null;
}

/**
 * D3ZoomHandler constructor
 * @param {Object} options - Configuration options
 */
function D3ZoomHandler(options) {
    options = options || {};

    this.options = {
        minScale: options.minScale || 0.5,
        maxScale: options.maxScale || 10,
        duration: options.duration || 250,
        enableD3: options.enableD3 !== false // Try to use d3 if available
    };

    this.zoomBehavior = null;
    this.selection = null;
    this.stateManager = null;
    this.converter = null;
    this.onZoomCallback = null;
}

/**
 * Initialize d3-zoom behavior
 * @param {HTMLElement} element - Target element
 * @param {StateManager} stateManager - State manager instance
 * @param {CoordinateConverter} converter - Coordinate converter
 * @param {Function} onZoom - Callback when zoom occurs
 * @returns {Boolean} True if d3-zoom was initialized
 */
D3ZoomHandler.prototype.init = function(element, stateManager, converter, onZoom) {
    if (!this.options.enableD3 || !isAvailable()) {
        return false;
    }

    this.stateManager = stateManager;
    this.converter = converter;
    this.onZoomCallback = onZoom;

    // Create d3 zoom behavior
    this.zoomBehavior = d3Zoom.zoom()
        .scaleExtent([this.options.minScale, this.options.maxScale])
        .on('zoom', this._handleZoom.bind(this))
        .on('start', this._handleZoomStart.bind(this))
        .on('end', this._handleZoomEnd.bind(this));

    // Apply to element
    this.selection = d3Select(element);
    this.selection.call(this.zoomBehavior);

    return true;
};

/**
 * Handle zoom event from d3
 * @private
 */
D3ZoomHandler.prototype._handleZoom = function(event) {
    if (!this.stateManager || !this.converter) {
        return;
    }

    var transform = event.transform;
    var currentState = this.stateManager.getState();
    var currentView = currentState.view;

    // Calculate new view based on transform
    var newTransform = {
        k: transform.k,
        x: transform.x,
        y: transform.y
    };

    // Update state with new transform
    this.stateManager.updateTransform(newTransform, currentView);

    // Trigger callback
    if (this.onZoomCallback) {
        this.onZoomCallback();
    }
};

/**
 * Handle zoom start event
 * @private
 */
D3ZoomHandler.prototype._handleZoomStart = function(event) {
    // Can be used for visual feedback
};

/**
 * Handle zoom end event
 * @private
 */
D3ZoomHandler.prototype._handleZoomEnd = function(event) {
    // Can be used for cleanup or notifications
};

/**
 * Programmatic zoom to a specific transform
 * @param {Number} k - Scale factor
 * @param {Number} x - X translation
 * @param {Number} y - Y translation
 * @param {Number} duration - Transition duration in ms
 */
D3ZoomHandler.prototype.zoomTo = function(k, x, y, duration) {
    if (!this.selection || !this.zoomBehavior) {
        return false;
    }

    duration = duration !== undefined ? duration : this.options.duration;

    var transform = d3Zoom.zoomIdentity.translate(x, y).scale(k);

    if (duration > 0) {
        this.selection
            .transition()
            .duration(duration)
            .call(this.zoomBehavior.transform, transform);
    } else {
        this.selection.call(this.zoomBehavior.transform, transform);
    }

    return true;
};

/**
 * Zoom to a specific data range
 * @param {Number} xMin - Minimum x value
 * @param {Number} xMax - Maximum x value
 * @param {Number} yMin - Minimum y value
 * @param {Number} yMax - Maximum y value
 * @param {Number} duration - Transition duration in ms
 */
D3ZoomHandler.prototype.zoomToRange = function(xMin, xMax, yMin, yMax, duration) {
    if (!this.stateManager || !this.converter) {
        return false;
    }

    var currentView = this.stateManager.getViewRange();
    var plotArea = this.converter.getPlotArea();

    // Calculate scale needed
    var scaleX = plotArea.width / (xMax - xMin) / (currentView.xMax - currentView.xMin) * plotArea.width;
    var scaleY = plotArea.height / (yMax - yMin) / (currentView.yMax - currentView.yMin) * plotArea.height;
    var k = Math.min(scaleX, scaleY);

    // Calculate center position
    var centerX = (xMin + xMax) / 2;
    var centerY = (yMin + yMax) / 2;

    var centerPixel = this.converter.dataToPixel(centerX, centerY);

    // Calculate translation to center the view
    var x = plotArea.width / 2 - centerPixel.x * k;
    var y = plotArea.height / 2 - centerPixel.y * k;

    return this.zoomTo(k, x, y, duration);
};

/**
 * Reset zoom to initial state
 * @param {Number} duration - Transition duration in ms
 */
D3ZoomHandler.prototype.reset = function(duration) {
    return this.zoomTo(1, 0, 0, duration);
};

/**
 * Enable/disable zoom interaction
 * @param {Boolean} enabled
 */
D3ZoomHandler.prototype.setEnabled = function(enabled) {
    if (!this.selection || !this.zoomBehavior) {
        return;
    }

    if (enabled) {
        this.selection.on('.zoom', null);
        this.selection.call(this.zoomBehavior);
    } else {
        this.selection.on('.zoom', null);
    }
};

/**
 * Clean up d3 zoom behavior
 */
D3ZoomHandler.prototype.destroy = function() {
    if (this.selection && this.zoomBehavior) {
        this.selection.on('.zoom', null);
    }
    this.selection = null;
    this.zoomBehavior = null;
    this.stateManager = null;
    this.converter = null;
    this.onZoomCallback = null;
};

/**
 * Get current d3 zoom transform
 * @returns {Object|null} Transform {k, x, y} or null if not available
 */
D3ZoomHandler.prototype.getTransform = function() {
    if (!this.selection) {
        return null;
    }

    var event = this.selection.node().__zoom;
    if (event) {
        return {
            k: event.k,
            x: event.x,
            y: event.y
        };
    }
    return null;
};

module.exports = {
    D3ZoomHandler: D3ZoomHandler,
    isAvailable: isAvailable
};
