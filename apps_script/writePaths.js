// write paths to sheet
// have sheet that lists all path results
// toggles on display sheet to change what appears
// show exclusive pool or give full string w/ exclusive
// show what type of path
// same 4 section layout but toggle what is shown?
// fills in from left to right and top to bottom?

function writePathResults() {
  const allPathResults = getPathResults();

  writePaths(allPathResults);

  console.log("paths written");
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

  const PATH_ROWS = {
    pathProb: 52,
    pathProbAspect: 76,
    pathCost: 4,
    pathCostAspect: 28,
  };

  const [pathProbType, pathDivType] = getPathTypes();

  const writePathType = (pathName, startRow) => {
    let pathTable = [];
    let pathResults = allPathResults[pathName];

    for (let { recomb, cost } of pathResults.pathHistory) {
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
    // columns
    // Final Item
    // Feeder Items
    // Exclusive Mods
    // Full Recomb
    // Cost
    // Prob

    const startCol = 1;
    const numRows = pathTable.length;
    const numCols = pathTable[0].length;

    sheet.getRange(startRow, startCol, 20, numCols).clear();
    sheet
      .getRange(startRow, startCol, numRows, numCols)
      .setValues(pathTable.reverse());

    // only write 21 rows
    console.log("written");
  };

  for (const [type, startRow] of Object.entries(PATH_ROWS)) {
    writePathType(type, startRow);
  }
}
