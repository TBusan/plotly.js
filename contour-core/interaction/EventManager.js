'use strict';

/**
 * EventManager - Unified event management for contour-core
 *
 * Responsibilities:
 * 1. Manage all DOM event listeners
 * 2. Event delegation and propagation control
 * 3. Event to handler mapping
 * 4. Third-party library integration point
 */

/**
 * EventManager constructor
 * @param {Object} options - Configuration options
 */
function EventManager(options) {
    options = options || {};
    this.listeners = [];
    this.paused = false;
    this.element = null;
    this.handlerContext = options.handlerContext || null;
}

/**
 * Bind an event listener
 * @param {HTMLElement} element - The element to bind event to
 * @param {String} event - Event type (e.g., 'wheel', 'mousedown')
 * @param {Function} handler - Event handler function
 * @param {Object} options - Event listener options
 * @returns {EventManager} - Returns this for chaining
 */
EventManager.prototype.on = function(element, event, handler, options) {
    if (!element || !event || typeof handler !== 'function') {
        console.warn('EventManager.on: Invalid parameters');
        return this;
    }

    // Bind the event
    var listener = {
        element: element,
        event: event,
        handler: handler,
        options: options || false,
        boundHandler: null
    };

    // Create bound handler with context if provided
    if (this.handlerContext) {
        listener.boundHandler = handler.bind(this.handlerContext);
    } else {
        listener.boundHandler = handler;
    }

    // Add event listener
    var eventOptions = options || false;
    if (typeof eventOptions === 'object') {
        element.addEventListener(event, listener.boundHandler, eventOptions);
    } else {
        element.addEventListener(event, listener.boundHandler);
    }

    this.listeners.push(listener);
    this.element = this.element || element;

    return this;
};

/**
 * Unbind an event listener
 * @param {HTMLElement} element - The element event was bound to
 * @param {String} event - Event type
 * @param {Function} handler - Original handler function
 * @returns {EventManager} - Returns this for chaining
 */
EventManager.prototype.off = function(element, event, handler) {
    var i = this.listeners.length;
    while (i--) {
        var listener = this.listeners[i];
        if (listener.element === element &&
            listener.event === event &&
            listener.handler === handler) {
            // Remove event listener
            element.removeEventListener(event, listener.boundHandler);
            this.listeners.splice(i, 1);
        }
    }

    return this;
};

/**
 * Pause event handling (events are still captured but not processed)
 * @returns {EventManager} - Returns this for chaining
 */
EventManager.prototype.pause = function() {
    this.paused = true;
    return this;
};

/**
 * Resume event handling
 * @returns {EventManager} - Returns this for chaining
 */
EventManager.prototype.resume = function() {
    this.paused = false;
    return this;
};

/**
 * Check if events are currently paused
 * @returns {Boolean}
 */
EventManager.prototype.isPaused = function() {
    return this.paused;
};

/**
 * Remove all event listeners
 * @returns {EventManager} - Returns this for chaining
 */
EventManager.prototype.destroy = function() {
    var i = this.listeners.length;
    while (i--) {
        var listener = this.listeners[i];
        listener.element.removeEventListener(
            listener.event,
            listener.boundHandler,
            listener.options
        );
    }
    this.listeners = [];
    this.element = null;
    return this;
};

/**
 * Get the number of active listeners
 * @returns {Number}
 */
EventManager.prototype.getListenerCount = function() {
    return this.listeners.length;
};

/**
 * Delegate events from parent to children
 * @param {HTMLElement} parent - Parent element
 * @param {String} event - Event type
 * @param {String} selector - CSS selector for target elements
 * @param {Function} handler - Handler function
 * @returns {EventManager} - Returns this for chaining
 */
EventManager.prototype.delegate = function(parent, event, selector, handler) {
    var self = this;

    var delegateHandler = function(e) {
        var target = e.target;
        var match = target.closest(selector);

        if (match && parent.contains(match)) {
            // Create a synthetic event with the matched element as target
            var syntheticEvent = {};
            for (var key in e) {
                syntheticEvent[key] = e[key];
            }
            syntheticEvent.delegateTarget = match;
            syntheticEvent.originalEvent = e;

            if (self.handlerContext) {
                handler.call(self.handlerContext, syntheticEvent);
            } else {
                handler(syntheticEvent);
            }
        }
    };

    return this.on(parent, event, delegateHandler);
};

module.exports = EventManager;
