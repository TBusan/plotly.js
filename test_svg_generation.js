var C = require('./src/contour-core/index.js');

// Create test grid similar to demo
var grid = [];
for(var i = 0; i < 30; i++) {
    grid[i] = [];
    for(var j = 0; j < 40; j++) {
        grid[i][j] = Math.sin(i * 0.3) * Math.cos(j * 0.3) * 10 + j * 0.5;
    }
}

console.log('Computing contours...');
var r = C.computeContours({z: grid}, {ncontours: 8});
console.log('Total paths:', r.paths.length);

// Generate SVG
var svg = C.renderers.svg.renderSVG(r, {
    width: 500,
    height: 400,
    coloring: 'fill',
    colorscale: 'Viridis'
});

// Save SVG
var fs = require('fs');
fs.writeFileSync('test_fill_output.svg', svg);
console.log('Saved to test_fill_output.svg');
console.log('SVG length:', svg.length);

// Log first few paths to see structure
console.log('\n=== First 3 levels ===');
for(var i = 0; i < Math.min(3, r.paths.length); i++) {
    var p = r.paths[i];
    console.log('Level', p.level, ': edgepaths=' + p.edgepaths.length + ', paths=' + p.paths.length + ', prefixBoundary=' + p.prefixBoundary);
}
