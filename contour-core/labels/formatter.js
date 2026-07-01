'use strict';

/**
 * Format contour label text
 */

/**
 * Format a value as a contour label
 * @param {number} value - The value to format
 * @param {string} format - Format string (e.g., '.2f', '+.1f')
 * @returns {string} Formatted label text
 */
function formatContourLabel(value, format) {
    // Guard against undefined, null, and empty-string format specs.
    // Previously only `undefined` was handled, so a `null` format would
    // reach `format.includes(...)` below and throw TypeError.
    if (format === undefined || format === null || format === '') {
        return String(value);
    }

    // Handle format strings like '.2f', '+.1f', '.0f'
    if (format.includes('f')) {
        // Extract precision
        const match = format.match(/\.(\d+)f/);
        if (match) {
            const precision = parseInt(match[1]);
            let formatted = value.toFixed(precision);

            // Handle sign
            if (format.startsWith('+') && value >= 0) {
                formatted = '+' + formatted;
            }

            return formatted;
        }
    }

    // Handle percentage
    if (format.includes('%')) {
        const match = format.match(/\.(\d+)%/);
        if (match) {
            const precision = parseInt(match[1]);
            return (value * 100).toFixed(precision) + '%';
        }
    }

    return String(value);
}

module.exports = formatContourLabel;
