// -----------------------------------------------------
// writePaths
// Gets paths and writes to sheet
// -----------------------------------------------------

function writePathResults() {
  const allPathResults = getPathResults();

  writePaths(allPathResults);
}

const pathHeaders = [
  "Lowest Cost w/o Aspects", //  A4:F24
  "Lowest Cost", // A28:F48
  "Highest Prob w/o Aspects", // A52:F72
  "Highest Prob", // A76:F96
];

function writePaths(allPathResults) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SHEET_NAMES.PATH_DATA_SHEET
  );
  const sheetConfig = getSheetConfig();
  const baseCost = sheetConfig.costOptions.baseCost;

  const [finalP, finalS] = getAffixCount(sheetConfig.finalItem);
  const prefixCost = sheetConfig.costOptions.prefixModCost;
  const suffixCost = sheetConfig.costOptions.suffixModCost;
  const modCost =
    (prefixCost * finalP + suffixCost * finalS) / (finalP + finalS);

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
        `=TEXT(${recomb[pathProbType]},"0.00%")`,
      ]);

      // only write 20 lines
      if (pathTable.length == 18) {
        pathTable.pop();
        pathTable.push(["TOO", "MANY", "PATHS", "TO", "WRITE", ""]);
        break;
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
      .setValue(pathResults.baseCost / baseCost);

    // write total mod rolls needed
    sheet
      .getRange(startRow, startCol + numCols + 2)
      .setValue(pathResults.modCost / modCost);

    // write total prep cost needed
    sheet
      .getRange(startRow, startCol + numCols + 3)
      .setValue(pathResults.prepCost);
  };

  for (const [type, startRow] of Object.entries(PATH_ROWS)) {
    writePathType(type, startRow);
  }
}
