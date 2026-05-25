'use strict';

/**
 * Null value handling module
 * Provides utilities for normalizing and handling null/undefined/NaN values in contour data
 */

module.exports = {
    normalizeNullValues: require('./normalize'),
    generateNullMask: require('./mask'),
    isValidValue: require('./validate'),
    findEmpties: require('./find_empties'),
    interp2d: require('./interp2d'),
    generateClipPath: require('./clip_mask').generateClipPath,
    generateNullMaskPolygons: require('./clip_mask').generateNullMaskPolygons,
    makeBinaryMask: require('./clip_mask').makeBinaryMask
};
