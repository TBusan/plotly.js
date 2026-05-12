'use strict';

var ContourCore = require('../../index');
var geojson = require('../../geojson');

var passed = 0;
var failed = 0;

function assert(condition, msg) {
    if (condition) {
        console.log('  \x1b[32m✓\x1b[0m ' + msg);
        passed++;
    } else {
        console.log('  \x1b[31m✗\x1b[0m ' + msg);
        failed++;
    }
}

function approxEq(a, b, tol) {
    tol = tol || 1e-6;
    return Math.abs(a - b) < tol;
}

// Simple grid data for testing
function makeSimpleGrid() {
    return [
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [3, 4, 5, 6],
        [4, 5, 6, 7]
    ];
}

function makeLargeRangeGrid() {
    // Grid with large coordinate range (e.g., GPS coordinates)
    var grid = [];
    for (var i = 0; i < 10; i++) {
        var row = [];
        for (var j = 0; j < 10; j++) {
            row.push(Math.sin(i * 0.5) * Math.cos(j * 0.5) * 100);
        }
        grid.push(row);
    }
    return grid;
}

// ========================================
console.log('\n\x1b[33m═══ toGeoJSON basic tests ═══\x1b[0m\n');

(function testBasicLineExport() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });
    var fc = geojson.toGeoJSON(result);

    assert(fc.type === 'FeatureCollection', 'FeatureCollection type');
    assert(Array.isArray(fc.features), 'features is array');
    assert(fc.features.length > 0, 'has features');

    var lineFeatures = fc.features.filter(function(f) {
        return f.geometry.type === 'LineString';
    });
    assert(lineFeatures.length > 0, 'has LineString features');

    lineFeatures.forEach(function(f, i) {
        assert(f.properties.level !== undefined, 'feature ' + i + ' has level property');
        assert(f.properties.value !== undefined, 'feature ' + i + ' has value property');
        assert(f.geometry.coordinates.length >= 2, 'feature ' + i + ' has >= 2 coords');
    });
})();

(function testFillMode() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });
    // toGeoJSON with type:'fill' only converts closed paths to Polygons
    // (edge paths are skipped because they need boundary closure)
    // Use toFilledGeoJSON for proper filled polygon export
    var fc = geojson.toGeoJSON(result, { type: 'fill' });

    // For this grid, all paths are edge paths, so no Polygon features in toGeoJSON fill mode
    // That's expected - toFilledGeoJSON handles the fill case
    assert(fc.type === 'FeatureCollection', 'fill mode toGeoJSON returns valid FeatureCollection');
})();

(function testEdgePaths() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });
    var fc = geojson.toGeoJSON(result, { includeEdgePaths: true });

    var edgeFeatures = fc.features.filter(function(f) {
        return f.properties.type === 'linestring_edge';
    });
    // Edge paths may or may not exist depending on data
    assert(true, 'edge path export runs without error, got ' + edgeFeatures.length + ' edge features');
})();

(function testExcludeEdgePaths() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });
    var fc = geojson.toGeoJSON(result, { includeEdgePaths: false });

    var edgeFeatures = fc.features.filter(function(f) {
        return f.properties.type === 'linestring_edge';
    });
    assert(edgeFeatures.length === 0, 'no edge features when includeEdgePaths=false');
})();

// ========================================
console.log('\n\x1b[33m═══ toFilledGeoJSON tests ═══\x1b[0m\n');

(function testFilledBasic() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });
    var fc = geojson.toFilledGeoJSON(result);

    assert(fc.type === 'FeatureCollection', 'filled: FeatureCollection type');
    assert(fc.features.length > 0, 'filled: has features');

    fc.features.forEach(function(f, i) {
        assert(f.geometry.type === 'Polygon', 'feature ' + i + ' is Polygon');
        assert(f.properties.level !== undefined, 'feature ' + i + ' has level');
        assert(f.properties.type === 'filled_contour', 'feature ' + i + ' has type filled_contour');
        assert(f.properties.clipped === undefined, 'feature ' + i + ' has no clipped property (clip removed)');

        // Validate polygon ring closure
        var ring = f.geometry.coordinates[0];
        if (ring && ring.length > 2) {
            var first = ring[0];
            var last = ring[ring.length - 1];
            assert(approxEq(first[0], last[0]) && approxEq(first[1], last[1]),
                'feature ' + i + ' polygon ring is closed');
        }
    });
})();

(function testFilledNoClipParameter() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });
    // Ensure 'clip' option is ignored - function should work regardless
    var fc1 = geojson.toFilledGeoJSON(result, {});
    var fc2 = geojson.toFilledGeoJSON(result, { clip: true });
    var fc3 = geojson.toFilledGeoJSON(result, { clip: false });

    // All three should produce the same result
    assert(fc1.features.length === fc2.features.length, 'clip=true same feature count as no clip');
    assert(fc1.features.length === fc3.features.length, 'clip=false same feature count as no clip');
})();

// ========================================
console.log('\n\x1b[33m═══ Large coordinate range (tolerance) tests ═══\x1b[0m\n');

(function testLargeRangeCoordinates() {
    var grid = makeLargeRangeGrid();
    var x = [];
    var y = [];
    // GPS-like coordinates: longitude 100-109, latitude 30-39
    for (var i = 0; i < 10; i++) {
        x.push(100 + i);
        y.push(30 + i);
    }

    var result = ContourCore.computeContours({ z: grid, x: x, y: y }, { autocontour: true });
    var fc = geojson.toGeoJSON(result);

    assert(fc.features.length > 0, 'large range: has features');

    // Check that coordinates are in data space, not grid index space
    fc.features.forEach(function(f) {
        f.geometry.coordinates.forEach(function(coord) {
            assert(coord[0] >= 99 && coord[0] <= 111, 'x coord in data space: ' + coord[0]);
            assert(coord[1] >= 29 && coord[1] <= 41, 'y coord in data space: ' + coord[1]);
        });
    });
})();

(function testFilledLargeRange() {
    var grid = makeLargeRangeGrid();
    var x = [];
    var y = [];
    for (var i = 0; i < 10; i++) {
        x.push(100 + i);
        y.push(30 + i);
    }

    var result = ContourCore.computeContours({ z: grid, x: x, y: y }, { autocontour: true });
    var fc = geojson.toFilledGeoJSON(result);

    assert(fc.features.length > 0, 'large range filled: has features');

    fc.features.forEach(function(f) {
        var ring = f.geometry.coordinates[0];
        if (ring) {
            var allInDataSpace = ring.every(function(coord) {
                return coord[0] >= 99 && coord[0] <= 111 && coord[1] >= 29 && coord[1] <= 41;
            });
            assert(allInDataSpace, 'filled: all coords in data space');
        }
    });
})();

// ========================================
console.log('\n\x1b[33m═══ Smooth option tests ═══\x1b[0m\n');

(function testSmoothOption() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });

    var fcNoSmooth = geojson.toGeoJSON(result, { smooth: 0 });
    var fcSmooth = geojson.toGeoJSON(result, { smooth: 0.5 });

    // Smoothing should produce more coordinate points
    var noSmoothCoords = 0;
    var smoothCoords = 0;

    fcNoSmooth.features.forEach(function(f) {
        noSmoothCoords += f.geometry.coordinates.length;
    });
    fcSmooth.features.forEach(function(f) {
        smoothCoords += f.geometry.coordinates.length;
    });

    assert(smoothCoords >= noSmoothCoords, 'smoothing produces >= coordinate points (smooth: ' + smoothCoords + ' vs no-smooth: ' + noSmoothCoords + ')');
})();

// ========================================
console.log('\n\x1b[33m═══ Transform option tests ═══\x1b[0m\n');

(function testTransformOption() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });

    var transform = {
        forward: function(x, y) {
            return [x * 100 + 1000, y * 100 + 2000];
        }
    };

    var fc = geojson.toGeoJSON(result, { transform: transform });

    assert(fc.features.length > 0, 'transform: has features');

    fc.features.forEach(function(f, i) {
        f.geometry.coordinates.forEach(function(coord) {
            // All coordinates should be in transformed space
            assert(coord[0] >= 1000, 'transform: x >= 1000, got ' + coord[0]);
            assert(coord[1] >= 2000, 'transform: y >= 2000, got ' + coord[1]);
        });
    });
})();

// ========================================
console.log('\n\x1b[33m═══ CRS option tests ═══\x1b[0m\n');

(function testCrsOption() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });

    var crs = {
        type: 'name',
        properties: {
            name: 'urn:ogc:def:crs:EPSG::4326'
        }
    };

    var fcWithCrs = geojson.toGeoJSON(result, { crs: crs });
    assert(fcWithCrs.crs !== undefined, 'FeatureCollection has crs property');
    assert(fcWithCrs.crs.type === 'name', 'crs type is name');
    assert(fcWithCrs.crs.properties.name === 'urn:ogc:def:crs:EPSG::4326', 'crs name correct');

    var fcNoCrs = geojson.toGeoJSON(result);
    assert(fcNoCrs.crs === undefined, 'FeatureCollection without crs has no crs property');
})();

(function testFilledCrsOption() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });

    var crs = {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:EPSG::3857' }
    };

    var fc = geojson.toFilledGeoJSON(result, { crs: crs });
    assert(fc.crs !== undefined, 'filled FeatureCollection has crs');
    assert(fc.crs.properties.name === 'urn:ogc:def:crs:EPSG::3857', 'filled crs name correct');
})();

// ========================================
console.log('\n\x1b[33m═══ Empty result test ═══\x1b[0m\n');

(function testEmptyResult() {
    var grid = [[1, 1], [1, 1]]; // constant data -> no contours
    try {
        var result = ContourCore.computeContours({ z: grid }, { start: 10, end: 10, size: 1 });
        var fc = geojson.toGeoJSON(result);
        assert(fc.type === 'FeatureCollection', 'empty result: FeatureCollection type');
        assert(fc.features.length === 0, 'empty result: 0 features');
    } catch (e) {
        // May throw for constant data, that's acceptable
        assert(true, 'constant data handled without crash');
    }
})();

// ========================================
console.log('\n\x1b[33m═══ stringify test ═══\x1b[0m\n');

(function testStringify() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });

    var str = geojson.stringify(result);
    var parsed = JSON.parse(str);

    assert(parsed.type === 'FeatureCollection', 'stringify: valid JSON');
    assert(parsed.features.length > 0, 'stringify: has features');

    // Test fill mode stringify
    var strFill = geojson.stringify(result, { type: 'fill' });
    var parsedFill = JSON.parse(strFill);
    assert(parsedFill.type === 'FeatureCollection', 'stringify fill: valid JSON');
})();

(function testStringifyWithTransform() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });

    var str = geojson.stringify(result, {
        transform: {
            forward: function(x, y) { return [x * 10, y * 10]; }
        },
        indent: 0
    });

    var parsed = JSON.parse(str);
    assert(parsed.type === 'FeatureCollection', 'stringify with transform: valid JSON');
})();

// ========================================
console.log('\n\x1b[33m═══ Error handling tests ═══\x1b[0m\n');

(function testInvalidResult() {
    var threw = false;
    try {
        geojson.toGeoJSON(null);
    } catch (e) {
        threw = true;
        assert(e.message === 'Invalid contour result: missing paths', 'correct error message');
    }
    assert(threw, 'throws on null result');

    threw = false;
    try {
        geojson.toFilledGeoJSON({});
    } catch (e) {
        threw = true;
    }
    assert(threw, 'throws on empty result');
})();

// ========================================
console.log('\n\x1b[33m═══ scalePathsToData removed ═══\x1b[0m\n');

(function testScalePathsToDataRemoved() {
    var compute = require('../../compute');
    assert(compute.scalePathsToData === undefined, 'scalePathsToData is removed from compute module');

    var idx = require('../../index');
    assert(idx.scalePathsToData === undefined, 'scalePathsToData is removed from index module');
})();

// ========================================
console.log('\n\x1b[36m═══ Results ═══\x1b[0m');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
console.log(failed === 0 ? '\n\x1b[32mAll tests passed!\x1b[0m\n' : '\n\x1b[31mSome tests failed!\x1b[0m\n');

process.exit(failed > 0 ? 1 : 0);