#!/usr/bin/env node

/**
 * Simple test of UMD module in Node.js
 */

const fs = require('fs');
const path = require('path');

// Read and evaluate the UMD module
const umdCode = fs.readFileSync(path.join(__dirname, 'dist', 'contour-core.umd.js'), 'utf8');

// Create a module context
const moduleContext = {
    exports: {}
};

// Evaluate in a sandboxed way
const factory = new Function('module', umdCode + '\nreturn module.exports;');
const ContourCore = factory(moduleContext);

console.log('=== Testing UMD Module ===\n');
console.log('Module loaded:', typeof ContourCore);
console.log('computeContours:', typeof ContourCore.computeContours);
console.log('getVersion:', typeof ContourCore.getVersion);
console.log('getInfo:', typeof ContourCore.getInfo);

if (typeof ContourCore.computeContours === 'function') {
    console.log('\n✓ computeContours is a function');

    const grid = {
        z: [
            [0, 1, 2, 3, 4],
            [1, 2, 3, 4, 5],
            [2, 3, 4, 5, 6],
            [3, 4, 5, 6, 7],
            [4, 5, 6, 7, 8]
        ]
    };

    const options = {
        autocontour: true,
        ncontours: 5
    };

    try {
        const result = ContourCore.computeContours(grid, options);
        console.log('\n✓ Computation successful');
        console.log('  Levels:', result.levels.length);
        console.log('  Paths:', result.paths.length);
    } catch (error) {
        console.error('\n✗ Computation failed:', error.message);
        console.error('Stack:', error.stack);
    }
} else {
    console.error('\n✗ computeContours is not a function!');
}
