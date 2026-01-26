'use strict';

/**
 * Browser bundle for contour-core
 * This file makes the module work in both browser and Node.js
 */

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = {
        computeContours: require('./compute').computeContours,
        scalePathsToData: require('./compute').scalePathsToData,
        canvas: require('./canvas'),
        smooth: require('./smooth'),
        constants: require('./constants')
    };
} else {
    // Browser - create global object
    this.ContourCore = {
        computeContours: null,  // Will be set by bundler
        canvas: null
    };
}
