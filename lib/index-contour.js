'use strict';

var Plotly = require('./core');

Plotly.register([
    require('./scatter'),
    require('./scattergl'),
    require('./contour'),
    require('./histogram2dcontour')
    // traces
    //
    //
    //
    //
    //
    // require('./histogram2dcontour'),
    // require('./contour'),
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    // require('./scattergl'),
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //

    // // components
    // require('./calendars'),
]);

module.exports = Plotly;
