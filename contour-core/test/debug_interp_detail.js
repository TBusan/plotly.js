'use strict';

/**
 * Debug to show the actual z values before and after interpolation
 */

var normalizeNullValues = require('../null_handling/normalize');
var findEmpties = require('../null_handling/find_empties');
var interp2d = require('../null_handling/interp2d');

// Data2: Contains null values
var data2 = [[null, null, null, 12, 13, 14, 15, 16],
    [null, 1, null, 11, null, null, null, 17],
    [null, 2, 6, 7, null, null, null, 18],
    [null, 3, null, 8, null, null, null, 19],
    [5, 4, 10, 9, null, null, null, 20],
    [null, null, null, 27, null, null, null, 21],
    [null, null, null, 26, 25, 24, 23, 22]];

console.log('=== DATA2 Before/After Interpolation ===\n');

// Show original data
console.log('ORIGINAL DATA2:');
console.log('First row:', data2[0]);
console.log('Last row:', data2[data2.length - 1]);

// Normalize (convert null to undefined)
var norm = normalizeNullValues(data2);
console.log('\nAFTER NORMALIZATION (null -> undefined):');
console.log('First row:', norm.cleanedGrid[0]);
console.log('Last row:', norm.cleanedGrid[norm.cleanedGrid.length - 1]);
console.log('Null count:', norm.nullCount);
console.log('Valid count:', norm.validCount);

// Find empties
var empties = findEmpties(norm.cleanedGrid);
console.log('\nEMPTY POINTS TO INTERPOLATE:', empties.length);
console.log('First 10 empty points:', empties.slice(0, 10));

// Interpolate
var zCopy = JSON.parse(JSON.stringify(norm.cleanedGrid));
interp2d(zCopy, empties);

console.log('\nAFTER INTERPOLATION:');
console.log('First row:', zCopy[0]);
console.log('Last row:', zCopy[zCopy.length - 1]);
console.log('\nOriginal data1 first row for comparison:');
console.log('[2, 4, 7, 12, 13, 14, 15, 16]');

// Show percentage of data that was interpolated
console.log('\nSTATISTICS:');
var totalCells = data2.length * data2[0].length;
var nullPercentage = (norm.nullCount / totalCells * 100).toFixed(1);
console.log('Null cells: ' + norm.nullCount + ' / ' + totalCells + ' (' + nullPercentage + '%)');
console.log('\nCONCLUSION:');
console.log('With ' + nullPercentage + '% of data being null, the interpolated values');
console.log('will differ significantly from actual data values. This is expected.');
console.log('The contour lines will follow the interpolated surface, not the original data.');
