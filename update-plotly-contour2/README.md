# ContourToGeoJSON

A JavaScript library for extracting contour lines from Plotly.js and converting them to GeoJSON format for mapping applications.

## Overview

This library implements a version of the Marching Squares algorithm used by Plotly.js to generate contour plots. It extracts contour lines and represents them as GeoJSON LineString features.

The implementation is based directly on the plotly.js contour generation code but focused specifically on generating GeoJSON output for further use in mapping libraries.

## Features

- Extracts contour lines at specified levels
- Produces standard GeoJSON LineString features
- Compatible with mapping libraries like Leaflet, MapboxGL, OpenLayers, etc.
- Can be used in both browser and Node.js environments

## Installation

```bash
# Using npm
npm install contour-to-geojson

# Using yarn
yarn add contour-to-geojson
```

Or simply include the script in your HTML:

```html
<script src="index.js"></script>
```

## Usage

Basic usage example:

```javascript
// Import the library
const ContourToGeoJSON = require('./contour-to-geojson');

// Prepare your data
const z = [
  [10, 10.625, 12.5, 15.625, 20],
  [5.625, 6.25, 8.125, 11.25, 15.625],
  [2.5, 3.125, 5, 8.125, 12.5],
  [0.625, 1.25, 3.125, 6.25, 10.625],
  [0, 0.625, 2.5, 5.625, 10]
];
const x = [0, 1, 2, 3, 4];
const y = [0, 1, 2, 3, 4];
const contours = [2, 5, 8, 11, 14]; // Contour levels

// Convert to GeoJSON
const contourGeoJSON = ContourToGeoJSON.contourToGeoJSON({
  z: z,  // 2D array of values
  x: x,  // x coordinates
  y: y,  // y coordinates
  contours: contours  // Array of contour levels
});

// Use the GeoJSON data
console.log(contourGeoJSON);
```

## Output Format

The library produces a GeoJSON FeatureCollection containing LineString features representing contour lines.

Each feature includes a property `level` indicating the contour level it represents.

Example output:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "level": 5
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[1.5, 0], [2, 0.5], [3, 1], [4, 1.25]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "level": 5
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[0, 1.5], [0.5, 2], [1, 3], [1.25, 4]]
      }
    }
  ]
}
```

## Saving GeoJSON Files

In Node.js environments, you can save the GeoJSON data to files as shown in the example.js file:

```javascript
const fs = require('fs');

function saveGeoJSONToFile(geojson, filename) {
  try {
    fs.writeFileSync(filename, JSON.stringify(geojson, null, 2));
    console.log(`GeoJSON data saved to ${filename}`);
    return true;
  } catch (error) {
    console.error(`Error saving GeoJSON to file: ${error.message}`);
    return false;
  }
}

// Save contour lines
saveGeoJSONToFile(contourGeoJSON, 'contour_lines.geojson');
```

## How It Works

The library implements the Marching Squares algorithm to trace contour lines:

1. For each contour level, it identifies crossing points in the grid
2. It traces paths along these crossing points
3. It handles both closed paths (complete contours) and open paths (contours that reach edges)
4. It outputs all data as standard GeoJSON LineString features

## Example

Check out the `example.js` file for a complete usage example that generates sample data, converts it to GeoJSON, and saves the results to a file.

## License

MIT 