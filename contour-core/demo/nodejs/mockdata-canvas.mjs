'use strict';

/**
 * Node.js Demo: MockData Canvas Export
 *
 * This demo renders all mockData datasets (data1-data7) using canvas
 * and exports them as PNG files with both fill and lines modes.
 *
 * Usage: node mockdata-canvas.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from '@napi-rs/canvas';
import contourCore from '../../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color scale definitions (consistent with mockdata-demo.html)
const COLOR_SCALES = {
    Viridis: [
        [0, '#440154'],
        [0.1, '#482878'],
        [0.2, '#3e4a89'],
        [0.3, '#31688e'],
        [0.4, '#26838f'],
        [0.5, '#1f9d8a'],
        [0.6, '#35b779'],
        [0.7, '#6dcd59'],
        [0.8, '#b4de2c'],
        [0.9, '#fde725'],
        [1, '#fde725']
    ],
    Plasma: [
        [0, '#0d0887'],
        [0.1, '#46039f'],
        [0.2, '#7201a8'],
        [0.3, '#9c179e'],
        [0.4, '#bd3786'],
        [0.5, '#d8576b'],
        [0.6, '#ed7953'],
        [0.7, '#fb9f3a'],
        [0.8, '#fdca26'],
        [0.9, '#f0f921'],
        [1, '#f0f921']
    ],
    Inferno: [
        [0, '#000004'],
        [0.1, '#1b0c41'],
        [0.2, '#4a0c6b'],
        [0.3, '#781c6d'],
        [0.4, '#a52c60'],
        [0.5, '#cf4446'],
        [0.6, '#ed6925'],
        [0.7, '#fb9b06'],
        [0.8, '#f7d13d'],
        [0.9, '#fcffa4'],
        [1, '#fcffa4']
    ],
    Jet: [
        [0, '#000080'],
        [0.1, '#0000ff'],
        [0.2, '#007fff'],
        [0.3, '#00ffff'],
        [0.4, '#7fff7f'],
        [0.5, '#ffff00'],
        [0.6, '#ff7f00'],
        [0.7, '#ff0000'],
        [0.8, '#ff0000'],
        [0.9, '#7f0000'],
        [1, '#7f0000']
    ],
    Hot: [
        [0, '#000000'],
        [0.1, '#220000'],
        [0.2, '#440000'],
        [0.3, '#660000'],
        [0.4, '#880000'],
        [0.5, '#cc0000'],
        [0.6, '#ff4400'],
        [0.7, '#ff8800'],
        [0.8, '#ffcc00'],
        [0.9, '#ffff00'],
        [1, '#ffffff']
    ]
};

// Custom configuration for each dataset
const DATASET_CONFIGS = {
    data1: {
        smoothing: 0.3,
        ncontours: 15,
        colorScheme: 'Viridis',
        xTitle: 'X 坐标',
        yTitle: 'Y 坐标'
    },
    data2: {
        smoothing: 0.4,
        ncontours: 12,
        colorScheme: 'Plasma',
        xTitle: '列索引',
        yTitle: '行索引'
    },
    data3: {
        smoothing: 0.3,
        ncontours: 15,
        colorScheme: 'Viridis',
        xTitle: '经度 (°E)',
        yTitle: '纬度 (°N)'
    },
    data4: {
        smoothing: 0.5,
        ncontours: 10,
        colorScheme: 'Inferno',
        xTitle: '列索引',
        yTitle: '行索引'
    },
    data5: {
        smoothing: 0.3,
        ncontours: 15,
        colorScheme: 'Viridis',
        xTitle: '列索引',
        yTitle: '行索引'
    },
    data6: {
        smoothing: 0.4,
        ncontours: 12,
        colorScheme: 'Jet',
        xTitle: '经度 (°E)',
        yTitle: '纬度 (°N)'
    },
    data7: {
        smoothing: 0.5,
        ncontours: 10,
        colorScheme: 'Hot',
        xTitle: '列索引',
        yTitle: '行索引'
    }
};

/**
 * Build color scale for specific value range
 */
function buildColorScale(minVal, maxVal, schemeName) {
    const scheme = COLOR_SCALES[schemeName] || COLOR_SCALES.Viridis;
    return scheme.map(([t, color]) => {
        const value = minVal + t * (maxVal - minVal);
        return [value, color];
    });
}

/**
 * Get data range (min, max)
 */
function getDataRange(z) {
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < z.length; i++) {
        for (let j = 0; j < z[i].length; j++) {
            const val = z[i][j];
            if (val !== null && val !== undefined && !isNaN(val)) {
                if (val < min) min = val;
                if (val > max) max = val;
            }
        }
    }

    return { min, max };
}

/**
 * Render a single dataset with specified mode
 */
function renderDataset(name, data, mode, config) {
    const width = 800;
    const height = 600;

    // Extract z data and optional x, y
    let z, x, y;
    if (data && data.z) {
        z = data.z;
        x = data.x || null;
        y = data.y || null;
    } else {
        z = data;
        x = null;
        y = null;
    }

    // Get data range for color scale
    const { min: minVal, max: maxVal } = getDataRange(z);

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Clear with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Build grid data
    const gridData = { z };
    if (x) gridData.x = x;
    if (y) gridData.y = y;

    // Compute contours
    const result = contourCore.computeContours(gridData, {
        autocontour: true,
        ncontours: config.ncontours,
        smoothing: config.smoothing,
        connectgaps: false
    });

    // Build color scale
    const colorScale = buildColorScale(minVal, maxVal, config.colorScheme);

    // Render options based on mode
    const options = {
        width,
        height,
        colorScale,
        smoothing: config.smoothing,
        padding: 60,
        showGrid: true,
        gridColor: '#e0e0e0',
        backgroundColor: '#ffffff',
        showColorbar: true,
        axes: {
            x: { title: config.xTitle, color: '#333' },
            y: { title: config.yTitle, color: '#333' }
        }
    };

    if (mode === 'fill') {
        options.coloring = 'fill';
        options.showLines = true;
        options.lineColor = 'rgba(255,255,255,0.5)';
        options.lineWidth = 1;
    } else {
        options.coloring = 'lines';
        options.showLines = true;
        options.lineColor = '#333333';
        options.lineWidth = 1.5;
    }

    // Render to canvas
    const canvasRenderer = contourCore.renderers.canvas;
    canvasRenderer.drawContours(ctx, result, options);

    return canvas;
}

/**
 * Main demo function
 */
async function runDemo() {
    console.log('=== MockData Canvas Export Demo ===\n');
    console.log('Loading mock data...\n');

    // Dynamic import for ES module
    const mockDataPath = path.resolve(__dirname, '../../data/mockData.mjs');
    const mockDataUrl = `file://${mockDataPath.replace(/\\/g, '/')}`;
    const mockDataModule = await import(mockDataUrl);
    const { data1, data2, data3, data4, data5, data6, data7 } = mockDataModule;

    const DATASETS = {
        data1,
        data2,
        data3,
        data4,
        data5,
        data6,
        data7
    };

    console.log('Rendering all 7 datasets with fill and lines modes...\n');

    const outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    const results = [];
    const datasetNames = Object.keys(DATASETS);

    for (const name of datasetNames) {
        const data = DATASETS[name];
        const config = DATASET_CONFIGS[name];

        console.log(`--- Processing ${name} ---`);

        // Get data info
        let z, x, y;
        if (data && data.z) {
            z = data.z;
            x = data.x;
            y = data.y;
        } else {
            z = data;
        }
        const rows = z.length;
        const cols = z[0] ? z[0].length : 0;
        const { min, max } = getDataRange(z);

        console.log(`  Size: ${rows} x ${cols}`);
        console.log(`  Range: [${min.toFixed(2)}, ${max.toFixed(2)}]`);
        if (x && y) {
            console.log(`  X: [${x[0].toFixed(4)}, ${x[x.length-1].toFixed(4)}]`);
            console.log(`  Y: [${y[0].toFixed(4)}, ${y[y.length-1].toFixed(4)}]`);
        }

        // Render fill mode
        const fillCanvas = renderDataset(name, data, 'fill', config);
        const fillPath = path.join(outputDir, `${name}-fill.png`);
        const fillBuffer = fillCanvas.toBuffer('image/png');
        fs.writeFileSync(fillPath, fillBuffer);
        console.log(`  Saved: ${name}-fill.png (${(fillBuffer.length / 1024).toFixed(1)} KB)`);

        // Render lines mode
        const linesCanvas = renderDataset(name, data, 'lines', config);
        const linesPath = path.join(outputDir, `${name}-lines.png`);
        const linesBuffer = linesCanvas.toBuffer('image/png');
        fs.writeFileSync(linesPath, linesBuffer);
        console.log(`  Saved: ${name}-lines.png (${(linesBuffer.length / 1024).toFixed(1)} KB)`);

        results.push({
            name,
            fillSize: fillBuffer.length,
            linesSize: linesBuffer.length
        });

        console.log('');
    }

    // Summary
    console.log('=== Summary ===\n');
    console.log('Output directory:', outputDir);
    console.log('\nFile sizes:');

    let totalSize = 0;
    for (const r of results) {
        console.log(`  ${r.name}-fill.png:  ${(r.fillSize / 1024).toFixed(1)} KB`);
        console.log(`  ${r.name}-lines.png: ${(r.linesSize / 1024).toFixed(1)} KB`);
        totalSize += r.fillSize + r.linesSize;
    }

    console.log(`\nTotal files: ${results.length * 2}`);
    console.log(`Total size: ${(totalSize / 1024).toFixed(1)} KB`);
    console.log('\nDone!');
}

runDemo();
