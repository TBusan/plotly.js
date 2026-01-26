#!/usr/bin/env node
/**
 * Test rendering functionality to catch errors before browser testing
 */

const ContourCore = require('./dist/contour-core.umd.js');

console.log('=== Testing Rendering Functionality ===\n');

// Mock canvas for Node.js testing
class MockCanvas {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.operations = [];
    }

    getContext(type) {
        return {
            canvas: this,
            clearRect: (x, y, w, h) => this.operations.push(['clearRect', x, y, w, h]),
            fillStyle: null,
            strokeStyle: null,
            lineWidth: 1,
            lineJoin: 'round',
            lineCap: 'round',
            beginPath: () => this.operations.push(['beginPath']),
            moveTo: (x, y) => this.operations.push(['moveTo', x, y]),
            lineTo: (x, y) => this.operations.push(['lineTo', x, y]),
            closePath: () => this.operations.push(['closePath']),
            fill: () => this.operations.push(['fill']),
            stroke: () => this.operations.push(['stroke']),
            bezierCurveTo: (x1, y1, x2, y2, x, y) => this.operations.push(['bezierCurveTo', x1, y1, x2, y2, x, y]),
            quadraticCurveTo: (x1, y1, x, y) => this.operations.push(['quadraticCurveTo', x1, y1, x, y]),
            fillRect: (x, y, w, h) => this.operations.push(['fillRect', x, y, w, h]),
            strokeRect: (x, y, w, h) => this.operations.push(['strokeRect', x, y, w, h]),
            fillText: (text, x, y) => this.operations.push(['fillText', text, x, y]),
            save: () => this.operations.push(['save']),
            restore: () => this.operations.push(['restore']),
            translate: (x, y) => this.operations.push(['translate', x, y]),
            rotate: (angle) => this.operations.push(['rotate', angle])
        };
    }
}

// Test data
const grid2 = [
    [10, 10.625, 12.5, 15.625, 20],
    [5.625, 6.25, 8.125, 11.25, 15.625],
    [2.5, 3.125, 5., 8.125, 12.5],
    [0.625, 1.25, 3.125, 6.25, 10.625],
    [0, 0.625, 2.5, 5.625, 10]
];

const grid1 = [
    [null, null, null, 12, 13, 14, 15, 16],
    [null, 1, null, 11, null, null, null, 17],
    [null, 2, 6, 7, null, null, null, 18],
    [null, 3, null, 8, null, null, null, 19],
    [5, 4, 10, 9, null, null, null, 20],
    [null, null, null, 27, null, null, null, 21],
    [null, null, null, 26, 25, 24, 23, 22]
];

// Test different rendering modes
const testCases = [
    {
        name: 'Grid2 - Fill mode with Viridis',
        grid: grid2,
        config: {
            z: grid2,
            contours: { type: 'fill' },
            colorscale: 'Viridis',
            autocontour: true,
            ncontours: 10,
            smoothing: 0.5
        }
    },
    {
        name: 'Grid2 - Lines mode with Plasma',
        grid: grid2,
        config: {
            z: grid2,
            contours: { type: 'lines' },
            colorscale: 'Plasma',
            autocontour: true,
            ncontours: 8,
            smoothing: 0
        }
    },
    {
        name: 'Grid2 - Fill+Lines with Hot',
        grid: grid2,
        config: {
            z: grid2,
            contours: { type: 'fill' },
            colorscale: 'Hot',
            autocontour: true,
            ncontours: 12,
            smoothing: 0.5
        }
    },
    {
        name: 'Grid1 - Fill mode with nulls',
        grid: grid1,
        config: {
            z: grid1,
            contours: { type: 'fill' },
            colorscale: 'Jet',
            autocontour: true,
            ncontours: 10,
            smoothing: 0.5
        }
    },
    {
        name: 'Grid1 - Lines mode with nulls',
        grid: grid1,
        config: {
            z: grid1,
            contours: { type: 'lines' },
            colorscale: 'Earth',
            autocontour: true,
            ncontours: 8,
            smoothing: 0
        }
    },
    {
        name: 'Grid2 - No smoothing',
        grid: grid2,
        config: {
            z: grid2,
            contours: { type: 'fill' },
            colorscale: 'Viridis',
            autocontour: true,
            ncontours: 8,
            smoothing: 0
        }
    },
    {
        name: 'Grid2 - High smoothing',
        grid: grid2,
        config: {
            z: grid2,
            contours: { type: 'fill' },
            colorscale: 'Viridis',
            autocontour: true,
            ncontours: 8,
            smoothing: 1.0
        }
    }
];

let passCount = 0;
let failCount = 0;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    try {
        const canvas = new MockCanvas(400, 350);
        const result = ContourCore.render(canvas, testCase.config);

        const operationCount = canvas.operations.length;
        const hasOperations = operationCount > 0;

        if (hasOperations) {
            console.log(`  ✓ PASS - ${operationCount} canvas operations`);
            console.log(`    Levels: ${result.levels.length}, Paths: ${result.paths.length}`);
            passCount++;
        } else {
            console.log('  ✗ FAIL - No canvas operations generated');
            failCount++;
        }
    } catch (e) {
        console.log(`  ✗ FAIL - ${e.message}`);
        console.log(`    Stack: ${e.stack.split('\n').slice(0, 3).join('\n')}`);
        failCount++;
    }
    console.log('');
});

console.log('=== Test Results ===');
console.log(`Passed: ${passCount}/${testCases.length}`);
console.log(`Failed: ${failCount}/${testCases.length}`);

if (failCount === 0) {
    console.log('\n✅ All rendering tests passed!');
    console.log('The library should work correctly in test_simple.html');
} else {
    console.log('\n❌ Some tests failed - please review the errors above');
    process.exit(1);
}
