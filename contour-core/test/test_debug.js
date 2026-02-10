'use strict';

var contourCore = require('../index');

function generatePeaks(size) {
    size = size || 20;
    var grid = { z: [], x: [], y: [] };
    for (var i = 0; i < size; i++) {
        grid.z[i] = [];
        grid.y.push(i);
        for (var j = 0; j < size; j++) {
            if (i === 0) grid.x.push(j);
            var dx1 = j - size * 0.35;
            var dy1 = i - size * 0.35;
            var peak1 = 80 * Math.exp(-(dx1 * dx1 + dy1 * dy1) / 50);
            var dx2 = j - size * 0.7;
            var dy2 = i - size * 0.6;
            var peak2 = 60 * Math.exp(-(dx2 * dx2 + dy2 * dy2) / 40);
            grid.z[i][j] = peak1 + peak2;
        }
    }
    return grid;
}

console.log('=== Testing computeContours ===');
var peaksData = generatePeaks(20);
var result = contourCore.computeContours(peaksData, { autocontour: true, ncontours: 8 });

console.log('Type of result.levels:', typeof result.levels);
console.log('result.levels:', result.levels);
console.log('result.levels.length:', result.levels.length);
console.log('Is Array?:', Array.isArray(result.levels));

// Test color scale
var colors = ['#440154', '#482878', '#3e4a89', '#31688e', '#26838f',
              '#1f9d8a', '#35b779', '#6dcd59', '#b4de2c', '#fde725'];

// Try to build colorScale - same way as demo
var colorScale = result.levels.map(function(level, i) {
    var t = result.levels.length > 1 ? (i / (result.levels.length - 1)) : 0.5;
    var colorIdx = Math.floor(t * (colors.length - 1));
    return [level, colors[colorIdx]];
});

console.log('colorScale:', colorScale);
