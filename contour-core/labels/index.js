'use strict';

/**
 * Labels module for contour rendering
 * Handles label positioning, formatting, cost calculation, and density control
 */

module.exports = {
    findBestTextLocation: require('./position'),
    formatContourLabel: require('./formatter'),
    locationCost: require('./cost'),
    // Density control module
    density: require('./density'),
    // Convenience exports from density module
    calculateMaxLabels: require('./density').calculateMaxLabels,
    pathLength: require('./density').pathLength,
    getVisibleSegment: require('./density').getVisibleSegment,
    isPathClosed: require('./density').isPathClosed
};
