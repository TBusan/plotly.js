'use strict';

/**
 * Simple test for fill rendering
 */

var contourCore = require('../index');

// Test data
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

function generateConcentric(size) {
    size = size || 20;
    var grid = { z: [], x: [], y: [] };
    var cx = size / 2;
    var cy = size / 2;

    for (var i = 0; i < size; i++) {
        grid.z[i] = [];
        grid.y.push(i);
        for (var j = 0; j < size; j++) {
            if (i === 0) grid.x.push(j);
            var dx = j - cx;
            var dy = i - cy;
            var dist = Math.sqrt(dx * dx + dy * dy);
            grid.z[i][j] = 100 - dist * 3;
        }
    }
    return grid;
}

console.log('Testing fill rendering...');

// Test 1: Peaks
console.log('\n=== Test 1: Peaks ===');
var peaksData = generatePeaks(20);
var result1 = contourCore.computeContours(peaksData, { autocontour: true, ncontours: 8 });
console.log('Levels:', result1.levels);
console.log('Paths count:', result1.paths.length);
for (var i = 0; i < Math.min(3, result1.paths.length); i++) {
    console.log('  Path ' + i + ': edgepaths=' + result1.paths[i].edgepaths.length +
                ', paths=' + result1.paths[i].paths.length +
                ', prefixBoundary=' + result1.paths[i].prefixBoundary);
}

// Test 2: Concentric
console.log('\n=== Test 2: Concentric ===');
var concentricData = generateConcentric(20);
var result2 = contourCore.computeContours(concentricData, { autocontour: true, ncontours: 8 });
console.log('Levels:', result2.levels);
console.log('Paths count:', result2.paths.length);
for (var i = 0; i < Math.min(3, result2.paths.length); i++) {
    console.log('  Path ' + i + ': edgepaths=' + result2.paths[i].edgepaths.length +
                ', paths=' + result2.paths[i].paths.length +
                ', prefixBoundary=' + result2.paths[i].prefixBoundary);
}

// Test color scale construction
console.log('\n=== Test 3: Color Scale ===');
var colors = ['#440154', '#482878', '#3e4a89', '#31688e', '#26838f',
              '#1f9d8a', '#35b779', '#6dcd59', '#b4de2c', '#fde725'];
console.log('Colors array:', colors);
console.log('Colors length:', colors.length);
var colorScale = result1.levels.map(function(level, i) {
    var t = result1.levels.length > 1 ? (i / (result1.levels - 1)) : 0.5;
    var colorIdx = Math.floor(t * (colors.length - 1));
    var safeIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));
    var color = colors[safeIdx];
    console.log('  i=' + i + ', level=' + level + ', t=' + t.toFixed(2) + ', colorIdx=' + colorIdx + ', safeIdx=' + safeIdx + ', color=' + color);
    return [level, color];
});
console.log('ColorScale:', colorScale);

console.log('\n=== Test completed ===');
