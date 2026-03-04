'use strict';

/**
 * Interaction Manager
 * Handles mouse/touch events for interactive zoom/pan operations
 *
 * Supports:
 * - Wheel zoom (centered on cursor)
 * - Drag pan
 * - Double-click reset
 * - Box zoom (optional)
 */

/**
 * Create an interaction manager
 *
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} layeredRenderer - Layered renderer instance
 * @param {Object} config - Configuration options
 * @param {boolean} config.zoom - Enable zoom (default: true)
 * @param {boolean} config.pan - Enable pan (default: true)
 * @param {number} config.minZoom - Minimum zoom level (default: 0.1)
 * @param {number} config.maxZoom - Maximum zoom level (default: 10)
 * @param {boolean} config.dblclickReset - Enable double-click reset (default: true)
 * @param {boolean} config.boxZoom - Enable box zoom (default: false)
 * @param {Function} config.onZoom - Zoom callback
 * @param {Function} config.onPan - Pan callback
 * @param {Function} config.onReset - Reset callback
 * @returns {Object} Interaction manager API
 */
function createInteractionManager(canvas, layeredRenderer, config) {
    config = config || {};

    var viewManager = layeredRenderer.getViewManager();
    var drawingArea = layeredRenderer.getDrawingArea();

    // Interaction state
    var isDragging = false;
    var isBoxZooming = false;
    var lastX = 0;
    var lastY = 0;
    var boxStartX = 0;
    var boxStartY = 0;

    // Configuration
    var zoomEnabled = config.zoom !== false;
    var panEnabled = config.pan !== false;
    var dblclickReset = config.dblclickReset !== false;
    var boxZoomEnabled = config.boxZoom === true;

    // Zoom sensitivity (wheel delta multiplier)
    var zoomSensitivity = 0.001;

    // Bound event handlers (for cleanup)
    var boundHandlers = {};

    /**
     * Get mouse position relative to canvas
     */
    function getMousePos(e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /**
     * Check if position is within drawing area
     */
    function isInDrawingArea(pos) {
        return pos.x >= drawingArea.x &&
               pos.x <= drawingArea.x + drawingArea.width &&
               pos.y >= drawingArea.y &&
               pos.y <= drawingArea.y + drawingArea.height;
    }

    /**
     * Handle wheel event (zoom)
     */
    function handleWheel(e) {
        if (!zoomEnabled) return;

        var pos = getMousePos(e);
        if (!isInDrawingArea(pos)) return;

        e.preventDefault();

        // Get data coordinates under cursor
        var dataPos = viewManager.pixelToData(pos.x, pos.y, drawingArea);

        // Calculate zoom factor
        var delta = -e.deltaY;
        var factor = 1 + delta * zoomSensitivity;

        // Clamp factor to reasonable range
        factor = Math.max(0.5, Math.min(2, factor));

        // Zoom at cursor position
        viewManager.zoomAt(factor, dataPos.x, dataPos.y, drawingArea);

        // Re-render
        layeredRenderer.render();

        // Callback
        if (config.onZoom) {
            config.onZoom(viewManager.getState());
        }
    }

    /**
     * Handle mouse down (start pan or box zoom)
     */
    function handleMouseDown(e) {
        var pos = getMousePos(e);

        if (!isInDrawingArea(pos)) return;

        if (e.button === 0) { // Left button
            if (e.shiftKey && boxZoomEnabled) {
                // Start box zoom
                isBoxZooming = true;
                boxStartX = pos.x;
                boxStartY = pos.y;
            } else if (panEnabled) {
                // Start pan
                isDragging = true;
                lastX = pos.x;
                lastY = pos.y;
                canvas.style.cursor = 'grabbing';
            }
        }
    }

    /**
     * Handle mouse move (pan or update box)
     */
    function handleMouseMove(e) {
        var pos = getMousePos(e);

        if (isDragging) {
            e.preventDefault();

            var dx = pos.x - lastX;
            var dy = pos.y - lastY;

            viewManager.pan(dx, dy, drawingArea);

            lastX = pos.x;
            lastY = pos.y;

            // Re-render
            layeredRenderer.render();

            // Callback
            if (config.onPan) {
                config.onPan(viewManager.getState());
            }
        } else if (isBoxZooming) {
            // Draw box zoom rectangle
            // (This would need additional overlay canvas or DOM element)
            // For now, just update the end position
        } else if (isInDrawingArea(pos)) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
    }

    /**
     * Handle mouse up (end pan or box zoom)
     */
    function handleMouseUp(e) {
        if (isDragging) {
            isDragging = false;
            canvas.style.cursor = 'grab';
        }

        if (isBoxZooming) {
            isBoxZooming = false;

            var pos = getMousePos(e);

            // Calculate box bounds
            var x1 = Math.min(boxStartX, pos.x);
            var x2 = Math.max(boxStartX, pos.x);
            var y1 = Math.min(boxStartY, pos.y);
            var y2 = Math.max(boxStartY, pos.y);

            // Only zoom if box is large enough
            if (x2 - x1 > 10 && y2 - y1 > 10) {
                // Convert box corners to data coordinates
                var dataStart = viewManager.pixelToData(x1, y2, drawingArea);
                var dataEnd = viewManager.pixelToData(x2, y1, drawingArea);

                // Set new visible range
                viewManager.setRange(dataStart.x, dataEnd.x, dataStart.y, dataEnd.y);

                // Re-render
                layeredRenderer.render();

                // Callback
                if (config.onZoom) {
                    config.onZoom(viewManager.getState());
                }
            }
        }
    }

    /**
     * Handle double click (reset)
     */
    function handleDblClick(e) {
        if (!dblclickReset) return;

        var pos = getMousePos(e);
        if (!isInDrawingArea(pos)) return;

        e.preventDefault();

        // Reset to full range
        viewManager.reset();

        // Re-render
        layeredRenderer.render();

        // Callback
        if (config.onReset) {
            config.onReset();
        }
    }

    /**
     * Handle touch start
     */
    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            var touch = e.touches[0];
            var pos = getMousePos(touch);

            if (isInDrawingArea(pos)) {
                isDragging = true;
                lastX = pos.x;
                lastY = pos.y;
            }
        }
    }

    /**
     * Handle touch move
     */
    function handleTouchMove(e) {
        if (e.touches.length === 1 && isDragging) {
            e.preventDefault();

            var touch = e.touches[0];
            var pos = getMousePos(touch);

            var dx = pos.x - lastX;
            var dy = pos.y - lastY;

            viewManager.pan(dx, dy, drawingArea);

            lastX = pos.x;
            lastY = pos.y;

            // Re-render
            layeredRenderer.render();

            // Callback
            if (config.onPan) {
                config.onPan(viewManager.getState());
            }
        }
    }

    /**
     * Handle touch end
     */
    function handleTouchEnd(e) {
        isDragging = false;
    }

    /**
     * Get current view state
     */
    function getViewState() {
        return viewManager.getState();
    }

    /**
     * Set view range programmatically
     */
    function setViewRange(xMin, xMax, yMin, yMax) {
        viewManager.setRange(xMin, xMax, yMin, yMax);
        layeredRenderer.render();
    }

    /**
     * Reset view
     */
    function resetView() {
        viewManager.reset();
        layeredRenderer.render();

        if (config.onReset) {
            config.onReset();
        }
    }

    /**
     * Bind event listeners
     */
    function bindEvents() {
        boundHandlers.wheel = handleWheel.bind(this);
        boundHandlers.mousedown = handleMouseDown.bind(this);
        boundHandlers.mousemove = handleMouseMove.bind(this);
        boundHandlers.mouseup = handleMouseUp.bind(this);
        boundHandlers.mouseleave = handleMouseUp.bind(this);
        boundHandlers.dblclick = handleDblClick.bind(this);
        boundHandlers.touchstart = handleTouchStart.bind(this);
        boundHandlers.touchmove = handleTouchMove.bind(this);
        boundHandlers.touchend = handleTouchEnd.bind(this);

        canvas.addEventListener('wheel', boundHandlers.wheel, { passive: false });
        canvas.addEventListener('mousedown', boundHandlers.mousedown);
        canvas.addEventListener('mousemove', boundHandlers.mousemove);
        canvas.addEventListener('mouseup', boundHandlers.mouseup);
        canvas.addEventListener('mouseleave', boundHandlers.mouseleave);
        canvas.addEventListener('dblclick', boundHandlers.dblclick);
        canvas.addEventListener('touchstart', boundHandlers.touchstart, { passive: false });
        canvas.addEventListener('touchmove', boundHandlers.touchmove, { passive: false });
        canvas.addEventListener('touchend', boundHandlers.touchend);
    }

    /**
     * Unbind event listeners
     */
    function unbindEvents() {
        canvas.removeEventListener('wheel', boundHandlers.wheel);
        canvas.removeEventListener('mousedown', boundHandlers.mousedown);
        canvas.removeEventListener('mousemove', boundHandlers.mousemove);
        canvas.removeEventListener('mouseup', boundHandlers.mouseup);
        canvas.removeEventListener('mouseleave', boundHandlers.mouseleave);
        canvas.removeEventListener('dblclick', boundHandlers.dblclick);
        canvas.removeEventListener('touchstart', boundHandlers.touchstart);
        canvas.removeEventListener('touchmove', boundHandlers.touchmove);
        canvas.removeEventListener('touchend', boundHandlers.touchend);
    }

    /**
     * Destroy the interaction manager
     */
    function destroy() {
        unbindEvents();
    }

    // Initialize
    bindEvents();

    return {
        getViewState: getViewState,
        setViewRange: setViewRange,
        resetView: resetView,
        destroy: destroy
    };
}

module.exports = {
    createInteractionManager: createInteractionManager
};
