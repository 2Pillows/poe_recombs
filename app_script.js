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

  const baseCost = parseFloat(sheet.getRange("C7").getValue());
  const aspectCost = parseFloat(sheet.getRange("C8").getValue());
  const annulCost = parseFloat(sheet.getRange("C9").getValue());

  const eldritchItem = sheet.getRange("C11").getValue();
  const oneModMagic = sheet.getRange("C12").getValue();

  var guaranteedItems = {
    "2p/0s": sheet.getRange("C15").getValue(),
    "1p/1s": sheet.getRange("C16").getValue(),
    "0p/2s": sheet.getRange("C17").getValue(),
    "3p/0s": sheet.getRange("C18").getValue(),
    "2p/1s": sheet.getRange("C19").getValue(),
    "1p/2s": sheet.getRange("C20").getValue(),
    "0p/3s": sheet.getRange("C21").getValue(),
    "3p/1s": sheet.getRange("C22").getValue(),
    "2p/2s": sheet.getRange("C23").getValue(),
    "1p/3s": sheet.getRange("C24").getValue(),
    "3p/2s": sheet.getRange("C25").getValue(),
    "2p/3s": sheet.getRange("C26").getValue(),
  };

  guaranteedItems = Object.keys(guaranteedItems)
    .filter((key) => guaranteedItems[key] >= 1)
    .reduce((obj, key) => {
      obj[key] = guaranteedItems[key];
      return obj;
    }, {});
  // always guaranteed items
  guaranteedItems["1p/0s"] = 9999999;
  guaranteedItems["0p/1s"] = 9999999;

  return {
    finalItem,
    baseCost,
    aspectCost,
    eldritchItem,
    guaranteedItems,
    annulCost,
    oneModMagic,
  };
}

// Calculate best paths to get to final item according to params
function getGuaranteedPath(
  recombDict,
  FINAL_ITEM,
  BASE_COST,
  ASPECT_COST,
  ANNUL_COST,
  ONE_MOD_MAGIC,
  GUARANTEED_ITEMS,
  sortProb,
  sortCost,
  allowAspect
) {
  // explore paths for target item
  function guaranteedDfs(guaranteedItems, targetItem, curPath) {
    // Skip if not in recomb dict
    if (!(targetItem in recombDict)) {
      return;
    }

    let bestPath = {
      feederItems: [],
      exclusiveMods: "",
      cost: Infinity,
      prob: -Infinity,
      pathProb: -Infinity,
      pathCost: Infinity,
    };

    // Process all recombinations for the target item
    for (const recomb of recombDict[targetItem]) {
      var {
        Item1: item1,
        Item2: item2,
        Exclusive: exclusive,
        Prob: probability,
        Multimods: multimodsUsed,
        "Eldritch Annuls": annulsUsed,
        "Aspect Suffix Count": aspectSuffixCount,
        "Desired Suffixes": totalDesiredSuffixes,
        "Magic Multimods": magicMultiMods,
        "Magic Item Used": magicItemUsed,
      } = recomb;
      probability = parseFloat(probability);
      multimodsUsed = parseFloat(multimodsUsed);
      aspectSuffixCount = parseFloat(aspectSuffixCount);
      annulsUsed = parseFloat(annulsUsed);
      totalDesiredSuffixes = parseFloat(totalDesiredSuffixes);
      magicMultiMods =
        magicMultiMods === "inf" ? Infinity : parseFloat(magicMultiMods);
      magicItemUsed = magicItemUsed.toLowerCase() === "true";

      // skip if has aspect and cant include
      if (!allowAspect && aspectSuffixCount > 0) continue;

      // if one mod must be magic, is one mod, and isn't magic then skip
      valid_magic = ONE_MOD_MAGIC && magicItemUsed;
      if (valid_magic && magicMultiMods == Infinity) continue;

      let multiModsRequired = multimodsUsed;
      if (valid_magic) multiModsRequired = magicMultiMods;

      // Guaranteed items for current final item
      // reach recomb has same starting amount of guaranteed items from dfs call
      let availGuaranteed = JSON.parse(JSON.stringify(guaranteedItems));

      // assume paths are guar
      let item1Path = { pathProb: 1, pathCost: BASE_COST, path: [] };
      let item2Path = { pathProb: 1, pathCost: BASE_COST, path: [] };

      // check if item1 and item2 are guar, decrease count if so
      let item1Guar = false;
      let item2Guar = false;
      if (availGuaranteed[item1] > 0) {
        availGuaranteed[item1] -= 1;
        item1Guar = true;
      }

      if (availGuaranteed[item2] > 0) {
        availGuaranteed[item2] -= 1;
        item2Guar = true;
      }

      // if not guar, explore paths
      if (!item1Guar) {
        item1Path = { pathProb: 0, pathCost: 0, path: [] };
        guaranteedDfs(availGuaranteed, item1, item1Path);
      }

      if (!item2Guar) {
        item2Path = { pathProb: 0, pathCost: 0, path: [] };
        guaranteedDfs(availGuaranteed, item2, item2Path);
      }

      // recomb cost is nothing, unless guaranteed, then risking base
      let benchCost = 0;
      if (multiModsRequired > 0) benchCost += multiModsRequired * 2;
      if (aspectSuffixCount > 0 && totalDesiredSuffixes === 0) benchCost += 1;
      benchCost += aspectSuffixCount * ASPECT_COST;
      if (annulsUsed > 0) benchCost += annulsUsed * ANNUL_COST;
      recombCost = (benchCost + BASE_COST) / probability;

      // get prob of current item in path
      let curPathProb =
        item1Path["pathProb"] * item2Path["pathProb"] * probability;

      // get cost of current item in path
      let curPathCost =
        (benchCost + (item1Path["pathCost"] + item2Path["pathCost"]) / 2) /
        probability;

      // set as path if sort by prob and highest prob, or sort by cost and lowest cost
      if (
        (sortProb && curPathProb >= bestPath["pathProb"]) ||
        (sortCost && curPathCost <= bestPath["pathCost"])
      ) {
        // always update if is "better" or is cheaper
        if (
          (sortProb && curPathProb > bestPath["pathProb"]) ||
          (sortCost && curPathCost < bestPath["pathCost"]) ||
          curPathCost < bestPath["pathCost"]
        ) {
          let curPathItems = [...item1Path["path"], ...item2Path["path"]];
          curPathItems.push({
            final: targetItem,
            feeder: item2 + " + " + item1,
            exclusive: exclusive,
            cost: recombCost,
            prob: probability,
          });
          bestPath = {
            item1: item1,
            item2: item2,
            pathProb: curPathProb,
            pathCost: curPathCost,
            path: curPathItems,
          };
        }
      }
      // }
    }

    // set path to best path found
    curPath["pathProb"] = bestPath["pathProb"];
    curPath["pathCost"] = bestPath["pathCost"];
    curPath["path"].push(...bestPath["path"]);

    // remove from guar if either item is used
    if (guaranteedItems[bestPath["item1"]] > 0) {
      guaranteedItems[bestPath["item1"]] -= 1;
    }

    if (guaranteedItems[bestPath["item2"]] > 0) {
      guaranteedItems[bestPath["item2"]] -= 1;
    }
  }

  // start exploring paths
  let guarFinalPath = { pathProb: 0, pathCost: 0, path: [] };
  guaranteedDfs(GUARANTEED_ITEMS, FINAL_ITEM, guarFinalPath);

  // return best path
  return guarFinalPath;
}

// Calculate best paths to get to final item according to params
function getPath(
  recombDict,
  FINAL_ITEM,
  BASE_COST,
  ASPECT_COST,
  ANNUL_COST,
  ONE_MOD_MAGIC,
  GUARANTEED_ITEMS,
  sortProb,
  sortCost,
  allowAspect
) {
  pathDetails = {
    "0p/1s": { pathProb: 1, pathCost: BASE_COST, path: [] },
    "1p/0s": { pathProb: 1, pathCost: BASE_COST, path: [] },
  };

  // explore paths for target item
  function dfs(targetItem, visited) {
    // Skip if not in recomb dict
    if (visited.has(targetItem) || !(targetItem in recombDict)) {
      return;
    }

    visited.add(targetItem);

    let bestPath = {
      feederItems: [],
      exclusiveMods: "",
      cost: Infinity,
      prob: -Infinity,
      pathProb: -Infinity,
      pathCost: Infinity,
    };

    // Process all recombinations for the target item
    for (const recomb of recombDict[targetItem]) {
      var {
        Item1: item1,
        Item2: item2,
        Exclusive: exclusive,
        Prob: probability,
        Multimods: multimodsUsed,
        "Eldritch Annuls": annulsUsed,
        "Aspect Suffix Count": aspectSuffixCount,
        "Desired Suffixes": totalDesiredSuffixes,
        "Magic Multimods": magicMultiMods,
        "Magic Item Used": magicItemUsed,
      } = recomb;
      probability = parseFloat(probability);
      multimodsUsed = parseFloat(multimodsUsed);
      aspectSuffixCount = parseFloat(aspectSuffixCount);
      annulsUsed = parseFloat(annulsUsed);
      totalDesiredSuffixes = parseFloat(totalDesiredSuffixes);
      magicMultiMods =
        magicMultiMods === "inf" ? Infinity : parseFloat(magicMultiMods);
      magicItemUsed = magicItemUsed.toLowerCase() === "true";

      // skip if has aspect and cant include
      if (!allowAspect && aspectSuffixCount > 0) continue;

      // if one mod must be magic, is one mod, and isn't magic then skip
      valid_magic = ONE_MOD_MAGIC && magicItemUsed;
      if (valid_magic && magicMultiMods == Infinity) continue;

      let multiModsRequired = multimodsUsed;
      if (valid_magic) multiModsRequired = magicMultiMods;

      // explore path if haven't yet
      if (!visited.has(item1)) {
        dfs(item1, visited);
      }

      if (!visited.has(item2)) {
        dfs(item2, visited);
      }

      item1Path = pathDetails[item1];
      item2Path = pathDetails[item2];

      // recomb cost is nothing, unless guaranteed, then risking base
      let benchCost = 0;
      if (multiModsRequired > 0) benchCost += multiModsRequired * 2;
      if (aspectSuffixCount > 0 && totalDesiredSuffixes === 0) benchCost += 1;
      benchCost += aspectSuffixCount * ASPECT_COST;
      if (annulsUsed > 0) benchCost += annulsUsed * ANNUL_COST;
      recombCost = (benchCost + BASE_COST) / probability;

      // get prob of current item in path
      let curPathProb =
        item1Path["pathProb"] * item2Path["pathProb"] * probability;

      // get cost of current item in path
      let curPathCost =
        (benchCost + (item1Path["pathCost"] + item2Path["pathCost"]) / 2) /
        probability;

      // set as path if sort by prob and highest prob, or sort by cost and lowest cost
      if (
        (sortProb && curPathProb >= bestPath["pathProb"]) ||
        (sortCost && curPathCost <= bestPath["pathCost"])
      ) {
        // always update if is "better" or is cheaper
        if (
          (sortProb && curPathProb > bestPath["pathProb"]) ||
          (sortCost && curPathCost < bestPath["pathCost"]) ||
          curPathCost < bestPath["pathCost"]
        ) {
          let curPathItems = [...item1Path["path"], ...item2Path["path"]];
          curPathItems.push({
            final: targetItem,
            feeder: item2 + " + " + item1,
            exclusive: exclusive,
            cost: recombCost,
            prob: probability,
          });
          bestPath = {
            item1: item1,
            item2: item2,
            pathProb: curPathProb,
            pathCost: curPathCost,
            path: curPathItems,
          };
        }
      }
      // }
    }

    // add to pathDetails
    pathDetails[targetItem] = bestPath;
  }

  // start exploring paths
  dfs(FINAL_ITEM, new Set());

  // return best path
  return pathDetails[FINAL_ITEM];
}

// write all paths to final item
function writeToSheet(
  sheetName,
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
  sheet.getRange("G24").setValue(path_prob["pathCost"].toFixed(2));
  sheet
    .getRange("I24")
    .setValue((path_prob["pathProb"] * 100).toFixed(2) + "%");
  writeDataToSheet(sheet, path_prob["path"], "E4");

  // Path probability with aspect
  sheet.getRange("M24").setValue(path_prob_aspect["pathCost"].toFixed(2));
  sheet
    .getRange("O24")
    .setValue((path_prob_aspect["pathProb"] * 100).toFixed(2) + "%");
  writeDataToSheet(sheet, path_prob_aspect["path"], "K4");

  // Path cost
  sheet.getRange("G48").setValue(path_cost["pathCost"].toFixed(2));
  sheet
    .getRange("I48")
    .setValue((path_cost["pathProb"] * 100).toFixed(2) + "%");
  writeDataToSheet(sheet, path_cost["path"], "E28");

  // Path cost with aspect
  sheet.getRange("M48").setValue(path_cost_aspect["pathCost"].toFixed(2));
  sheet
    .getRange("O48")
    .setValue((path_cost_aspect["pathProb"] * 100).toFixed(2) + "%");
  writeDataToSheet(sheet, path_cost_aspect["path"], "K28");
}

// write data to sheet section
function writeDataToSheet(sheet, pathData, startCell) {
  // reverse path order, final item to starting
  pathData = pathData.reverse();
  const pathArray = pathData.map((obj) => [
    obj.final,
    obj.feeder,
    obj.exclusive,
    obj.cost.toFixed(2),
    obj.prob,
  ]);

  var numRows = pathArray.length;
  var numCols = pathArray[0].length;

  var range = sheet.getRange(startCell).offset(0, 0, numRows, numCols);

  range.setValues(pathArray);
}

// main script
function run() {
  pathOptions = getPathOptions("Find Path");
  const BASE_COST = pathOptions.baseCost;
  const ASPECT_COST = pathOptions.aspectCost;
  const FINAL_ITEM = pathOptions.finalItem;
  const ELDTRICH_ITEM = pathOptions.eldritchItem;
  const GUARANTEED_ITEMS = pathOptions.guaranteedItems;
  const ANNUL_COST = pathOptions.annulCost;
  const ONE_MOD_MAGIC = pathOptions.oneModMagic;

  recombDict = getRecombData("Recombs for Script", ELDTRICH_ITEM);

  // 2 always guaranteed
  if (Object.keys(GUARANTEED_ITEMS).length > 2) {
    let path_prob = getGuaranteedPath(
      JSON.parse(JSON.stringify(recombDict)),
      FINAL_ITEM,
      BASE_COST,
      ASPECT_COST,
      ANNUL_COST,
      ONE_MOD_MAGIC,
      JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
      (sortProb = true),
      (sortCost = false),
      (allowAspect = false)
    );

    let path_prob_aspect = getGuaranteedPath(
      JSON.parse(JSON.stringify(recombDict)),
      FINAL_ITEM,
      BASE_COST,
      ASPECT_COST,
      ANNUL_COST,
      ONE_MOD_MAGIC,
      JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
      (sortProb = true),
      (sortCost = false),
      (allowAspect = true)
    );
    let path_cost = getGuaranteedPath(
      JSON.parse(JSON.stringify(recombDict)),
      FINAL_ITEM,
      BASE_COST,
      ASPECT_COST,
      ANNUL_COST,
      ONE_MOD_MAGIC,
      JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
      (sortProb = false),
      (sortCost = true),
      (allowAspect = false)
    );
    let path_cost_aspect = getGuaranteedPath(
      JSON.parse(JSON.stringify(recombDict)),
      FINAL_ITEM,
      BASE_COST,
      ASPECT_COST,
      ANNUL_COST,
      ONE_MOD_MAGIC,
      JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
      (sortProb = false),
      (sortCost = true),
      (allowAspect = true)
    );
    // write paths to sheet
    writeToSheet(
      "Find Path",
      path_prob,
      path_prob_aspect,
      path_cost,
      path_cost_aspect
    );
  } else {
    let path_prob = getPath(
      JSON.parse(JSON.stringify(recombDict)),
      FINAL_ITEM,
      BASE_COST,
      ASPECT_COST,
      ANNUL_COST,
      ONE_MOD_MAGIC,
      JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
      (sortProb = true),
      (sortCost = false),
      (allowAspect = false)
    );
    let path_prob_aspect = getPath(
      JSON.parse(JSON.stringify(recombDict)),
      FINAL_ITEM,
      BASE_COST,
      ASPECT_COST,
      ANNUL_COST,
      ONE_MOD_MAGIC,
      JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
      (sortProb = true),
      (sortCost = false),
      (allowAspect = true)
    );
    let path_cost = getPath(
      JSON.parse(JSON.stringify(recombDict)),
      FINAL_ITEM,
      BASE_COST,
      ASPECT_COST,
      ANNUL_COST,
      ONE_MOD_MAGIC,
      JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
      (sortProb = false),
      (sortCost = true),
      (allowAspect = false)
    );
    let path_cost_aspect = getPath(
      JSON.parse(JSON.stringify(recombDict)),
      FINAL_ITEM,
      BASE_COST,
      ASPECT_COST,
      ANNUL_COST,
      ONE_MOD_MAGIC,
      JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
      (sortProb = false),
      (sortCost = true),
      (allowAspect = true)
    );
    // write paths to sheet
    writeToSheet(
      "Find Path",
      path_prob,
      path_prob_aspect,
      path_cost,
      path_cost_aspect
    );
  }
}

// trigger run from script
function onEdit(e) {
  if (e && e.source && e.range) {
    var sheet = e.source.getActiveSheet();
    if (sheet.getName() === "Find Path") {
      var range = e.range;
      if (range.getA1Notation() === "C28") {
        // Check if the value is TRUE
        if (range.getValue() === true) {
          run();
          sheet.getRange("C28").setValue(false);
        }
      }
    }
  }
}
