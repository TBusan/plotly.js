'use strict';

/**
 * Compare regenerated demo outputs against the captured baseline.
 * Normalizes known nondeterministic tokens (timestamp/random SVG ids)
 * so text files can be byte-compared deterministically.
 *
 * Usage:
 *   node bench/verify-output.js          # compare demo/nodejs/output vs bench/baseline
 *   node bench/verify-output.js --update # refresh bench/baseline from current outputs
 *
 * Exit 0 = all identical (after normalization), 1 = differences.
 */

var fs = require('fs');
var path = require('path');
var { execSync } = require('child_process');

var OUT = 'demo/nodejs/output';
var BASE = 'bench/baseline';

// Files excluded from byte-comparison: these demo outputs are generated from
// RANDOM input data (demo/nodejs/geojson-export.js uses Math.random()*5 to
// build its terrain), so they legitimately differ between runs. GeoJSON
// determinism is covered by fixed-input assertions in bench/regression.js.
var EXCLUDE = ['contour-lines.geojson', 'contour-fill.geojson'];

// Normalize nondeterministic tokens in generated SVG/GeoJSON text:
//  - colorbar-gradient-<timestamp>
//  - clip<timestamp><random> (svg clipPath ids)
function normalize(text) {
    return text
        .replace(/colorbar-gradient-\d+/g, 'colorbar-gradient-ID')
        .replace(/clip\d+\d{4,}/g, 'clipID');
}

function compareFiles(aPath, bPath) {
    if (aPath.endsWith('.png')) {
        var r = execSync('node bench/pixel-diff.js ' +
            JSON.stringify(bPath) + ' ' + JSON.stringify(aPath), { encoding: 'utf8' });
        return r.includes('IDENTICAL');
    }
    var a = fs.readFileSync(aPath, 'utf8');
    var b = fs.readFileSync(bPath, 'utf8');
    return normalize(a) === normalize(b);
}

function run() {
    var outDir = path.join(__dirname, '..', OUT);
    var baseDir = path.join(__dirname, '..', BASE);
    var files = fs.readdirSync(outDir).sort();
    var diffs = [];
    var missing = [];
    var total = 0;

    files.forEach(function(f) {
        if (EXCLUDE.indexOf(f) !== -1) { return; }
        var op = path.join(outDir, f);
        var bp = path.join(baseDir, f);
        if (!fs.existsSync(bp)) { missing.push(f); return; }
        total++;
        if (!compareFiles(op, bp)) diffs.push(f);
    });

    if (missing.length) {
        console.log('MISSING in baseline: ' + missing.join(', '));
    }
    if (diffs.length) {
        console.log('DIFFS (' + diffs.length + '/' + total + '):');
        diffs.forEach(function(d) { console.log('  - ' + d); });
    } else {
        console.log('ALL ' + total + ' outputs IDENTICAL (normalized)');
    }
    return diffs.length === 0 && missing.length === 0;
}

if (process.argv.includes('--update')) {
    fs.mkdirSync(path.join(__dirname, '..', BASE), { recursive: true });
    fs.readdirSync(path.join(__dirname, '..', OUT)).forEach(function(f) {
        fs.copyFileSync(
            path.join(__dirname, '..', OUT, f),
            path.join(__dirname, '..', BASE, f));
    });
    console.log('baseline updated from ' + OUT);
    process.exit(0);
}

process.exit(run() ? 0 : 1);
