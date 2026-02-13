'use strict';

/**
 * createInteraction - Factory function to create interactive contour visualization
 *
 * This is the main entry point for creating an interactive contour chart.
 * It integrates EventManager, StateManager, CoordinateConverter, and handlers.
 */

var EventManager = require('./EventManager');
var StateManager = require('./StateManager');
var CoordinateConverter = require('./CoordinateConverter');
var ZoomHandler = require('./handlers/Zoom');
var PanHandler = require('./handlers/Pan');
var HoverHandler = require('./handlers/Hover');

var canvasRenderer = require('../renderers/canvas');
var computeModule = require('../compute');

/**
 * Create an interactive contour visualization
 *
 * @param {String|HTMLElement} container - Container selector or element
 * @param {Object} config - Configuration object
 * @returns {Object} Interactive contour instance
 */
function createInteraction(container, config) {
    config = config || {};

    // Get container element
    var element = typeof container === 'string'
        ? document.querySelector(container)
        : container;

    if (!element) {
        throw new Error('Container element not found');
    }

    // Store config
    var interactionConfig = config.interaction || {};
    var dataConfig = {
        z: config.z,
        x: config.x,
        y: config.y
    };

    // Computation result cache
    var contourResult = null;
    var renderRequested = false;
    var rafId = null;

    // ============================================
    // Initialize components
    // ============================================

    // Create canvas element
    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.cursor = 'grab';
    element.appendChild(canvas);

    var ctx = canvas.getContext('2d');

    // Set canvas size
    var width = config.width || element.clientWidth || 600;
    var height = config.height || element.clientHeight || 500;
    canvas.width = width;
    canvas.height = height;

    // Initialize state manager
    var stateManager = new StateManager({
        xMin: 0,
        xMax: config.x ? config.x[config.x.length - 1] : 100,
        yMin: 0,
        yMax: config.y ? config.y[config.y.length - 1] : 100,
        constraints: interactionConfig.constraints
    });

    // Initialize coordinate converter
    var converter = new CoordinateConverter({
        xMin: 0,
        xMax: config.x ? config.x[config.x.length - 1] : 100,
        yMin: 0,
        yMax: config.y ? config.y[config.y.length - 1] : 100,
        width: width,
        height: height,
        margins: config.margins || { left: 50, right: 30, top: 20, bottom: 50 }
    });

    // Initialize handlers
    var zoomHandler = new ZoomHandler(interactionConfig.zoom);
    var panHandler = new PanHandler(interactionConfig.pan);
    var hoverHandler = new HoverHandler(interactionConfig.hover);

    // Initialize event manager
    var eventManager = new EventManager();

    // Interaction state
    var panState = null;
    var boxState = null;
    var hoverData = null;
    var isInteractionEnabled = true;

    // Callbacks
    var callbacks = {
        viewChange: [],
        hover: [],
        click: [],
        zoomStart: [],
        zoomEnd: []
    };

    // ============================================
    // Core functions
    // ============================================

    /**
     * Request a render (debounced)
     */
    function requestRender() {
        if (rafId) {
            return; // Already scheduled
        }
        rafId = requestAnimationFrame(function() {
            render();
            rafId = null;
        });
    }

    /**
     * Main render function
     */
    function render() {
        if (!contourResult) {
            return;
        }

        var view = stateManager.getViewRange();
        var transform = stateManager.getTransform();

        // Update converter with current state
        converter.update(view, transform);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        ctx.save();

        // Get plot area and original data bounds
        var plotArea = converter.getPlotArea();
        var dataBounds = stateManager.dataBounds;

        // Calculate how much the view has shifted from original bounds
        // This is the offset we need to apply to the canvas
        var dataWidth = dataBounds.xMax - dataBounds.xMin;
        var dataHeight = dataBounds.yMax - dataBounds.yMin;
        var viewWidth = view.xMax - view.xMin;
        var viewHeight = view.yMax - view.yMin;

        // Calculate scale (pixels per data unit)
        var scaleX = plotArea.width / dataWidth;
        var scaleY = plotArea.height / dataHeight;

        // Calculate offset in pixels based on view shift
        // NEGATE offset because: when view shifts right (we see more on right), canvas moves left
        var offsetX = -(view.xMin - dataBounds.xMin) * scaleX;
        var offsetY = (view.yMax - dataBounds.yMax) * scaleY; // Y: positive = move down (canvas direction)

        // Get zoom center (from transform or default to plot area center)
        var zoomCenterX = transform.zoomCenterX !== undefined ? transform.zoomCenterX : (plotArea.x + plotArea.width / 2);
        var zoomCenterY = transform.zoomCenterY !== undefined ? transform.zoomCenterY : (plotArea.y + plotArea.height / 2);

        // Apply transforms in order:
        // 1. Translate to zoom center
        ctx.translate(zoomCenterX, zoomCenterY);
        // 2. Apply zoom scale
        ctx.scale(transform.k, transform.k);
        // 3. Translate back from zoom center
        ctx.translate(-zoomCenterX, -zoomCenterY);
        // 4. Apply pan offset
        ctx.translate(offsetX, offsetY);

        // Draw contours
        var style = {
            width: width,
            height: height,
            x: contourResult.pathinfo && contourResult.pathinfo[0] ? contourResult.pathinfo[0].x : dataConfig.x,
            y: contourResult.pathinfo && contourResult.pathinfo[0] ? contourResult.pathinfo[0].y : dataConfig.y,
            z: contourResult.pathinfo && contourResult.pathinfo[0] ? contourResult.pathinfo[0].z : dataConfig.z,
            coloring: config.contours ? config.contours.type : 'fill',
            showLines: true,
            lineWidth: 1.5,
            lineColor: '#666',
            colorScale: buildColorScale(contourResult.levels, config.colorscale),
            valueColorMap: config.valueColorMap,
            smoothing: config.smoothing || 0
        };

        canvasRenderer.drawContours(ctx, contourResult, style);

        ctx.restore();

        // Draw box selection if active
        if (boxState && boxState.active) {
            drawBoxSelection();
        }

        // Draw tooltip if enabled
        if (hoverData && interactionConfig.hover && interactionConfig.hover.tooltip) {
            drawTooltip();
        }
    }

    /**
     * Build color scale array
     */
    function buildColorScale(levels, colorscale) {
        // Simplified - use provided colorscale or default
        var colors = getColorScale(colorscale);
        var scale = [];
        for (var i = 0; i < levels.length; i++) {
            var t = levels.length > 1 ? i / (levels.length - 1) : 0;
            var colorIdx = Math.floor(t * (colors.length - 1));
            scale.push([levels[i], colors[colorIdx]]);
        }
        return scale;
    }

    /**
     * Get color scale array
     */
    function getColorScale(colorscale) {
        if (Array.isArray(colorscale)) {
            return colorscale;
        }

        // Preset color scales
        var COLOR_SCALES = {
            viridis: ['#440154', '#482878', '#3e4a89', '#31688e', '#26828f',
                      '#1f9d8a', '#35b779', '#6dcd59', '#b4de2c', '#fde725'],
            plasma: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786',
                     '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'],
            hot: ['#000000', '#4a0000', '#880000', '#c20000', '#ff0000',
                  '#ff4a00', '#ff8800', '#ffc200', '#ffff00', '#ffff80'],
            jet: ['#000080', '#0000ff', '#0080ff', '#00ffff', '#80ff80',
                  '#ffff00', '#ff8000', '#ff0000', '#800000', '#000000'],
            earth: ['#2a1c0b', '#5c4033', '#8f6b4e', '#c19a6b', '#e5c99b',
                    '#f5e6c8', '#8b4513', '#a0522d', '#cd853f', '#deb887'],
            electric: ['#000004', '#1b0c42', '#4a0c6e', '#781c6d', '#a52c60',
                       '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4']
        };

        // Handle color scale name
        if (typeof colorscale === 'string') {
            var name = colorscale.toLowerCase();
            if (COLOR_SCALES[name]) {
                return COLOR_SCALES[name];
            }
        }

        // Default to Viridis
        return COLOR_SCALES.viridis;
    }

    /**
     * Draw box selection rectangle
     */
    function drawBoxSelection() {
        var rect = zoomHandler.getBoxRect(boxState);
        if (!rect) return;

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 100, 200, 0.8)';
        ctx.fillStyle = 'rgba(0, 100, 200, 0.2)';
        ctx.lineWidth = 1;

        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.restore();
    }

    /**
     * Draw tooltip
     */
    function drawTooltip() {
        if (!hoverData) return;

        var text = hoverHandler.formatTooltip(hoverData, config.tooltip || {});
        if (!text) return;

        var padding = 8;
        var fontSize = 12;
        ctx.font = fontSize + 'px Arial';
        var textWidth = ctx.measureText(text).width;
        var tooltipWidth = textWidth + padding * 2;
        var tooltipHeight = fontSize + padding * 2;

        var pos = hoverHandler.clampTooltipPosition(
            hoverData.screen.x,
            hoverData.screen.y,
            tooltipWidth,
            tooltipHeight,
            width,
            height
        );

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(pos.x, pos.y, tooltipWidth, tooltipHeight);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, pos.x + padding, pos.y + padding);
        ctx.restore();
    }

    // ============================================
    // Event handlers
    // ============================================

    function onMouseDown(event) {
        if (!isInteractionEnabled) return;

        // Check interaction mode
        // Left button (0) + Shift = Box zoom
        // Left button (0) without Shift = Pan
        // Middle button (1) = Pan

        if (event.button === 0 && event.shiftKey) {
            // Box zoom (Shift + Left click)
            boxState = zoomHandler.startBoxZoom(event, stateManager);
            event.preventDefault();
        } else if (event.button === 0 || event.button === 1) {
            // Pan (Left click or Middle click)
            panState = panHandler.startPan(event, stateManager);
            canvas.style.cursor = 'grabbing';
            event.preventDefault();
        }
    }

    function onMouseMove(event) {
        if (!isInteractionEnabled) return;

        // Handle pan
        if (panHandler.isPanning(panState)) {
            var panUpdate = panHandler.handlePan(event, panState, stateManager, converter);
            if (panUpdate) {
                stateManager.update(panUpdate);
                requestRender();
            }
            return;
        }

        // Handle box zoom
        if (boxState && boxState.active) {
            boxState = zoomHandler.updateBoxZoom(event, boxState);
            requestRender();
            return;
        }

        // Handle hover
        if (interactionConfig.hover && interactionConfig.hover.enabled !== false) {
            hoverHandler.setGridData(dataConfig);
            var newHoverData = hoverHandler.handleMove(event, converter, dataConfig);

            if (newHoverData) {
                hoverData = newHoverData;
                requestRender();

                // Notify hover callback
                callbacks.hover.forEach(function(cb) {
                    try { cb(hoverData); } catch (e) { console.error(e); }
                });
            } else if (hoverData) {
                hoverData = null;
                requestRender();
            }
        }
    }

    function onMouseUp(event) {
        if (!isInteractionEnabled) return;

        // End pan
        if (panHandler.isPanning(panState)) {
            panState = panHandler.endPan(event, panState);
            canvas.style.cursor = 'grab';
        }

        // End box zoom
        if (boxState && boxState.active) {
            var boxUpdate = zoomHandler.finishBoxZoom(event, boxState, stateManager, converter);
            if (boxUpdate) {
                stateManager.update(boxUpdate);
                notifyViewChange();
            }
            boxState = zoomHandler.cancelBoxZoom();
            requestRender();
        }
    }

    function onWheel(event) {
        if (!isInteractionEnabled) return;

        if (interactionConfig.zoom && interactionConfig.zoom.wheelEnabled !== false) {
            var zoomUpdate = zoomHandler.handleWheel(event, stateManager, converter);
            if (zoomUpdate) {
                stateManager.update(zoomUpdate);
                requestRender();
                notifyViewChange();
            }
        }
    }

    function onDoubleClick(event) {
        if (!isInteractionEnabled) return;

        if (interactionConfig.doubleClickReset !== false) {
            resetView();
        }
    }

    function onMouseLeave(event) {
        // Cancel pan and box zoom
        panState = null;
        if (boxState && boxState.active) {
            boxState = zoomHandler.cancelBoxZoom();
            requestRender();
        }

        // Clear hover
        if (hoverData) {
            hoverData = null;
            requestRender();
        }

        canvas.style.cursor = 'grab';
    }

    function notifyViewChange() {
        var view = stateManager.getViewRange();
        callbacks.viewChange.forEach(function(cb) {
            try { cb(view); } catch (e) { console.error(e); }
        });
    }

    // ============================================
    // Bind events
    // ============================================

    eventManager.on(canvas, 'mousedown', onMouseDown, { passive: false });
    eventManager.on(canvas, 'mousemove', onMouseMove, { passive: false });
    eventManager.on(canvas, 'mouseup', onMouseUp);
    eventManager.on(canvas, 'mouseleave', onMouseLeave);
    eventManager.on(canvas, 'wheel', onWheel, { passive: false });
    eventManager.on(canvas, 'dblclick', onDoubleClick);

    // Listen to state changes
    stateManager.onChange(function(oldState, newState) {
        // State changed internally, re-render
        requestRender();
    });

    // ============================================
    // Initial computation
    // ============================================

    function compute() {
        var options = {
            autocontour: config.autocontour !== false,
            ncontours: config.ncontours || 15,
            start: config.contours ? config.contours.start : undefined,
            end: config.contours ? config.contours.end : undefined,
            size: config.contours ? config.contours.size : undefined,
            smoothing: config.smoothing !== undefined ? config.smoothing : 0.5,
            valueColorMap: config.valueColorMap
        };

        contourResult = computeModule.computeContours(dataConfig, options);
        return contourResult;
    }

    // Compute initial contours
    compute();

    // Initial render
    requestRender();

    // ============================================
    // Public API
    // ============================================

    return {
        // Update data
        update: function(newData) {
            if (newData.z) dataConfig.z = newData.z;
            if (newData.x) dataConfig.x = newData.x;
            if (newData.y) dataConfig.y = newData.y;

            contourResult = compute();
            requestRender();
        },

        // Set view range
        setView: function(xMin, xMax, yMin, yMax) {
            var currentTransform = stateManager.getTransform();
            stateManager.update({
                view: { xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax }
            });
            requestRender();
            notifyViewChange();
        },

        // Get current view
        getView: function() {
            return stateManager.getViewRange();
        },

        // Reset view
        resetView: function() {
            stateManager.reset();
            requestRender();
            notifyViewChange();
        },

        // Zoom to range
        zoomTo: function(x1, y1, x2, y2, options) {
            var zoomUpdate = zoomHandler.zoomToRange(x1, x2, y1, y2, stateManager, converter);
            stateManager.update(zoomUpdate);
            requestRender();
            notifyViewChange();
        },

        // Pan by offset
        panTo: function(dx, dy, options) {
            var panUpdate = panHandler.panBy(dx, dy, stateManager);
            stateManager.update(panUpdate);
            requestRender();
            notifyViewChange();
        },

        // Enable/disable interaction
        enableInteraction: function(enabled) {
            isInteractionEnabled = enabled;
            canvas.style.cursor = enabled ? 'grab' : 'default';
        },

        // Event registration
        onViewChange: function(callback) {
            if (typeof callback === 'function') {
                callbacks.viewChange.push(callback);
            }
        },

        onHover: function(callback) {
            if (typeof callback === 'function') {
                callbacks.hover.push(callback);
            }
        },

        onClick: function(callback) {
            if (typeof callback === 'function') {
                callbacks.click.push(callback);
            }
        },

        onZoomStart: function(callback) {
            if (typeof callback === 'function') {
                callbacks.zoomStart.push(callback);
            }
        },

        onZoomEnd: function(callback) {
            if (typeof callback === 'function') {
                callbacks.zoomEnd.push(callback);
            }
        },

        // Get internal components (for advanced usage)
        getComponents: function() {
            return {
                stateManager: stateManager,
                converter: converter,
                eventManager: eventManager,
                zoomHandler: zoomHandler,
                panHandler: panHandler,
                hoverHandler: hoverHandler
            };
        },

        // Resize
        resize: function(newWidth, newHeight) {
            width = newWidth || width;
            height = newHeight || height;
            canvas.width = width;
            canvas.height = height;
            converter.updateScreenSize(width, height);
            requestRender();
        },

        // Destroy
        destroy: function() {
            eventManager.destroy();
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            if (element.contains(canvas)) {
                element.removeChild(canvas);
            }
        },

        // Get canvas element
        getCanvas: function() {
            return canvas;
        }
    };
}

module.exports = createInteraction;
