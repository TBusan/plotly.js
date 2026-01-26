#!/usr/bin/env node

'use strict';

/**
 * Server-Side Rendering (SSR) Demo
 * Generates contour plots as PNG images on the server side
 *
 * Requirements:
 * - Node.js >= 12
 * - canvas: npm install canvas
 */

var http = require('http');
var fs = require('fs');
var path = require('path');
var contourCore = require('./src/contour-core');

// Try to load canvas - it's optional for the demo
var Canvas, Image, createCanvas;
try {
    var canvasModule = require('canvas');
    Canvas = canvasModule.Canvas;
    Image = canvasModule.Image;
    createCanvas = canvasModule.createCanvas;
} catch (e) {
    console.log('Note: canvas module not installed. SSR rendering disabled.');
    console.log('Install with: npm install canvas');
}

// ========================================
// Data Generation
// ========================================

function createGaussianGrid(size, centerX, centerY, sigma) {
    var z = [];
    for (var i = 0; i < size; i++) {
        var row = [];
        for (var j = 0; j < size; j++) {
            var dx = j - centerX;
            var dy = i - centerY;
            var val = Math.exp(-(dx*dx + dy*dy) / (2*sigma*sigma));
            row.push(val * 100);
        }
        z.push(row);
    }
    return { z: z, x: [], y: [] };
}

function createMultiPeakGrid(size) {
    var z = [];
    for (var i = 0; i < size; i++) {
        var row = [];
        for (var j = 0; j < size; j++) {
            var val1 = 80 * Math.exp(-((j-10)*(j-10) + (i-10)*(i-10)) / 50);
            var val2 = 60 * Math.exp(-((j-25)*(j-25) + (i-20)*(i-20)) / 80);
            var val3 = 40 * Math.exp(-((j-15)*(j-15) + (i-30)*(i-30)) / 60);
            row.push(val1 + val2 + val3);
        }
        z.push(row);
    }
    return { z: z, x: [], y: [] };
}

// ========================================
// Canvas Rendering (when canvas is available)
// ========================================

function renderContourToCanvas(grid, options, width, height) {
    if (!createCanvas) {
        return null;
    }

    var canvas = createCanvas(width || 600, height || 400);
    var ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Compute contours
    var result = contourCore.computeContours(grid, options);

    // Simple renderer (no smoothing for SSR demo)
    var smoothing = options.smoothing || 0;
    var xScale = width / grid.z[0].length;
    var yScale = height / grid.z.length;

    var colors = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4'];

    result.paths.forEach(function(pathInfo, idx) {
        ctx.strokeStyle = colors[idx % colors.length];
        ctx.lineWidth = 1.5;
        ctx.fillStyle = colors[idx % colors.length];

        var paths = pathInfo.paths.concat(pathInfo.edgepaths);

        paths.forEach(function(path) {
            if (path.length < 2) return;

            ctx.beginPath();
            var scaledPath = path.map(function(pt) {
                return [pt[0] * xScale, height - pt[1] * yScale];
            });

            ctx.moveTo(scaledPath[0][0], scaledPath[0][1]);
            for (var i = 1; i < scaledPath.length; i++) {
                ctx.lineTo(scaledPath[i][0], scaledPath[i][1]);
            }

            if (pathInfo.paths.indexOf(path) >= 0) {
                ctx.closePath();
                if (options.coloring === 'fill') {
                    ctx.globalAlpha = 0.5;
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                }
            }
            ctx.stroke();
        });
    });

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Contour SSR Demo - Node.js Canvas', width / 2, 25);

    return canvas;
}

// ========================================
// HTTP Server
// ========================================

var server = http.createServer(function(req, res) {
    var url = req.url;

    if (url === '/' || url === '/demo') {
        // Serve HTML demo page
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getDemoPage());
    } else if (url === '/api/contour') {
        // JSON API endpoint
        handleContourAPI(req, res);
    } else if (url.startsWith('/api/render')) {
        // Render to PNG endpoint
        handleRenderAPI(req, res);
    } else if (url === '/benchmark') {
        // Run benchmark
        handleBenchmark(req, res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

function handleContourAPI(req, res, body) {
    var data = '';
    req.on('data', function(chunk) { data += chunk; });
    req.on('end', function() {
        try {
            var params = JSON.parse(data || '{}');
            var grid = createGaussianGrid(
                params.size || 30,
                (params.size || 30) / 2,
                (params.size || 30) / 2,
                (params.size || 30) / 6
            );

            var start = Date.now();
            var result = contourCore.computeContours(grid, params.options || {});
            var elapsed = Date.now() - start;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                elapsed: elapsed + 'ms',
                levels: result.levels,
                pathCount: result.paths.reduce(function(sum, p) {
                    return sum + p.edgepaths.length + p.paths.length;
                }, 0),
                paths: result.paths
            }, null, 2));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    });
}

function handleRenderAPI(req, res) {
    if (!createCanvas) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'canvas module not installed' }));
        return;
    }

    var data = '';
    req.on('data', function(chunk) { data += chunk; });
    req.on('end', function() {
        try {
            var params = JSON.parse(data || '{}');
            var grid = createGaussianGrid(params.size || 30, 15, 15, 5);
            var canvas = renderContourToCanvas(grid, params.options || {}, 600, 400);

            if (canvas) {
                res.writeHead(200, { 'Content-Type': 'image/png' });
                canvas.createPNGStream().pipe(res);
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Canvas not available');
            }
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    });
}

function handleBenchmark(req, res) {
    var results = [];
    var sizes = [20, 30, 50];

    sizes.forEach(function(size) {
        var grid = createGaussianGrid(size, size/2, size/2, size/6);
        var start = process.hrtime.bigint();
        var result = contourCore.computeContours(grid, {
            autocontour: true,
            ncontours: 10,
            smoothing: 0
        });
        var elapsed = Number(process.hrtime.bigint() - start) / 1000000;

        results.push({
            size: size + 'x' + size,
            time: elapsed.toFixed(2) + 'ms',
            levels: result.levels.length
        });
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ results: results }, null, 2));
}

function getDemoPage() {
    return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n' +
        '<title>Contour SSR Demo</title>\n' +
        '<style>body{font-family:Arial,sans-serif;margin:20px;background:#f5f5f5;}' +
        '.container{max-width:900px;margin:0 auto;background:white;padding:30px;border-radius:10px;}' +
        'h1{color:#1976d2;}h2{color:#424242;border-bottom:2px solid #1976d2;padding-bottom:10px;}' +
        '.section{margin:30px 0;padding:20px;background:#f9f9f9;border-radius:8px;}' +
        'button{padding:10px 20px;border:none;border-radius:5px;background:#1976d2;color:white;cursor:pointer;font-size:14px;}' +
        'button:hover{background:#1565c0;}' +
        'pre{background:#263238;color:#aed581;padding:15px;border-radius:8px;overflow-x:auto;}' +
        '.success{background:#c8e6c9;color:#2e7d32;padding:15px;border-radius:8px;}</style>\n</head>\n<body>\n' +
        '<div class="container">\n' +
        '<h1>🚀 Contour-Core SSR Demo</h1>\n' +
        '<div class="success">✓ Running on Node.js server with contour-core module</div>\n\n' +
        '<div class="section">\n<h2>Test 1: Compute Contours (JSON API)</h2>\n' +
        '<button onclick="testCompute()">Run Test</button>\n' +
        '<pre id="compute-result">Click "Run Test" to compute contours...</pre>\n</div>\n\n' +
        (createCanvas ?
        '<div class="section">\n<h2>Test 2: Render to PNG (Image API)</h2>\n' +
        '<button onclick="testRender()">Generate PNG</button>\n' +
        '<div id="render-result" style="margin-top:15px;"></div>\n</div>\n\n' : '') +
        '<div class="section">\n<h2>Test 3: Benchmark</h2>\n' +
        '<button onclick="testBenchmark()">Run Benchmark</button>\n' +
        '<pre id="benchmark-result">Click "Run Benchmark"...</pre>\n</div>\n\n' +
        '<div class="section">\n<h2>📊 Server-Side Rendering Benefits</h2>\n' +
        '<ul><li><strong>Performance</strong>: Offload computation to server</li>\n' +
        '<li><strong>SEO Friendly</strong>: Pre-render charts on server</li>\n' +
        '<li><strong>Reduced Client Load</strong>: Send pre-computed data</li>\n' +
        '<li><strong>Image Generation</strong>: Create PNG thumbnails</li>\n' +
        '<li><strong>Batch Processing</strong>: Generate many charts in parallel</li></ul></div>\n' +
        '</div>\n\n<script>\n' +
        'async function testCompute() {\n' +
        '  const res = await fetch("/api/contour", {\n' +
        '    method: "POST",\n' +
        '    headers: {"Content-Type": "application/json"},\n' +
        '    body: JSON.stringify({ size: 30, options: { autocontour: true, ncontours: 10, smoothing: 0.5 } })\n' +
        '  });\n' +
        '  const data = await res.json();\n' +
        '  document.getElementById("compute-result").textContent =\n' +
        '    JSON.stringify(data, null, 2);\n' +
        '}\n\n' +
        (createCanvas ?
        'async function testRender() {\n' +
        '  const res = await fetch("/api/render", {\n' +
        '    method: "POST",\n' +
        '    headers: {"Content-Type": "application/json"},\n' +
        '    body: JSON.stringify({ size: 30, options: { autocontour: true, ncontours: 8 } })\n' +
        '  });\n' +
        '  const blob = await res.blob();\n' +
        '  const url = URL.createObjectURL(blob);\n' +
        '  document.getElementById("render-result").innerHTML =\n' +
        '    \'<p><img src="\' + url + \'" style="border:2px solid #ddd;border-radius:8px;" /></p>\';\n' +
        '}\n\n' : '') +
        'async function testBenchmark() {\n' +
        '  const res = await fetch("/benchmark");\n' +
        '  const data = await res.json();\n' +
        '  document.getElementById("benchmark-result").textContent =\n' +
        '    JSON.stringify(data, null, 2);\n' +
        '}\n</script>\n</body>\n</html>';
}

// ========================================
// Start Server
// ========================================

var PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
    console.log('=== Contour-Core SSR Server ===');
    console.log('Server running at: http://localhost:' + PORT + '/');
    console.log('');
    console.log('Available endpoints:');
    console.log('  /                    - Demo page');
    console.log('  /api/contour        - Compute contours (JSON)');
    if (createCanvas) {
        console.log('  /api/render         - Render to PNG');
    }
    console.log('  /benchmark           - Run performance benchmark');
    console.log('');
    console.log('Features:');
    console.log('  ✓ Server-side contour computation');
    if (createCanvas) {
        console.log('  ✓ PNG image generation');
    } else {
        console.log('  ○ PNG generation (install canvas module)');
    }
    console.log('  ✓ JSON API');
    console.log('  ✓ No browser/DOM required');
    console.log('');
    console.log('Press Ctrl+C to stop');
});
