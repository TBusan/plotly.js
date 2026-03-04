'use strict';

/**
 * Renderers module for contour visualization
 * Provides Canvas, SVG, ZRender, and Three.js rendering capabilities
 */

module.exports = {
    canvas: require('./canvas'),
    svg: require('./svg'),
    zrender: require('./zrender'),
    three: require('./three')
};
