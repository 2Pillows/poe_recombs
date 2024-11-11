// only one edit possibe, need to have one for the path check and one for the resize check
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;

  // Edits for Search Sheet
  if (sheet.getName() === SHEET_NAMES.SEARCH_SHEET) {
    resizeColumns(SHEET_NAMES.SEARCH_SHEET);
  }

  // Edits for find path
  if (sheet.getName() === SHEET_NAMES.PATH_SHEET) {
    if (range.getA1Notation() === SHEET_RANGES.runScript) {
      // Check if the value is TRUE
      if (range.getValue() === true) {
        writePathResults();
        sheet.getRange(SHEET_RANGES.runScript).setValue(false);
      }
    }
  }
}

// takes around 5 seconds, idk if can make faster
function resizeColumns(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  // cols h, i, j, k
  const columnsToResize = [8, 9, 10, 11];

  columnsToResize.forEach((col) => {
    const headerValue = sheet.getRange(1, col).getValue();

    if (headerValue === "Failed Items") {
      sheet.autoResizeColumn(col);
    } else {
      sheet.setColumnWidth(col, 120);
    }
  });
}
