var C = require('./src/contour-core/index.js');

var grid = [];
for(var i = 0; i < 10; i++) {
    grid[i] = [];
    for(var j = 0; j < 15; j++) {
        grid[i][j] = Math.sin(i * 0.3) * Math.cos(j * 0.3) * 10;
    }
}

var r = C.computeContours({z: grid}, {ncontours: 3});
var pathInfo = r.paths[0];

console.log('=== Level 0 Debug ===');
console.log('edgepaths:', pathInfo.edgepaths.length);
console.log('First edgepath first 3 points:', pathInfo.edgepaths[0].slice(0, 3));
if(pathInfo.edgepaths.length > 1) {
    console.log('Second edgepath first 3 points:', pathInfo.edgepaths[1].slice(0, 3));
}
if(pathInfo.edgepaths.length > 2) {
    console.log('Third edgepath first 3 points:', pathInfo.edgepaths[2].slice(0, 3));
}

// Check if points are on perimeter
var style = {z: grid, width: 500, height: 400, padding: 30};
var perimeter = [[30,30],[470,30],[470,370],[30,370]];

function scalePoint(style, pt) {
    var m = style.z.length;
    var n = style.z[0].length;
    var width = style.width;
    var height = style.height;
    var padding = style.padding;
    var scaleX = (width - 2*padding)/(n-1);
    var scaleY = (height - 2*padding)/(m-1);
    return [padding + pt[0]*scaleX, padding + (m-1-pt[1])*scaleY];
}

// Scale and check first edgepath endpoints
var ep0 = pathInfo.edgepaths[0].map(function(pt) { return scalePoint(style, pt); });
console.log('\n=== Scaled paths ===');
console.log('EP0 start:', ep0[0], 'end:', ep0[ep0.length-1]);

if(pathInfo.edgepaths.length > 1) {
    var ep1 = pathInfo.edgepaths[1].map(function(pt) { return scalePoint(style, pt); });
    console.log('EP1 start:', ep1[0], 'end:', ep1[ep1.length-1]);
}
if(pathInfo.edgepaths.length > 2) {
    var ep2 = pathInfo.edgepaths[2].map(function(pt) { return scalePoint(style, pt); });
    console.log('EP2 start:', ep2[0], 'end:', ep2[ep2.length-1]);
}

console.log('\n=== Perimeter ===');
console.log('TL:', perimeter[0], 'TR:', perimeter[1], 'BR:', perimeter[2], 'BL:', perimeter[3]);
