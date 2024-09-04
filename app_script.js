// app_script.js
// app script used for sheet

// Get detailed paths from the sheet
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

  // Final item in path
  const finalItemValues = sheet
    .getRange("C4")
    .setNumberFormat("@STRING@")
    .getValue();
  const [a, b] = finalItemValues.split("/");
  const finalItem = `${a}p/${b}s`;

  // Costs for path
  const baseCost = parseFloat(sheet.getRange("C6").getValue());
  const aspectCost = parseFloat(sheet.getRange("C7").getValue());

  // If item is eldritch for aspect annul
  const eldritchItem = sheet.getRange("C9").getValue();

  // If have 1 copy of item already
  const guaranteedItemOne = {
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

  // If have 1 copy of item already
  const guaranteedItemTwo = {
    "2p/0s": sheet.getRange("D12").getValue(),
    "1p/1s": sheet.getRange("D13").getValue(),
    "0p/2s": sheet.getRange("D14").getValue(),
    "3p/0s": sheet.getRange("D15").getValue(),
    "2p/1s": sheet.getRange("D16").getValue(),
    "1p/2s": sheet.getRange("D17").getValue(),
    "0p/3s": sheet.getRange("D18").getValue(),
    "3p/1s": sheet.getRange("D19").getValue(),
    "2p/2s": sheet.getRange("D20").getValue(),
    "1p/3s": sheet.getRange("D21").getValue(),
    "3p/2s": sheet.getRange("D22").getValue(),
    "2p/3s": sheet.getRange("D23").getValue(),
  };

  // Consolidate guaranteed items to "item": count
  const guaranteedItems = {};
  Object.keys(guaranteedItemOne).forEach((key) => {
    const valueOne = guaranteedItemOne[key];
    const valueTwo = guaranteedItemTwo[key];

    if (valueOne === true && valueTwo === true) {
      guaranteedItems[key] = 2;
    } else if (valueOne === true || valueTwo === true) {
      guaranteedItems[key] = 1;
    }
  });

  return {
    finalItem,
    baseCost,
    aspectCost,
    eldritchItem,
    // hideAspect,
    guaranteedItems,
  };
}

// Calculate best paths for best path according to params
function getPaths(
  recombDict,
  BASE_COST,
  ASPECT_COST,
  GUARANTEED_ITEMS,
  sortProb,
  sortCost,
  allowAspect
) {
  // guaranteed item path
  var guaranteedItem = {
    pathProb: 1,
    pathCost: 0,
    recomb: null,
  };

  // Create best paths, add guaranteed items
  var bestPaths = {};
  bestPaths["0p/0s"] = guaranteedItem;
  bestPaths["1p/0s"] = guaranteedItem;
  bestPaths["0p/1s"] = guaranteedItem;

  // For given final item, find the best path
  // Need past final items to avoid cycle
  function findFinalItemPaths(finalItem, pastFinalItems) {
    var bestCombination = bestPaths[finalItem];
    var minCost = bestCombination ? bestCombination.pathCost : Infinity;
    var maxProb = bestCombination ? bestCombination.pathProb : -Infinity;

    const recombs = recombDict[finalItem];

    for (const recomb of recombs) {
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

      let recombCost = BASE_COST;
      recombCost += multimodsUsed * 2;
      // lock prefix
      if (aspectSuffixCount > 0 && totalDesiredSuffixes === 0) {
        recombCost += 1;
      }
      recombCost += aspectSuffixCount * ASPECT_COST;
      recomb.recombCost = recombCost / probability;

      if (!bestPaths[item1]) {
        if (pastFinalItems.has(item1)) continue;
        pastFinalItems.add(item1);
        findFinalItemPaths(item1, pastFinalItems);
      }

      if (!bestPaths[item2]) {
        if (pastFinalItems.has(item2)) continue;
        pastFinalItems.add(item2);
        findFinalItemPaths(item2, pastFinalItems);
      }

      var item1Prob = parseFloat(bestPaths[item1].pathProb);
      var item2Prob = parseFloat(bestPaths[item2].pathProb);

      var item1Cost = parseFloat(bestPaths[item1].pathCost);
      var item2Cost = parseFloat(bestPaths[item2].pathCost);

      // If both items same, need 2 guaranteed
      // Otherwise need only 1 guaranteed for both
      if (item1 === item2 && GUARANTEED_ITEMS[item1] === 2) {
        item1Prob = 1;
        item1Cost = 0;
        item2Prob = 1;
        item2Cost = 0;
      } else if (GUARANTEED_ITEMS[item1] === 1) {
        item1Prob = 1;
        item1Cost = 0;
      } else if (GUARANTEED_ITEMS[item2] === 1) {
        item2Prob = 1;
        item2Cost = 0;
      }

      const pathProb = probability * item1Prob * item2Prob;
      const pathCost = recombCost + item1Cost + item2Cost / probability;

      // update best combo if same or better
      if (
        (sortProb && pathProb >= maxProb) ||
        (sortCost && pathCost <= minCost)
      ) {
        // skip if has aspect and cant include
        if (!allowAspect && aspectSuffixCount > 0) continue;

        // if higher, update min and max values for best path
        if (
          (sortProb && pathProb > maxProb) ||
          (sortCost && pathCost < minCost)
        ) {
          maxProb = pathProb;
          minCost = pathCost;

          bestCombination = {
            pathProb: pathProb,
            pathCost: pathCost,
            recomb: recomb,
          };
        }

        // already checked as valid item, update best combo if cheaper or same price and less crafted mods
        else if (
          getAffixCount(exclusive) <
            getAffixCount(bestCombination.recomb.Exclusive) ||
          recombCost < recomb.recombCost
        ) {
          bestCombination = {
            pathProb: pathProb,
            pathCost: pathCost,
            recomb: recomb,
          };
        }
      }
    }

    // add best combo as path
    bestPaths[finalItem] = bestCombination;
  }

  // get best path for each item
  Object.keys(recombDict).forEach((finalItem) => {
    findFinalItemPaths(finalItem, new Set());
  });

  return bestPaths;
}

function getAffixCount(str) {
  let numbers = str.match(/\d+/g);

  let sum = numbers.reduce((acc, num) => acc + parseInt(num), 0);

  return sum;
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

  // Clear specified ranges before writing new data
  sheet.getRange("F4:J12").clearContent();
  sheet.getRange("L4:P12").clearContent();
  sheet.getRange("F17:J25").clearContent();
  sheet.getRange("L17:P25").clearContent();

  // Path probability
  sheet.getRange("H13").setValue(path_prob[FINAL_ITEM].pathCost.toFixed(2));
  sheet
    .getRange("J13")
    .setValue((path_prob[FINAL_ITEM].pathProb * 100).toFixed(2) + "%");
  pathProbData = collectPaths(
    FINAL_ITEM,
    { ...GUARANTEED_ITEMS },
    path_prob,
    new Set()
  );
  writeDataToSheet(sheet, pathProbData, "F4");

  // Path probability with aspect
  sheet
    .getRange("N13")
    .setValue(path_prob_aspect[FINAL_ITEM].pathCost.toFixed(2));
  sheet
    .getRange("P13")
    .setValue((path_prob_aspect[FINAL_ITEM].pathProb * 100).toFixed(2) + "%");
  pathProbAspectData = collectPaths(
    FINAL_ITEM,
    { ...GUARANTEED_ITEMS },
    path_prob_aspect,
    new Set()
  );
  writeDataToSheet(sheet, pathProbAspectData, "L4");

  // Path cost
  sheet.getRange("H26").setValue(path_cost[FINAL_ITEM].pathCost.toFixed(2));
  sheet
    .getRange("JI26")
    .setValue((path_cost[FINAL_ITEM].pathProb * 100).toFixed(2) + "%");
  pathCostData = collectPaths(
    FINAL_ITEM,
    { ...GUARANTEED_ITEMS },
    path_cost,
    new Set()
  );
  writeDataToSheet(sheet, pathCostData, "F17");

  // Path cost with aspect
  sheet
    .getRange("N26")
    .setValue(path_cost_aspect[FINAL_ITEM].pathCost.toFixed(2));
  sheet
    .getRange("P26")
    .setValue((path_cost_aspect[FINAL_ITEM].pathProb * 100).toFixed(2) + "%");
  pathCostAspectData = collectPaths(
    FINAL_ITEM,
    { ...GUARANTEED_ITEMS },
    path_cost_aspect,
    new Set()
  );
  writeDataToSheet(sheet, pathCostAspectData, "L17");
}

function collectPaths(target_item, guaranteed_items, paths, visited_items) {
  // Check if the item has already been visited
  if (visited_items.has(target_item)) {
    return [];
  }

  var path_details = paths[target_item];
  if (!path_details) {
    return [];
  }

  var recomb_details = path_details.recomb;
  if (!recomb_details) {
    return [];
  }

  var feeder_items = recomb_details.Item1 + " + " + recomb_details.Item2;
  var exclusive_mods = recomb_details.Exclusive;
  var cost = recomb_details.recombCost;
  var prob = recomb_details.Prob;

  // add path to row
  var row = [
    target_item,
    feeder_items,
    exclusive_mods,
    cost.toFixed(2),
    (prob * 100).toFixed(2) + "%",
  ];

  // add to visited to avoid cycle
  visited_items.add(target_item);

  // collect paths from item1 and item2
  var rows = [row];
  if (guaranteed_items[recomb_details.Item2]) {
    guaranteed_items[recomb_details.Item2] -= 1;
    if (guaranteed_items[recomb_details.Item2] === 0) {
      delete guaranteed_items[recomb_details.Item2];
    }
  } else {
    rows = rows.concat(
      collectPaths(recomb_details.Item2, guaranteed_items, paths, visited_items)
    );
  }

  if (guaranteed_items[recomb_details.Item1]) {
    guaranteed_items[recomb_details.Item1] -= 1;
    if (guaranteed_items[recomb_details.Item1] === 0) {
      delete guaranteed_items[recomb_details.Item1];
    }
  } else {
    rows = rows.concat(
      collectPaths(recomb_details.Item1, guaranteed_items, paths, visited_items)
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

// main script
function run() {
  pathOptions = getPathOptions("Find Path");
  const BASE_COST = pathOptions.baseCost;
  const ASPECT_COST = pathOptions.aspectCost;
  const FINAL_ITEM = pathOptions.finalItem;
  const ELDTRICH_ITEM = pathOptions.eldritchItem;
  const GUARANTEED_ITEMS = pathOptions.guaranteedItems;

  recombDict = getRecombData("Recombs for Script", ELDTRICH_ITEM);

  // get paths
  path_prob = getPaths(
    recombDict,
    BASE_COST,
    ASPECT_COST,
    GUARANTEED_ITEMS,
    (sortProb = true),
    (sortCost = false),
    (allowAspect = false)
  );
  path_prob_aspect = getPaths(
    recombDict,
    BASE_COST,
    ASPECT_COST,
    GUARANTEED_ITEMS,
    (sortProb = true),
    (sortCost = false),
    (allowAspect = true)
  );
  path_cost = getPaths(
    recombDict,
    BASE_COST,
    ASPECT_COST,
    GUARANTEED_ITEMS,
    (sortProb = false),
    (sortCost = true),
    (allowAspect = false)
  );
  path_cost_aspect = getPaths(
    recombDict,
    BASE_COST,
    ASPECT_COST,
    GUARANTEED_ITEMS,
    (sortProb = false),
    (sortCost = true),
    (allowAspect = true)
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
