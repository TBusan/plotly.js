# Node.js Demos

This directory contains Node.js demos for contour-core that demonstrate how to compute and export contours without a browser.

## Demos

| File | Description | Output |
|------|-------------|--------|
| `basic-svg.js` | Basic SVG export with fill and lines | `output/basic-contour.svg` |
| `lines-svg.js` | Contour lines only (no fill) | `output/contour-lines.svg` |
| `heatmap-svg.js` | Heatmap style with smooth gradient | `output/heatmap.svg` |
| `null-handling.js` | Handling null/NaN values in grid | `output/contour-with-nulls.svg` |
| `custom-colors.js` | Different color scales | `output/colorscale-*.svg` |
| `geojson-export.js` | Export to GeoJSON format | `output/contour-*.geojson` |
| `full-features.js` | All features combined | `output/full-features-*.svg/.geojson` |

## Running Demos

```bash
# Run a specific demo
node demo/nodejs/basic-svg.js

# Run all demos (full-features generates most outputs)
node demo/nodejs/full-features.js
```

## Output

All demos save their output to the `output/` subdirectory.

## Key Concepts

### 1. Computing Contours

```javascript
var contourCore = require('contour-core');

var result = contourCore.computeContours({
    z: gridData,      // 2D array of values
    x: xCoordinates,  // Optional: x axis values
    y: yCoordinates   // Optional: y axis values
}, {
    autocontour: true,  // Auto-generate contour levels
    ncontours: 15,      // Number of contour levels
    smoothing: 0.5      // Smoothing factor (0-1)
});
```

### 2. SVG Export

```javascript
var svgRenderer = contourCore.renderers.svg;

var svgString = svgRenderer.renderSVG(result, {
    width: 800,
    height: 600,
    coloring: 'fill',   // 'fill', 'lines', or 'heatmap'
    showLines: true,
    colorScale: [
        [0, '#440154'],
        [50, '#35b779'],
        [100, '#fde725']
    ]
});
```

### 3. GeoJSON Export

```javascript
// Line contours
var lineGeoJSON = contourCore.toGeoJSON(result, {
    type: 'lines',
    propertyName: 'elevation'
});

// Filled polygons
var fillGeoJSON = contourCore.toFilledGeoJSON(result, {
    propertyName: 'elevation',
    clip: true  // Clip to eliminate overlaps
});
```

### 4. Null Value Handling

The library supports null, undefined, and NaN values in grid data:

```javascript
var grid = [
    [1, 2, null, 4],
    [2, NaN, 3, 5],
    [undefined, 4, 5, 6]
];

var result = contourCore.computeContours({ z: grid });
console.log('Null count:', result.nullCount);
```

## Dependencies

These demos use only Node.js built-in modules (`fs`, `path`) and contour-core itself.
No additional packages are required.
