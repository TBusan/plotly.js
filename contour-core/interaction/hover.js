'use strict';

/**
 * Hover functionality for contour lines
 * Detects when mouse is near a contour line and shows tooltip with value info
 */

/**
 * Create a hover manager
 *
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} config - Configuration options
 * @param {boolean} config.enabled - Enable hover (default: true)
 * @param {number} config.hitRadius - Pixel radius for hit detection (default: 5)
 * @param {Function} config.onHover - Hover callback function(data)
 * @param {Function} config.onLeave - Mouse leave callback
 * @returns {Object} Hover manager API
 */
function createHoverManager(canvas, contourResult, config) {
    config = config || {};

    var enabled = config.enabled !== false;
    var hitRadius = config.hitRadius || 5;
    var viewManager = config.viewManager;
    var drawingArea = config.drawingArea;
    var style = config.style || {};

    // Store path pixel data for hit testing
    var pathPixelData = [];
    var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];

    /**
     * Pre-compute pixel coordinates for all contour paths
     * This is called after rendering to cache pixel positions
     */
    function computePathPixels() {
        pathPixelData = [];

        if (!contourResult.paths || !pathInfo) return;

        var x = pathInfo.x || [];
        var y = pathInfo.y || [];

        // Get visible range for coordinate conversion
        var visibleRange = viewManager ? viewManager.getState() : null;
        var fullRange = viewManager ? viewManager.getFullRange() : null;
        var range = visibleRange || fullRange;

        if (!range) return;

        var xMin = range.xMin;
        var xMax = range.xMax;
        var yMin = range.yMin;
        var yMax = range.yMax;
        var xRange = xMax - xMin || 1;
        var yRange = yMax - yMin || 1;

        // Process each contour level
        var levels = contourResult.levels || [];

        for (var i = 0; i < contourResult.paths.length; i++) {
            var pathData = contourResult.paths[i];
            var level = pathData.level;

            // Process closed paths
            if (pathData.paths) {
                for (var j = 0; j < pathData.paths.length; j++) {
                    var path = pathData.paths[j];
                    if (!path || path.length < 2) continue;

                    // Convert data coordinates to pixel coordinates
                    var pixels = [];
                    for (var k = 0; k < path.length; k++) {
                        var pt = path[k];
                        if (!pt || isNaN(pt[0]) || isNaN(pt[1])) continue;

                        var px, py;
                        if (drawingArea) {
                            px = drawingArea.x + ((pt[0] - xMin) / xRange) * drawingArea.width;
                            py = drawingArea.y + drawingArea.height - ((pt[1] - yMin) / yRange) * drawingArea.height;
                        } else {
                            // Fallback without drawingArea
                            px = pt[0];
                            py = pt[1];
                        }

                        pixels.push({ x: px, y: py, dataX: pt[0], dataY: pt[1] });
                    }

                    if (pixels.length >= 2) {
                        pathPixelData.push({
                            level: level,
                            levelIndex: i,
                            pixels: pixels,
                            closed: true
                        });
                    }
                }
            }

            // Process edge paths
            if (pathData.edgepaths) {
                for (var j = 0; j < pathData.edgepaths.length; j++) {
                    var path = pathData.edgepaths[j];
                    if (!path || path.length < 2) continue;

                    var pixels = [];
                    for (var k = 0; k < path.length; k++) {
                        var pt = path[k];
                        if (!pt || isNaN(pt[0]) || isNaN(pt[1])) continue;

                        var px, py;
                        if (drawingArea) {
                            px = drawingArea.x + ((pt[0] - xMin) / xRange) * drawingArea.width;
                            py = drawingArea.y + drawingArea.height - ((pt[1] - yMin) / yRange) * drawingArea.height;
                        } else {
                            px = pt[0];
                            py = pt[1];
                        }

                        pixels.push({ x: px, y: py, dataX: pt[0], dataY: pt[1] });
                    }

                    if (pixels.length >= 2) {
                        pathPixelData.push({
                            level: level,
                            levelIndex: i,
                            pixels: pixels,
                            closed: false
                        });
                    }
                }
            }
        }
    }

    /**
     * Calculate distance from point to line segment
     */
    function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            // Segment is a point
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }

        // Project point onto line segment
        var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
        var projX = x1 + t * dx;
        var projY = y1 + t * dy;

        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }

    /**
     * Find nearest contour point to mouse position
     */
    function findNearestContour(mouseX, mouseY) {
        var minDistance = Infinity;
        var nearestPoint = null;

        for (var i = 0; i < pathPixelData.length; i++) {
            var pathData = pathPixelData[i];
            var pixels = pathData.pixels;

            for (var j = 0; j < pixels.length - 1; j++) {
                var p1 = pixels[j];
                var p2 = pixels[j + 1];

                var dist = pointToSegmentDistance(mouseX, mouseY, p1.x, p1.y, p2.x, p2.y);

                if (dist < minDistance) {
                    minDistance = dist;

                    // Calculate interpolated position along segment
                    var dx = p2.x - p1.x;
                    var dy = p2.y - p1.y;
                    var lengthSq = dx * dx + dy * dy;
                    var t = lengthSq > 0 ? Math.max(0, Math.min(1, ((mouseX - p1.x) * dx + (mouseY - p1.y) * dy) / lengthSq)) : 0;

                    nearestPoint = {
                        level: pathData.level,
                        pixelX: p1.x + t * dx,
                        pixelY: p1.y + t * dy,
                        dataX: p1.dataX + t * (p2.dataX - p1.dataX),
                        dataY: p1.dataY + t * (p2.dataY - p1.dataY),
                        distance: dist
                    };
                }
            }
        }

        return nearestPoint;
    }

    /**
     * Handle mouse move for hover detection
     */
    function handleMouseMove(e) {
        if (!enabled) return;

        var rect = canvas.getBoundingClientRect();
        var mouseX = e.clientX - rect.left;
        var mouseY = e.clientY - rect.top;

        // Check if mouse is in drawing area
        if (drawingArea) {
            if (mouseX < drawingArea.x || mouseX > drawingArea.x + drawingArea.width ||
                mouseY < drawingArea.y || mouseY > drawingArea.y + drawingArea.height) {
                if (config.onLeave) config.onLeave();
                return;
            }
        }

        // Find nearest contour point
        var nearest = findNearestContour(mouseX, mouseY);

        if (nearest && nearest.distance <= hitRadius) {
            // Mouse is near a contour line
            if (config.onHover) {
                config.onHover({
                    level: nearest.level,
                    x: nearest.dataX,
                    y: nearest.dataY,
                    pixelX: nearest.pixelX,
                    pixelY: nearest.pixelY,
                    mouseX: mouseX,
                    mouseY: mouseY
                });
            }
        } else {
            // Mouse is not near any contour line
            if (config.onLeave) {
                config.onLeave();
            }
        }
    }

    /**
     * Handle mouse leave
     */
    function handleMouseLeave() {
        if (config.onLeave) {
            config.onLeave();
        }
    }

    /**
     * Enable hover functionality
     */
    function enable() {
        enabled = true;
    }

    /**
     * Disable hover functionality
     */
    function disable() {
        enabled = false;
        if (config.onLeave) {
            config.onLeave();
        }
    }

    /**
     * Check if hover is enabled
     */
    function isEnabled() {
        return enabled;
    }

    /**
     * Update configuration
     */
    function updateConfig(newConfig) {
        if (newConfig.enabled !== undefined) {
            enabled = newConfig.enabled;
        }
        if (newConfig.hitRadius !== undefined) {
            hitRadius = newConfig.hitRadius;
        }
        if (newConfig.contourResult !== undefined) {
            contourResult = newConfig.contourResult;
            computePathPixels();
        }
        if (newConfig.viewManager !== undefined) {
            viewManager = newConfig.viewManager;
        }
        if (newConfig.drawingArea !== undefined) {
            drawingArea = newConfig.drawingArea;
        }
        if (newConfig.style !== undefined) {
            style = newConfig.style;
        }
    }

    /**
     * Recompute path pixels (call after zoom/pan)
     */
    function refresh() {
        computePathPixels();
    }

    /**
     * Destroy hover manager
     */
    function destroy() {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
        pathPixelData = [];
    }

    // Initialize
    computePathPixels();
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return {
        enable: enable,
        disable: disable,
        isEnabled: isEnabled,
        updateConfig: updateConfig,
        refresh: refresh,
        destroy: destroy
    };
}

/**
 * Create a tooltip element
 *
 * @param {Object} options - Tooltip options
 * @param {string} options.container - Container element or selector
 * @param {string} options.className - CSS class name for tooltip
 * @param {Function} options.formatter - Function to format tooltip content
 * @returns {Object} Tooltip API
 */
function createTooltip(options) {
    options = options || {};

    var container = typeof options.container === 'string'
        ? document.querySelector(options.container)
        : options.container || document.body;

    var className = options.className || 'contour-tooltip';
    var formatter = options.formatter || defaultFormatter;

    // Create tooltip element
    var tooltip = document.createElement('div');
    tooltip.className = className;
    tooltip.style.cssText = [
        'position: absolute',
        'pointer-events: none',
        'display: none',
        'background: rgba(0, 0, 0, 0.8)',
        'color: white',
        'padding: 8px 12px',
        'border-radius: 4px',
        'font-size: 12px',
        'font-family: Arial, sans-serif',
        'white-space: nowrap',
        'z-index: 1000',
        'box-shadow: 0 2px 8px rgba(0,0,0,0.2)'
    ].join(';');
    container.appendChild(tooltip);

    function defaultFormatter(data) {
        var lines = [];
        if (data.level !== undefined) {
            lines.push('值: ' + data.level.toFixed(2));
        }
        if (data.x !== undefined) {
            lines.push('X: ' + data.x.toFixed(4));
        }
        if (data.y !== undefined) {
            lines.push('Y: ' + data.y.toFixed(4));
        }
        return lines.join('<br>');
    }

    /**
     * Show tooltip at position
     */
    function show(data, x, y) {
        tooltip.innerHTML = formatter(data);
        tooltip.style.display = 'block';

        // Position tooltip
        var rect = tooltip.getBoundingClientRect();
        var containerRect = container.getBoundingClientRect();

        // Calculate position with offset
        var left = x - containerRect.left + 15;
        var top = y - containerRect.top - 10;

        // Keep tooltip within container bounds
        if (left + rect.width > containerRect.width) {
            left = x - containerRect.left - rect.width - 10;
        }
        if (top + rect.height > containerRect.height) {
            top = y - containerRect.top - rect.height - 10;
        }
        if (top < 0) top = 5;
        if (left < 0) left = 5;

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    /**
     * Hide tooltip
     */
    function hide() {
        tooltip.style.display = 'none';
    }

    /**
     * Destroy tooltip
     */
    function destroy() {
        if (tooltip && tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
    }

    return {
        show: show,
        hide: hide,
        destroy: destroy
    };
}

module.exports = {
    createHoverManager: createHoverManager,
    createTooltip: createTooltip
};
