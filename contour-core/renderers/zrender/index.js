'use strict';

/**
 * ZRender Contour Renderer
 * Using zrender for canvas-based contour rendering with built-in interaction support
 */

var zrender = require('zrender');
var pathUtils = require('./paths');
var labelUtils = require('./labels');
var axesUtils = require('./axes');
var colorbarUtils = require('./colorbar');
var nullUtils = require('./nulls');
var heatmapUtils = require('./heatmap');

/**
 * ZRenderContourRenderer - Main renderer class
 */
function ZRenderContourRenderer(container, options) {
    options = options || {};

    // Initialize zrender instance (canvas only, no SVG)
    this.zr = zrender.init(container, {
        renderer: 'canvas',
        width: options.width || 600,
        height: options.height || 500,
        devicePixelRatio: options.devicePixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1)
    });

    // Create main container group
    this.mainGroup = new zrender.Group();
    this.zr.add(this.mainGroup);

    // Layer management for optimized rendering - order matters!
    this.layers = {
        background: new zrender.Group(),
        grid: new zrender.Group(),
        fills: new zrender.Group(),
        lines: new zrender.Group(),
        nullOverlay: new zrender.Group(),  // Null region overlay (on top of fills)
        axes: new zrender.Group(),
        labels: new zrender.Group(),
        overlay: new zrender.Group()
    };

    // Add layers to main group in correct order
    this.mainGroup.add(this.layers.background);
    this.mainGroup.add(this.layers.grid);
    this.mainGroup.add(this.layers.fills);
    this.mainGroup.add(this.layers.lines);
    this.mainGroup.add(this.layers.nullOverlay);  // Null overlay after fills
    this.mainGroup.add(this.layers.axes);
    this.mainGroup.add(this.layers.labels);
    this.mainGroup.add(this.layers.overlay);

    // Store configuration
    this.options = options;
    this.contourResult = null;
    this.style = null;

    // Event handlers
    this.eventHandlers = new Map();
    this.interactionEnabled = true;
}

/**
 * Render contours
 * Uses same rendering logic as canvas renderer:
 * 1. Background layer first
 * 2. Heatmap background (if coloring mode is 'heatmap')
 * 3. Fill layers from lowest to highest (each layer covers previous)
 * 4. Null regions overlay (if connectgaps is false)
 */
ZRenderContourRenderer.prototype.renderContours = function(result, style) {
    // Clear existing elements
    this.layers.background.removeAll();
    this.layers.fills.removeAll();
    this.layers.lines.removeAll();
    this.layers.nullOverlay.removeAll();  // Clear null overlay
    this.layers.labels.removeAll();  // Also clear labels when re-rendering contours

    this.contourResult = result;
    this.style = style;

    // Check if we need null handling
    var connectGaps = result.connectgaps !== undefined ? result.connectgaps : true;
    var needsNullHandling = !connectGaps && result.nullMask && result.nullCount > 0;

    // Get coloring mode
    var coloring = style.coloring || 'fill';

    // If null handling with clip path, apply clip to fills layer
    if (needsNullHandling && style.useClipMask !== false) {
        this.applyNullClipToLayer(result, style);
    }

    // Render heatmap background if coloring mode is 'heatmap'
    if (coloring === 'heatmap') {
        this.renderHeatmap(result, style);
    }

    // Create path elements using same logic as canvas renderer
    var contourElements = pathUtils.createContourPaths(result, style, this.options);

    // Process elements by type
    for (var i = 0; i < contourElements.length; i++) {
        var item = contourElements[i];
        var element = item.element;
        var type = item.type;

        if (type === 'background') {
            // Background rect goes to background layer
            this.layers.background.add(element);
        } else if (type === 'fill') {
            // Fill paths (CompoundPath with fill and optional stroke)
            this.layers.fills.add(element);
        }
    }

    // Render null regions as fallback when clipPath is not used
    // IMPORTANT: Only mask when connectgaps is false (like plotly.js does)
    if (needsNullHandling && style.useClipMask === false) {
        this.renderNulls(result, style);
    }

    // Attach events to fill elements only (not background)
    this.attachContourEvents(contourElements.filter(function(item) {
        return item.type === 'fill';
    }));
};

/**
 * Render null regions
 * Handles areas with null/missing data by overlaying masks
 *
 * @param {Object} contourResult - Contour computation result
 * @param {Object} style - Style options
 */
ZRenderContourRenderer.prototype.renderNulls = function(contourResult, style) {
    this.layers.nullOverlay.removeAll();

    if (!contourResult || !contourResult.nullMask) {
        return;
    }

    var nullElements = nullUtils.createNullElements(contourResult, style);

    for (var i = 0; i < nullElements.length; i++) {
        var item = nullElements[i];

        if (item.type === 'fill') {
            this.layers.nullOverlay.add(item.element);
        } else if (item.type === 'stroke') {
            this.layers.nullOverlay.add(item.element);
        }
        // Note: 'mask' type is handled separately via applyNullClipToLayer
    }

    this.zr.flush();
};

/**
 * Apply null region clipping to the fills layer
 * Uses zrender's clip path for smooth null boundaries
 *
 * @param {Object} contourResult - Contour computation result
 * @param {Object} style - Style options
 */
ZRenderContourRenderer.prototype.applyNullClipToLayer = function(contourResult, style) {
    if (!contourResult || !contourResult.nullMask) {
        return;
    }

    var clipPath = nullUtils.createNullClipPath(contourResult, style);

    if (clipPath && this.layers.fills) {
        // Create inverse clip: we want to show data areas, not null areas
        // zrender clip shows content inside the path, so we need the data boundary
        this.layers.fills.setClipPath(clipPath);
    }
};

/**
 * Clear null region clipping
 */
ZRenderContourRenderer.prototype.clearNullClip = function() {
    if (this.layers.fills) {
        this.layers.fills.setClipPath(null);
    }
};

/**
 * Render heatmap background
 * Draws heatmap image below contour lines when coloring mode is 'heatmap'
 *
 * @param {Object} contourResult - Contour computation result
 * @param {Object} style - Style options
 */
ZRenderContourRenderer.prototype.renderHeatmap = function(contourResult, style) {
    this.layers.background.removeAll();

    if (!contourResult || !contourResult.pathinfo || !contourResult.pathinfo[0]) {
        return;
    }

    // Get grid data from pathinfo
    var pathInfo = contourResult.pathinfo[0];
    var grid = {
        z: pathInfo.z,
        x: pathInfo.x,
        y: pathInfo.y
    };

    // Determine heatmap mode
    var heatmapMode = style.heatmapMode || 'interpolated';

    // Get colorscale
    var colorscale = style.colorscale || style.colorScale || 'Viridis';

    // Build heatmap style
    var heatmapStyle = {
        width: style.width || this.options.width || 600,
        height: style.height || this.options.height || 500,
        padding: style.padding || 30,
        colorscale: colorscale,
        dataRange: style.dataRange || {
            min: contourResult.zmin,
            max: contourResult.zmax
        },
        reverse: style.reverse || false,
        heatmapMode: heatmapMode
    };

    // Create heatmap element
    var heatmapElement = heatmapUtils.createInterpolatedHeatmap(grid, heatmapStyle);

    if (heatmapElement) {
        this.layers.background.add(heatmapElement);
    } else {
        // Fallback to basic rects if canvas not available
        var heatmapGroup = heatmapUtils.createHeatmapBackground(grid, heatmapStyle);
        if (heatmapGroup) {
            this.layers.background.add(heatmapGroup);
        }
    }

    this.zr.flush();
};

/**
 * Clear heatmap
 */
ZRenderContourRenderer.prototype.clearHeatmap = function() {
    this.layers.background.removeAll();
};

/**
 * Render labels
 * @param {Object} contourResult - Contour computation result
 * @param {Object} style - Style options
 */
ZRenderContourRenderer.prototype.renderLabels = function(contourResult, style) {
    this.layers.labels.removeAll();

    if (!contourResult || !contourResult.paths) {
        return;
    }

    var labelElements = labelUtils.createLabels(contourResult, style);

    for (var i = 0; i < labelElements.length; i++) {
        this.layers.labels.add(labelElements[i]);
    }
};

/**
 * Render axes
 */
ZRenderContourRenderer.prototype.renderAxes = function(axesConfig, style) {
    this.layers.axes.removeAll();
    this.layers.grid.removeAll();

    if (!axesConfig) {
        return;
    }

    // Draw grid first (behind axes)
    if (axesConfig.x && axesConfig.x.showgrid) {
        axesUtils.drawXGrid(this.layers.grid, axesConfig, style);
    }

    if (axesConfig.y && axesConfig.y.showgrid) {
        axesUtils.drawYGrid(this.layers.grid, axesConfig, style);
    }

    // Draw axes on top of grid
    if (axesConfig.x) {
        axesUtils.drawXAxis(this.layers.axes, axesConfig, style);
    }

    if (axesConfig.y) {
        axesUtils.drawYAxis(this.layers.axes, axesConfig, style);
    }
};

/**
 * Render colorbar
 */
ZRenderContourRenderer.prototype.renderColorbar = function(result, colors, config) {
    // Remove existing colorbar
    if (this.colorbarElement) {
        this.mainGroup.remove(this.colorbarElement);
    }

    if (!config || config.show === false) {
        return;
    }

    var colorbarGroup = colorbarUtils.createColorbar(result, colors, config, this.options);
    this.colorbarElement = colorbarGroup;
    // Add colorbar after labels (on top)
    this.mainGroup.add(colorbarGroup);
};

/**
 * Attach events to contour elements
 * Works with both individual elements and Groups
 */
ZRenderContourRenderer.prototype.attachContourEvents = function(elements) {
    var self = this;

    for (var i = 0; i < elements.length; i++) {
        var item = elements[i];
        var element = item.element;
        var level = item.level;

        // For Group elements, we need to attach events to each child
        // and also to the group itself for proper hit detection
        if (element.isGroup) {
            // Attach events to group (catches events from any child)
            attachEventsToElement(element, level, element);
        } else {
            // Single element
            attachEventsToElement(element, level, element);
        }
    }

    function attachEventsToElement(el, lvl, originalElement) {
        el.on('mouseover', function(e) {
            self.handleContourHover(e, originalElement, lvl);
        });

        el.on('mouseout', function(e) {
            self.handleContourHoverEnd(e);
        });

        el.on('click', function(e) {
            self.handleContourClick(e, lvl);
        });
    }
};

/**
 * Handle contour hover
 * Works with both Polygon and Group elements
 */
ZRenderContourRenderer.prototype.handleContourHover = function(e, element, level) {
    if (!this.interactionEnabled) return;
    if (level === null) return; // Skip background

    // Clear previous highlight
    this.layers.overlay.removeAll();

    // Get bounding rect (works for both single elements and Groups)
    var rect = element.getBoundingRect();
    var padding = 5;

    // Create highlight effect as a bounding box
    var highlight = new zrender.Rect({
        shape: {
            x: rect.x - padding,
            y: rect.y - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2
        },
        style: {
            fill: 'none',
            stroke: this.options.highlightColor || '#ffff00',
            lineWidth: 2,
            lineDash: [4, 4],
            opacity: 0.8
        },
        z: 1000
    });

    this.layers.overlay.add(highlight);
    this._highlightElement = highlight;
    this._highlightOriginal = element;

    // Set cursor
    if (this.zr.dom) {
        this.zr.dom.style.cursor = 'pointer';
    }

    // Trigger callback
    if (this.options.onHoverStart) {
        this.options.onHoverStart({
            level: level,
            event: e
        });
    }
};

/**
 * Handle contour hover end
 * Improved with proper cursor restoration
 */
ZRenderContourRenderer.prototype.handleContourHoverEnd = function(e) {
    this.layers.overlay.removeAll();
    this._highlightElement = null;
    this._highlightOriginal = null;

    // Reset cursor
    if (this.zr.dom) {
        this.zr.dom.style.cursor = 'default';
    }

    if (this.options.onHoverEnd) {
        this.options.onHoverEnd(e);
    }
};

/**
 * Handle contour click
 */
ZRenderContourRenderer.prototype.handleContourClick = function(e, level) {
    if (!this.interactionEnabled) return;

    if (this.options.onContourClick) {
        this.options.onContourClick({
            level: level,
            event: e
        });
    }
};

/**
 * Initialize zoom interaction
 * Optimized for smooth, centered zooming
 */
ZRenderContourRenderer.prototype.initZoom = function(options) {
    var self = this;
    options = options || {};

    this.zoomState = {
        scale: 1,
        minX: options.minScale || 0.1,
        maxX: options.maxScale || 10,
        baseScale: 1
    };

    // Mouse wheel zoom - use wheel event for better cross-browser support
    this.zr.on('mousewheel', function(e) {
        if (!self.interactionEnabled) return;
        if (options.wheelEnabled === false) return;

        e.stop();
        self.handleWheel(e, options);
    });

    // Pinch zoom support (for touch devices)
    this.zr.on('pinch', function(e) {
        if (!self.interactionEnabled) return;
        if (options.pinchEnabled === false) return;

        e.stop();
        self.handlePinch(e, options);
    });
};

/**
 * Handle wheel zoom
 * Improved for centered zooming with proper delta calculation
 */
ZRenderContourRenderer.prototype.handleWheel = function(e, options) {
    // Calculate zoom delta based on wheel direction
    // wheelDelta: positive = scroll up (zoom in), negative = scroll down (zoom out)
    var zoomFactor = options.zoomFactor || 0.001;
    var delta = 1 + (e.wheelDelta || -e.deltaY) * zoomFactor;

    var newScale = this.zoomState.scale * delta;

    // Clamp scale
    newScale = Math.max(this.zoomState.minX, Math.min(this.zoomState.maxX, newScale));

    // Apply centered zoom
    this.applyZoom(newScale, e.offsetX, e.offsetY);

    if (options.onZoom) {
        options.onZoom({
            scale: newScale,
            centerX: e.offsetX,
            centerY: e.offsetY
        });
    }

    this.zoomState.scale = newScale;
};

/**
 * Handle pinch zoom (touch devices)
 */
ZRenderContourRenderer.prototype.handlePinch = function(e, options) {
    var pinchScale = e.pinchScale || 1;
    var newScale = this.zoomState.scale * pinchScale;

    // Clamp scale
    newScale = Math.max(this.zoomState.minX, Math.min(this.zoomState.maxX, newScale));

    // Apply centered zoom at pinch position
    this.applyZoom(newScale, e.clientX, e.clientY);

    if (options.onZoom) {
        options.onZoom({
            scale: newScale,
            centerX: e.clientX,
            centerY: e.clientY,
            pinch: true
        });
    }

    this.zoomState.scale = newScale;
};

/**
 * Apply zoom transform with center point preservation
 * Optimized for smooth, centered zooming
 */
ZRenderContourRenderer.prototype.applyZoom = function(scale, centerX, centerY) {
    var group = this.mainGroup;
    var currentScale = group.scaleX || 1;
    var scaleChange = scale / currentScale;

    // Get current position
    var currentX = group.x || 0;
    var currentY = group.y || 0;

    // Calculate new position to keep center point stable
    // Formula: newPos = center - (center - oldPos) * scaleChange
    var newX = centerX - (centerX - currentX) * scaleChange;
    var newY = centerY - (centerY - currentY) * scaleChange;

    group.attr({
        x: newX,
        y: newY,
        scaleX: scale,
        scaleY: scale
    });

    this.zr.flush();
};

/**
 * Initialize pan interaction
 * Optimized with boundary constraints and better cursor handling
 */
ZRenderContourRenderer.prototype.initPan = function(options) {
    var self = this;
    options = options || {};

    this.panState = {
        isDragging: false,
        lastX: 0,
        lastY: 0,
        startX: 0,
        startY: 0
    };

    // Get container element for cursor management
    var dom = this.zr.dom;

    this.zr.on('mousedown', function(e) {
        if (!self.interactionEnabled) return;
        if (options.dragEnabled === false) return;

        self.panState.isDragging = true;
        self.panState.lastX = e.offsetX;
        self.panState.lastY = e.offsetY;
        self.panState.startX = e.offsetX;
        self.panState.startY = e.offsetY;

        // Change cursor to grabbing
        if (dom) {
            dom.style.cursor = 'grabbing';
        }

        if (options.onPanStart) {
            options.onPanStart(e);
        }
    });

    this.zr.on('mousemove', function(e) {
        if (!self.panState.isDragging) return;

        var dx = e.offsetX - self.panState.lastX;
        var dy = e.offsetY - self.panState.lastY;

        var group = self.mainGroup;
        var newX = group.x + dx;
        var newY = group.y + dy;

        // Apply boundary constraints if configured
        if (options.bounds) {
            var bounds = options.bounds;
            newX = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
            newY = Math.max(bounds.minY, Math.min(bounds.maxY, newY));
        }

        group.attr({
            x: newX,
            y: newY
        });

        self.panState.lastX = e.offsetX;
        self.panState.lastY = e.offsetY;
        self.zr.flush();

        if (options.onPan) {
            options.onPan({
                dx: dx,
                dy: dy,
                totalDx: e.offsetX - self.panState.startX,
                totalDy: e.offsetY - self.panState.startY
            });
        }
    });

    this.zr.on('mouseup', endPan);
    this.zr.on('globalout', endPan);

    function endPan() {
        if (self.panState.isDragging) {
            self.panState.isDragging = false;

            // Reset cursor
            if (dom) {
                dom.style.cursor = 'default';
            }

            if (options.onPanEnd) {
                options.onPanEnd();
            }
        }
    }
};

/**
 * Reset view to default state
 * Supports animated transition
 */
ZRenderContourRenderer.prototype.resetView = function(animate) {
    var group = this.mainGroup;
    var self = this;

    if (animate && this.zr.animation) {
        // Animate back to default state
        var duration = 300;
        var easing = 'cubicOut';

        group.animateTo({
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1
        }, duration, easing, function() {
            self.zr.flush();
            if (self.zoomState) {
                self.zoomState.scale = 1;
            }
        });
    } else {
        // Immediate reset
        group.attr({
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1
        });

        if (this.zoomState) {
            this.zoomState.scale = 1;
        }

        this.zr.flush();
    }
};

/**
 * Enable/disable interaction
 */
ZRenderContourRenderer.prototype.setInteractionEnabled = function(enabled) {
    this.interactionEnabled = enabled;
};

/**
 * Resize
 */
ZRenderContourRenderer.prototype.resize = function(width, height) {
    this.zr.resize({
        width: width,
        height: height
    });
};

/**
 * Get current state
 */
ZRenderContourRenderer.prototype.getState = function() {
    return {
        x: this.mainGroup.x,
        y: this.mainGroup.y,
        scale: this.mainGroup.scaleX || 1,
        zoom: this.zoomState ? this.zoomState.scale : 1
    };
};

/**
 * Dispose
 */
ZRenderContourRenderer.prototype.dispose = function() {
    this.zr.dispose();
};

// Export factory function
function createRenderer(container, options) {
    return new ZRenderContourRenderer(container, options);
}

module.exports = {
    ZRenderContourRenderer: ZRenderContourRenderer,
    createRenderer: createRenderer
};
