// app_script.js
// app script used for sheet

// Get detailed paths from the sheet
// Has each recomb for any final item
function getRecombData(sheetName, ELDTRICH_ITEM) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  var column = ELDTRICH_ITEM ? "D" : "B";
  var data = sheet.getRange(column + "5:" + column).getValues();

  var recombsDict = {};

  var finalItem = "";

  for (var i = 0; i < data.length; i++) {
    var cellValue = data[i][0].trim();

    if (
      cellValue !== "" &&
      cellValue.indexOf("-") === -1 &&
      cellValue.indexOf("Item1:") === -1
    ) {
      finalItem = cellValue;
      recombsDict[finalItem] = [];
    } else if (cellValue.indexOf("Item1:") !== -1) {
      dict = {};

      pairs = cellValue.split(", ");
      for (var j = 0; j < pairs.length; j++) {
        var pair = pairs[j].split(": ");
        var key = pair[0];
        var value = pair[1];
        dict[key] = value;
      }

      recombsDict[finalItem].push(dict);
    }
  }

  return recombsDict;
}

// Get path options and guaranteed items from sheet
function getPathOptions(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const finalItemValues = sheet
    .getRange("C4")
    .setNumberFormat("@STRING@")
    .getValue();
  const [a, b] = finalItemValues.split("/");
  const finalItem = `${a}p/${b}s`;

  const baseCost = parseFloat(sheet.getRange("C6").getValue());
  const aspectCost = parseFloat(sheet.getRange("C7").getValue());

  const eldritchItem = sheet.getRange("C9").getValue();

  var guaranteedItems = {
    "2p/0s": sheet.getRange("C12").getValue(),
    "1p/1s": sheet.getRange("C13").getValue(),
    "0p/2s": sheet.getRange("C14").getValue(),
    "3p/0s": sheet.getRange("C15").getValue(),
    "2p/1s": sheet.getRange("C16").getValue(),
    "1p/2s": sheet.getRange("C17").getValue(),
    "0p/3s": sheet.getRange("C18").getValue(),
    "3p/1s": sheet.getRange("C19").getValue(),
    "2p/2s": sheet.getRange("C20").getValue(),
    "1p/3s": sheet.getRange("C21").getValue(),
    "3p/2s": sheet.getRange("C22").getValue(),
    "2p/3s": sheet.getRange("C23").getValue(),
  };

  guaranteedItems = Object.keys(guaranteedItems)
    .filter((key) => guaranteedItems[key] >= 1)
    .reduce((obj, key) => {
      obj[key] = guaranteedItems[key];
      return obj;
    }, {});

  return {
    finalItem,
    baseCost,
    aspectCost,
    eldritchItem,
    guaranteedItems,
  };
}

// Calculate best paths to get to final item according to params
function getPaths(
  recombDict,
  pathDetails,
  FINAL_ITEM,
  BASE_COST,
  ASPECT_COST,
  guaranteedItems,
  sortProb,
  sortCost,
  allowAspect,
  visited
) {
  // Skip if visited or not in recomb dict
  if (visited.has(FINAL_ITEM) || !(FINAL_ITEM in recombDict)) {
    return;
  }

  visited.add(FINAL_ITEM);

  // Process all recombinations for the final item
  for (const recomb of recombDict[FINAL_ITEM]) {
    var {
      Item1: item1,
      Item2: item2,
      Exclusive: exclusive,
      Prob: probability,
      Multimods: multimodsUsed,
      "Aspect Suffix Count": aspectSuffixCount,
      "Desired Suffixes": totalDesiredSuffixes,
    } = recomb;
    probability = parseFloat(probability);
    multimodsUsed = parseFloat(multimodsUsed);
    aspectSuffixCount = parseFloat(aspectSuffixCount);
    totalDesiredSuffixes = parseFloat(totalDesiredSuffixes);

    // Guaranteed items for current final item
    // const availGuaranteed = { ...guaranteedItems };

    // Recursively process item1 and item2
    if (!visited.has(item1)) {
      getPaths(
        recombDict,
        pathDetails,
        item1,
        BASE_COST,
        ASPECT_COST,
        guaranteedItems,
        sortProb,
        sortCost,
        allowAspect,
        visited
      );
    }
    if (!visited.has(item2)) {
      getPaths(
        recombDict,
        pathDetails,
        item2,
        BASE_COST,
        ASPECT_COST,
        guaranteedItems,
        sortProb,
        sortCost,
        allowAspect,
        visited
      );
    }

    // recomb cost is nothing, unless guaranteed, then risking base
    let benchCost = 0;
    benchCost += multimodsUsed * 2;
    if (aspectSuffixCount > 0 && totalDesiredSuffixes === 0) benchCost += 1;
    benchCost += aspectSuffixCount * ASPECT_COST;
    recombCost = (benchCost + BASE_COST) / probability;

    let curItem1Prob = pathDetails[item1]["pathProb"];
    let curItem2Prob = pathDetails[item2]["pathProb"];

    let curItem1Cost = pathDetails[item1]["pathCost"];
    let curItem2Cost = pathDetails[item2]["pathCost"];

    // let item1GuarUsed = false
    // let item2GuarUsed = false

    // Change prob and cost if guaranteed item
    // if (guaranteedItems[item1] > 0) {
    //   curItem1Prob = 1;
    //   curItem1Cost = BASE_COST;
    //   guaranteedItems[item1] -= 1;
    //   item1GuarUsed = true
    // }

    // if (guaranteedItems[item2] > 0) {
    //   curItem2Prob = 1;
    //   curItem2Cost = BASE_COST;
    //   guaranteedItems[item2] -= 1;
    //   item2GuarUsed = true
    // }

    let curPathProb = curItem1Prob * curItem2Prob * probability;
    let curPathCost =
      (benchCost + (curItem1Cost + curItem2Cost) / 2) / probability;

    // if (sortProb && !allowAspect && FINAL_ITEM === '3p/2s' && item1 === "2p/1s" && item2 === "2p/1s") {
    //   console.log(item1, " + ", item2, " | ", curItem1Prob, " * ", curItem2Prob, " = ", curPathProb)
    // }

    // set as path if sort by prob and highest prob, or sort by cost and lowest cost
    // let itemUsed = false
    if (
      (sortProb && curPathProb >= pathDetails[FINAL_ITEM]["pathProb"]) ||
      (sortCost && curPathCost <= pathDetails[FINAL_ITEM]["pathCost"])
    ) {
      // skip if has aspect and cant include
      if (!allowAspect && aspectSuffixCount > 0) continue;

      pathDetailDict = {
        feederItems: [item1, item2],
        exclusiveMods: exclusive,
        cost: recombCost,
        prob: probability,
        pathProb: curPathProb,
        pathCost: curPathCost,
      };

      // always update if is "better" or is cheaper
      if (
        (sortProb && curPathProb > pathDetails[FINAL_ITEM]["pathProb"]) ||
        (sortCost && curPathCost < pathDetails[FINAL_ITEM]["pathCost"]) ||
        curPathCost < pathDetails[FINAL_ITEM]["pathCost"]
      ) {
        pathDetails[FINAL_ITEM] = pathDetailDict;
      }
    }

    // if (!itemUsed && item1GuarUsed) {
    //   guaranteedItems[item1] += 1;
    // }
    // if (!itemUsed && item2GuarUsed) {
    //   guaranteedItems[item2] += 1;
    // }
  }

  return pathDetails;
}

// write all paths to final item
function writeToSheet(
  sheetName,
  FINAL_ITEM,
  GUARANTEED_ITEMS,
  path_prob,
  path_prob_aspect,
  path_cost,
  path_cost_aspect
) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  // Clear sheet before writing
  sheet.getRange("E4:J23").clearContent();
  sheet.getRange("K4:P23").clearContent();
  sheet.getRange("E28:J47").clearContent();
  sheet.getRange("K28:P47").clearContent();

  // Path probability
  sheet.getRange("G24").setValue(path_prob[FINAL_ITEM]["pathCost"].toFixed(2));
  sheet
    .getRange("I24")
    .setValue((path_prob[FINAL_ITEM]["pathProb"] * 100).toFixed(2) + "%");
  pathProbData = collectPaths(FINAL_ITEM, { ...GUARANTEED_ITEMS }, path_prob);
  writeDataToSheet(sheet, pathProbData, "E4");

  // Path probability with aspect
  sheet
    .getRange("M24")
    .setValue(path_prob_aspect[FINAL_ITEM]["pathCost"].toFixed(2));
  sheet
    .getRange("O24")
    .setValue(
      (path_prob_aspect[FINAL_ITEM]["pathProb"] * 100).toFixed(2) + "%"
    );
  pathProbAspectData = collectPaths(
    FINAL_ITEM,
    { ...GUARANTEED_ITEMS },
    path_prob_aspect
  );
  writeDataToSheet(sheet, pathProbAspectData, "K4");

  // Path cost
  sheet.getRange("G48").setValue(path_cost[FINAL_ITEM]["pathCost"].toFixed(2));
  sheet
    .getRange("I48")
    .setValue((path_cost[FINAL_ITEM]["pathProb"] * 100).toFixed(2) + "%");
  pathCostData = collectPaths(FINAL_ITEM, { ...GUARANTEED_ITEMS }, path_cost);
  writeDataToSheet(sheet, pathCostData, "E28");

  // Path cost with aspect
  sheet
    .getRange("M48")
    .setValue(path_cost_aspect[FINAL_ITEM]["pathCost"].toFixed(2));
  sheet
    .getRange("O48")
    .setValue(
      (path_cost_aspect[FINAL_ITEM]["pathProb"] * 100).toFixed(2) + "%"
    );
  pathCostAspectData = collectPaths(
    FINAL_ITEM,
    { ...GUARANTEED_ITEMS },
    path_cost_aspect
  );
  writeDataToSheet(sheet, pathCostAspectData, "K28");
}

// Collects all recombs needed for target item
function collectPaths(target_item, guaranteedItems, pathDetails) {
  var path_details = pathDetails[target_item];
  if (!path_details || path_details["feederItems"].length === 0) {
    return [];
  }

  var feeder_items =
    path_details["feederItems"][0] + " + " + path_details["feederItems"][1];
  var exclusive_mods = path_details["exclusiveMods"];
  var cost = path_details["cost"];
  var prob = path_details["prob"];

  // create row for current item
  var row = [
    target_item,
    feeder_items,
    exclusive_mods,
    cost.toFixed(2),
    (prob * 100).toFixed(2) + "%",
  ];

  // collect paths for item1 and item2
  var rows = [row];
  if (guaranteedItems[path_details["feederItems"][1]] > 0) {
    guaranteedItems[path_details["feederItems"][1]] -= 1;
  } else {
    rows = rows.concat(
      collectPaths(path_details["feederItems"][1], guaranteedItems, pathDetails)
    );
  }
  if (guaranteedItems[path_details["feederItems"][0]] > 0) {
    guaranteedItems[path_details["feederItems"][0]] -= 1;
  } else {
    rows = rows.concat(
      collectPaths(path_details["feederItems"][0], guaranteedItems, pathDetails)
    );
  }

  return rows;
}

// write data to sheet section
function writeDataToSheet(sheet, data, startCell) {
  var numRows = data.length;
  var numCols = data[0].length;

  var range = sheet.getRange(startCell).offset(0, 0, numRows, numCols);

  range.setValues(data);
}

// get base dict for path details, used to hold best paths
function getpathDetails(BASE_COST) {
  const pathDetails = {};

  for (let p = 0; p <= 3; p++) {
    for (let s = 0; s <= 3; s++) {
      const key = `${p}p/${s}s`;
      pathDetails[key] = {};
      pathDetailDict = {
        feederItems: [],
        exclusiveMods: "",
        cost:
          (p === 0 && s === 0) || (p === 1 && s === 0) || (p === 0 && s === 1)
            ? BASE_COST
            : Infinity,
        prob:
          (p === 0 && s === 0) || (p === 1 && s === 0) || (p === 0 && s === 1)
            ? 1
            : -Infinity,
        pathProb:
          (p === 0 && s === 0) || (p === 1 && s === 0) || (p === 0 && s === 1)
            ? 1
            : -Infinity,
        pathCost:
          (p === 0 && s === 0) || (p === 1 && s === 0) || (p === 0 && s === 1)
            ? BASE_COST
            : Infinity,
      };
      pathDetails[key] = pathDetailDict;
    }
  }

  delete pathDetails["0p/0s"];
  delete pathDetails["3p/3s"];
  return pathDetails;
}

// main script
function run() {
  pathOptions = getPathOptions("Find Path");
  const BASE_COST = pathOptions.baseCost;
  const ASPECT_COST = pathOptions.aspectCost;
  const FINAL_ITEM = pathOptions.finalItem;
  const ELDTRICH_ITEM = pathOptions.eldritchItem;
  const GUARANTEED_ITEMS = pathOptions.guaranteedItems;

  recombDict = getRecombData("Recombs for Script", ELDTRICH_ITEM);

  pathDetails = getpathDetails(BASE_COST);

  // get paths
  path_prob = getPaths(
    { ...recombDict },
    { ...pathDetails },
    FINAL_ITEM,
    BASE_COST,
    ASPECT_COST,
    { ...GUARANTEED_ITEMS },
    (sortProb = true),
    (sortCost = false),
    (allowAspect = false),
    new Set()
  );
  path_prob_aspect = getPaths(
    { ...recombDict },
    { ...pathDetails },
    FINAL_ITEM,
    BASE_COST,
    ASPECT_COST,
    { ...GUARANTEED_ITEMS },
    (sortProb = true),
    (sortCost = false),
    (allowAspect = true),
    new Set()
  );
  path_cost = getPaths(
    { ...recombDict },
    { ...pathDetails },
    FINAL_ITEM,
    BASE_COST,
    ASPECT_COST,
    { ...GUARANTEED_ITEMS },
    (sortProb = false),
    (sortCost = true),
    (allowAspect = false),
    new Set()
  );
  path_cost_aspect = getPaths(
    { ...recombDict },
    { ...pathDetails },
    FINAL_ITEM,
    BASE_COST,
    ASPECT_COST,
    { ...GUARANTEED_ITEMS },
    (sortProb = false),
    (sortCost = true),
    (allowAspect = true),
    new Set()
  );

  // write paths to sheet
  writeToSheet(
    "Find Path",
    FINAL_ITEM,
    GUARANTEED_ITEMS,
    path_prob,
    path_prob_aspect,
    path_cost,
    path_cost_aspect
  );
}

// trigger run from script
function onEdit(e) {
  if (e && e.source && e.range) {
    var sheet = e.source.getActiveSheet();
    if (sheet.getName() === "Find Path") {
      var range = e.range;
      if (range.getA1Notation() === "C25") {
        // Check if the value is TRUE
        if (range.getValue() === true) {
          run();
          sheet.getRange("C25").setValue(false);
        }
      }
    }
  }
}
