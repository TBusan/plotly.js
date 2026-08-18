'use strict';

/**
 * Pixel-level diff of two PNG files using @napi-rs/canvas.
 * Tolerates 0 difference by default (pixel-identical requirement).
 *
 * Usage:
 *   node bench/pixel-diff.js <baseline.png> <candidate.png>
 *
 * Exit code 0 = identical, 1 = differences (prints stats).
 */

var { createCanvas, loadImage } = require('@napi-rs/canvas');

function pixelDiff(aPath, bPath) {
    var a = loadImage(aPath);
    var b = loadImage(bPath);
    return Promise.all([a, b]).then(function(imgs) {
        return compare(imgs[0], imgs[1], aPath);
    });
}

function compare(a, b, aPath) {

    if (a.width !== b.width || a.height !== b.height) {
        console.error('SIZE MISMATCH: ' + a.width + 'x' + a.height + ' vs ' + b.width + 'x' + b.height);
        process.exit(1);
    }

    var canvas = createCanvas(a.width, a.height);
    var ctx = canvas.getContext('2d');
    ctx.drawImage(a, 0, 0);
    var dataA = ctx.getImageData(0, 0, a.width, a.height).data;

    ctx.clearRect(0, 0, a.width, a.height);
    ctx.drawImage(b, 0, 0);
    var dataB = ctx.getImageData(0, 0, a.width, a.height).data;

    var diff = 0;
    var maxDiff = 0;
    for (var i = 0; i < dataA.length; i += 4) {
        var d = Math.max(
            Math.abs(dataA[i] - dataB[i]),
            Math.abs(dataA[i + 1] - dataB[i + 1]),
            Math.abs(dataA[i + 2] - dataB[i + 2]),
            Math.abs(dataA[i + 3] - dataB[i + 3])
        );
        if (d > 0) {
            diff++;
            if (d > maxDiff) maxDiff = d;
        }
    }

    if (diff === 0) {
        console.log('IDENTICAL: ' + aPath);
        return true;
    }
    console.log('DIFF (' + diff + ' px, max channel delta ' + maxDiff + '): ' + aPath);
    return false;
}

var pairs = process.argv.slice(2);
Promise.all(pairs.map(function(p, i) {
    if (i % 2 === 0 && pairs[i + 1]) return pixelDiff(p, pairs[i + 1]);
    return null;
})).then(function(results) {
    var ok = results.filter(Boolean).every(function(r) { return r; });
    process.exit(ok ? 0 : 1);
}).catch(function(e) {
    console.error(e);
    process.exit(1);
});
