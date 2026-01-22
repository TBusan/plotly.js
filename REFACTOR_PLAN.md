# Plotly.js Contour Refactoring Plan

## Overview
Extract contour calculation logic from Plotly.js to create a standalone contour-core library for SSR and performance optimization.

## Current Codebase Structure

### Core Contour Files
- `src/traces/contour/calc.js` - Entry point, calls heatmap calc + setContours
- `src/traces/contour/set_contours.js` - Computes contour levels
- `src/traces/contour/plot.js` - SVG rendering (d3.js dependent)
- `src/traces/contour/make_crossings.js` - Marching squares algorithm
- `src/traces/contour/find_all_paths.js` - Path finding
- `src/traces/contour/empty_pathinfo.js` - Path data structure
- `src/traces/contour/close_boundaries.js` - Boundary closing
- `src/traces/heatmap/calc.js` - Grid data preparation

### Dependencies
- `d3` - SVG manipulation (remove in Stage 3)
- `Colorscale` - Color mapping
- `Axes` - Axis utilities (partial)
- `Lib` - Plotly utilities (partial)

## Refactoring Stages

### Stage 1: Understand Core Contour Flow ✓
- [x] Identified calc.js as entry point
- [x] Found marching squares in make_crossings.js
- [x] Found path finding in find_all_paths.js
- [ ] Create minimal contour demo

### Stage 2: Extract Pure Calculation Code
- [ ] Create computeContours(grid, options) function
- [ ] Decouple from Plotly trace context
- [ ] Make all dependencies explicit

### Stage 3: Replace Renderer
- [ ] Write custom Canvas renderer
- [ ] Remove d3.js dependency from calculation layer
- [ ] Performance benchmarking

### Stage 4: SSR Support
- [ ] Node Canvas integration
- [ ] SVG renderer option

### Stage 5: Code Cleanup
- [ ] Clean up lib/index.js
- [ ] Remove unused source files
- [ ] Modularize into packages

## Key API Target
```javascript
function computeContours(grid, options) {
  return {
    lines: Path[],      // contour line paths
    fills: Polygon[],   // filled regions
    labels: Label[],    // label positions
    levels: number[],   // contour levels
    colorScale: ColorStop[]
  }
}
```

## Files to Keep
- scatter, scattergl, contour, histogram2dcontour traces
- Required lib/ utilities
- Required components/

## Files to Remove
- All other traces (bar, box, pie, 3d, geo, etc.)
- Unnecessary components
