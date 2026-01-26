#!/usr/bin/env node

/**
 * Package contour-core as a standalone UMD module
 * 将 contour-core 打包成通用的 UMD 格式
 */

import fs from 'fs';
import path from 'path';

console.log('=== Packaging contour-core Standalone Module ===\n');

// 读取所有 contour-core 源文件
const contourDir = 'src/contour-core';

// 读取源文件
const constants = fs.readFileSync(path.join(contourDir, 'constants.js'), 'utf8');
const levelsCode = fs.readFileSync(path.join(contourDir, 'levels.js'), 'utf8');
const marchingSquares = fs.readFileSync(path.join(contourDir, 'marchingsquares.js'), 'utf8');
const pathFinding = fs.readFileSync(path.join(contourDir, 'pathfinding.js'), 'utf8');
const compute = fs.readFileSync(path.join(contourDir, 'compute.js'), 'utf8');

/**
 * 清理代码：移除不需要的行
 */
function cleanCode(code) {
    let lines = code.split('\n');
    let result = [];
    let skipExports = false;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 跳过 shebang, use strict
        if (line.startsWith('#!')) continue;
        if (line === "'use strict';") continue;
        if (line.includes('require(')) continue;

        // 检测 module.exports 的开始
        if (line.includes('module.exports')) {
            // 如果这一行包含 {，开始计数
            if (line.includes('{')) {
                braceCount += (line.match(/\{/g) || []).length;
                braceCount -= (line.match(/\}/g) || []).length;
                // 如果 { 和 } 在同一行，不需要跳过
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

            // 如果到了结束的 }
            if (braceCount === 0 && line.includes('}')) {
                skipExports = false;
                continue;
            }
            // 继续跳过
            continue;
        }

        result.push(line);
    }

    return result.join('\n').trim();
}

/**
 * 提取常量对象内容
 */
function getConstants(code) {
    return cleanCode(code)
        .replace(/^'use strict';\n/, '')
        .replace(/module\.exports = \{/, '')
        .replace(/\};?\s*$/, '')
        .trim();
}

// 手动构建完整的 UMD 模块
const umdCode = `
/**
 * contour-core - Standalone Contour Calculation Library
 * Version: 1.0.0
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
    // CONSTANTS
    // ============================================
    var constants = {
        // Edge start indicators for marching squares
        BOTTOMSTART: [1, 9, 13, 104, 713],
        TOPSTART: [4, 6, 7, 104, 713],
        LEFTSTART: [8, 12, 14, 208, 1114],
        RIGHTSTART: [2, 3, 11, 208, 1114],

        // Which way [dx,dy] do we leave a given index?
        NEWDELTA: [
            null, [-1, 0], [0, -1], [-1, 0],
            [1, 0], null, [0, -1], [-1, 0],
            [0, 1], [0, 1], null, [0, 1],
            [1, 0], [1, 0], [0, -1]
        ],

        // For each saddle, the first index here is used
        CHOOSESADDLE: {
            104: [4, 1],
            208: [2, 8],
            713: [7, 13],
            1114: [11, 14]
        },

        // After one index has been used for a saddle, which do we substitute?
        SADDLEREMAINDER: {1: 4, 2: 8, 4: 1, 7: 13, 8: 2, 11: 14, 13: 7, 14: 11},

        // Label constants
        LABELDISTANCE: 2,
        LABELINCREASE: 10,
        LABELMIN: 3,
        LABELMAX: 10,
        LABELOPTIMIZER: {
            EDGECOST: 1,
            ANGLECOST: 1,
            NEIGHBORCOST: 5,
            SAMELEVELFACTOR: 10,
            SAMELEVELDISTANCE: 5,
            MAXCOST: 100,
            INITIALSEARCHPOINTS: 10,
            ITERATIONS: 5
        }
    };

    // ============================================
    // LEVELS
    // ============================================
${cleanCode(levelsCode)}

    // Create levels module object
    var levels = {
        setContours: setContours,
        endPlus: endPlus
    };

    // ============================================
    // MARCHING SQUARES
    // ============================================
${cleanCode(marchingSquares)}

    // Create marchingSquares module object
    var marchingSquares = {
        makeCrossings: makeCrossings,
        getMarchingIndex: getMarchingIndex
    };

    // ============================================
    // PATHFINDING
    // ============================================
${cleanCode(pathFinding)}

    // Create pathFinding module object
    var pathFinding = {
        findAllPaths: findAllPaths,
        getInterpPx: getInterpPx
    };

    // ============================================
    // COMPUTE
    // ============================================
${cleanCode(compute)}

    // ============================================
    // PUBLIC API
    // ============================================
    return {
        version: '1.0.0',
        computeContours: computeContours,
        getVersion: function() { return '1.0.0'; },
        getInfo: function() {
            return {
                name: 'contour-core',
                version: '1.0.0',
                description: 'Standalone contour calculation library',
                license: 'MIT'
            };
        }
    };
}));
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

console.log('\n✅ 打包完成！');
console.log('\n测试方法:');
console.log('  浏览器: <script src="dist/contour-core.umd.js"></script>');
console.log('  Node.js: node test_umd_simple.js');
console.log('  测试页面: 打开 standalone_test.html');
