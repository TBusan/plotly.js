# contour-core

Standalone contour calculation library extracted from Plotly.js for SSR and performance optimization.

## Features

- Pure JavaScript implementation with no external dependencies
- Works in Node.js and browser environments
- Marching squares algorithm for contour generation
- Catmull-Rom spline smoothing for smooth paths
- Support for custom thresholds and automatic contour levels
- Can be used for server-side rendering (SSR)

## Installation

```bash
npm install ./src/contour-core
```

## Usage

```javascript
var contourCore = require('contour-core');

// Create a 2D grid of values
var grid = {
    z: [
        [0, 1, 2, 3, 4],
        [1, 2, 3, 4, 5],
        [2, 3, 4, 5, 6],
        [3, 4, 5, 6, 7],
        [4, 5, 6, 7, 8]
    ],
    x: [0, 1, 2, 3, 4],  // optional x coordinates
    y: [0, 1, 2, 3, 4]   // optional y coordinates
};

// Compute contours
var result = contourCore.computeContours(grid, {
    autocontour: true,
    ncontours: 5,
    smoothing: 0.5
});

// Result contains:
// - levels: array of contour level values
// - paths: array of path objects, one per level
//   - level: the contour level value
//   - edgepaths: array of edge paths (not closed)
//   - paths: array of closed paths
// Each path is an array of [x, y] coordinates

console.log('Contour levels:', result.levels);
console.log('Number of paths:', result.paths.length);
```

## Options

- `thresholds`: Array of custom threshold values (optional)
- `autocontour`: Auto-generate contour levels (default: true)
- `start`: Start value for contours (optional)
- `end`: End value for contours (optional)
- `size`: Step size between contours (optional)
- `ncontours`: Approximate number of contours (default: 15)
- `smoothing`: Smoothing factor for paths (0-1, default: 0)

## API

### `computeContours(grid, options)`

Main function to compute contours from a 2D grid.

### `scalePathsToData(result, x, y)`

Scale paths from grid index space to data coordinate space.

## Testing

```bash
npm test
```

## License

MIT (extracted from Plotly.js)
