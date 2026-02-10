'use strict';

var contourCore = require('../index');

function generateConcentric(size) {
    size = size || 30;
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

console.log('=== Testing concentric fill ===');
var data = generateConcentric(30);
var result = contourCore.computeContours(data, { autocontour: true, ncontours: 8 });

console.log('Levels:', result.levels);
console.log('Paths:', result.paths.length);

// Check each path in detail
for (var i = 0; i < result.paths.length; i++) {
    var pathInfo = result.paths[i];
    console.log('\nPath ' + i + ' (level=' + pathInfo.level + '):');
    console.log('  edgepaths:', pathInfo.edgepaths.length);
    console.log('  paths:', pathInfo.paths.length);
    console.log('  prefixBoundary:', pathInfo.prefixBoundary);

    // Show edgepath details
    if (pathInfo.edgepaths.length > 0) {
        console.log('  First edgepath length:', pathInfo.edgepaths[0].length);
        console.log('  First edgepath sample:', pathInfo.edgepaths[0].slice(0, 3));
    }
    // Show interior path details
    if (pathInfo.paths.length > 0) {
        console.log('  First interior path length:', pathInfo.paths[0].length);
        console.log('  First interior path sample:', pathInfo.paths[0].slice(0, 3));
    }

    // Check if joinAllPaths would return something
    var edgepathsCount = pathInfo.edgepaths.length;
    var pathsCount = pathInfo.paths.length;
    console.log('  Would joinAllPaths return empty?', (edgepathsCount === 0 && pathsCount === 0));
}

// Check what happens with style.x and style.y
console.log('\n=== Checking style.x and style.y ===');
console.log('data.x length:', data.x.length);
console.log('data.y length:', data.y.length);
console.log('data.x sample:', data.x.slice(0, 5));
console.log('data.y sample:', data.y.slice(0, 5));
