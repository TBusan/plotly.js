'use strict';

/**
 * StateManager - View state management for contour-core
 *
 * Responsibilities:
 * 1. Maintain view state (range, zoom level, transform)
 * 2. State change history (for undo/redo)
 * 3. State constraints (boundary checking)
 * 4. State change event publishing
 */

/**
 * StateManager constructor
 * @param {Object} initialState - Initial state configuration
 */
function StateManager(initialState) {
    initialState = initialState || {};

    // Data bounds (constraints)
    this.dataBounds = {
        xMin: initialState.xMin !== undefined ? initialState.xMin : 0,
        xMax: initialState.xMax !== undefined ? initialState.xMax : 100,
        yMin: initialState.yMin !== undefined ? initialState.yMin : 0,
        yMax: initialState.yMax !== undefined ? initialState.yMax : 100
    };

    // Initial view state
    var view = initialState.view || {};
    this.state = {
        // Current visible range in data coordinates
        view: {
            xMin: view.xMin !== undefined ? view.xMin : this.dataBounds.xMin,
            xMax: view.xMax !== undefined ? view.xMax : this.dataBounds.xMax,
            yMin: view.yMin !== undefined ? view.yMin : this.dataBounds.yMin,
            yMax: view.yMax !== undefined ? view.yMax : this.dataBounds.yMax
        },

        // Transform state (from d3-zoom or similar)
        transform: {
            k: view.scale || 1,  // scale factor
            x: view.translateX || 0,  // x translation in pixels
            y: view.translateY || 0   // y translation in pixels
        },

        // Interaction state
        interaction: {
            isDragging: false,
            isZooming: false,
            dragStart: null,
            zoomCenter: null,
            isPanning: false
        }
    };

    // Store initial state for reset
    this.initialState = JSON.parse(JSON.stringify(this.state));

    // Constraints
    this.constraints = initialState.constraints || {};
    this.constraints.minScale = this.constraints.minScale || 0.1;
    this.constraints.maxScale = this.constraints.maxScale || 10;
    this.constraints.constrainPan = this.constraints.constrainPan !== false;

    // History for undo/redo
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;

    // Change listeners
    this.changeListeners = [];

    // Save initial state to history
    this._saveToHistory();
}

/**
 * Get current state
 * @returns {Object} Current state
 */
StateManager.prototype.getState = function() {
    return JSON.parse(JSON.stringify(this.state));
};

/**
 * Get current view range
 * @returns {Object} View range {xMin, xMax, yMin, yMax}
 */
StateManager.prototype.getViewRange = function() {
    return {
        xMin: this.state.view.xMin,
        xMax: this.state.view.xMax,
        yMin: this.state.view.yMin,
        yMax: this.state.view.yMax
    };
};

/**
 * Get current transform
 * @returns {Object} Transform {k, x, y, zoomCenterX, zoomCenterY}
 */
StateManager.prototype.getTransform = function() {
    return {
        k: this.state.transform.k,
        x: this.state.transform.x,
        y: this.state.transform.y,
        zoomCenterX: this.state.transform.zoomCenterX,
        zoomCenterY: this.state.transform.zoomCenterY
    };
};

/**
 * Update state with constraint checking
 * @param {Object} newState - Partial or complete state update
 * @param {Object} options - Update options
 * @returns {Object} The updated state
 */
StateManager.prototype.update = function(newState, options) {
    options = options || {};

    // Create new state by merging with current
    var updatedState = this._mergeState(this.state, newState);

    // Apply constraints
    updatedState = this._applyConstraints(updatedState);

    // Check if state actually changed
    if (this._statesEqual(this.state, updatedState)) {
        return this.state;
    }

    // Update state
    var oldState = this.state;
    this.state = updatedState;

    // Save to history
    if (options.saveHistory !== false) {
        this._saveToHistory();
    }

    // Notify listeners
    this._notifyChange(oldState, this.state);

    return this.state;
};

/**
 * Update transform state
 * @param {Object} transform - Transform {k, x, y}
 * @param {Object} view - View range {xMin, xMax, yMin, yMax}
 * @returns {Object} The updated state
 */
StateManager.prototype.updateTransform = function(transform, view) {
    var update = {};
    if (transform) {
        update.transform = transform;
    }
    if (view) {
        update.view = view;
    }
    return this.update(update);
};

/**
 * Reset to initial state
 * @returns {Object} The reset state
 */
StateManager.prototype.reset = function() {
    this.state = JSON.parse(JSON.stringify(this.initialState));
    this._saveToHistory();
    this._notifyChange(null, this.state);
    return this.state;
};

/**
 * Register a state change listener
 * @param {Function} callback - Callback function (oldState, newState)
 * @returns {Function} Unsubscribe function
 */
StateManager.prototype.onChange = function(callback) {
    var self = this;
    this.changeListeners.push(callback);

    // Return unsubscribe function
    return function() {
        var index = self.changeListeners.indexOf(callback);
        if (index !== -1) {
            self.changeListeners.splice(index, 1);
        }
    };
};

/**
 * Undo last state change
 * @returns {Object} The restored state
 */
StateManager.prototype.undo = function() {
    if (this.historyIndex > 0) {
        this.historyIndex--;
        this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        this._notifyChange(null, this.state);
    }
    return this.state;
};

/**
 * Redo last undone state change
 * @returns {Object} The restored state
 */
StateManager.prototype.redo = function() {
    if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        this._notifyChange(null, this.state);
    }
    return this.state;
};

/**
 * Check if can undo
 * @returns {Boolean}
 */
StateManager.prototype.canUndo = function() {
    return this.historyIndex > 0;
};

/**
 * Check if can redo
 * @returns {Boolean}
 */
StateManager.prototype.canRedo = function() {
    return this.historyIndex < this.history.length - 1;
};

/**
 * Clear history
 */
StateManager.prototype.clearHistory = function() {
    this.history = [];
    this.historyIndex = -1;
    this._saveToHistory();
};

/**
 * Get state as serializable object
 * @returns {Object} Serializable state
 */
StateManager.prototype.serialize = function() {
    return {
        view: this.state.view,
        transform: this.state.transform,
        dataBounds: this.dataBounds
    };
};

/**
 * Restore state from serialized object
 * @param {Object} data - Serialized state
 */
StateManager.prototype.deserialize = function(data) {
    if (data && data.view) {
        this.update({
            view: data.view,
            transform: data.transform || { k: 1, x: 0, y: 0 }
        }, { saveHistory: true });
    }
};

/**
 * Merge states deeply
 * @private
 */
StateManager.prototype._mergeState = function(current, update) {
    var merged = JSON.parse(JSON.stringify(current));

    for (var key in update) {
        if (update.hasOwnProperty(key)) {
            if (typeof update[key] === 'object' && !Array.isArray(update[key])) {
                merged[key] = this._mergeState(merged[key] || {}, update[key]);
            } else {
                merged[key] = update[key];
            }
        }
    }

    return merged;
};

/**
 * Apply constraints to state
 * @private
 */
StateManager.prototype._applyConstraints = function(state) {
    var constrained = JSON.parse(JSON.stringify(state));

    // Scale constraints
    constrained.transform.k = Math.max(
        this.constraints.minScale,
        Math.min(this.constraints.maxScale, constrained.transform.k)
    );

    // Pan constraints (if enabled)
    if (this.constraints.constrainPan) {
        // Don't allow view to go beyond data bounds
        // This is a simple implementation; can be enhanced
        var viewWidth = constrained.view.xMax - constrained.view.xMin;
        var viewHeight = constrained.view.yMax - constrained.view.yMin;
        var dataWidth = this.dataBounds.xMax - this.dataBounds.xMin;
        var dataHeight = this.dataBounds.yMax - this.dataBounds.yMin;

        // Allow some overscroll but prevent complete loss of data view
        var maxOverscroll = 0.5; // Allow 50% overscroll

        if (viewWidth > dataWidth * (1 + maxOverscroll)) {
            // View is too wide, constrain it
            var centerX = (constrained.view.xMin + constrained.view.xMax) / 2;
            constrained.view.xMin = centerX - (dataWidth * (1 + maxOverscroll)) / 2;
            constrained.view.xMax = centerX + (dataWidth * (1 + maxOverscroll)) / 2;
        }

        if (viewHeight > dataHeight * (1 + maxOverscroll)) {
            var centerY = (constrained.view.yMin + constrained.view.yMax) / 2;
            constrained.view.yMin = centerY - (dataHeight * (1 + maxOverscroll)) / 2;
            constrained.view.yMax = centerY + (dataHeight * (1 + maxOverscroll)) / 2;
        }
    }

    return constrained;
};

/**
 * Check if two states are equal
 * @private
 */
StateManager.prototype._statesEqual = function(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Save current state to history
 * @private
 */
StateManager.prototype._saveToHistory = function() {
    // Remove any forward history
    this.history = this.history.slice(0, this.historyIndex + 1);

    // Add current state
    this.history.push(JSON.parse(JSON.stringify(this.state)));

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
        this.history.shift();
    } else {
        this.historyIndex++;
    }
};

/**
 * Notify state change listeners
 * @private
 */
StateManager.prototype._notifyChange = function(oldState, newState) {
    for (var i = 0; i < this.changeListeners.length; i++) {
        try {
            this.changeListeners[i](oldState, newState);
        } catch (e) {
            console.error('Error in state change listener:', e);
        }
    }
};

module.exports = StateManager;
