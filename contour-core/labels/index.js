'use strict';

/**
 * Labels module for contour rendering
 * Handles label positioning, formatting, and cost calculation
 */

module.exports = {
    findBestTextLocation: require('./position'),
    formatContourLabel: require('./formatter'),
    locationCost: require('./cost')
};
