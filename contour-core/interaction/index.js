'use strict';

/**
 * Interaction module
 * Provides zoom/pan interaction support for contour rendering
 */

var viewState = require('./view_state');
var interactionManager = require('./interaction_manager');

module.exports = {
    createViewManager: viewState.createViewManager,
    createInteractionManager: interactionManager.createInteractionManager
};
