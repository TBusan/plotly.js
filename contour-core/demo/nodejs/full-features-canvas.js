'use strict';

/**
 * Node.js Demo: Full Features Canvas
 *
 * This demo shows all major features of contour-core canvas rendering:
 * - Fill mode
 * - Lines mode
 * - Heatmap mode
 * - With axes
 * - Export to PNG
 */

var fs = require('fs');
var path = require('path');
var { createCanvas } = require('@napi-rs/canvas');
var contourCore = require('../../index.js');

// Create a realistic terrain-like grid
function createTerrainGrid() {
    var rows = 60;
    var cols = 80;
    var grid = [];

    for (var i = 0; i < rows; i++) {
        var row = [];
        for (var j = 0; j < cols; j++) {
            var x = j / cols;
            var y = i / rows;

            // Combine multiple features
            var base = 50;
            var ridge = Math.exp(-Math.pow((x - 0.3) * 2, 2)) * 30 * (1 - y);
            var valley = -Math.exp(-Math.pow((x - 0.7) * 3, 2)) * 20;
            var hill1 = Math.exp(-((x - 0.2) ** 2 + (y - 0.8) ** 2) * 20) * 40;
            var hill2 = Math.exp(-((x - 0.8) ** 2 + (y - 0.2) ** 2) * 15) * 35;
            var noise = Math.sin(x * 30) * Math.cos(y * 25) * 3;

            row.push(base + ridge + valley + hill1 + hill2 + noise);
        }
        grid.push(row);
    }

    return grid;
}

function runDemo() {
    console.log('=== Full Features Canvas Demo ===\n');
    console.log('This demo generates multiple output files:\n');

    var grid = createTerrainGrid();
    console.log('Grid size:', grid.length, 'x', grid[0].length);

    var outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    var canvasRenderer = contourCore.renderers.canvas;

    // ========================================
    // 1. Fill mode
    // ========================================
    console.log('\n--- Canvas Export (Fill) ---');

    var fillResult = contourCore.computeContours({
        z: grid
    }, {
        autocontour: true,
        ncontours: 15,
        smoothing: 0.6
    });

    var fillCanvas = createCanvas(900, 600);
    var fillCtx = fillCanvas.getContext('2d');
    fillCtx.fillStyle = '#ffffff';
    fillCtx.fillRect(0, 0, 900, 600);

    canvasRenderer.drawContours(fillCtx, fillResult, {
        width: 900,
        height: 600,
        coloring: 'fill',
        showLines: true,
        lineColor: 'rgba(255,255,255,0.5)',
        lineWidth: 1,
        colorScale: [
            [20, '#2c7bb6'],
            [40, '#abd9e9'],
            [60, '#ffffbf'],
            [80, '#fdae61'],
            [100, '#d7191c']
        ]
    });

    var fillPath = path.join(outputDir, 'full-features-fill-canvas.png');
    var fillBuffer = fillCanvas.toBuffer('image/png');
    fs.writeFileSync(fillPath, fillBuffer);
    console.log('Saved:', fillPath, '(' + (fillBuffer.length / 1024).toFixed(1), 'KB)');

    // ========================================
    // 2. Lines mode
    // ========================================
    console.log('\n--- Canvas Export (Lines) ---');

    var linesCanvas = createCanvas(900, 600);
    var linesCtx = linesCanvas.getContext('2d');
    linesCtx.fillStyle = '#ffffff';
    linesCtx.fillRect(0, 0, 900, 600);

    canvasRenderer.drawContours(linesCtx, fillResult, {
        width: 900,
        height: 600,
        coloring: 'lines',
        showLines: true,
        lineWidth: 1.5,
        lineColor: '#333'
    });

    var linesPath = path.join(outputDir, 'full-features-lines-canvas.png');
    var linesBuffer = linesCanvas.toBuffer('image/png');
    fs.writeFileSync(linesPath, linesBuffer);
    console.log('Saved:', linesPath, '(' + (linesBuffer.length / 1024).toFixed(1), 'KB)');

    // ========================================
    // 3. Heatmap mode
    // ========================================
    console.log('\n--- Canvas Export (Heatmap) ---');

    var heatmapResult = contourCore.computeContours({
        z: grid
    }, {
        autocontour: true,
        ncontours: 30,
        smoothing: 0
    });

    var heatmapCanvas = createCanvas(900, 600);
    var heatmapCtx = heatmapCanvas.getContext('2d');
    heatmapCtx.fillStyle = '#ffffff';
    heatmapCtx.fillRect(0, 0, 900, 600);

    canvasRenderer.drawContours(heatmapCtx, heatmapResult, {
        width: 900,
        height: 600,
        coloring: 'heatmap',
        showLines: false,
        colorScale: [
            [20, '#313695'],
            [35, '#4575b4'],
            [50, '#74add1'],
            [65, '#e0f3f8'],
            [80, '#fee090'],
            [95, '#f46d43'],
            [110, '#a50026']
        ]
    });

    var heatmapPath = path.join(outputDir, 'full-features-heatmap-canvas.png');
    var heatmapBuffer = heatmapCanvas.toBuffer('image/png');
    fs.writeFileSync(heatmapPath, heatmapBuffer);
    console.log('Saved:', heatmapPath, '(' + (heatmapBuffer.length / 1024).toFixed(1), 'KB)');

    // ========================================
    // 4. Fill with Axes
    // ========================================
    console.log('\n--- Canvas Export (Fill + Axes) ---');

    var axesCanvas = createCanvas(900, 600);
    var axesCtx = axesCanvas.getContext('2d');
    axesCtx.fillStyle = '#ffffff';
    axesCtx.fillRect(0, 0, 900, 600);

    canvasRenderer.drawContours(axesCtx, fillResult, {
        width: 900,
        height: 600,
        coloring: 'fill',
        showLines: true,
        lineColor: 'rgba(255,255,255,0.5)',
        lineWidth: 1,
        colorScale: [
            [20, '#2c7bb6'],
            [40, '#abd9e9'],
            [60, '#ffffbf'],
            [80, '#fdae61'],
            [100, '#d7191c']
        ],
        axes: {
            x: {
                title: 'X Distance (m)',
                color: '#333'
            },
            y: {
                title: 'Y Distance (m)',
                color: '#333'
            }
        },
        showGrid: true,
        gridColor: '#e0e0e0'
    });

    var axesPath = path.join(outputDir, 'full-features-axes-canvas.png');
    var axesBuffer = axesCanvas.toBuffer('image/png');
    fs.writeFileSync(axesPath, axesBuffer);
    console.log('Saved:', axesPath, '(' + (axesBuffer.length / 1024).toFixed(1), 'KB)');

    // ========================================
    // 5. Statistics
    // ========================================
    console.log('\n--- Output Statistics ---');

    var files = [
        { name: 'full-features-fill-canvas.png', size: fillBuffer.length },
        { name: 'full-features-lines-canvas.png', size: linesBuffer.length },
        { name: 'full-features-heatmap-canvas.png', size: heatmapBuffer.length },
        { name: 'full-features-axes-canvas.png', size: axesBuffer.length }
    ];

    console.log('\nFile sizes:');
    for (var i = 0; i < files.length; i++) {
        console.log('  ' + files[i].name + ': ' + (files[i].size / 1024).toFixed(2) + ' KB');
    }

    console.log('\n=== All outputs saved to: ' + outputDir + ' ===');
    console.log('\nDone!');
}

runDemo();
