'use strict';

/**
 * Interaction layer for contour-core
 * Provides zoom, pan, hover, and other interactive features
 */

module.exports = {
    EventManager: require('./EventManager'),
    StateManager: require('./StateManager'),
    CoordinateConverter: require('./CoordinateConverter'),
    ZoomHandler: require('./handlers/Zoom'),
    PanHandler: require('./handlers/Pan'),
    HoverHandler: require('./handlers/Hover'),
    D3ZoomHandler: require('./handlers/D3Zoom').D3ZoomHandler,
    isD3Available: require('./handlers/D3Zoom').isAvailable,
    createInteraction: require('./createInteraction')
};
