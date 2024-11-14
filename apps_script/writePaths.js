// -----------------------------------------------------
// writePaths
// Gets paths and writes to sheet
// -----------------------------------------------------

function writePathResults() {
  const allPathResults = getPathResults();

  writePaths(allPathResults);
}

const pathHeaders = [
  "Lowest Cost wo/ Aspects", //  A4:F24
  "Lowest Cost", // A28:F48
  "Highest Prob wo/ Aspects", // A52:F72
  "Highest Prob", // A76:F96
];

function writePaths(allPathResults) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SHEET_NAMES.PATH_DATA_SHEET
  );

  const [pathProbType, pathDivType] = getPathTypes();

  const writePathType = (pathName, startRow) => {
    let pathTable = [];
    let pathResults = allPathResults[pathName];

    for (let { recomb, cost } of pathResults.pathHistory) {
      // columns
      // Final Item
      // Feeder Items
      // Exclusive Mods
      // Full Recomb
      // Cost
      // Prob

      pathTable.push([
        recomb.desStr,
        recomb.feederItems.desStr,
        recomb.feederItems.excStr,
        recomb.feederItems.str,
        cost,
        recomb[pathProbType],
      ]);

      // only write 20 lines
      if (pathTable.length == 19) {
        pathTable.pop();
        pathTable.push(["overflow"]);
      }
    }

    const startCol = 1;
    const numRows = pathTable.length;
    const numCols = pathTable[0].length;

    sheet.getRange(startRow, startCol, 20, numCols).clear();
    sheet
      .getRange(startRow, startCol, numRows, numCols)
      .setValues(pathTable.reverse());

    // write total path cost
    sheet.getRange(startRow, startCol + numCols).setValue(pathResults.pathCost);

    // write total bases needed
    sheet
      .getRange(startRow, startCol + numCols + 1)
      .setValue(pathResults.basesUsed);
  };

  for (const [type, startRow] of Object.entries(PATH_ROWS)) {
    writePathType(type, startRow);
  }
}
