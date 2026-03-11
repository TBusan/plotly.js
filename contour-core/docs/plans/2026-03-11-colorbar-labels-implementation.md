# Colorbar and Labels Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three issues in mockdata-demo.html: colorbar show/hide control, discrete color blocks, and non-closed contour labels.

**Architecture:** Modify Canvas renderer to properly handle showColorbar parameter, refactor colorbar module to support discrete blocks with configurable position, and optimize label positioning for non-closed paths.

**Tech Stack:** JavaScript, Canvas 2D API, Node.js

---

## Task 1: Fix Colorbar Show/Hide Control

**Files:**
- Modify: `contour-core/renderers/canvas/index.js:189,274`
- Test: `contour-core/demo/mockdata-demo.html`

**Step 1: Identify the issue**

The current code at line 189 checks `style.colorbar !== false`, but `mockdata-demo.html` passes `showColorbar` as a separate parameter. Need to check both.

**Step 2: Write the fix for static rendering**

Modify line 189 in `contour-core/renderers/canvas/index.js`:

```javascript
// BEFORE (line 189):
if (style.colorbar !== false && (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap')) {
    drawColorbar(ctx, contourResult, style);
}

// AFTER:
var showColorbar = style.showColorbar !== false &&
                   (style.colorbar === undefined || style.colorbar === true || style.colorbar.show !== false);
if (showColorbar && (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap')) {
    drawColorbar(ctx, contourResult, style);
}
```

**Step 3: Write the fix for interactive rendering**

Modify line 274 in `contour-core/renderers/canvas/index.js`:

```javascript
// BEFORE (line 274-276):
if (currentStyle.colorbar !== false &&
    (currentStyle.coloring === 'fill' || currentStyle.coloring === 'fill+lines' || currentStyle.coloring === 'heatmap')) {
    drawColorbar(ctx, contourResult, currentStyle);
}

// AFTER:
var showColorbarInteractive = currentStyle.showColorbar !== false &&
    (currentStyle.colorbar === undefined || currentStyle.colorbar === true || currentStyle.colorbar.show !== false);
if (showColorbarInteractive &&
    (currentStyle.coloring === 'fill' || currentStyle.coloring === 'fill+lines' || currentStyle.coloring === 'heatmap')) {
    drawColorbar(ctx, contourResult, currentStyle);
}
```

**Step 4: Test the fix**

1. Open `contour-core/demo/mockdata-demo.html` in browser
2. Uncheck "显示颜色标尺" checkbox
3. Verify colorbar disappears
4. Check "显示颜色标尺" checkbox
5. Verify colorbar reappears

**Step 5: Commit**

```bash
git add contour-core/renderers/canvas/index.js
git commit -m "fix: colorbar show/hide control now responds to showColorbar parameter"
```

---

## Task 2: Create Discrete Colorbar Module

**Files:**
- Create: `contour-core/colorbar/discrete.js`
- Modify: `contour-core/colorbar/index.js`

**Step 1: Create discrete colorbar computation module**

Create file `contour-core/colorbar/discrete.js`:

```javascript
'use strict';

/**
 * Discrete colorbar module
 * Handles discrete color block computation and rendering
 */

/**
 * Compute discrete colorbar data from color blocks
 * @param {Array} blocks - Array of [color, value] pairs
 * @param {Object} options - Options for computation
 * @param {number} options.tickInterval - Show label every N blocks (0 = all)
 * @returns {Object} Discrete colorbar data
 */
function computeDiscreteColorbar(blocks, options) {
    options = options || {};

    if (!blocks || blocks.length === 0) {
        return { blocks: [], min: 0, max: 1 };
    }

    var tickInterval = options.tickInterval || 0;

    var result = {
        blocks: [],
        min: blocks[0][1],
        max: blocks[blocks.length - 1][1]
    };

    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var showLabel = tickInterval === 0 ||
                        i === 0 ||
                        i === blocks.length - 1 ||
                        i % tickInterval === 0;

        result.blocks.push({
            color: block[0],
            value: block[1],
            index: i,
            showLabel: showLabel
        });
    }

    return result;
}

/**
 * Calculate colorbar dimensions based on position
 * @param {Object} options - Position and size options
 * @param {string} options.position - 'left' | 'right' | 'top' | 'bottom'
 * @param {number} options.thickness - Block thickness in pixels
 * @param {number} options.padding - Padding from plot area
 * @param {number} options.width - Canvas width
 * @param {number} options.height - Canvas height
 * @param {number} options.blockCount - Number of blocks
 * @returns {Object} Dimension data {x, y, thickness, length, isVertical}
 */
function calculateColorbarDimensions(options) {
    var position = options.position || 'right';
    var thickness = options.thickness || 25;
    var padding = options.padding || 10;
    var width = options.width;
    var height = options.height;
    var blockCount = options.blockCount || 10;

    var isVertical = position === 'left' || position === 'right';
    var x, y, length;

    if (isVertical) {
        length = height * 0.8;
        y = (height - length) / 2;

        if (position === 'right') {
            x = width - thickness - padding;
        } else {
            x = padding;
        }
    } else {
        length = width * 0.8;
        x = (width - length) / 2;

        if (position === 'bottom') {
            y = height - thickness - padding;
        } else {
            y = padding;
        }
    }

    return {
        x: x,
        y: y,
        thickness: thickness,
        length: length,
        isVertical: isVertical,
        blockThickness: isVertical ? length / blockCount : length / blockCount
    };
}

module.exports = {
    computeDiscreteColorbar: computeDiscreteColorbar,
    calculateColorbarDimensions: calculateColorbarDimensions
};
```

**Step 2: Update colorbar index to export discrete module**

Modify `contour-core/colorbar/index.js`:

```javascript
'use strict';

/**
 * Colorbar module for contour rendering
 * Handles colorbar computation, ticks, and color mapping
 */

var colors = require('./colors');
var discrete = require('./discrete');

module.exports = {
    computeColorbar: require('./compute'),
    computeTicks: require('./ticks'),
    mapColors: colors.mapColors,
    buildColorScale: colors.buildColorScale,
    COLOR_SCALES: colors.COLOR_SCALES,
    // Discrete colorbar
    computeDiscreteColorbar: discrete.computeDiscreteColorbar,
    calculateColorbarDimensions: discrete.calculateColorbarDimensions
};
```

**Step 3: Verify module loads correctly**

Run in Node.js:
```bash
cd contour-core && node -e "var cb = require('./colorbar'); console.log(typeof cb.computeDiscreteColorbar);"
```
Expected output: `function`

**Step 4: Commit**

```bash
git add contour-core/colorbar/discrete.js contour-core/colorbar/index.js
git commit -m "feat: add discrete colorbar computation module"
```

---

## Task 3: Implement Discrete Colorbar Canvas Rendering

**Files:**
- Modify: `contour-core/renderers/canvas/colorbar.js`

**Step 1: Add discrete rendering function**

Add the following to `contour-core/renderers/canvas/colorbar.js`:

```javascript
'use strict';

/**
 * Canvas colorbar drawing
 */

var mapColors = require('../../colorbar').mapColors;
var computeTicks = require('../../colorbar').computeTicks;
var computeDiscreteColorbar = require('../../colorbar').computeDiscreteColorbar;
var calculateColorbarDimensions = require('../../colorbar').calculateColorbarDimensions;

/**
 * Draw colorbar on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} contourResult - Contour result
 * @param {Object} style - Style options
 */
function drawColorbar(ctx, contourResult, style) {
    style = style || {};

    // Check if discrete mode is requested or colorScale provides blocks
    var colorbarConfig = style.colorbar || {};
    var blocks = colorbarConfig.blocks || style.colorScale;

    if (blocks && Array.isArray(blocks) && blocks.length > 0 && Array.isArray(blocks[0])) {
        // Use discrete colorbar rendering
        drawDiscreteColorbar(ctx, blocks, style);
    } else {
        // Use legacy gradient colorbar rendering
        drawGradientColorbar(ctx, contourResult, style);
    }
}

/**
 * Draw discrete colorbar (color blocks)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} blocks - Array of [color, value] pairs
 * @param {Object} style - Style options
 */
function drawDiscreteColorbar(ctx, blocks, style) {
    style = style || {};
    var colorbarConfig = style.colorbar || {};

    ctx.save();

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var position = colorbarConfig.position || 'right';
    var thickness = colorbarConfig.thickness || 25;
    var padding = colorbarConfig.padding || 10;
    var tickInterval = colorbarConfig.tickInterval || 0;
    var blockGap = colorbarConfig.blockGap || 1;

    // Calculate dimensions
    var dims = calculateColorbarDimensions({
        position: position,
        thickness: thickness,
        padding: padding,
        width: width,
        height: height,
        blockCount: blocks.length
    });

    // Compute discrete colorbar data
    var discreteData = computeDiscreteColorbar(blocks, {
        tickInterval: tickInterval
    });

    // Draw each block
    for (var i = 0; i < discreteData.blocks.length; i++) {
        var block = discreteData.blocks[i];
        var bx, by, bw, bh;

        if (dims.isVertical) {
            bx = dims.x;
            by = dims.y + i * dims.blockThickness;
            bw = dims.thickness;
            bh = dims.blockThickness - blockGap;

            // Clamp block height
            if (by + bh > dims.y + dims.length) {
                bh = dims.y + dims.length - by;
            }
        } else {
            bx = dims.x + i * dims.blockThickness;
            by = dims.y;
            bw = dims.blockThickness - blockGap;
            bh = dims.thickness;

            // Clamp block width
            if (bx + bw > dims.x + dims.length) {
                bw = dims.x + dims.length - bx;
            }
        }

        // Draw block
        ctx.fillStyle = block.color;
        ctx.fillRect(bx, by, bw, bh);
    }

    // Draw border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    if (dims.isVertical) {
        ctx.strokeRect(dims.x, dims.y, dims.thickness, dims.length);
    } else {
        ctx.strokeRect(dims.x, dims.y, dims.length, dims.thickness);
    }

    // Draw labels
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textBaseline = 'middle';

    for (var j = 0; j < discreteData.blocks.length; j++) {
        var block = discreteData.blocks[j];
        if (!block.showLabel) continue;

        var labelX, labelY;
        var label = formatValue(block.value);

        if (dims.isVertical) {
            labelX = dims.x + dims.thickness + 5;
            labelY = dims.y + j * dims.blockThickness + dims.blockThickness / 2;

            if (position === 'left') {
                ctx.textAlign = 'right';
                labelX = dims.x - 5;
            } else {
                ctx.textAlign = 'left';
            }
        } else {
            labelX = dims.x + j * dims.blockThickness + dims.blockThickness / 2;
            labelY = dims.y + dims.thickness + 12;

            if (position === 'top') {
                labelY = dims.y - 5;
            }
            ctx.textAlign = 'center';
        }

        ctx.fillText(label, labelX, labelY);
    }

    // Draw title if provided
    if (colorbarConfig.title) {
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';

        if (dims.isVertical) {
            ctx.save();
            ctx.translate(dims.x + dims.thickness / 2, dims.y - 15);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(colorbarConfig.title, 0, 0);
            ctx.restore();
        } else {
            ctx.fillText(colorbarConfig.title, dims.x + dims.length / 2, dims.y - 10);
        }
    }

    ctx.restore();
}

/**
 * Format value for display
 * @param {number} value - Value to format
 * @returns {string} Formatted value
 */
function formatValue(value) {
    if (Math.abs(value) < 0.01 || Math.abs(value) >= 1000) {
        return value.toExponential(1);
    }
    return value.toFixed(2);
}

/**
 * Draw gradient colorbar (legacy)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} contourResult - Contour result
 * @param {Object} style - Style options
 */
function drawGradientColorbar(ctx, contourResult, style) {
    style = style || {};

    var levels = contourResult.levels;
    if (!levels || levels.length === 0) return;

    ctx.save();

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;

    var thickness = style.colorbarThickness || 20;
    var len = style.colorbarLen || 0.8;
    var barHeight = height * len;
    var x = width - thickness - 10;
    var y = (height - barHeight) / 2;

    var colorscale = style.colorscale || 'Viridis';
    var zmin = style.zmin !== undefined ? style.zmin : levels[0];
    var zmax = style.zmax !== undefined ? style.zmax : levels[levels.length - 1];

    // Draw gradient
    for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var value = zmin + t * (zmax - zmin);
        var color = mapColors(value, zmin, zmax, colorscale, style.reversescale);

        ctx.fillStyle = color;
        ctx.fillRect(x, y + i, thickness, 1);
    }

    // Draw border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, thickness, barHeight);

    // Draw title
    if (style.colorbarTitle) {
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(x + thickness / 2, y - 10);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(style.colorbarTitle, 0, 0);
        ctx.restore();
    }

    // Draw tick labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    var tickCount = Math.min(5, levels.length);
    for (i = 0; i < tickCount; i++) {
        var idx = Math.floor(i * (levels.length - 1) / (tickCount - 1));
        var level = levels[idx];
        var t = (level - levels[0]) / (levels[levels.length - 1] - levels[0]);
        var tickY = y + barHeight * (1 - t);

        ctx.fillText(level.toFixed(1), x + thickness + 5, tickY);
    }

    ctx.restore();
}

module.exports = drawColorbar;
```

**Step 2: Test discrete rendering**

1. Open `contour-core/demo/mockdata-demo.html`
2. Set coloring mode to "填充模式"
3. Verify colorbar displays as discrete blocks

**Step 3: Commit**

```bash
git add contour-core/renderers/canvas/colorbar.js
git commit -m "feat: add discrete colorbar rendering support"
```

---

## Task 4: Update mockdata-demo.html to Use Discrete Colorbar

**Files:**
- Modify: `contour-core/demo/mockdata-demo.html`

**Step 1: Add colorbar configuration**

Find the options object in `renderContours()` function (around line 692) and add colorbar config:

```javascript
// BEFORE:
var options = {
    width: canvas.width,
    height: canvas.height,
    coloring: coloringMode,
    colorScale: mappedColors,
    // ... other options
    showColorbar: showColorbar,
    // ...
};

// AFTER:
var options = {
    width: canvas.width,
    height: canvas.height,
    coloring: coloringMode,
    colorScale: mappedColors,
    // ... other options
    showColorbar: showColorbar,
    colorbar: {
        blocks: colorScale,  // Use the parsed colorScale
        position: 'right',
        tickInterval: 2,
        thickness: 25,
        padding: 10
    },
    // ...
};
```

**Step 2: Test in browser**

1. Open `contour-core/demo/mockdata-demo.html`
2. Verify colorbar shows discrete blocks
3. Toggle showColorbar checkbox
4. Verify show/hide works

**Step 3: Commit**

```bash
git add contour-core/demo/mockdata-demo.html
git commit -m "feat: update mockdata-demo to use discrete colorbar"
```

---

## Task 5: Add Colorbar Position Control to Demo

**Files:**
- Modify: `contour-core/demo/mockdata-demo.html`

**Step 1: Add position selector in HTML**

Add after line 375 (after showColorbar checkbox):

```html
<div class="control-row">
    <label>标尺位置</label>
    <select id="colorbarPosition" onchange="updateRender()">
        <option value="right">右侧</option>
        <option value="left">左侧</option>
        <option value="bottom">下边</option>
        <option value="top">上边</option>
    </select>
</div>
<div class="control-row">
    <label>标注间隔</label>
    <input type="range" id="tickInterval" min="0" max="5" value="2" onchange="updateRender()">
    <span id="tickIntervalVal">2</span>
</div>
```

**Step 2: Update renderContours() to use new controls**

Add after line 655:

```javascript
var colorbarPosition = document.getElementById('colorbarPosition').value;
var tickInterval = parseInt(document.getElementById('tickInterval').value);
document.getElementById('tickIntervalVal').textContent = tickInterval;
```

Update colorbar config:

```javascript
colorbar: {
    blocks: colorScale,
    position: colorbarPosition,
    tickInterval: tickInterval,
    thickness: 25,
    padding: 10
},
```

**Step 3: Test all positions**

1. Test right position
2. Test left position
3. Test bottom position
4. Test top position
5. Test different tick intervals

**Step 4: Commit**

```bash
git add contour-core/demo/mockdata-demo.html
git commit -m "feat: add colorbar position and tick interval controls to demo"
```

---

## Task 6: Fix Non-Closed Contour Labels

**Files:**
- Modify: `contour-core/labels/position.js:159-176`

**Step 1: Identify the issue**

The current code at lines 166-176 requires `totalPathLen > textWidth * 2` for non-closed paths, which is too strict.

**Step 2: Update the search range calculation**

Replace lines 159-176 in `contour-core/labels/position.js`:

```javascript
// BEFORE:
// Calculate search range
var dp, p0, pMax;

if (isClosed) {
    // Closed path - can search anywhere along the path
    dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
    p0 = dp / 2;
    pMax = totalPathLen;
} else if (totalPathLen > textWidth * 2) {
    // Open path - keep text away from edges
    dp = (totalPathLen - textWidth * 2) / (COST_CONSTANTS.INITIALSEARCHPOINTS - 1);
    p0 = textWidth;
    pMax = totalPathLen - textWidth;
} else {
    // Very short path - search entire path
    dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
    p0 = dp / 2;
    pMax = totalPathLen;
}

// AFTER:
// Calculate search range with relaxed conditions for non-closed paths
var dp, p0, pMax;

if (isClosed) {
    // Closed path - can search anywhere along the path
    dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
    p0 = dp / 2;
    pMax = totalPathLen;
} else if (totalPathLen > textWidth * 1.2) {
    // Non-closed path (longer): allow label closer to edges
    dp = (totalPathLen - textWidth) / (COST_CONSTANTS.INITIALSEARCHPOINTS - 1);
    p0 = textWidth / 2;
    pMax = totalPathLen - textWidth / 2;
} else if (totalPathLen > textWidth * 0.5) {
    // Non-closed path (shorter): place label in middle of path
    dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
    p0 = totalPathLen / 4;
    pMax = totalPathLen * 3 / 4;
} else {
    // Very short path - no label
    return null;
}
```

**Step 3: Test with non-closed contours**

1. Open `contour-core/demo/mockdata-demo.html`
2. Enable "显示等值线标注"
3. Use a dataset with edge contours (non-closed paths)
4. Verify labels appear on non-closed contours

**Step 4: Commit**

```bash
git add contour-core/labels/position.js
git commit -m "fix: allow labels on non-closed contour paths with relaxed conditions"
```

---

## Task 7: Final Testing and Documentation

**Files:**
- Test: All demo files
- Modify: `contour-core/docs/plans/2026-03-11-colorbar-labels-design.md`

**Step 1: Run comprehensive tests**

1. Open `contour-core/demo/mockdata-demo.html`
2. Test all datasets (data1-data8)
3. Test all coloring modes
4. Test colorbar show/hide
5. Test all colorbar positions
6. Test tick intervals
7. Test labels on various contour types

**Step 2: Update design document with implementation notes**

Add to the end of `contour-core/docs/plans/2026-03-11-colorbar-labels-design.md`:

```markdown
---

## Implementation Notes

### Completed Tasks

1. **Colorbar Show/Hide Control** - Fixed in `renderers/canvas/index.js`
2. **Discrete Colorbar Module** - Created `colorbar/discrete.js`
3. **Discrete Colorbar Rendering** - Updated `renderers/canvas/colorbar.js`
4. **Demo Controls** - Added position and tick interval controls
5. **Non-Closed Contour Labels** - Fixed in `labels/position.js`

### API Usage

```javascript
var options = {
    showColorbar: true,
    colorbar: {
        blocks: [
            ['#440154', 0],
            ['#482878', 0.11],
            // ...
        ],
        position: 'right',  // 'left' | 'right' | 'top' | 'bottom'
        tickInterval: 2,    // Show label every N blocks
        thickness: 25,
        padding: 10,
        title: 'Value'
    }
};
```
```

**Step 3: Final commit**

```bash
git add contour-core/docs/plans/2026-03-11-colorbar-labels-design.md
git commit -m "docs: update design document with implementation notes"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Fix colorbar show/hide | `renderers/canvas/index.js` |
| 2 | Create discrete module | `colorbar/discrete.js`, `colorbar/index.js` |
| 3 | Implement discrete rendering | `renderers/canvas/colorbar.js` |
| 4 | Update demo | `demo/mockdata-demo.html` |
| 5 | Add position controls | `demo/mockdata-demo.html` |
| 6 | Fix non-closed labels | `labels/position.js` |
| 7 | Final testing | All files |
