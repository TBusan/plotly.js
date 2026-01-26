'use strict';

var Plotly = require('./core');

Plotly.register([
    require('./scatter'),
    require('./histogram2dcontour')
    // traces
    // require('./bar'),
    //
    //
    // require('./histogram'),
    //
    //
    //
    //
    //
    // require('./funnel'),
    // require('./waterfall'),
    //
    // require('./pie'),
    //
    //
    //
    // require('./funnelarea'),
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
    // require('./indicator'),
    //
    //
    //
    //
    // require('./ohlc'),
    // require('./candlestick'),
    //
    //
    //
    //

    // // components
    // require('./calendars'),
]);

module.exports = Plotly;
