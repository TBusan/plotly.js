'use strict';

/**
 * ZRender label utilities for contour labels
 * Optimized for proper positioning and readability
 */

var zrender = require('zrender');
var pathUtils = require('./paths');

/**
 * Create a label element with background for better readability
 * Improved positioning and styling
 */
function createLabel(labelData, style) {
    var x = labelData.x;
    var y = labelData.y;
    var text = labelData.text;
    var level = labelData.level;

    var fontSize = style.fontSize || 11;
    var fontWeight = style.fontWeight || 'bold';
    var textColor = style.labelColor || '#333';

    // Estimate text dimensions for proper background sizing
    var textWidth = text.length * fontSize * 0.6;
    var textHeight = fontSize * 1.2;

    var padding = style.labelPadding || 4;
    var bgWidth = textWidth + padding * 2;
    var bgHeight = textHeight + padding * 2;
    var cornerRadius = style.labelRadius || 3;

    var group = new zrender.Group();

    // Background rectangle for readability
    var bgColor = style.labelBgColor || 'rgba(255, 255, 255, 0.85)';
    var borderColor = style.labelBorderColor || '#999';
    var borderWidth = style.labelBorderWidth || 1;

    var bgRect = new zrender.Rect({
        shape: {
            x: x - bgWidth / 2,
            y: y - bgHeight / 2,
            width: bgWidth,
            height: bgHeight,
            r: cornerRadius
        },
        style: {
            fill: bgColor,
            stroke: borderColor,
            lineWidth: borderWidth
        }
    });
    group.add(bgRect);

    // Text element - centered on position
    var textEl = new zrender.Text({
        style: {
            text: text,
            x: x,
            y: y,
            textAlign: 'center',
            textVerticalAlign: 'middle',
            fill: textColor,
            fontSize: fontSize,
            fontWeight: fontWeight
        }
    });
    group.add(textEl);

    return group;
}

/**
 * Create all label elements
 * Improved with better positioning and layer management
 */
function createLabels(labels, style) {
    var elements = [];

    if (!labels || labels.length === 0) {
        return elements;
    }

    for (var i = 0; i < labels.length; i++) {
        var label = createLabel(labels[i], style);
        elements.push(label);
    }

    return elements;
}

module.exports = {
    createLabel: createLabel,
    createLabels: createLabels
};
