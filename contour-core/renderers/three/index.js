'use strict';

/**
 * Three.js Contour Renderer
 * WebGL-based 2D contour rendering with OrthographicCamera
 * Supports pan, zoom interactions (no rotation)
 */

// Try to get THREE from require, fall back to global
var THREE;
try {
    THREE = require('three');
} catch (e) {
    // Three.js is optional - use global if available
    THREE = typeof window !== 'undefined' ? window.THREE : null;
}

// Check if THREE is available
function checkThree() {
    if (!THREE) {
        throw new Error('Three.js is required for the three renderer. Please include Three.js via npm or CDN.');
    }
}

var pathUtils = require('./paths');
var labelUtils = require('./labels');
var axesUtils = require('./axes');
var colorbarUtils = require('./colorbar');
var nullUtils = require('./nulls');
var heatmapUtils = require('./heatmap');

/**
 * ThreeContourRenderer - Main renderer class using Three.js
 */
function ThreeContourRenderer(container, options) {
    checkThree();
    options = options || {};

    this.container = container;
    this.width = options.width || 600;
    this.height = options.height || 500;
    this.options = options;

    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(options.backgroundColor || 0xffffff);

    // Orthographic camera for 2D rendering
    this.initCamera();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
        antialias: options.antialias !== false,
        alpha: options.alpha || false
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(options.devicePixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1));

    // Add to container
    if (typeof container === 'string') {
        container = document.getElementById(container);
    }
    if (container && container.appendChild) {
        container.appendChild(this.renderer.domElement);
    }

    // Layer groups (order matters for rendering)
    this.layers = {
        background: new THREE.Group(),
        heatmap: new THREE.Group(),
        fills: new THREE.Group(),
        lines: new THREE.Group(),
        nullOverlay: new THREE.Group(),
        grid: new THREE.Group(),
        axes: new THREE.Group(),
        labels: new THREE.Group(),
        overlay: new THREE.Group()
    };

    // Add layers to scene
    for (var key in this.layers) {
        this.scene.add(this.layers[key]);
    }

    // State
    this.contourResult = null;
    this.style = null;
    this.interactionEnabled = true;

    // Interaction state
    this.zoomState = {
        scale: 1,
        minScale: options.minScale || 0.1,
        maxScale: options.maxScale || 10
    };
    this.panState = {
        isDragging: false,
        lastX: 0,
        lastY: 0
    };

    // Raycaster for mouse interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Element level map for interaction
    this.elementLevelMap = new Map();
}

/**
 * Initialize orthographic camera
 */
ThreeContourRenderer.prototype.initCamera = function() {
    var halfWidth = this.width / 2;
    var halfHeight = this.height / 2;

    this.camera = new THREE.OrthographicCamera(
        -halfWidth, halfWidth,
        halfHeight, -halfHeight,
        0.1, 10000
    );
    this.camera.position.z = 1000;
    this.camera.lookAt(0, 0, 0);
};

/**
 * Convert screen coordinates to world coordinates
 */
ThreeContourRenderer.prototype.screenToWorld = function(x, y) {
    var worldX = x - this.width / 2;
    var worldY = -(y - this.height / 2);
    return { x: worldX, y: worldY };
};

/**
 * Render contours
 */
ThreeContourRenderer.prototype.renderContours = function(result, style) {
    style = style || {};

    // Clear existing elements
    this.clearLayer(this.layers.background);
    this.clearLayer(this.layers.fills);
    this.clearLayer(this.layers.lines);
    this.clearLayer(this.layers.nullOverlay);
    this.clearLayer(this.layers.labels);
    this.elementLevelMap.clear();

    this.contourResult = result;
    this.style = style;

    var coloring = style.coloring || 'fill';
    var connectGaps = result.connectgaps !== undefined ? result.connectgaps : true;
    var needsNullHandling = !connectGaps && result.nullMask && result.nullCount > 0;

    // Render heatmap background
    if (coloring === 'heatmap') {
        this.renderHeatmap(result, style);
    }

    // Create contour paths
    var pathElements = pathUtils.createContourPaths(result, style, this);

    // Add elements to appropriate layers
    for (var i = 0; i < pathElements.length; i++) {
        var item = pathElements[i];
        var mesh = item.mesh;
        var type = item.type;
        var level = item.level;

        if (type === 'background') {
            this.layers.background.add(mesh);
        } else if (type === 'fill') {
            this.layers.fills.add(mesh);
            if (level !== null && level !== undefined) {
                this.elementLevelMap.set(mesh.uuid, level);
            }
        } else if (type === 'line') {
            this.layers.lines.add(mesh);
        }
    }

    // Render null regions
    if (needsNullHandling && style.useClipMask === false) {
        this.renderNulls(result, style);
    }

    // Apply null clipping if needed
    if (needsNullHandling && style.useClipMask !== false) {
        this.applyNullClip(result, style);
    }

    this.render();
};

/**
 * Render null regions
 */
ThreeContourRenderer.prototype.renderNulls = function(contourResult, style) {
    this.clearLayer(this.layers.nullOverlay);

    if (!contourResult || !contourResult.nullMask) return;

    var nullMeshes = nullUtils.createNullMeshes(contourResult, style, this);

    for (var i = 0; i < nullMeshes.length; i++) {
        this.layers.nullOverlay.add(nullMeshes[i]);
    }

    this.render();
};

/**
 * Apply null clipping to fills layer
 */
ThreeContourRenderer.prototype.applyNullClip = function(contourResult, style) {
    if (!contourResult || !contourResult.nullMask) return;

    var clipMesh = nullUtils.createClipMesh(contourResult, style, this);
    if (clipMesh && this.layers.fills) {
        // Apply stencil clipping
        this.layers.fills.userData.clipMesh = clipMesh;
    }
};

/**
 * Render heatmap background
 */
ThreeContourRenderer.prototype.renderHeatmap = function(contourResult, style) {
    this.clearLayer(this.layers.heatmap);

    if (!contourResult || !contourResult.pathinfo || !contourResult.pathinfo[0]) return;

    var heatmapMesh = heatmapUtils.createHeatmapMesh(contourResult, style, this);
    if (heatmapMesh) {
        this.layers.heatmap.add(heatmapMesh);
    }

    this.render();
};

/**
 * Render labels
 */
ThreeContourRenderer.prototype.renderLabels = function(contourResult, style) {
    this.clearLayer(this.layers.labels);

    if (!contourResult || !contourResult.paths) return;

    var labelSprites = labelUtils.createLabels(contourResult, style, this);

    for (var i = 0; i < labelSprites.length; i++) {
        this.layers.labels.add(labelSprites[i]);
    }

    this.render();
};

/**
 * Render axes
 */
ThreeContourRenderer.prototype.renderAxes = function(axesConfig, style) {
    this.clearLayer(this.layers.axes);
    this.clearLayer(this.layers.grid);

    if (!axesConfig) return;

    // Draw grid
    if (axesConfig.x && axesConfig.x.showgrid) {
        var xGridMeshes = axesUtils.createGridLines(axesConfig, style, 'x', this);
        for (var i = 0; i < xGridMeshes.length; i++) {
            this.layers.grid.add(xGridMeshes[i]);
        }
    }

    if (axesConfig.y && axesConfig.y.showgrid) {
        var yGridMeshes = axesUtils.createGridLines(axesConfig, style, 'y', this);
        for (var i = 0; i < yGridMeshes.length; i++) {
            this.layers.grid.add(yGridMeshes[i]);
        }
    }

    // Draw axes
    if (axesConfig.x) {
        var xAxisMeshes = axesUtils.createAxis(axesConfig, style, 'x', this);
        for (var i = 0; i < xAxisMeshes.length; i++) {
            this.layers.axes.add(xAxisMeshes[i]);
        }
    }

    if (axesConfig.y) {
        var yAxisMeshes = axesUtils.createAxis(axesConfig, style, 'y', this);
        for (var i = 0; i < yAxisMeshes.length; i++) {
            this.layers.axes.add(yAxisMeshes[i]);
        }
    }

    this.render();
};

/**
 * Render colorbar
 */
ThreeContourRenderer.prototype.renderColorbar = function(result, colors, config) {
    if (this.colorbarMesh) {
        this.scene.remove(this.colorbarMesh);
    }

    if (!config || config.show === false) return;

    var colorbarGroup = colorbarUtils.createColorbar(result, colors, config, this);
    this.colorbarMesh = colorbarGroup;
    this.scene.add(colorbarGroup);

    this.render();
};

/**
 * Clear a layer's contents
 */
ThreeContourRenderer.prototype.clearLayer = function(layer) {
    while (layer.children.length > 0) {
        var child = layer.children[0];
        layer.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(function(m) { m.dispose(); });
            } else {
                child.material.dispose();
            }
        }
    }
};

/**
 * Main render call
 */
ThreeContourRenderer.prototype.render = function() {
    this.renderer.render(this.scene, this.camera);
};

/**
 * Initialize zoom interaction
 */
ThreeContourRenderer.prototype.initZoom = function(options) {
    var self = this;
    options = options || {};

    if (options.wheelEnabled === false) return;

    this.domElement().addEventListener('wheel', function(e) {
        if (!self.interactionEnabled) return;
        e.preventDefault();

        var zoomFactor = options.zoomFactor || 0.001;
        var delta = 1 - e.deltaY * zoomFactor;
        var newScale = self.zoomState.scale * delta;

        // Clamp scale
        newScale = Math.max(self.zoomState.minScale, Math.min(self.zoomState.maxScale, newScale));

        // Zoom centered on mouse position
        var rect = self.renderer.domElement.getBoundingClientRect();
        var mouseX = e.clientX - rect.left;
        var mouseY = e.clientY - rect.top;
        var worldPos = self.screenToWorld(mouseX, mouseY);

        // Update camera frustum
        self.applyZoom(newScale, worldPos.x, worldPos.y);

        if (options.onZoom) {
            options.onZoom({ scale: newScale, centerX: mouseX, centerY: mouseY });
        }

        self.zoomState.scale = newScale;
        self.render();
    }, { passive: false });
};

/**
 * Apply zoom with center point
 */
ThreeContourRenderer.prototype.applyZoom = function(scale, centerX, centerY) {
    var halfWidth = (this.width / 2) / scale;
    var halfHeight = (this.height / 2) / scale;

    // Adjust camera to zoom toward center point
    var offsetX = centerX * (1 - 1/scale);
    var offsetY = centerY * (1 - 1/scale);

    this.camera.left = -halfWidth + offsetX;
    this.camera.right = halfWidth + offsetX;
    this.camera.top = halfHeight - offsetY;
    this.camera.bottom = -halfHeight - offsetY;
    this.camera.updateProjectionMatrix();
};

/**
 * Initialize pan interaction
 */
ThreeContourRenderer.prototype.initPan = function(options) {
    var self = this;
    options = options || {};

    if (options.dragEnabled === false) return;

    var dom = this.domElement();

    dom.addEventListener('mousedown', function(e) {
        if (!self.interactionEnabled) return;

        self.panState.isDragging = true;
        self.panState.lastX = e.clientX;
        self.panState.lastY = e.clientY;
        dom.style.cursor = 'grabbing';

        if (options.onPanStart) options.onPanStart(e);
    });

    dom.addEventListener('mousemove', function(e) {
        if (!self.panState.isDragging) return;

        var dx = e.clientX - self.panState.lastX;
        var dy = e.clientY - self.panState.lastY;

        // Move camera frustum
        self.camera.left -= dx;
        self.camera.right -= dx;
        self.camera.top += dy;
        self.camera.bottom += dy;
        self.camera.updateProjectionMatrix();

        self.panState.lastX = e.clientX;
        self.panState.lastY = e.clientY;

        self.render();

        if (options.onPan) {
            options.onPan({ dx: dx, dy: dy });
        }
    });

    var endPan = function() {
        if (self.panState.isDragging) {
            self.panState.isDragging = false;
            dom.style.cursor = 'default';
            if (options.onPanEnd) options.onPanEnd();
        }
    };

    dom.addEventListener('mouseup', endPan);
    dom.addEventListener('mouseleave', endPan);
};

/**
 * Initialize hover interaction
 */
ThreeContourRenderer.prototype.initHover = function(options) {
    var self = this;
    options = options || {};

    this.domElement().addEventListener('mousemove', function(e) {
        if (self.panState.isDragging || !self.interactionEnabled) return;

        var rect = self.renderer.domElement.getBoundingClientRect();
        self.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        self.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        self.raycaster.setFromCamera(self.mouse, self.camera);

        // Check intersection with fill meshes
        var intersects = self.raycaster.intersectObjects(self.layers.fills.children, true);

        self.clearLayer(self.layers.overlay);

        if (intersects.length > 0) {
            var mesh = intersects[0].object;
            var level = self.elementLevelMap.get(mesh.uuid);

            if (level !== undefined) {
                // Create highlight
                var highlight = self.createHighlight(mesh);
                if (highlight) {
                    self.layers.overlay.add(highlight);
                }

                dom.style.cursor = 'pointer';

                if (options.onHover) {
                    options.onHover({ level: level, event: e });
                }
            }
        } else {
            dom.style.cursor = 'default';
        }

        self.render();
    }.bind({ dom: this.domElement() }));
};

/**
 * Create highlight mesh
 */
ThreeContourRenderer.prototype.createHighlight = function(mesh) {
    if (!mesh.geometry) return null;

    var edges = new THREE.EdgesGeometry(mesh.geometry);
    var highlightLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 })
    );

    return highlightLine;
};

/**
 * Initialize click interaction
 */
ThreeContourRenderer.prototype.initClick = function(options) {
    var self = this;
    options = options || {};

    this.domElement().addEventListener('click', function(e) {
        if (!self.interactionEnabled) return;

        var rect = self.renderer.domElement.getBoundingClientRect();
        self.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        self.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        self.raycaster.setFromCamera(self.mouse, self.camera);

        var intersects = self.raycaster.intersectObjects(self.layers.fills.children, true);

        if (intersects.length > 0) {
            var mesh = intersects[0].object;
            var level = self.elementLevelMap.get(mesh.uuid);

            if (level !== undefined && options.onClick) {
                options.onClick({ level: level, event: e });
            }
        }
    });
};

/**
 * Reset view to default
 */
ThreeContourRenderer.prototype.resetView = function(animate) {
    var self = this;

    if (animate) {
        // Simple animation - could be enhanced with GSAP or similar
        var startLeft = this.camera.left;
        var startRight = this.camera.right;
        var startTop = this.camera.top;
        var startBottom = this.camera.bottom;

        var targetHalfW = this.width / 2;
        var targetHalfH = this.height / 2;

        var duration = 300;
        var startTime = Date.now();

        function animateStep() {
            var elapsed = Date.now() - startTime;
            var t = Math.min(elapsed / duration, 1);
            var ease = 1 - Math.pow(1 - t, 3); // easeOutCubic

            self.camera.left = startLeft + (-targetHalfW - startLeft) * ease;
            self.camera.right = startRight + (targetHalfW - startRight) * ease;
            self.camera.top = startTop + (targetHalfH - startTop) * ease;
            self.camera.bottom = startBottom + (-targetHalfH - startBottom) * ease;
            self.camera.updateProjectionMatrix();
            self.render();

            if (t < 1) {
                requestAnimationFrame(animateStep);
            } else {
                self.zoomState.scale = 1;
            }
        }

        animateStep();
    } else {
        var halfWidth = this.width / 2;
        var halfHeight = this.height / 2;

        this.camera.left = -halfWidth;
        this.camera.right = halfWidth;
        this.camera.top = halfHeight;
        this.camera.bottom = -halfHeight;
        this.camera.updateProjectionMatrix();
        this.zoomState.scale = 1;
        this.render();
    }
};

/**
 * Get DOM element
 */
ThreeContourRenderer.prototype.domElement = function() {
    return this.renderer.domElement;
};

/**
 * Enable/disable interaction
 */
ThreeContourRenderer.prototype.setInteractionEnabled = function(enabled) {
    this.interactionEnabled = enabled;
};

/**
 * Resize renderer
 */
ThreeContourRenderer.prototype.resize = function(width, height) {
    this.width = width;
    this.height = height;

    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.render();
};

/**
 * Get current state
 */
ThreeContourRenderer.prototype.getState = function() {
    return {
        scale: this.zoomState.scale,
        cameraLeft: this.camera.left,
        cameraRight: this.camera.right,
        cameraTop: this.camera.top,
        cameraBottom: this.camera.bottom
    };
};

/**
 * Dispose resources
 */
ThreeContourRenderer.prototype.dispose = function() {
    // Clear all layers
    for (var key in this.layers) {
        this.clearLayer(this.layers[key]);
    }

    // Dispose renderer
    this.renderer.dispose();

    // Remove from DOM
    if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
};

// Factory function
function createRenderer(container, options) {
    return new ThreeContourRenderer(container, options);
}

module.exports = {
    ThreeContourRenderer: ThreeContourRenderer,
    createRenderer: createRenderer
};
