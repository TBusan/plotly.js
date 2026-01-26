'use strict';

/**
 * Null value handling module
 * Provides utilities for normalizing and handling null/undefined/NaN values in contour data
 */

module.exports = {
    normalizeNullValues: require('./normalize'),
    generateNullMask: require('./mask'),
    isValidValue: require('./validate')
};
