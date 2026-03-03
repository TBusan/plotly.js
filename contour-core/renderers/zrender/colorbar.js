'use strict';

/**
 * ZRender colorbar utilities
 */

var zrender = require('zrender');

/**
 * Create colorbar
 */
function createColorbar(result, colors, config, options) {
    config = config || {};
    options = options || {};

    var width = options.width || 600;
    var height = options.height || 500;

    var thickness = config.thickness || 20;
    var len = config.len || 0.8;
    var barHeight = height * len;
    var x = width - thickness - 20;
    var y = (height - barHeight) / 2;

    var colorbarGroup = new zrender.Group();

    // Draw gradient colorbar
    for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var colorIdx = Math.floor(t * (colors.length - 1));
        colorIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));

        var rect = new zrender.Rect({
            shape: {
                x: x,
                y: y + i,
                width: thickness,
                height: 1
            },
            style: {
                fill: colors[colorIdx]
            }
        });
        colorbarGroup.add(rect);
    }

    // Draw border
    var border = new zrender.Rect({
        shape: {
            x: x,
            y: y,
            width: thickness,
            height: barHeight
        },
        style: {
            fill: 'transparent',
            stroke: '#666',
            lineWidth: 1
        }
    });
    colorbarGroup.add(border);

    // Draw title
    if (config.title) {
        var title = new zrender.Text({
            style: {
                text: config.title,
                x: x + thickness / 2,
                y: y - 10,
                textAlign: 'center',
                textVerticalAlign: 'bottom',
                fill: '#000',
                fontSize: 12
            }
        });
        colorbarGroup.add(title);
    }

    // Draw tick labels
    var levels = result.levels;
    var tickCount = Math.min(5, levels.length);

    for (var j = 0; j < tickCount; j++) {
        var idx = Math.floor(j * (levels.length - 1) / (tickCount - 1));
        var level = levels[idx];
        var t = (level - levels[0]) / (levels[levels.length - 1] - levels[0]);
        var tickY = y + barHeight * (1 - t);

        var text = new zrender.Text({
            style: {
                text: level.toFixed(1),
                x: x + thickness + 5,
                y: tickY,
                textAlign: 'left',
                textVerticalAlign: 'middle',
                fill: '#666',
                fontSize: 10
            }
        });
        colorbarGroup.add(text);
    }

    return colorbarGroup;
}

module.exports = {
    createColorbar: createColorbar
};
