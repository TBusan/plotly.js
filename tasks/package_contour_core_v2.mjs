#!/usr/bin/env node

/**
 * Package contour-core v0.2.0 as a standalone UMD module
 * 支持 null_handling 和 简化渲染 API
 */

import fs from 'fs';
import path from 'path';

console.log('=== Packaging contour-core v0.2.0 ===\n');

const contourDir = 'contour-core';

/**
 * 清理代码：移除不需要的行，处理 require 语句
 */
function cleanCode(code, filename) {
    let lines = code.split('\n');
    let result = [];
    let skipExports = false;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 跳过 shebang, use strict
        if (line.startsWith('#!')) continue;
        if (line === "'use strict';") continue;

        // 处理 require 语句 - 替换为实际引用
        if (line.includes('require(')) {
            // api.js 的特殊处理
            if (filename === 'api.js') {
                if (line.includes("require('./compute')")) {
                    result.push('var compute = { computeContours: computeContours, scalePathsToData: scalePathsToData };');
                    continue;
                }
                if (line.includes("require('./canvas')")) {
                    result.push('var canvasRenderer = { drawContours: drawContours };');
                    continue;
                }
            }
            // canvas.js 的特殊处理
            if (filename === 'canvas.js') {
                if (line.includes("require('./smooth')")) {
                    result.push('var smooth = { smoothclosed: smoothclosed, smoothopen: smoothopen };');
                    continue;
                }
            }
            // compute.js 的特殊处理
            if (filename === 'compute.js') {
                if (line.includes("require('./levels')")) {
                    result.push('var levels = { setContours: setContours };');
                    continue;
                }
                if (line.includes("require('./marchingsquares')")) {
                    result.push('var marchingSquares = { makeCrossings: makeCrossings };');
                    continue;
                }
                if (line.includes("require('./pathfinding')")) {
                    result.push('var pathFinding = { findAllPaths: findAllPaths };');
                    continue;
                }
                if (line.includes("require('./null_handling')")) {
                    result.push('var nullHandling = { isValidValue: isValidValue, normalizeNullValues: normalizeNullValues, generateNullMask: generateNullMask };');
                    continue;
                }
                if (line.includes("require('./close_boundaries')")) {
                    // close_boundaries exports a function directly, not an object
                    // Just use the function name directly
                    result.push('');
                    continue;
                }
            }
            // pathfinding.js 的特殊处理
            if (filename === 'pathfinding.js') {
                // constants 已经作为全局变量存在，直接跳过 require 语句
                if (line.includes("require('./constants')")) {
                    continue;
                }
            }
            // 其他 require 语句全部跳过
            continue;
        }

        // 检测 module.exports 的开始
        if (line.includes('module.exports')) {
            if (line.includes('{')) {
                braceCount += (line.match(/\{/g) || []).length;
                braceCount -= (line.match(/\}/g) || []).length;
                if (braceCount === 0 && line.includes('}')) {
                    continue;
                }
            }
            skipExports = true;
            continue;
        }

        // 跳过 module.exports 对象字面量的内容
        if (skipExports) {
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;

            if (braceCount === 0 && line.includes('}')) {
                skipExports = false;
                continue;
            }
            continue;
        }

        result.push(line);
    }

    return result.join('\n').trim();
}

// 读取并清理所有源文件
function loadAndClean(filename) {
    return cleanCode(fs.readFileSync(path.join(contourDir, filename), 'utf8'), filename);
}

function loadAndCleanSub(subdir, filename) {
    return cleanCode(fs.readFileSync(path.join(contourDir, subdir, filename), 'utf8'), filename);
}

// 加载所有模块
// Constants需要特殊处理 - 直接读取文件内容并处理
const cleanedConstants = (function() {
    const code = fs.readFileSync(path.join(contourDir, 'constants.js'), 'utf8');
    const lines = code.split('\n');
    const result = [];
    let inExports = false;
    let inMultilineComment = false;
    let braceCount = 0;
    let firstBrace = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 跳过 shebang, use strict
        if (line.startsWith('#!')) continue;
        if (line === "'use strict';") continue;

        // 处理多行注释
        if (line.includes('/*')) {
            inMultilineComment = true;
        }
        if (inMultilineComment) {
            if (line.includes('*/')) {
                inMultilineComment = false;
            }
            continue;
        }

        const trimmed = line.trim();

        // 跳过单行注释
        if (trimmed.startsWith('//')) continue;

        // 检测 module.exports 的开始
        if (line.includes('module.exports')) {
            if (line.includes('{')) {
                braceCount += (line.match(/\{/g) || []).length;
                braceCount -= (line.match(/\}/g) || []).length;
                firstBrace = true;
                inExports = true;
                continue;
            }
        }

        // 处理 module.exports 对象字面量内容
        if (inExports) {
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;

            // 保留非注释、非空行的内容（但跳过结尾的 };）
            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
                if (!(braceCount === 0 && trimmed === '};')) {
                    result.push(line);  // 保留原始行（包括缩进）
                }
            }

            if (braceCount === 0 && firstBrace) {
                inExports = false;
            }
            continue;
        }

        result.push(line);
    }

    return 'var constants = {\n' + result.join('\n') + '\n};';
})();
const cleanedLevels = loadAndClean('levels.js');
const cleanedSmooth = loadAndClean('smooth.js');
const cleanedMarchingSquares = loadAndClean('marchingsquares.js');
const cleanedPathfinding = loadAndClean('pathfinding.js');
const cleanedCloseBoundaries = loadAndClean('close_boundaries.js');
const cleanedCanvas = loadAndClean('canvas.js');
const cleanedCompute = loadAndClean('compute.js');
const cleanedValidate = loadAndCleanSub('null_handling', 'validate.js');
const cleanedNormalize = loadAndCleanSub('null_handling', 'normalize.js');
const cleanedMask = loadAndCleanSub('null_handling', 'mask.js');
const cleanedApi = loadAndClean('api.js');

// 使用字符串拼接构建 UMD 模块
const umdCode =
`/**
 * contour-core v0.2.0 - Standalone Contour Calculation Library
 * Features: Null value support + Simplified rendering API
 * License: MIT
 *
 * Extracted from Plotly.js for SSR and performance optimization
 */

(function (root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ContourCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ============================================
    // NULL HANDLING MODULE
    // ============================================

    ` + cleanedValidate + `

    ` + cleanedNormalize + `

    ` + cleanedMask + `

    var nullHandling = {
        isValidValue: isValidValue,
        normalizeNullValues: normalizeNullValues,
        generateNullMask: generateNullMask
    };

    // ============================================
    // CONSTANTS
    // ============================================
    ` + cleanedConstants + `

    // ============================================
    // LEVELS
    // ============================================
    ` + cleanedLevels + `

    // ============================================
    // SMOOTH
    // ============================================
    ` + cleanedSmooth + `

    // ============================================
    // MARCHING SQUARES
    // ============================================
    ` + cleanedMarchingSquares + `

    // ============================================
    // PATHFINDING
    // ============================================
    ` + cleanedPathfinding + `

    // ============================================
    // CANVAS RENDERER
    // ============================================
    ` + cleanedCanvas + `

    // ============================================
    // CLOSE BOUNDARIES
    // ============================================
    ` + cleanedCloseBoundaries + `

    // ============================================
    // COMPUTE (with null handling)
    // ============================================
    ` + cleanedCompute + `

    // ============================================
    // SIMPLIFIED RENDERING API
    // ============================================
    ` + cleanedApi + `

    // ============================================
    // PUBLIC API
    // ============================================
    return {
        version: '0.2.0',

        // Core computation
        computeContours: computeContours,
        scalePathsToData: scalePathsToData,

        // Simplified rendering API (NEW in v0.2.0)
        render: render,
        drawTo: drawTo,

        // Null handling (NEW in v0.2.0)
        nullHandling: nullHandling,

        // Color scales
        COLOR_SCALES: COLOR_SCALES
    };
}));

console.log('ContourCore v0.2.0 loaded');
`;

// 写入文件
const distDir = 'dist';
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const outputPath = path.join(distDir, 'contour-core.umd.js');
fs.writeFileSync(outputPath, umdCode);

const fileSize = (umdCode.length / 1024).toFixed(2);
console.log('✓ Built: dist/contour-core.umd.js (' + fileSize + ' KB)');

// 创建压缩版本
const minified = umdCode
    .replace(/\/\*[\s\S]*?\*\//g, '') // 移除块注释
    .replace(/\/\/.*/g, '')            // 移除行注释
    .replace(/\s+/g, ' ')              // 压缩空白
    .trim();

const minPath = path.join(distDir, 'contour-core.umd.min.js');
fs.writeFileSync(minPath, minified);

const minSize = (minified.length / 1024).toFixed(2);
console.log('✓ Built: dist/contour-core.umd.min.js (' + minSize + ' KB)');

console.log('\n✅ contour-core v0.2.0 打包完成！');
console.log('\n使用方法:');
console.log('  浏览器: <script src="dist/contour-core.umd.js"></script>');
console.log('  Node.js: const ContourCore = require("./dist/contour-core.umd.js")');
console.log('\n新功能 (v0.2.0):');
console.log('  • Null 值自动处理');
console.log('  • 简化渲染 API: ContourCore.render(canvas, config)');
console.log('  • 预设配色方案: Viridis, Plasma, Hot, 等');
console.log('\n测试页面: demo_v0.2.0.html');
