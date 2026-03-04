'use strict';

/**
 * ZRender null region rendering
 * Highlights areas with null/missing data using zrender elements
 */

var zrender = require('zrender');
var nullHandling = require('../../null_handling');

/**
 * Create null region elements for zrender
 * This function creates elements that mask out contour lines and fills in null data areas
 *
 * @param {Object} contourResult - Contour result (must have nullMask)
 * @param {Object} style - Style options
 * @returns {Array} Array of zrender elements
 */
function createNullElements(contourResult, style) {
    var elements = [];

    var nullMask = contourResult.nullMask;
    if (!nullMask) return elements;

    style = style || {};

    var nullRegion = style.nullRegion || {};
    var visible = nullRegion.visible !== false;
    if (!visible) return elements;

    var m = nullMask.length;
    var n = nullMask[0].length;

    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    // Collect null cells
    var nullCells = [];
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
                nullCells.push({ i: i, j: j });
            }
        }
    }

    if (nullCells.length === 0) return elements;

    // Try to merge adjacent null cells into larger rectangles for better performance
    var mergedRects = mergeNullCells(nullCells, m, n);

    // Create fill elements
    var fillColor = nullRegion.fill || nullRegion.bgColor || '#ffffff';
    var useTransparent = fillColor === 'transparent';

    if (!useTransparent) {
        // Create fill group
        var fillGroup = new zrender.Group();

        for (var r = 0; r < mergedRects.length; r++) {
            var rect = mergedRects[r];
            var rectElement = createNullRect(rect, scaleX, scaleY, padding, m, fillColor, nullRegion);
            fillGroup.add(rectElement);
        }

        elements.push({
            element: fillGroup,
            type: 'fill'
        });
    }

    // Create stroke elements (borders around null regions)
    var strokeColor = nullRegion.stroke;
    var showStroke = nullRegion.showStroke !== undefined ? nullRegion.showStroke : true;

    if (strokeColor && showStroke) {
        var strokeGroup = new zrender.Group();
        var strokeWidth = nullRegion.strokeWidth !== undefined ? nullRegion.strokeWidth : 1;
        var strokeDash = nullRegion.strokeDash || [];

        for (var r = 0; r < mergedRects.length; r++) {
            var rect = mergedRects[r];
            var borderElement = createNullBorder(rect, scaleX, scaleY, padding, m, strokeColor, strokeWidth, strokeDash);
            strokeGroup.add(borderElement);
        }

        elements.push({
            element: strokeGroup,
            type: 'stroke'
        });
    }

    // Create transparent mask elements if needed
    if (useTransparent) {
        // For transparent mode, we create a mask that punches holes
        // This is handled differently in zrender - we return mask info
        elements.push({
            element: null,
            type: 'mask',
            maskData: {
                nullMask: nullMask,
                mergedRects: mergedRects,
                scaleX: scaleX,
                scaleY: scaleY,
                padding: padding,
                m: m
            }
        });
    }

    return elements;
}

/**
 * Merge adjacent null cells into larger rectangles for better performance
 * Uses a simple greedy algorithm
 *
 * @param {Array} nullCells - Array of {i, j} cell positions
 * @param {number} m - Number of rows
 * @param {number} n - Number of columns
 * @returns {Array} Array of merged rectangles {minI, maxI, minJ, maxJ}
 */
function mergeNullCells(nullCells, m, n) {
    if (nullCells.length === 0) return [];

    // Create a grid to track which cells are null
    var grid = [];
    for (var i = 0; i < m; i++) {
        grid[i] = [];
        for (var j = 0; j < n; j++) {
            grid[i][j] = false;
        }
    }

    for (var k = 0; k < nullCells.length; k++) {
        var cell = nullCells[k];
        grid[cell.i][cell.j] = true;
    }

    var mergedRects = [];
    var visited = [];

    for (var i = 0; i < m; i++) {
        visited[i] = [];
        for (var j = 0; j < n; j++) {
            visited[i][j] = false;
        }
    }

    // Find connected components and create bounding rectangles
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            if (grid[i][j] && !visited[i][j]) {
                // BFS to find connected component
                var component = [];
                var queue = [{ i: i, j: j }];
                visited[i][j] = true;

                while (queue.length > 0) {
                    var cell = queue.shift();
                    component.push(cell);

                    // Check neighbors (4-connected)
                    var neighbors = [
                        { i: cell.i - 1, j: cell.j },
                        { i: cell.i + 1, j: cell.j },
                        { i: cell.i, j: cell.j - 1 },
                        { i: cell.i, j: cell.j + 1 }
                    ];

                    for (var ni = 0; ni < neighbors.length; ni++) {
                        var neighbor = neighbors[ni];
                        if (neighbor.i >= 0 && neighbor.i < m &&
                            neighbor.j >= 0 && neighbor.j < n &&
                            grid[neighbor.i][neighbor.j] &&
                            !visited[neighbor.i][neighbor.j]) {
                            visited[neighbor.i][neighbor.j] = true;
                            queue.push(neighbor);
                        }
                    }
                }

                // Create bounding rectangle for this component
                if (component.length > 0) {
                    var minI = Infinity, maxI = -Infinity;
                    var minJ = Infinity, maxJ = -Infinity;

                    for (var c = 0; c < component.length; c++) {
                        var cell = component[c];
                        minI = Math.min(minI, cell.i);
                        maxI = Math.max(maxI, cell.i);
                        minJ = Math.min(minJ, cell.j);
                        maxJ = Math.max(maxJ, cell.j);
                    }

                    mergedRects.push({
                        minI: minI,
                        maxI: maxI,
                        minJ: minJ,
                        maxJ: maxJ,
                        cells: component
                    });
                }
            }
        }
    }

    return mergedRects;
}

/**
 * Create a filled rectangle element for a null region
 */
function createNullRect(rect, scaleX, scaleY, padding, m, fillColor, nullRegion) {
    // Calculate pixel coordinates
    // rect contains grid indices {minI, maxI, minJ, maxJ}
    var x1 = padding + rect.minJ * scaleX;
    var x2 = padding + rect.maxJ * scaleX;
    var y1 = padding + (m - 1 - rect.maxI) * scaleY; // Note: Y is inverted
    var y2 = padding + (m - 1 - rect.minI) * scaleY;

    var rectWidth = x2 - x1 + scaleX;
    var rectHeight = y2 - y1 + scaleY;

    return new zrender.Rect({
        shape: {
            x: x1 - scaleX / 2,
            y: y1 - scaleY / 2,
            width: rectWidth,
            height: rectHeight
        },
        style: {
            fill: fillColor,
            opacity: nullRegion.opacity !== undefined ? nullRegion.opacity : 1
        },
        silent: true,
        z: 100  // Ensure null regions are drawn on top of contours
    });
}

/**
 * Create a border element for a null region
 */
function createNullBorder(rect, scaleX, scaleY, padding, m, strokeColor, strokeWidth, strokeDash) {
    var x1 = padding + rect.minJ * scaleX;
    var x2 = padding + rect.maxJ * scaleX;
    var y1 = padding + (m - 1 - rect.maxI) * scaleY;
    var y2 = padding + (m - 1 - rect.minI) * scaleY;

    var rectWidth = x2 - x1 + scaleX;
    var rectHeight = y2 - y1 + scaleY;

    return new zrender.Rect({
        shape: {
            x: x1 - scaleX / 2,
            y: y1 - scaleY / 2,
            width: rectWidth,
            height: rectHeight
        },
        style: {
            fill: 'none',
            stroke: strokeColor,
            lineWidth: strokeWidth,
            lineDash: strokeDash
        },
        silent: true,
        z: 101  // Borders on top of fill
    });
}

/**
 * Create a clip path for null regions
 * Uses the same logic as canvas renderer via nullHandling.generateClipPath()
 * The clip path defines the VISIBLE (data) region, cutting out null areas
 *
 * @param {Object} contourResult - Contour result with nullMask
 * @param {Object} style - Style options
 * @returns {zrender.Element|null} Clip path element or null
 */
function createNullClipPath(contourResult, style) {
    var nullMask = contourResult.nullMask;
    if (!nullMask) return null;

    style = style || {};
    var nullRegion = style.nullRegion || {};

    if (nullRegion.visible === false) return null;

    // Use the same clip path generation as canvas renderer
    // This creates a path that defines the VISIBLE (data) region
    var svgPathData = nullHandling.generateClipPath(contourResult, style);

    if (!svgPathData) return null;

    // Convert SVG path data to zrender Path element
    return svgPathToZRender(svgPathData);
}

/**
 * Convert SVG path data string to zrender Path element
 * Handles multiple sub-paths by creating a CompoundPath
 *
 * @param {String} svgPathData - SVG path data string (e.g., "M 10 10 L 100 10 ...")
 * @returns {zrender.Path|zrender.CompoundPath|null} ZRender path element
 */
function svgPathToZRender(svgPathData) {
    if (!svgPathData || typeof svgPathData !== 'string') return null;

    // Parse the SVG path into sub-paths
    var subPaths = parseSVGToSubPaths(svgPathData);

    if (subPaths.length === 0) return null;

    // Convert each sub-path to zrender Polygon
    var pathElements = [];
    for (var i = 0; i < subPaths.length; i++) {
        var points = subPaths[i];
        if (points.length < 3) continue;

        var polygon = new zrender.Polygon({
            shape: {
                points: points
            }
        });
        pathElements.push(polygon);
    }

    if (pathElements.length === 0) return null;

    // Single path: return the polygon directly
    if (pathElements.length === 1) {
        return pathElements[0];
    }

    // Multiple paths: use CompoundPath (has isZeroArea method required by clip path)
    return new zrender.CompoundPath({
        shape: {
            paths: pathElements
        }
    });
}

/**
 * Parse SVG path data into array of point arrays
 * Each sub-path (separated by M/m) becomes a separate array of [x, y] points
 *
 * @param {String} svgPathData - SVG path data string
 * @returns {Array} Array of sub-paths, each sub-path is array of [x, y] points
 */
function parseSVGToSubPaths(svgPathData) {
    var subPaths = [];
    var currentPath = [];
    var currentX = 0, currentY = 0;
    var startX = 0, startY = 0;

    // Split by commands while keeping the command characters
    var commands = svgPathData.match(/[MmLlHhVvAaQqTtCcSsZz][^MmLlHhVvAaQqTtCcSsZz]*/g) || [];

    for (var i = 0; i < commands.length; i++) {
        var cmd = commands[i];
        var type = cmd[0];
        var args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(function(n) { return !isNaN(n); });

        switch (type) {
            case 'M':
                // Move to (absolute) - starts a new sub-path
                if (currentPath.length > 0) {
                    subPaths.push(currentPath);
                }
                currentPath = [];
                currentX = args[0];
                currentY = args[1];
                startX = currentX;
                startY = currentY;
                currentPath.push([currentX, currentY]);
                // Handle implicit line-to commands after M
                for (var j = 2; j < args.length; j += 2) {
                    currentX = args[j];
                    currentY = args[j + 1];
                    currentPath.push([currentX, currentY]);
                }
                break;
            case 'm':
                // Move to (relative) - starts a new sub-path
                if (currentPath.length > 0) {
                    subPaths.push(currentPath);
                }
                currentPath = [];
                currentX += args[0];
                currentY += args[1];
                startX = currentX;
                startY = currentY;
                currentPath.push([currentX, currentY]);
                break;
            case 'L':
                // Line to (absolute)
                for (var j = 0; j < args.length; j += 2) {
                    currentX = args[j];
                    currentY = args[j + 1];
                    currentPath.push([currentX, currentY]);
                }
                break;
            case 'l':
                // Line to (relative)
                for (var j = 0; j < args.length; j += 2) {
                    currentX += args[j];
                    currentY += args[j + 1];
                    currentPath.push([currentX, currentY]);
                }
                break;
            case 'H':
                // Horizontal line to (absolute)
                currentX = args[0];
                currentPath.push([currentX, currentY]);
                break;
            case 'h':
                // Horizontal line to (relative)
                currentX += args[0];
                currentPath.push([currentX, currentY]);
                break;
            case 'V':
                // Vertical line to (absolute)
                currentY = args[0];
                currentPath.push([currentX, currentY]);
                break;
            case 'v':
                // Vertical line to (relative)
                currentY += args[0];
                currentPath.push([currentX, currentY]);
                break;
            case 'Z':
            case 'z':
                // Close path
                currentX = startX;
                currentY = startY;
                // Don't add closing point - Polygon handles closing automatically
                break;
            case 'C':
            case 'c':
            case 'S':
            case 's':
            case 'Q':
            case 'q':
            case 'T':
            case 't':
            case 'A':
            case 'a':
                // Bezier/Arc commands - simplify to line to endpoint
                if (args.length >= 2) {
                    // For these commands, the last two values are the endpoint
                    var lastIdx = args.length - 2;
                    if (type === type.toLowerCase()) {
                        // Relative
                        currentX += args[lastIdx];
                        currentY += args[lastIdx + 1];
                    } else {
                        // Absolute
                        currentX = args[lastIdx];
                        currentY = args[lastIdx + 1];
                    }
                    currentPath.push([currentX, currentY]);
                }
                break;
        }
    }

    // Add the last path
    if (currentPath.length > 0) {
        subPaths.push(currentPath);
    }

    return subPaths;
}

/**
 * Generate boundary paths around null regions using marching squares
 *
 * @param {Array} nullMask - 2D boolean array
 * @param {number} m - Number of rows
 * @param {number} n - Number of columns
 * @returns {Array} Array of boundary paths (each path is array of {x, y})
 */
function generateNullBoundaryPaths(nullMask, m, n) {
    var paths = [];

    // Find edges between null and non-null cells
    var edges = [];

    for (var i = 0; i < m - 1; i++) {
        for (var j = 0; j < n - 1; j++) {
            // Check the 2x2 cell neighborhood
            var tl = nullMask[i][j] ? 1 : 0;
            var tr = nullMask[i][j + 1] ? 1 : 0;
            var bl = nullMask[i + 1][j] ? 1 : 0;
            var br = nullMask[i + 1][j + 1] ? 1 : 0;

            var cellType = tl | (tr << 1) | (bl << 2) | (br << 3);

            // Generate edges based on marching squares lookup
            var cellEdges = getMarchingSquareEdges(cellType, j, i);

            for (var e = 0; e < cellEdges.length; e++) {
                edges.push(cellEdges[e]);
            }
        }
    }

    if (edges.length === 0) return paths;

    // Connect edges into paths
    paths = connectEdges(edges);

    return paths;
}

/**
 * Get edges for a marching square cell
 *
 * @param {number} cellType - Cell type (0-15)
 * @param {number} x - Cell x coordinate
 * @param {number} y - Cell y coordinate
 * @returns {Array} Array of edges [{x1, y1, x2, y2}, ...]
 */
function getMarchingSquareEdges(cellType, x, y) {
    // Edge midpoints
    var top = { x: x + 0.5, y: y };
    var right = { x: x + 1, y: y + 0.5 };
    var bottom = { x: x + 0.5, y: y + 1 };
    var left = { x: x, y: y + 0.5 };

    var edges = [];

    // Marching squares lookup table
    // Edges: top=1, right=2, bottom=4, left=8
    switch (cellType) {
        case 1:  // TL only
        case 14: // !TL
            edges.push({ x1: left.x, y1: left.y, x2: top.x, y2: top.y });
            break;
        case 2:  // TR only
        case 13: // !TR
            edges.push({ x1: top.x, y1: top.y, x2: right.x, y2: right.y });
            break;
        case 3:  // TL + TR
        case 12: // !(TL + TR)
            edges.push({ x1: left.x, y1: left.y, x2: right.x, y2: right.y });
            break;
        case 4:  // BL only
        case 11: // !BL
            edges.push({ x1: bottom.x, y1: bottom.y, x2: left.x, y2: left.y });
            break;
        case 5:  // TL + BL
            edges.push({ x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y });
            break;
        case 6:  // TR + BL (ambiguous)
        case 9:  // TL + BR (ambiguous)
            // Resolve ambiguity by using average
            edges.push({ x1: top.x, y1: top.y, x2: right.x, y2: right.y });
            edges.push({ x1: bottom.x, y1: bottom.y, x2: left.x, y2: left.y });
            break;
        case 7:  // !BR
        case 8:  // BR only
            edges.push({ x1: bottom.x, y1: bottom.y, x2: right.x, y2: right.y });
            break;
        case 10: // TR + BR
            edges.push({ x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y });
            break;
        // case 0, 15: no edges
    }

    return edges;
}

/**
 * Connect edges into continuous paths
 *
 * @param {Array} edges - Array of edges
 * @returns {Array} Array of connected paths
 */
function connectEdges(edges) {
    if (edges.length === 0) return [];

    var paths = [];
    var used = new Array(edges.length).fill(false);

    for (var startIdx = 0; startIdx < edges.length; startIdx++) {
        if (used[startIdx]) continue;

        var path = [];
        var currentEdge = edges[startIdx];
        used[startIdx] = true;

        // Start path
        path.push({ x: currentEdge.x1, y: currentEdge.y1 });
        path.push({ x: currentEdge.x2, y: currentEdge.y2 });

        var currentEnd = { x: currentEdge.x2, y: currentEdge.y2 };

        // Try to extend path
        var found = true;
        while (found) {
            found = false;

            for (var i = 0; i < edges.length; i++) {
                if (used[i]) continue;

                var edge = edges[i];

                // Check if edge connects to current end
                if (Math.abs(edge.x1 - currentEnd.x) < 0.01 &&
                    Math.abs(edge.y1 - currentEnd.y) < 0.01) {
                    path.push({ x: edge.x2, y: edge.y2 });
                    currentEnd = { x: edge.x2, y: edge.y2 };
                    used[i] = true;
                    found = true;
                    break;
                } else if (Math.abs(edge.x2 - currentEnd.x) < 0.01 &&
                           Math.abs(edge.y2 - currentEnd.y) < 0.01) {
                    path.push({ x: edge.x1, y: edge.y1 });
                    currentEnd = { x: edge.x1, y: edge.y1 };
                    used[i] = true;
                    found = true;
                    break;
                }
            }
        }

        if (path.length >= 3) {
            paths.push(path);
        }
    }

    return paths;
}

/**
 * Draw null regions directly onto a zrender container
 *
 * @param {zrender.Group} container - ZRender container group
 * @param {Object} contourResult - Contour result with nullMask
 * @param {Object} style - Style options
 */
function drawNulls(container, contourResult, style) {
    var elements = createNullElements(contourResult, style);

    for (var i = 0; i < elements.length; i++) {
        var item = elements[i];

        if (item.type === 'fill' || item.type === 'stroke') {
            container.add(item.element);
        }
        // Note: 'mask' type needs special handling at the renderer level
    }
}

/**
 * Apply null region clipping to a zrender element
 *
 * @param {zrender.Element} element - Element to clip
 * @param {Object} contourResult - Contour result with nullMask
 * @param {Object} style - Style options
 */
function applyNullClip(element, contourResult, style) {
    var clipPath = createNullClipPath(contourResult, style);

    if (clipPath) {
        element.setClipPath(clipPath);
    }
}

module.exports = {
    createNullElements: createNullElements,
    createNullClipPath: createNullClipPath,
    drawNulls: drawNulls,
    applyNullClip: applyNullClip,
    mergeNullCells: mergeNullCells,
    generateNullBoundaryPaths: generateNullBoundaryPaths
};
