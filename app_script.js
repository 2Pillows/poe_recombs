// app_script.js
// app script used for sheet

// main script
function run() {
  pathOptions = getPathOptions("Find Path");
  const BASE_COST = pathOptions.baseCost;
  const MOD_ROLLING = pathOptions.modRolling;
  const ASPECT_COST = pathOptions.aspectCost;
  const FINAL_ITEM = pathOptions.finalItem;
  const ELDTRICH_ITEM = pathOptions.eldritchItem;
  const GUARANTEED_ITEMS = pathOptions.guaranteedItems;
  const ANNUL_COST = pathOptions.annulCost;
  const ALL_RARE_ITEMS = pathOptions.allRareItems;

  recombDict = getRecombData("Recombs for Script", ELDTRICH_ITEM);

  // 2 always guaranteed

  let path_prob = getPath(
    JSON.parse(JSON.stringify(recombDict)),
    FINAL_ITEM,
    BASE_COST,
    MOD_ROLLING,
    ASPECT_COST,
    ANNUL_COST,
    ALL_RARE_ITEMS,
    JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
    (sortProb = true),
    (sortCost = false),
    (allowAspect = false)
  );
  let path_prob_aspect = getPath(
    JSON.parse(JSON.stringify(recombDict)),
    FINAL_ITEM,
    BASE_COST,
    MOD_ROLLING,
    ASPECT_COST,
    ANNUL_COST,
    ALL_RARE_ITEMS,
    JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
    (sortProb = true),
    (sortCost = false),
    (allowAspect = true)
  );
  let path_cost = getPath(
    JSON.parse(JSON.stringify(recombDict)),
    FINAL_ITEM,
    BASE_COST,
    MOD_ROLLING,
    ASPECT_COST,
    ANNUL_COST,
    ALL_RARE_ITEMS,
    JSON.parse(JSON.stringify(GUARANTEED_ITEMS)),
    (sortProb = false),
    (sortCost = true),
    (allowAspect = false)
  );
  let path_cost_aspect = getPath(
    JSON.parse(JSON.stringify(recombDict)),
    FINAL_ITEM,
    BASE_COST,
    MOD_ROLLING,
    ASPECT_COST,
    ANNUL_COST,
    ALL_RARE_ITEMS,
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

// Get detailed paths from the sheet
// Has each recomb for any final item
function getRecombData(sheetName, ELDTRICH_ITEM) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  var column = ELDTRICH_ITEM ? "D" : "B";
  var data = sheet.getRange(column + "5:" + column).getValues();

  var recombDict = {};

  var finalItem = "";

  for (var i = 0; i < data.length; i++) {
    var cellValue = data[i][0].trim();

    if (
      cellValue !== "" &&
      cellValue.indexOf("-") === -1 &&
      cellValue.indexOf("Item1:") === -1
    ) {
      finalItem = cellValue;
      recombDict[finalItem] = [];
    } else if (cellValue.indexOf("Item1:") !== -1) {
      dict = {};

      pairs = cellValue.split(", ");
      for (var j = 0; j < pairs.length; j++) {
        var pair = pairs[j].split(": ");
        var key = pair[0];
        var value = pair[1];
        dict[key] = value;
      }

      recombDict[finalItem].push(dict);
    }
  }

  let parsedRecombDict = parseRecombDict(recombDict);

  return parsedRecombDict;
}

function parseRecombDict(recombDict) {
  const parsedRecombDict = {};

  for (const targetItem in recombDict) {
    parsedRecombDict[targetItem] = recombDict[targetItem].map((recomb) => ({
      ...recomb,
      Prob: parseFloat(recomb.Prob),
      Multimods: parseFloat(recomb.Multimods),
      "Aspect Suffix Count": parseFloat(recomb["Aspect Suffix Count"]),
      "Eldritch Annuls": parseFloat(recomb["Eldritch Annuls"]),
      "Item1 Annul Prob": parseFloat(recomb["Item1 Annul Prob"]),
      "Item2 Annul Prob": parseFloat(recomb["Item2 Annul Prob"]),
    }));
  }

  return parsedRecombDict;
}

// Get path options and guaranteed items from sheet
function getPathOptions(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const finalItemValues = sheet
    .getRange("D4")
    .setNumberFormat("@STRING@")
    .getValue();
  const [a, b] = finalItemValues.split("/");
  const finalItem = `${a}p/${b}s`;

  const baseCost = parseFloat(sheet.getRange("D7").getValue());
  const modRolling = parseFloat(sheet.getRange("D8").getValue());
  const aspectCost = parseFloat(sheet.getRange("D9").getValue());
  const annulCost = parseFloat(sheet.getRange("D10").getValue());

  const eldritchItem = sheet.getRange("D13").getValue();
  const allRareItems = sheet.getRange("D14").getValue();

  var guaranteedItemsCount = {
    "2p/0s": sheet.getRange("C18").getValue(),
    "1p/1s": sheet.getRange("C19").getValue(),
    "0p/2s": sheet.getRange("C20").getValue(),
    "3p/0s": sheet.getRange("C21").getValue(),
    "2p/1s": sheet.getRange("C22").getValue(),
    "1p/2s": sheet.getRange("C23").getValue(),
    "0p/3s": sheet.getRange("C24").getValue(),
    "3p/1s": sheet.getRange("C25").getValue(),
    "2p/2s": sheet.getRange("C26").getValue(),
    "1p/3s": sheet.getRange("C27").getValue(),
    "3p/2s": sheet.getRange("C28").getValue(),
    "2p/3s": sheet.getRange("C29").getValue(),
  };
  var guaranteedItemsCost = {
    "2p/0s": sheet.getRange("D18").getValue(),
    "1p/1s": sheet.getRange("D19").getValue(),
    "0p/2s": sheet.getRange("D20").getValue(),
    "3p/0s": sheet.getRange("D21").getValue(),
    "2p/1s": sheet.getRange("D22").getValue(),
    "1p/2s": sheet.getRange("D23").getValue(),
    "0p/3s": sheet.getRange("D24").getValue(),
    "3p/1s": sheet.getRange("D25").getValue(),
    "2p/2s": sheet.getRange("D26").getValue(),
    "1p/3s": sheet.getRange("D27").getValue(),
    "3p/2s": sheet.getRange("D28").getValue(),
    "2p/3s": sheet.getRange("D29").getValue(),
  };

  let guaranteedItems = {};
  for (const key in guaranteedItemsCount) {
    keyCount = guaranteedItemsCount[key];
    keyCost = guaranteedItemsCost[key];

    if (keyCount === "" || keyCost === "" || keyCount === 0 || keyCost === 0)
      continue;

    guaranteedItems[key] = {
      count: keyCount,
      cost: keyCost,
    };
  }

  // always guaranteed items
  guaranteedItems["1p/0s"] = {
    count: 9999999999,
    cost: baseCost,
  };
  guaranteedItems["0p/1s"] = {
    count: 9999999999,
    cost: baseCost,
  };

  return {
    finalItem,
    baseCost,
    modRolling,
    aspectCost,
    eldritchItem,
    guaranteedItems,
    annulCost,
    allRareItems,
  };
}

function getPrepItemsCost(
  multimodsUsed,
  aspectSuffixCount,
  ASPECT_COST,
  targetSuffixCount,
  eldritchAnnulsUsed,
  ANNUL_COST,
  MOD_ROLLING,
  item1AnnulProb,
  item2AnnulProb,
  ALL_RARE_ITEMS
) {
  // recomb cost is nothing, unless guaranteed, then risking base
  let benchCost = 0;
  if (multimodsUsed > 0) benchCost += multimodsUsed * 2;
  if (aspectSuffixCount > 0 && targetSuffixCount === 0) benchCost += 1;
  benchCost += aspectSuffixCount * ASPECT_COST;
  if (eldritchAnnulsUsed > 0) benchCost += eldritchAnnulsUsed * ANNUL_COST;

  // cost of getting 1 mod item
  // assume just mod rolling, no need to annul
  let modRollingCost = 0;
  // if item isn't one mod and requires an annul, then adjust mod rolling
  if (!ALL_RARE_ITEMS) {
    if (item1AnnulProb > 0) modRollingCost += MOD_ROLLING / item1AnnulProb;
    if (item2AnnulProb > 0) modRollingCost += MOD_ROLLING / item2AnnulProb;
  }

  return benchCost + modRollingCost / 2;
}

function getAffixCount(itemString) {
  const match = itemString.match(/(\d+)p\/(\d+)s/);

  return [parseInt(match[1]), parseInt(match[2])];
}

function checkGuaranteedItem(item, availGuaranteed) {
  isGuaranteed = false;

  if (item in availGuaranteed && availGuaranteed[item]["count"] > 0) {
    availGuaranteed[item]["count"] -= 1;
    isGuaranteed = true;
  }

  return isGuaranteed;
}

// Calculate best paths to get to final item according to params
function getGuaranteedPath(
  pathDetails,
  recombDict,
  FINAL_ITEM,
  BASE_COST,
  MOD_ROLLING,
  ASPECT_COST,
  ANNUL_COST,
  ALL_RARE_ITEMS,
  GUARANTEED_ITEMS,
  sortProb,
  sortCost,
  allowAspect
) {
  const [finalPrefixCount, finalSuffixCount] = getAffixCount(FINAL_ITEM);

  function getItemPath(
    BASE_COST,
    isGuaranteed,
    availGuaranteed,
    item,
    pathDetails
  ) {
    // assume paths are guar
    let itemPath = {
      pathProb: 1,
      pathCost: BASE_COST,
      path: [],
    };

    // if not guar, explore paths
    if (!isGuaranteed) {
      // if a guaranteed item can be used, explore path
      // needs to have guaranteed item with less prefixes and less suffixes
      // check all guar items, if any has less prefixes and less suffixes, then do guarDfs
      let validGuarItems = false;
      for (let guarItem in availGuaranteed) {
        if (availGuaranteed[guarItem]["count"] <= 0) continue;
        if (guarItem === "1p/0s" || guarItem === "0p/1s") continue;
        const [guarPrefixCount, guarSuffixCount] = getAffixCount(guarItem);
        const [itemPrefixCount, itemSuffixCount] = getAffixCount(item);
        if (
          guarPrefixCount <= itemPrefixCount &&
          guarSuffixCount <= itemSuffixCount
        ) {
          validGuarItems = true;
        }
      }

      if (validGuarItems) {
        itemPath["pathProb"] = -Infinity;
        itemPath["pathCost"] = Infinity;
        guaranteedDfs(availGuaranteed, item, itemPath);
      }
      // no guarantee can be used, grab basic path
      else {
        itemPath = pathDetails[item];
      }
    }
    // item is guaranteed
    else {
      itemPath["pathCost"] = availGuaranteed[item]["cost"];
    }

    return itemPath;
  }

  // explore paths for target item
  function guaranteedDfs(guaranteedItems, targetItem, curPath) {
    const [targetPrefixCount, targetSuffixCount] = getAffixCount(targetItem);

    // Skip if not in recomb dict or has too many affixes
    if (
      !(targetItem in recombDict) ||
      targetPrefixCount > finalPrefixCount ||
      targetSuffixCount > finalSuffixCount
    ) {
      return;
    }

    let bestPath = {
      item1: "",
      item2: "",
      pathProb: -Infinity,
      pathCost: Infinity,
      path: [],
    };

    // Process all recombinations for the target item
    for (const recomb of recombDict[targetItem]) {
      let {
        Item1: item1,
        Item2: item2,
        Exclusive: exclusive,
        Prob: prob,
        Multimods: multimodsUsed,
        "Eldritch Annuls": eldritchAnnulsUsed,
        "Aspect Suffix Count": aspectSuffixCount,
        "Item1 Annul Prob": item1AnnulProb,
        "Item2 Annul Prob": item2AnnulProb,
      } = recomb;

      // skip if has aspect and cant include
      if (!allowAspect && aspectSuffixCount > 0) continue;

      // Guaranteed items for current final item
      // reach recomb has same starting amount of guaranteed items from dfs call
      let availGuaranteed = JSON.parse(JSON.stringify(guaranteedItems));

      // check if item1 and item2 are guar, decrease count if so
      let item1Guar = checkGuaranteedItem(item1, availGuaranteed);
      let item2Guar = checkGuaranteedItem(item2, availGuaranteed);

      // assume paths are guar
      let item1Path = getItemPath(
        BASE_COST,
        item1Guar,
        availGuaranteed,
        item1,
        pathDetails
      );
      let item2Path = getItemPath(
        BASE_COST,
        item2Guar,
        availGuaranteed,
        item2,
        pathDetails
      );

      // benchcost + mod rolling cost
      // if item isn't 1p/0s or 0p/1s no mod rolling cost
      let prepItemsCost = getPrepItemsCost(
        multimodsUsed,
        aspectSuffixCount,
        ASPECT_COST,
        targetSuffixCount,
        eldritchAnnulsUsed,
        ANNUL_COST,
        MOD_ROLLING,
        item1AnnulProb,
        item2AnnulProb,
        ALL_RARE_ITEMS
      );

      let recombCost = (BASE_COST + prepItemsCost) / prob;

      // if item needs to be made one mod, factor into prob
      let recombProb = prob;
      if (!ALL_RARE_ITEMS) {
        if (item1AnnulProb > 0) recombProb *= item1AnnulProb;
        if (item2AnnulProb > 0) recombProb *= item2AnnulProb;
      }

      // get prob of current item in path
      let curPathProb =
        item1Path["pathProb"] * item2Path["pathProb"] * recombProb;

      // get cost of current item in path
      let curPathCost =
        (prepItemsCost + (item1Path["pathCost"] + item2Path["pathCost"]) / 2) /
        prob;

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
            cost: curPathCost,
            prob: prob,
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
  MOD_ROLLING,
  ASPECT_COST,
  ANNUL_COST,
  ALL_RARE_ITEMS,
  GUARANTEED_ITEMS,
  sortProb,
  sortCost,
  allowAspect
) {
  const [finalPrefixCount, finalSuffixCount] = getAffixCount(FINAL_ITEM);

  let pathDetails = {
    "0p/1s": { pathProb: 1, pathCost: BASE_COST, path: [] },
    "1p/0s": { pathProb: 1, pathCost: BASE_COST, path: [] },
  };

  // explore paths for target item
  function dfs(targetItem, visited) {
    // Skip if not in recomb dict
    if (visited.has(targetItem) || !(targetItem in recombDict)) {
      return;
    }

    const [targetPrefixCount, targetSuffixCount] = getAffixCount(targetItem);

    if (
      targetPrefixCount > finalPrefixCount ||
      targetSuffixCount > finalSuffixCount
    ) {
      pathDetails[targetItem] = {
        item1: "",
        item2: "",
        pathProb: -Infinity,
        pathCost: Infinity,
        path: [],
      };
      return;
    }

    visited.add(targetItem);

    let bestPath = {
      item1: "",
      item2: "",
      pathProb: -Infinity,
      pathCost: Infinity,
      path: [],
    };

    // Process all recombinations for the target item
    for (const recomb of recombDict[targetItem]) {
      let {
        Item1: item1,
        Item2: item2,
        Exclusive: exclusive,
        Prob: prob,
        Multimods: multimodsUsed,
        "Eldritch Annuls": eldritchAnnulsUsed,
        "Aspect Suffix Count": aspectSuffixCount,
        "Item1 Annul Prob": item1AnnulProb,
        "Item2 Annul Prob": item2AnnulProb,
      } = recomb;

      // skip if has aspect and cant include
      if (!allowAspect && aspectSuffixCount > 0) continue;

      // explore path if haven't yet
      if (!visited.has(item1)) {
        dfs(item1, visited);
      }

      if (!visited.has(item2)) {
        dfs(item2, visited);
      }

      let item1Path = pathDetails[item1];
      let item2Path = pathDetails[item2];

      // benchcost + mod rolling cost
      // if item isn't 1p/0s or 0p/1s no mod rolling cost
      let prepItemsCost = getPrepItemsCost(
        multimodsUsed,
        aspectSuffixCount,
        ASPECT_COST,
        targetSuffixCount,
        eldritchAnnulsUsed,
        ANNUL_COST,
        MOD_ROLLING,
        item1AnnulProb,
        item2AnnulProb,
        ALL_RARE_ITEMS
      );

      let recombCost = (BASE_COST + prepItemsCost) / prob;

      // if item needs to be made one mod, factor into prob
      let recombProb = prob;
      if (!ALL_RARE_ITEMS) {
        if (item1AnnulProb > 0) recombProb *= item1AnnulProb;
        if (item2AnnulProb > 0) recombProb *= item2AnnulProb;
      }

      // get prob of current item in path
      let curPathProb =
        item1Path["pathProb"] * item2Path["pathProb"] * recombProb;

      // get cost of current item in path
      let curPathCost =
        (prepItemsCost + (item1Path["pathCost"] + item2Path["pathCost"]) / 2) /
        prob;

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
            cost: curPathCost,
            prob: prob,
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

  // use getGuaranteedPath if additional guaranteed items
  if (Object.keys(GUARANTEED_ITEMS).length > 2) {
    return getGuaranteedPath(
      pathDetails,
      recombDict,
      FINAL_ITEM,
      BASE_COST,
      MOD_ROLLING,
      ASPECT_COST,
      ANNUL_COST,
      ALL_RARE_ITEMS,
      GUARANTEED_ITEMS,
      sortProb,
      sortCost,
      allowAspect
    );
  }

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
  sheet.getRange("F4:J24").clearContent();
  sheet.getRange("L4:P24").clearContent();
  sheet.getRange("F28:J48").clearContent();
  sheet.getRange("L28:P48").clearContent();

  // Path prob
  writeDataToSheet(sheet, path_prob["path"], "F4");

  // Path prob with aspect
  writeDataToSheet(sheet, path_prob_aspect["path"], "L4");

  // Path cost
  writeDataToSheet(sheet, path_cost["path"], "F28");

  // Path cost with aspect
  writeDataToSheet(sheet, path_cost_aspect["path"], "L28");
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

// trigger run from script
function onEdit(e) {
  if (e && e.source && e.range) {
    var sheet = e.source.getActiveSheet();
    if (sheet.getName() === "Find Path") {
      var range = e.range;
      if (range.getA1Notation() === "D31") {
        // Check if the value is TRUE
        if (range.getValue() === true) {
          run();
          sheet.getRange("D31").setValue(false);
        }
      }
    }
  }
}
