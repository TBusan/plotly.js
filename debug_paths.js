var C = require('./src/contour-core/index.js');

// Create test grid similar to demo
var grid = [];
for(var i = 0; i < 20; i++) {
    grid[i] = [];
    for(var j = 0; j < 30; j++) {
        grid[i][j] = Math.sin(i * 0.3) * Math.cos(j * 0.3) * 10 + j * 0.5;
    }
}

console.log('Computing contours...');
var r = C.computeContours({z: grid}, {ncontours: 5});
console.log('Total paths:', r.paths.length);

// Examine first few levels
for(var i = 0; i < Math.min(5, r.paths.length); i++) {
    var p = r.paths[i];
    console.log('\n=== Level', p.level, '===');
    console.log('edgepaths:', p.edgepaths.length);
    console.log('paths:', p.paths.length);
    console.log('prefixBoundary:', p.prefixBoundary);

    // Show each edgepath's endpoints
    for(var j = 0; j < p.edgepaths.length; j++) {
        var ep = p.edgepaths[j];
        console.log('  Edgepath', j, ': length=' + ep.length +
                    ', start=[' + ep[0][0].toFixed(2) + ',' + ep[0][1].toFixed(2) + ']' +
                    ', end=[' + ep[ep.length-1][0].toFixed(2) + ',' + ep[ep.length-1][1].toFixed(2) + ']');
    }
}
