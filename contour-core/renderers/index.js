'use strict';

/**
 * Renderers module for contour visualization
 * Provides Canvas, SVG, and ZRender rendering capabilities
 */

module.exports = {
    canvas: require('./canvas'),
    svg: require('./svg'),
    zrender: require('./zrender')
};
