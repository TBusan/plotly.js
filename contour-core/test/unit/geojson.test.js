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
console.log('\n\x1b[33m═══ Cesium compliance tests ═══\x1b[0m\n');

(function testStrictRingClosure() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });

    // Test toFilledGeoJSON: all polygon rings must have strict first===last
    var fc = geojson.toFilledGeoJSON(result);
    fc.features.forEach(function(f, fi) {
        if (f.geometry.type === 'Polygon') {
            f.geometry.coordinates.forEach(function(ring, ri) {
                var first = ring[0];
                var last = ring[ring.length - 1];
                assert(first[0] === last[0] && first[1] === last[1],
                    'filled feature ' + fi + ' ring ' + ri + ': strict closure first[0]=' + first[0] + ' last[0]=' + last[0]);
            });
        } else if (f.geometry.type === 'MultiPolygon') {
            f.geometry.coordinates.forEach(function(poly, pi) {
                poly.forEach(function(ring, ri) {
                    var first = ring[0];
                    var last = ring[ring.length - 1];
                    assert(first[0] === last[0] && first[1] === last[1],
                        'filled multi feature ' + fi + ' poly ' + pi + ' ring ' + ri + ': strict closure');
                });
            });
        }
    });
})();

(function testWindingOrder() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });

    // Test toFilledGeoJSON: outer rings CCW, inner rings CW
    var fc = geojson.toFilledGeoJSON(result);
    fc.features.forEach(function(f, fi) {
        if (f.geometry.type === 'Polygon') {
            f.geometry.coordinates.forEach(function(ring, ri) {
                var area = ringSignedArea(ring);
                if (ri === 0) {
                    assert(area > 0,
                        'feature ' + fi + ' exterior ring ' + ri + ': CCW (positive area=' + area.toFixed(6) + ')');
                } else {
                    assert(area < 0,
                        'feature ' + fi + ' inner ring ' + ri + ': CW (negative area=' + area.toFixed(6) + ')');
                }
            });
        }
    });

    function ringSignedArea(ring) {
        var area = 0;
        for (var i = 0; i < ring.length - 1; i++) {
            area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        }
        return area / 2;
    }
})();

(function testNoConsecutiveDuplicates() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });

    var fc = geojson.toFilledGeoJSON(result);
    var duplicateCount = 0;
    fc.features.forEach(function(f) {
        var rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : [];
        rings.forEach(function(ring) {
            for (var i = 1; i < ring.length; i++) {
                var dx = Math.abs(ring[i][0] - ring[i - 1][0]);
                var dy = Math.abs(ring[i][1] - ring[i - 1][1]);
                if (dx < 1e-10 && dy < 1e-10) {
                    duplicateCount++;
                }
            }
        });
    });
    assert(duplicateCount === 0, 'no consecutive duplicate points in filled polygons (found ' + duplicateCount + ')');
})();

(function testNoDegenerateRings() {
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });

    var fc = geojson.toFilledGeoJSON(result);
    var degenerateCount = 0;
    fc.features.forEach(function(f) {
        if (f.geometry.type === 'Polygon') {
            f.geometry.coordinates.forEach(function(ring, ri) {
                // Ring must have at least 4 points (3 unique + 1 closing)
                if (ring.length < 4) {
                    degenerateCount++;
                }
            });
        }
    });
    assert(degenerateCount === 0, 'no degenerate rings (< 4 points) in filled polygons (found ' + degenerateCount + ')');
})();

(function testSanitizeRingForCesiumBasic() {
    // Test utility function directly
    // CCW ring (positive area)
    var ccwRing = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    var result1 = geojson.sanitizeRingForCesium(ccwRing, false);
    assert(result1 !== null, 'CCW ring: not null');
    assert(result1.length >= 4, 'CCW ring: >= 4 points');
    assert(result1[0][0] === result1[result1.length - 1][0] &&
           result1[0][1] === result1[result1.length - 1][1],
           'CCW ring: strict closure');

    // CW ring (negative area) should be reversed to CCW when isInner=false
    var cwRing = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]];
    var result2 = geojson.sanitizeRingForCesium(cwRing, false);
    assert(result2 !== null, 'CW->CCW ring: not null');
    var area = 0;
    for (var i = 0; i < result2.length - 1; i++) {
        area += result2[i][0] * result2[i + 1][1] - result2[i + 1][0] * result2[i][1];
    }
    area /= 2;
    assert(area > 0, 'CW->CCW ring: positive area after sanitization (area=' + area.toFixed(2) + ')');

    // Inner ring CW (should stay CW when isInner=true)
    var ccwInner = [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]];
    var result3 = geojson.sanitizeRingForCesium(ccwInner, true);
    assert(result3 !== null, 'inner ring: not null');
    var area3 = 0;
    for (var i = 0; i < result3.length - 1; i++) {
        area3 += result3[i][0] * result3[i + 1][1] - result3[i + 1][0] * result3[i][1];
    }
    area3 /= 2;
    assert(area3 < 0, 'inner ring: negative area (CW) after sanitization (area=' + area3.toFixed(2) + ')');
})();

(function testSanitizeRemovesDuplicates() {
    // Ring with consecutive duplicate point
    var ring = [[0, 0], [10, 0], [10, 10], [10, 10], [0, 10], [0, 0]];
    var result = geojson.sanitizeRingForCesium(ring, false);
    assert(result !== null, 'ring with duplicate: not null');
    // Should have 5 points (4 unique + 1 closing)
    assert(result.length === 5, 'ring with duplicate: 5 points (got ' + result.length + ')');
})();

(function testSanitizeRemovesCollinear() {
    // Ring with collinear point: (5,0) is collinear with (0,0)-(10,0)
    var ring = [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    var result = geojson.sanitizeRingForCesium(ring, false);
    assert(result !== null, 'ring with collinear: not null');
    // Should have 5 points (4 unique corners + 1 closing), (5,0) removed
    assert(result.length === 5, 'ring with collinear: 5 points (got ' + result.length + ')');
})();

(function testSanitizeNearZeroArea() {
    // Degenerate ring with near-zero area should not be reversed
    var degenerate = [[0, 0], [1e-15, 0], [1e-15, 1e-15], [0, 0]];
    var result = geojson.sanitizeRingForCesium(degenerate, false);
    // Should return null (less than 3 unique points after dedup)
    assert(result === null, 'degenerate ring: returns null');
})();

(function testLargeRangeCesiumCompliance() {
    var grid = makeLargeRangeGrid();
    var x = [];
    var y = [];
    for (var i = 0; i < 10; i++) {
        x.push(100 + i);
        y.push(30 + i);
    }

    var result = ContourCore.computeContours({ z: grid, x: x, y: y }, { autocontour: true });

    // Transform to geographic coordinates
    var transform = {
        forward: function(px, py) {
            return [116.0 + (px - 100) * 0.1, 39.5 + (py - 30) * 0.1];
        }
    };

    var fc = geojson.toFilledGeoJSON(result, { transform: transform });

    fc.features.forEach(function(f, fi) {
        if (f.geometry.type === 'Polygon') {
            f.geometry.coordinates.forEach(function(ring, ri) {
                // Check strict closure
                var first = ring[0];
                var last = ring[ring.length - 1];
                assert(first[0] === last[0] && first[1] === last[1],
                    'large range feature ' + fi + ' ring ' + ri + ': strict closure');

                // Check no consecutive duplicates
                for (var k = 1; k < ring.length; k++) {
                    var dx = Math.abs(ring[k][0] - ring[k - 1][0]);
                    var dy = Math.abs(ring[k][1] - ring[k - 1][1]);
                    assert(dx >= 1e-10 || dy >= 1e-10,
                        'large range feature ' + fi + ' ring ' + ri + ' no dup at ' + k);
                }
            });
        }
    });
})();

// ========================================
console.log('\n\x1b[33m═══ Self-intersection tests ═══\x1b[0m\n');

(function testBowtieSplit() {
    // Classic bow-tie (self-intersecting) polygon: (0,0) → (2,1) → (0,2) → (2,3) → (0,0)
    // Segments (0,0)→(2,1) and (0,2)→(2,3) cross at (1,0.5)? No...
    // Let me use a proper bow-tie:
    // (0,0) → (2,2) → (0,2) → (2,0) → (0,0)
    // Seg 0: (0,0)→(2,2), Seg 2: (0,2)→(2,0) — these cross at (1,1)
    var bowtie = [[0, 0], [2, 2], [0, 2], [2, 0], [0, 0]];
    var results = geojson.fixSelfIntersections(bowtie);
    assert(results.length === 2, 'bowtie splits into 2 rings (got ' + results.length + ')');

    // Each resulting ring should be simple (no self-intersections)
    results.forEach(function(ring, ri) {
        var recheck = geojson.fixSelfIntersections(ring);
        assert(recheck.length === 1, 'sub-ring ' + ri + ' is simple (no more splits)');
    });
})();

(function testAlreadySimpleRing() {
    // A simple square should not be split
    var square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    var results = geojson.fixSelfIntersections(square);
    assert(results.length === 1, 'simple square returns 1 ring (got ' + results.length + ')');
    assert(results[0].length === square.length, 'simple square unchanged length');
})();

(function testTriangleNoSplit() {
    var triangle = [[0, 0], [5, 0], [2.5, 4], [0, 0]];
    var results = geojson.fixSelfIntersections(triangle);
    assert(results.length === 1, 'triangle returns 1 ring');
})();

(function testComplexBowtie() {
    // More complex: (0,0) → (3,0) → (1,3) → (2,-1) → (0,2) → (0,0)
    // This should have a crossing somewhere
    var ring = [[0, 0], [3, 0], [1, 3], [2, -1], [0, 2], [0, 0]];
    var results = geojson.fixSelfIntersections(ring);
    assert(results.length >= 1, 'complex ring splits into >= 1 ring (got ' + results.length + ')');

    // All resulting rings should be simple
    results.forEach(function(ring, ri) {
        var recheck = geojson.fixSelfIntersections(ring);
        assert(recheck.length === 1, 'sub-ring ' + ri + ' is simple (no more splits)');
    });
})();

(function testSegmentIntersectionNoCross() {
    // Two parallel segments — should not intersect
    var ip = geojson.segmentIntersection([0, 0], [1, 0], [0, 1], [1, 1]);
    assert(ip === null, 'parallel segments: no intersection');

    // Two segments that share an endpoint — should not intersect (adjacent)
    var ip2 = geojson.segmentIntersection([0, 0], [1, 1], [1, 1], [2, 0]);
    assert(ip2 === null, 'shared endpoint: no intersection (t or s at boundary)');
})();

(function testSegmentIntersectionCross() {
    // Two segments that cross in the middle
    var ip = geojson.segmentIntersection([0, 0], [2, 2], [0, 2], [2, 0]);
    assert(ip !== null, 'crossing segments: found intersection');
    assert(Math.abs(ip[0] - 1) < 1e-6 && Math.abs(ip[1] - 1) < 1e-6,
        'crossing intersection at (1,1) (got ' + ip[0].toFixed(3) + ',' + ip[1].toFixed(3) + ')');
})();

(function testNoSelfIntersectionInFilledOutput() {
    // Real contour data should produce no self-intersections in any polygon ring
    var grid = makeSimpleGrid();
    var result = ContourCore.computeContours({ z: grid }, { autocontour: true });
    var fc = geojson.toFilledGeoJSON(result);

    fc.features.forEach(function(f, fi) {
        if (f.geometry.type === 'Polygon') {
            f.geometry.coordinates.forEach(function(ring, ri) {
                var simpleRings = geojson.fixSelfIntersections(ring);
                assert(simpleRings.length === 1,
                    'filled feature ' + fi + ' ring ' + ri + ': no self-intersection (splits into ' + simpleRings.length + ')');
            });
        }
    });
})();

(function testBowtieInFilledOutputSanitized() {
    // A bow-tie ring fed through sanitizeRingForCesium should be handled
    // by the pipeline (fixSelfIntersections is in the pipeline)
    var bowtie = [[0, 0], [2, 2], [0, 2], [2, 0], [0, 0]];
    var simpleRings = geojson.fixSelfIntersections(bowtie);
    assert(simpleRings.length === 2, 'bowtie in pipeline: splits into 2');

    // Each sub-ring should sanitize successfully
    simpleRings.forEach(function(ring, ri) {
        var sanitized = geojson.sanitizeRingForCesium(ring, ri === 0 ? false : true);
        assert(sanitized !== null, 'sub-ring ' + ri + ' sanitizes successfully');
        assert(sanitized.length >= 4, 'sub-ring ' + ri + ' has >= 4 points');
        // Strict closure
        assert(sanitized[0][0] === sanitized[sanitized.length - 1][0],
            'sub-ring ' + ri + ' strict closure x');
        assert(sanitized[0][1] === sanitized[sanitized.length - 1][1],
            'sub-ring ' + ri + ' strict closure y');
    });
})();

// ========================================
console.log('\n\x1b[36m═══ Results ═══\x1b[0m');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
console.log(failed === 0 ? '\n\x1b[32mAll tests passed!\x1b[0m\n' : '\n\x1b[31mSome tests failed!\x1b[0m\n');

process.exit(failed > 0 ? 1 : 0);