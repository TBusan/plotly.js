'use strict';

/**
 * Integration tests for SVG renderer
 */

var ContourCore = require('../../index');

console.log('=== SVG Renderer Tests ===\n');

// Test 1: SVG filled paths
console.log('Test 1: SVG filled paths');
// Generate a larger test grid
var grid1 = [];
for(var i = 0; i < 30; i++) {
    grid1[i] = [];
    for(var j = 0; j < 40; j++) {
        grid1[i][j] = Math.sin(i * 0.3) * Math.cos(j * 0.3) * 10 + j * 0.5;
    }
}
var result1 = ContourCore.computeContours({ z: grid1 }, { autocontour: true, ncontours: 8 });
var svg1 = ContourCore.renderers.svg.renderSVG(result1, {
    width: 500,
    height: 400,
    coloring: 'fill',
    colorscale: 'Viridis',
    showLines: true,
    showLabels: true,
    colorbar: true
});

console.assert(svg1.includes('<svg'), 'Should start with SVG tag');
console.assert(svg1.includes('</svg>'), 'Should end with SVG closing tag');
console.assert(svg1.includes('<path'), 'Should contain path elements');
console.log('SVG length: ' + svg1.length + ' characters');
console.log('✓ SVG filled paths created\n');

// Test 2: SVG stroke paths
console.log('Test 2: SVG stroke paths');
var svg2 = ContourCore.renderers.svg.renderSVG(result1, {
    width: 500,
    height: 400,
    coloring: 'lines',
    colorscale: 'Plasma',
    showLabels: false
});

console.assert(svg2.includes('stroke="#333"'), 'Should have stroke color');
console.assert(svg2.includes('fill="none"'), 'Should have no fill');
console.log('✓ SVG stroke paths created\n');

// Test 3: SVG with null regions
console.log('Test 3: SVG with null regions');
var grid2 = [
    [null, null, 12, 13],
    [null, 1, null, 11],
    [5, 2, 6, null]
];
var result2 = ContourCore.computeContours({ z: grid2 }, { autocontour: true, ncontours: 6 });
var svg3 = ContourCore.renderers.svg.renderSVG(result2, {
    width: 400,
    height: 300,
    coloring: 'fill',
    nullRegion: {
        visible: true,
        fill: '#ffffff',
        stroke: '#cccccc'
    }
});

console.assert(svg3.includes('<rect'), 'Should contain null region rectangles');
console.log('✓ SVG null regions created\n');

// Test 4: SVG colorbar
console.log('Test 4: SVG colorbar');
var svg4 = ContourCore.renderers.svg.renderSVG(result1, {
    width: 500,
    height: 400,
    coloring: 'fill',
    colorbar: true,
    colorscale: 'Hot',
    colorbarTitle: 'Temperature'
});

console.assert(svg4.includes('<linearGradient'), 'Should have gradient definition');
console.assert(svg4.includes('<rect'), 'Should have colorbar rect');
console.assert(svg4.includes('Temperature'), 'Should have title');
console.log('✓ SVG colorbar created\n');

// Test 5: SVG labels
console.log('Test 5: SVG labels');
var svg5 = ContourCore.renderers.svg.renderSVG(result1, {
    width: 500,
    height: 400,
    coloring: 'lines',
    showLabels: true,
    labelFont: 'Arial',
    labelSize: 14,
    labelColor: '#000'
});

console.assert(svg5.includes('<text'), 'Should contain text elements');
console.assert(svg5.includes('rotate('), 'Should have rotation transform');
console.log('✓ SVG labels created\n');

// Test 6: Save SVG to file
console.log('Test 6: Save SVG to file');
var fs = require('fs');
var outputPath = '../../test_output.svg';
fs.writeFileSync(outputPath, svg1);
console.log('✓ Saved test SVG to: ' + outputPath + '\n');

console.log('=== All SVG Renderer Tests Passed ===');
console.log('\nGenerated SVG samples:');
console.log('- test_output.svg: Complete example with fill + lines + labels + colorbar');
console.log('\nTo view: Open test_output.svg in a browser');
