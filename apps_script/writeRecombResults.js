// writes results to sheets

// -----------------------------------------------------
// Main Function
// -----------------------------------------------------

function writeResults() {
  const recombResults = getRecombResults();

  writeToSheet(recombResults);
}

// -----------------------------------------------------
// Write results to sheet
// -----------------------------------------------------

const writeToSheet = (recombResults) => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SHEET_NAMES.RESULTS_SHEET
  );

  // need to clear before writing
  const lastRow = sheet.getLastRow();
  sheet.setFrozenRows(0);
  if (lastRow > 2) {
    sheet.deleteRows(3, lastRow - 2);
  }
  sheet.setFrozenRows(1);

  const headers = [
    "Final Item",
    "Desired String",
    "Exclusive Mod Pool",
    "Full String Example",
    "Option in Path",
    "Prob",
    "Prob Eldritch",
    "Prob Aspect",
    // "Prob Eldritch Aspect",
    "Divines",
    "Divines Eldritch",
    "Divines Aspect",
    "Aspects Used",
    "Magic Items",
    "Failed Items",
  ];

  const recombTable = [headers];

  for (const [finalItem, recombList] of Object.entries(recombResults)) {
    recombList.forEach((recomb) => {
      recombTable.push([
        finalItem,
        recomb.feederItems.desStr,
        recomb.feederItems.excStr,
        recomb.feederItems.str,
        recomb.isPathOption,
        recomb.prob,
        recomb.probEldritch,
        recomb.probAspect,
        // recomb.probEldritchAspect,
        recomb.divines,
        recomb.divinesEldritch,
        recomb.divinesAspect,
        recomb.feederItems.totalAspS,
        recomb.feederItems.magicCount,
        recomb.failedStr,
      ]);
    });
  }

  const startRow = 1;
  const startCol = 1;
  const numRows = recombTable.length;
  const numCols = recombTable[0].length;

  sheet.getRange(startRow, startCol, numRows, numCols).setValues(recombTable);

  console.log("results written");
};
