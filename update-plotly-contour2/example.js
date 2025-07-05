/**
 * Example usage of ContourToGeoJSON
 * 
 * This file demonstrates how to extract contour lines from plotly.js
 * and convert them to GeoJSON format using test data.
 */

// Import the ContourToGeoJSON library and test data
const ContourToGeoJSON = require('./index');
const { contourData } = require('./testData');
const fs = require('fs');

/**
 * 将GeoJSON数据保存到文件
 * @param {Object} geojson - GeoJSON数据
 * @param {string} filename - 文件名
 * @returns {boolean} 是否保存成功
 */
function saveGeoJSONToFile(geojson, filename) {
  try {
    fs.writeFileSync(filename, JSON.stringify(geojson, null, 2));
    console.log(`GeoJSON data saved to ${filename}`);
    return true;
  } catch (error) {
    console.error(`Error saving GeoJSON to file: ${error.message}`);
    return false;
  }
}

// Example usage
function main() {
  // Use the test data from testData.js
  const { x, y, v } = contourData.data;
  
  // Define contour levels
  const contours = [0, 50, 100, 150, 200, 250, 300, 350];
  
  // Convert contours to GeoJSON
  const contourGeoJSON = ContourToGeoJSON.contourToGeoJSON({
    z: v,  // v is the 2D array of z values in the test data
    x: x,
    y: y,
    contours: contours
  });
  
  // 保存等值线的GeoJSON
  saveGeoJSONToFile(contourGeoJSON, 'contour_lines.geojson');
  
  // 输出结果摘要
  console.log('\nGeoJSON file generated:');
  console.log('- contour_lines.geojson (等值线数据)');
  
  // Summary of results
  let lineCount = contourGeoJSON.features.length;
  
  console.log(`\nGeoJSON contains:`);
  console.log(`- ${lineCount} LineString features (contour lines)`);
  console.log(`- Using test data with grid size: ${v.length}×${v[0].length}`);
  console.log(`- Contour levels: ${contours.join(', ')}`);
}

// Run the example
main(); 