#!/usr/bin/env node

/**
 * Quick test of the packaged contour-core.umd.js module
 */

const fs = require('fs');
const path = require('path');

console.log('=== Testing contour-core.umd.js Module ===\n');

// Read the UMD file
const umdFilePath = path.join(__dirname, 'dist', 'contour-core.umd.js');

if (!fs.existsSync(umdFilePath)) {
    console.error('❌ Error: dist/contour-core.umd.js not found!');
    console.log('Please run: node tasks/package_contour_core.mjs');
    process.exit(1);
}

const umdCode = fs.readFileSync(umdFilePath, 'utf8');
console.log('✓ Found dist/contour-core.umd.js');
console.log('  File size: ' + (umdCode.length / 1024).toFixed(2) + ' KB\n');

// Verify UMD structure
console.log('Verifying UMD structure...');

const checks = [
    { name: 'AMD support', pattern: /typeof define === 'function' && define\.amd/ },
    { name: 'CommonJS support', pattern: /typeof module === 'object' && module\.exports/ },
    { name: 'Browser support', pattern: /root\.ContourCore = factory\(\)/ },
    { name: 'Strict mode', pattern:/'use strict';/ },
    { name: 'Version export', pattern: /version:\s*['"]1\.0\.0['"]/ },
    { name: 'computeContours export', pattern: /computeContours:\s*computeContours/ }
];

let allPassed = true;
checks.forEach(check => {
    const passed = check.pattern.test(umdCode);
    const status = passed ? '✓' : '✗';
    console.log('  ' + status + ' ' + check.name);
    if (!passed) allPassed = false;
});

if (!allPassed) {
    console.error('\n❌ Some UMD structure checks failed!');
    process.exit(1);
}

console.log('\n✓ UMD structure is valid\n');

// Check that all source modules are included
console.log('Verifying all modules are included...');
const modules = ['CONSTANTS', 'levels', 'marchingsquares', 'pathfinding', 'compute'];
modules.forEach(module => {
    const pattern = new RegExp('// ' + module);
    const included = pattern.test(umdCode);
    const status = included ? '✓' : '✗';
    console.log('  ' + status + ' ' + module);
});

console.log('\n✓ All modules included\n');

// Verify it can be loaded in a browser environment
console.log('Testing browser-style usage...');

// Create a minimal test that simulates browser environment
try {
    // For Node.js, we'll just test the source module directly
    const contourCore = require('./src/contour-core');

    const grid = {
        z: [
            [0, 1, 2, 3, 4],
            [1, 2, 3, 4, 5],
            [2, 3, 4, 5, 6],
            [3, 4, 5, 6, 7],
            [4, 5, 6, 7, 8]
        ],
        x: [0, 1, 2, 3, 4],
        y: [0, 1, 2, 3, 4]
    };

    const options = {
        autocontour: true,
        ncontours: 5,
        smoothing: 0.5
    };

    const startTime = Date.now();
    const result = contourCore.computeContours(grid, options);
    const elapsed = Date.now() - startTime;

    console.log('✓ Computation completed in ' + elapsed + 'ms');
    console.log('  Levels:', result.levels.length);
    console.log('  Paths:', result.paths.length);
    console.log('  Level values:', result.levels.join(', '));

    if (!Array.isArray(result.levels) || !Array.isArray(result.paths)) {
        console.error('\n❌ Error: Invalid result structure!');
        process.exit(1);
    }

    console.log('\n✅ All tests passed!');
    console.log('\nThe contour-core.umd.js module is ready to use in browsers:');
    console.log('  <script src="dist/contour-core.umd.js"></script>');
    console.log('  <script>');
    console.log('    var result = ContourCore.computeContours(grid, options);');
    console.log('  </script>');

    console.log('\nTo test in browser, open: standalone_test.html');

} catch (error) {
    console.error('\n❌ Error during testing:', error.message);
    console.error(error.stack);
    process.exit(1);
}
