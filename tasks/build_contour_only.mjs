#!/usr/bin/env node

/**
 * Build contour-only Plotly.js bundle
 * 创建只包含 contour 功能的精简 Plotly.js
 */

import { execSync } from 'child_process';
import minimist from 'minimist';
import path from 'path';

// Parse command line
const args = minimist(process.argv.slice(2));
const unminified = args.unminified ? true : false;

console.log('=== Building Plotly.js (Contour Only) ===\n');

// Use the custom_bundle script to build only contour traces
try {
    const traces = 'contour,histogram2dcontour,scatter,scattergl';
    const strict = false;
    const out = 'contour';

    console.log('Building Plotly.js with only these traces:');
    console.log('  - contour');
    console.log('  - histogram2dcontour');
    console.log('  - scatter');
    console.log('  - scattergl');
    console.log('');

    const cmd = `node tasks/custom_bundle.mjs --traces=${traces} --out=${out}${unminified ? ' --unminified' : ''}`;

    console.log('Running: ' + cmd + '\n');

    execSync(cmd, { stdio: 'inherit' });

    console.log('\n✓ Built dist/plotly-contour.js' + (unminified ? '' : ' and minified version'));
    console.log('\n这是一个只包含 contour 功能的精简版本');
    console.log('大小约为完整版的 30-40%');

} catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
}
