#!/usr/bin/env node

'use strict';

/**
 * Build script for browser bundle
 * Creates a browser-ready version of contour-core
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('  Building contour-core for Browser');
console.log('========================================\n');

// Browser bundle template
const browserBundleTemplate = `/**
 * contour-core - Browser Bundle
 * Standalone contour calculation library
 * Version: 0.3.0
 *
 * Auto-generated from modules - Do not edit directly
 */

(function(global) {
    'use strict';

    // Module exports cache
    const modules = {};
    const cache = {};

    // Require function for browser
    function require(moduleId) {
        if (cache[moduleId]) {
            return cache[moduleId];
        }

        const module = modules[moduleId];
        if (!module) {
            throw new Error('Cannot find module "' + moduleId + '"');
        }

        cache[moduleId] = module.exports;

        // Execute the module
        const factory = module.factory;
        if (typeof factory === 'function') {
            factory(require, module.exports, module);
        }

        return cache[moduleId];
    }

    // Module definitions
PLACEHOLDER_MODULE_DEFS

    // Expose to global
    if (typeof window !== 'undefined') {
        window.contourCore = require('index');
    }

    // Export for ES6 modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = window.contourCore;
    }
})(typeof window !== 'undefined' ? window : global);
`;

// Read all module files and build definitions
const srcDir = path.join(__dirname, '..');
const moduleFiles = [
    'constants.js',
    'levels.js',
    'marchingsquares.js',
    'pathfinding.js',
    'smooth.js',
    'close_boundaries.js',
    'null_handling/index.js',
    'labels/index.js',
    'labels/position.js',
    'labels/cost.js',
    'labels/formatter.js',
    'colorbar/colors.js',
    'colorbar/ticks.js',
    'colorbar/compute.js',
    'renderers/canvas/paths.js',
    'renderers/canvas/heatmap.js',
    'renderers/canvas/labels.js',
    'renderers/canvas/colorbar.js',
    'renderers/canvas/nulls.js',
    'renderers/canvas/index.js',
    'renderers/svg/index.js',
    'renderers/index.js',
    'compute.js',
    'api.js',
    'index.js'
];

function getModuleContent(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function buildModuleDefinitions() {
    let moduleDefs = '';

    moduleFiles.forEach(file => {
        const filePath = path.join(srcDir, file);
        const moduleName = file.replace(/\.js$/, '').replace(/\//g, '/');
        const moduleId = moduleName;

        console.log('Processing:', file);

        let content = getModuleContent(filePath);

        // Remove require statements and convert to module.exports
        content = content
            .replace(/require\(['"]([^'"]+)['"]\)/g, 'require("$1")')
            .replace(/module\.exports\s*=/, 'exports = ');

        // Wrap in factory function
        const moduleDef = `
    modules['${moduleId}'] = {
        factory: function(require, exports, module) {
            ${content}
        },
        exports: {}
    };
`;

        moduleDefs += moduleDef;
    });

    return moduleDefs;
}

// Build browser bundle
console.log('Building module definitions...\n');
const moduleDefs = buildModuleDefinitions();

const browserBundle = browserBundleTemplate.replace('PLACEHOLDER_MODULE_DEFS', moduleDefs);

// Write browser bundle
const outputDir = path.join(srcDir, 'dist');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const bundlePath = path.join(outputDir, 'contour-core.browser.js');
fs.writeFileSync(bundlePath, browserBundle, 'utf8');

console.log('\n✅ Browser bundle created successfully!');
console.log('Output: ' + bundlePath);
console.log('\nSize: ' + (fs.statSync(bundlePath).size / 1024).toFixed(2) + ' KB');
console.log('\n========================================');
console.log('  Build Complete!');
console.log('========================================\n');

// Create README for dist
const distReadme = `
# contour-core Browser Bundle

## Usage

### In HTML (ES6 Modules)

\`\`\`html
<script type="module">
  import contourCore from './contour-core.browser.js';

  // Use contourCore...
</script>
\`\`\`

### In HTML (Script Tag)

\`\`\`html
<script src="./contour-core.browser.js"></script>
<script>
  // contourCore is available globally
  const result = contourCore.computeContours(grid, options);
</script>
\`\`\`

## Files

- \`contour-core.browser.js\` - Browser bundle (this file)
- Includes all dependencies (no external deps needed)

## Example

See \`../demo.html\` for usage examples.
`;

fs.writeFileSync(path.join(outputDir, 'README.md'), distReadme, 'utf8');

console.log('========================================');
console.log('  Distribution Summary');
console.log('========================================\n');
console.log('Bundle: ' + bundlePath);
console.log('\nAvailable commands:');
console.log('  npm run build     - Build browser bundle');
console.log('  npm run demo      - Start demo server');
console.log('  npm run demo:open - Open demo in browser\n');

console.log('Demo will be available at: http://localhost:8080/demo.html');
console.log('');
console.log('========================================');
