'use strict';

/**
 * Find all empty (undefined) points in a 2D array
 * Based on plotly.js src/traces/heatmap/find_empties.js
 *
 * Return a list of empty points in 2D array z
 * Each empty point z[i][j] gives an array [i, j, neighborCount]
 * neighborCount is the count of 4 nearest neighbors that DO exist
 * This is to give us an order of points to evaluate for interpolation.
 *
 * If no neighbors exist, we iteratively look for neighbors that HAVE
 * neighbors, and add a fractional neighborCount
 *
 * @param {Array} z - 2D array of values (may contain undefined)
 * @returns {Array} Array of [i, j, neighborCount] for each empty point,
 *                  sorted by neighbor count (descending)
 */
function findEmpties(z) {
    if (!z || z.length === 0) {
        return [];
    }

    var empties = [];
    var neighborHash = {};
    var noNeighborList = [];
    var rowLength = 0;

    // Find max row length (like plotly.js maxRowLength)
    for (var i = 0; i < z.length; i++) {
        if (z[i] && z[i].length > rowLength) {
            rowLength = z[i].length;
        }
    }

    var blank = [0, 0, 0];
    var prevRow, row, nextRow;

    // First pass: find all undefined points and count direct neighbors
    for (var i = 0; i < z.length; i++) {
        prevRow = row;
        row = z[i];
        nextRow = z[i + 1] || [];

        for (var j = 0; j < rowLength; j++) {
            // Check if this point is empty (undefined)
            if (row[j] === undefined) {
                var neighborCount = (row[j - 1] !== undefined ? 1 : 0) +
                    (row[j + 1] !== undefined ? 1 : 0) +
                    (prevRow && prevRow[j] !== undefined ? 1 : 0) +
                    (nextRow && nextRow[j] !== undefined ? 1 : 0);

                if (neighborCount) {
                    // For edge points, don't count off-the-edge as undefined neighbors
                    if (i === 0) neighborCount++;
                    if (j === 0) neighborCount++;
                    if (i === z.length - 1) neighborCount++;
                    if (row && j === row.length - 1) neighborCount++;

                    // Only store in neighborHash if not all 4 neighbors exist
                    // (we don't need these for finding farther neighbors)
                    if (neighborCount < 4) {
                        neighborHash[[i, j]] = [i, j, neighborCount];
                    }

                    empties.push([i, j, neighborCount]);
                } else {
                    noNeighborList.push([i, j]);
                }
            }
        }
    }

    // Find neighbors for points that initially had none
    var newNeighborHash, foundNewNeighbors, thisPt, neighborCount;

    while (noNeighborList.length) {
        newNeighborHash = {};
        foundNewNeighbors = false;

        // Look for cells that now have neighbors but didn't before
        for (var p = noNeighborList.length - 1; p >= 0; p--) {
            thisPt = noNeighborList[p];
            var i = thisPt[0];
            var j = thisPt[1];

            // Calculate fractional neighbor count from neighbors' neighbors
            neighborCount = ((neighborHash[[i - 1, j]] || blank)[2] +
                (neighborHash[[i + 1, j]] || blank)[2] +
                (neighborHash[[i, j - 1]] || blank)[2] +
                (neighborHash[[i, j + 1]] || blank)[2]) / 20;

            if (neighborCount) {
                newNeighborHash[thisPt] = [i, j, neighborCount];
                noNeighborList.splice(p, 1);
                foundNewNeighbors = true;
            }
        }

        // Matching plotly.js behavior - throw error if no new neighbors found
        if (!foundNewNeighbors) {
            throw new Error('findEmpties: Iterated with no new neighbors - cannot interpolate all empty points');
        }

        // Put these new cells into the main neighbor list
        for (var key in newNeighborHash) {
            neighborHash[key] = newNeighborHash[key];
            empties.push(newNeighborHash[key]);
        }
    }

    // Sort by neighbor count descending (more neighbors first)
    return empties.sort(function(a, b) { return b[2] - a[2]; });
}

module.exports = findEmpties;
