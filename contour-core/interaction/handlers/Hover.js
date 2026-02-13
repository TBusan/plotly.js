'use strict';

/**
 * HoverHandler - Handle hover interactions for contour-core
 *
 * Supports:
 * - Data point query from mouse position
 * - Nearest contour line detection
 * - Tooltip formatting
 */

/**
 * HoverHandler constructor
 * @param {Object} options - Configuration options
 */
function HoverHandler(options) {
    options = options || {};

    this.options = {
        enabled: options.enabled !== false,
        showTooltip: options.showTooltip !== false,
        highlightLine: options.highlightLine || false,
        format: options.format || null,
        snapToGrid: options.snapToGrid !== false,
        interpolation: options.interpolation || 'bilinear'
    };

    // Grid data reference (set during hover)
    this.gridData = null;
}

/**
 * Set grid data for hover queries
 * @param {Object} grid - Grid data {x, y, z}
 */
HoverHandler.prototype.setGridData = function(grid) {
    this.gridData = grid;
};

/**
 * Handle mouse move for hover
 * @param {MouseEvent} event - Mouse move event
 * @param {CoordinateConverter} converter - Coordinate converter
 * @param {Object} grid - Grid data {x, y, z}
 * @returns {Object|null} Hover data with screen and data coordinates
 */
HoverHandler.prototype.handleMove = function(event, converter, grid) {
    if (!this.options.enabled) {
        return null;
    }

    // Use provided grid or stored grid
    grid = grid || this.gridData;
    if (!grid || !grid.z) {
        return null;
    }

    var px = event.offsetX;
    var py = event.offsetY;

    // Check if in plot area
    if (!converter.isInPlotArea(px, py)) {
        return null;
    }

    // Convert to data coordinates
    var dataPos = converter.pixelToData(px, py);

    // Find z value at this position
    var zValue = this.findZValue(dataPos.x, dataPos.y, grid);

    return {
        screen: {
            x: px,
            y: py
        },
        data: {
            x: dataPos.x,
            y: dataPos.y,
            z: zValue
        },
        event: event
    };
};

/**
 * Find z value at data coordinates using interpolation
 * @param {Number} x - X data coordinate
 * @param {Number} y - Y data coordinate
 * @param {Object} grid - Grid data {x, y, z}
 * @returns {Number|null} Interpolated z value
 */
HoverHandler.prototype.findZValue = function(x, y, grid) {
    if (!grid || !grid.z) {
        return null;
    }

    var z = grid.z;
    var m = z.length;
    var n = z[0].length;

    // Get x and y coordinate arrays
    var xCoords = grid.x || this._defaultArray(n);
    var yCoords = grid.y || this._defaultArray(m);

    // Find the grid cell containing the point
    var result = this._findCell(x, y, xCoords, yCoords);

    if (!result) {
        return null; // Out of bounds
    }

    var i = result.i;
    var j = result.j;
    var x1 = xCoords[j];
    var x2 = xCoords[j + 1];
    var y1 = yCoords[i];
    var y2 = yCoords[i + 1];

    // Get the four corner values
    var z11 = z[i][j];
    var z12 = z[i][j + 1];
    var z21 = z[i + 1][j];
    var z22 = z[i + 1][j + 1];

    // Check for null values
    var hasNull = (z11 == null || z12 == null || z21 == null || z22 == null);
    if (hasNull) {
        return null;
    }

    // Bilinear interpolation
    if (this.options.interpolation === 'bilinear') {
        var t = (x - x1) / (x2 - x1);
        var u = (y - y1) / (y2 - y1);

        return (1 - t) * (1 - u) * z11 +
               t * (1 - u) * z12 +
               (1 - t) * u * z21 +
               t * u * z22;
    }

    // Nearest neighbor (default)
    return z11;
};

/**
 * Find the grid cell containing a point
 * @private
 */
HoverHandler.prototype._findCell = function(x, y, xCoords, yCoords) {
    var m = yCoords.length;
    var n = xCoords.length;

    // Check bounds
    if (x < xCoords[0] || x > xCoords[n - 1] ||
        y < yCoords[0] || y > yCoords[m - 1]) {
        return null;
    }

    // Find x index
    var j = this._findIndex(x, xCoords);

    // Find y index
    var i = this._findIndex(y, yCoords);

    // Clamp indices
    i = Math.min(i, m - 2);
    j = Math.min(j, n - 2);

    return { i: i, j: j };
};

/**
 * Find index in sorted array
 * @private
 */
HoverHandler.prototype._findIndex = function(value, array) {
    var left = 0;
    var right = array.length - 1;

    while (left < right) {
        var mid = Math.floor((left + right) / 2);
        if (value < array[mid]) {
            right = mid;
        } else if (value >= array[mid + 1]) {
            left = mid + 1;
        } else {
            return mid;
        }
    }

    return left;
};

/**
 * Create default array [0, 1, 2, ...]
 * @private
 */
HoverHandler.prototype._defaultArray = function(length) {
    var arr = [];
    for (var i = 0; i < length; i++) {
        arr.push(i);
    }
    return arr;
};

/**
 * Find nearest contour line to a point
 * @param {Object} dataPos - Data coordinates {x, y}
 * @param {Object} contourResult - Result from computeContours()
 * @param {Number} maxDistance - Maximum distance to search
 * @returns {Object|null} Nearest line info {level, path, distance}
 */
HoverHandler.prototype.findNearestLine = function(dataPos, contourResult, maxDistance) {
    maxDistance = maxDistance || Infinity;

    if (!contourResult || !contourResult.paths) {
        return null;
    }

    var nearest = null;
    var minDistance = Infinity;

    // Search all paths
    var levels = contourResult.levels;
    var paths = contourResult.paths;

    for (var levelIdx = 0; levelIdx < paths.length; levelIdx++) {
        var levelPaths = paths[levelIdx];
        var level = levels[levelIdx];

        for (var pathIdx = 0; pathIdx < levelPaths.length; pathIdx++) {
            var path = levelPaths[pathIdx];

            if (path && path.length > 0) {
                var distance = this._pointToPathDistance(dataPos, path);

                if (distance < minDistance && distance <= maxDistance) {
                    minDistance = distance;
                    nearest = {
                        level: level,
                        pathIndex: pathIdx,
                        path: path,
                        distance: distance
                    };
                }
            }
        }
    }

    return nearest;
};

/**
 * Calculate minimum distance from point to path
 * @private
 */
HoverHandler.prototype._pointToPathDistance = function(point, path) {
    var minDist = Infinity;

    for (var i = 0; i < path.length - 1; i++) {
        var p1 = path[i];
        var p2 = path[i + 1];

        var dist = this._pointToSegmentDistance(point, p1, p2);
        minDist = Math.min(minDist, dist);
    }

    return minDist;
};

/**
 * Calculate distance from point to line segment
 * @private
 */
HoverHandler.prototype._pointToSegmentDistance = function(point, p1, p2) {
    var l2 = (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);

    if (l2 === 0) {
        // Points are the same
        var dx = point.x - p1.x;
        var dy = point.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Project point onto line
    var t = ((point.x - p1.x) * (p2.x - p1.x) + (point.y - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));

    // Find closest point on segment
    var closestX = p1.x + t * (p2.x - p1.x);
    var closestY = p1.y + t * (p2.y - p1.y);

    var dx = point.x - closestX;
    var dy = point.y - closestY;

    return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Format tooltip content
 * @param {Object} hoverData - Data from handleMove
 * @param {Object} config - Additional configuration
 * @returns {String} Formatted tooltip content
 */
HoverHandler.prototype.formatTooltip = function(hoverData, config) {
    config = config || {};

    if (!hoverData) {
        return '';
    }

    var data = hoverData.data;

    // Use custom format if provided
    if (this.options.format) {
        return this.options.format(data, config);
    }

    // Default format
    var parts = [];

    if (data.x !== undefined && data.x !== null) {
        var xFormat = config.xFormat || '{x}';
        var xStr = xFormat.replace('{x}', this._formatNumber(data.x, config.xPrecision));
        parts.push('x: ' + xStr);
    }

    if (data.y !== undefined && data.y !== null) {
        var yFormat = config.yFormat || '{y}';
        var yStr = yFormat.replace('{y}', this._formatNumber(data.y, config.yPrecision));
        parts.push('y: ' + yStr);
    }

    if (data.z !== undefined && data.z !== null) {
        var zFormat = config.zFormat || '{z}';
        var zStr = zFormat.replace('{z}', this._formatNumber(data.z, config.zPrecision));
        parts.push('z: ' + zStr);
    }

    return parts.join(', ');
};

/**
 * Format a number with optional precision
 * @private
 */
HoverHandler.prototype._formatNumber = function(value, precision) {
    if (value == null) {
        return 'N/A';
    }

    if (precision !== undefined) {
        return value.toFixed(precision);
    }

    // Auto precision based on magnitude
    if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.01 && value !== 0)) {
        return value.toExponential(2);
    } else if (Number.isInteger(value)) {
        return value.toString();
    } else {
        return value.toFixed(2);
    }
};

/**
 * Clamp position to screen bounds for tooltip
 * @param {Number} x - Tooltip x position
 * @param {Number} y - Tooltip y position
 * @param {Number} width - Tooltip width
 * @param {Number} height - Tooltip height
 * @param {Number} screenWidth - Screen width
 * @param {Number} screenHeight - Screen height
 * @returns {Object} Clamped position {x, y}
 */
HoverHandler.prototype.clampTooltipPosition = function(x, y, width, height, screenWidth, screenHeight) {
    var margin = 10;

    var clampedX = x + width + margin > screenWidth ? x - width - margin : x + margin;
    var clampedY = y + height + margin > screenHeight ? y - height - margin : y + margin;

    // Ensure tooltip stays on screen
    clampedX = Math.max(margin, Math.min(screenWidth - width - margin, clampedX));
    clampedY = Math.max(margin, Math.min(screenHeight - height - margin, clampedY));

    return { x: clampedX, y: clampedY };
};

module.exports = HoverHandler;
