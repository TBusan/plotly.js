var C = require('./src/contour-core/index.js');

// Create simple test grid
var grid = [
    [1, 2, 3, 4],
    [2, 3, 4, 5],
    [3, 4, 5, 6]
];

console.log('Computing contours...');
var r = C.computeContours({z: grid}, {ncontours: 3});
console.log('Total levels:', r.paths.length);

// Check first level with edgepaths
for(var i = 0; i < r.paths.length; i++) {
    var p = r.paths[i];
    if(p.edgepaths.length > 0) {
        console.log('\n=== Level', p.level, '===');
        console.log('edgepaths:', p.edgepaths.length);

        // Show what joinAllPaths should do
        var style = {z: grid, width: 400, height: 300, padding: 30};
        var perimeter = [[30,30],[370,30],[370,270],[30,270]];

        // Manual implementation of joinAllPaths
        var edgepaths = p.edgepaths;

        console.log('\nEdgepath endpoints:');
        for(var j = 0; j < edgepaths.length; j++) {
            var ep = edgepaths[j];
            console.log('  EP[' + j + '] start:', ep[0], 'end:', ep[ep.length-1]);
        }

        break;
    }
}
