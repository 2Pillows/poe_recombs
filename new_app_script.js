// app_script.js
// script used in google sheet
// WIP, calcs cost using failed items from recomb

// Main function
function run() {
  // Calls getPath with options
  function getPathWithOptions(sortProb, sortCost, allowAspect) {
    return getItemPaths(
      recombDictCopy(),
      pathConfig,
      guaranteedItemsCopy(),
      sortProb,
      sortCost,
      allowAspect
    );
  }

  const pathConfig = getPathConfig("Find Path");

  const recombDict = getRecombDict("Script Recombs", pathConfig.isEldritchItem);

  let recombDictCopy = () => JSON.parse(JSON.stringify(recombDict));
  let guaranteedItemsCopy = () =>
    JSON.parse(JSON.stringify(pathConfig.guaranteedItems));

  // Get paths for each type, (sortProb, sortCost, allowAspect)
  let path_prob = getPathWithOptions(true, false, false);
  let path_prob_aspect = getPathWithOptions(true, false, true);
  let path_cost = getPathWithOptions(false, true, false);
  let path_cost_aspect = getPathWithOptions(false, true, true);

  // Write paths to sheet
  writeToSheet(
    "Find Path",
    path_prob,
    path_prob_aspect,
    path_cost,
    path_cost_aspect
  );
}

const sheetRanges = {
  finalItem: "D4",
  baseCost: "D7",
  modRollingCost: "D8",
  aspectCost: "D9",
  eldritchAnnulCost: "D10",
  isEldritchItem: "D13",
  isOneModRare: "D14",
  guaranteedStart: 18,
  guaranteedCostCol: "D",
  guaranteedAmountCol: "C",
};

// Get dict with all recombs for key final item
function getRecombDict(sheetName, isEldritchItem) {
  // Process dict data
  function processRecombDict(recombDict) {
    // Process failed probabilities into an array of dicts w/ item and prob
    function parseFailedProbs(failedProbsString) {
      return failedProbsString
        .split(") (")
        .map((s) => s.replace(/[()]/g, ""))
        .map((group) => {
          let [item, prob] = group.split(" ");
          return { item: item, prob: parseFloat(prob) };
        });
    }

    const parsedRecombDict = {};

    for (const targetItem in recombDict) {
      parsedRecombDict[targetItem] = recombDict[targetItem].map((recomb) => ({
        ...recomb,
        // Convert string values to floats
        recombProb: parseFloat(recomb.recombProb),
        multimodCount: parseFloat(recomb.multimodCount),
        aspectSuffixCount: parseFloat(recomb.aspectSuffixCount),
        eldritchAnnulCount: parseFloat(recomb.eldritchAnnulCount),
        item1AnnulProb: parseFloat(recomb.item1AnnulProb),
        item2AnnulProb: parseFloat(recomb.item2AnnulProb),
        // Get array for all failed items
        failedItemProbs: parseFailedProbs(recomb.failedItemProbs),
      }));
    }

    return parsedRecombDict;
  }

  // Sheet w/ recomb data
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  // Select column and data for recombDict
  const column = isEldritchItem ? "D" : "B";
  const sheetData = sheet.getRange(`${column}5:${column}`).getValues();

  const recombDict = {};
  let finalItem = "";

  for (let i = 0; i < sheetData.length; i++) {
    let cellValue = sheetData[i][0].trim();

    // Update final item
    if (
      cellValue !== "" &&
      cellValue.indexOf("-") === -1 &&
      cellValue.indexOf(",") === -1
    ) {
      finalItem = cellValue;
      recombDict[finalItem] = [];
    }
    // Add recomb details under final item
    else if (cellValue.indexOf(",") !== -1) {
      let recombDetails = {};

      // Update dict w/ recomb detail
      const detailPairs = cellValue.split(", ");
      detailPairs.forEach((pair) => {
        const [key, value] = pair.split(": ");
        recombDetails[key] = value;
      });

      recombDict[finalItem].push(recombDetails);
    }
  }

  // Process recomb dict to format values
  return processRecombDict(recombDict);
}

// Get path options and guaranteed items from sheet
function getPathConfig(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  // Final item
  const finalItemValues = sheet.getRange(sheetRanges.finalItem).getValue();
  const [prefix, suffix] = finalItemValues.split("/");
  const finalItem = `${prefix}p/${suffix}s`;

  // Costs
  const baseCost = parseFloat(sheet.getRange(sheetRanges.baseCost).getValue());
  const modRollingCost = parseFloat(
    sheet.getRange(sheetRanges.modRollingCost).getValue()
  );
  const aspectCost = parseFloat(
    sheet.getRange(sheetRanges.aspectCost).getValue()
  );
  const annulCost = parseFloat(
    sheet.getRange(sheetRanges.eldritchAnnulCost).getValue()
  );

  // Item conditions
  const isEldritchItem = sheet.getRange(sheetRanges.isEldritchItem).getValue();
  const isOneModRare = sheet.getRange(sheetRanges.isOneModRare).getValue();

  const guaranteedItems = {};
  const guaranteedItemKeys = [
    "0p/2s",
    "0p/3s",
    "1p/1s",
    "1p/2s",
    "1p/3s",
    "2p/0s",
    "2p/1s",
    "2p/2s",
    "2p/3s",
    "3p/0s",
    "3p/1s",
    "3p/2s",
  ];

  for (let i = 0; i < guaranteedItemKeys.length; i++) {
    const row = sheetRanges.guaranteedStart + i;
    const key = guaranteedItemKeys[i];

    const count = parseFloat(
      sheet.getRange(`${sheetRanges.guaranteedAmountCol}${row}`).getValue()
    );
    const cost = parseFloat(
      sheet.getRange(`${sheetRanges.guaranteedCostCol}${row}`).getValue()
    );

    if (count && cost) {
      guaranteedItems[key] = { count, cost };
    }
  }

  // always guaranteed items
  guaranteedItems["1p/0s"] = {
    count: 9999999999,
    cost: 0,
  };
  guaranteedItems["0p/1s"] = {
    count: 9999999999,
    cost: 0,
  };

  return {
    finalItem,
    baseCost,
    modRollingCost,
    aspectCost,
    isEldritchItem,
    guaranteedItems,
    annulCost,
    isOneModRare,
  };
}

function getBenchcraftCost(pathConfig, recombDetails, targetSuffixCount) {
  const { multimodCount, aspectSuffixCount, eldritchAnnulCount } =
    recombDetails;
  const { eldritchAnnulCost, aspectCost } = pathConfig;

  // benchcost includes multimods, aspects, and eldritch annuls
  let benchCost = 0;
  if (multimodCount > 0) {
    benchCost += multimodCount * 2;
  }
  if (aspectSuffixCount > 0) {
    benchCost += aspectSuffixCount * aspectCost;
    // if has apsect and no target suffixes, lock prefix and scour
    if (targetSuffixCount === 0) benchCost += 1;
  }
  if (eldritchAnnulCount > 0) {
    benchCost += eldritchAnnulCount * eldritchAnnulCost;
  }

  return benchCost;
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

function getRecombCost(
  item1,
  item2,
  item1Cost,
  item2Cost,
  allPaths,
  failedItemProbs,
  finalPrefixCount,
  finalSuffixCount,
  targetPrefixCount,
  targetSuffixCount,
  dfsFunction
) {
  // If either item is invalid, invalid item cost
  if (item1Cost == Infinity || item2Cost == Infinity) return Infinity;

  // Both items are lost in recomb
  let totalItemCost = item1Cost + item2Cost;

  // Subtract failed recomb costs from total
  for (let i = 0; i < failedItemProbs.length; i++) {
    let failedItem = failedItemProbs[i]["item"];
    let failedProb = failedItemProbs[i]["prob"];

    let [failedPrefixCount, failedSuffixCount] = getAffixCount(failedItem);

    // Cap affix count if exceed final item
    if (failedPrefixCount > finalPrefixCount) {
      failedPrefixCount = finalPrefixCount;
    }
    if (failedSuffixCount > finalSuffixCount) {
      failedSuffixCount = finalSuffixCount;
    }

    failedItem = `${failedPrefixCount}p/${failedSuffixCount}s`;

    // get failed item cost if haven't explored yet
    if (!allPaths.hasOwnProperty(failedItem)) {
      dfsFunction(failedItem);
    }

    let failedItemCost = 0;
    if (allPaths.hasOwnProperty(failedItem)) {
      failedItemCost = allPaths[failedItem]["pathCost"];
    }

    // if no allPaths[failedItem], its a cycle, remove path cost that has same number of mods
    else {
      const [item1PrefixCount, item1SuffixCount] = getAffixCount(item1);
      const [item2PrefixCount, item2SuffixCount] = getAffixCount(item2);

      const totalFailedAffixes = failedPrefixCount + failedSuffixCount;
      const totalItem1Affixes = item1PrefixCount + item1SuffixCount;
      const totalItem2Affixes = item2PrefixCount + item2SuffixCount;
      const totalTargetAffixes = targetPrefixCount + targetSuffixCount;

      if (
        totalFailedAffixes == totalItem1Affixes &&
        totalFailedAffixes == totalItem2Affixes
      ) {
        failedItemCost = (item1Cost + item2Cost) / 2;
      } else if (totalFailedAffixes == totalItem1Affixes) {
        failedItemCost = item1Cost;
      } else if (totalFailedAffixes == totalItem2Affixes) {
        failedItemCost = item2Cost;
      }
      // If same number of affxies, then no cost
      else if (totalFailedAffixes >= totalTargetAffixes) {
        return 0;
      } else {
        console.log("failed item not accounted for");
      }
    }

    if (failedItemCost == "Infinity") console.log("invalid after");

    totalItemCost -= failedItemCost * failedProb;
  }

  // total cost can be nothing at min
  if (totalItemCost < 0) {
    totalItemCost = 0;
  }

  return totalItemCost;
}

// Calculate best paths to get to final item according to params
function getItemPaths(
  recombDict,
  pathConfig,
  GUARANTEED_ITEMS,
  sortProb,
  sortCost,
  allowAspect
) {
  // Get best paths for each item
  const allPaths = getAllPaths(
    recombDict,
    pathConfig,
    sortProb,
    sortCost,
    allowAspect
  );

  const {
    finalItem,
    baseCost,
    modRollingCost,
    aspectCost,
    isEldritchItem,
    annulCost,
    isOneModRare,
  } = pathConfig;

  // If only guaranteed items are 1 mod, then return path for finalItem
  if (Object.keys(GUARANTEED_ITEMS).length <= 2) {
    return allPaths[finalItem];
  }
}

// Calculate best paths to get to final item according to params
function getAllPaths(recombDict, pathConfig, sortProb, sortCost, allowAspect) {
  const {
    finalItem,
    baseCost,
    modRollingCost,
    aspectCost,
    isEldritchItem,
    annulCost,
    isOneModRare,
  } = pathConfig;

  const [finalPrefixCount, finalSuffixCount] = getAffixCount(finalItem);

  let allPaths = {
    // Invalid 0 mod item
    "0p/0s": { pathProb: 1, pathCost: 0, path: [] },
    // Set 1 mod items to have 2 costs for if rare or magic
    "1p/0s": {
      pathProb: 1,
      pathCost: {
        0.3889: modRollingCost / 0.3889,
        0.6667: modRollingCost / 0.6667,
      },
      path: [],
    },
    "0p/1s": {
      pathProb: 1,
      pathCost: {
        0.3889: modRollingCost / 0.3889,
        0.6667: modRollingCost / 0.6667,
      },
      path: [],
    },
  };

  // explore paths for target item
  function bestPathForTarget(targetItem) {
    // Skip if already have path or no recomb details for target item
    if (allPaths.hasOwnProperty(targetItem)) {
      return;
    }

    const [targetPrefixCount, targetSuffixCount] = getAffixCount(targetItem);

    // Stores best path found out of all path options
    let bestPath = {
      pathProb: -Infinity,
      pathCost: Infinity,
    };

    // Process all recombinations for the target item
    for (const recombDetails of recombDict[targetItem]) {
      const {
        item1,
        item2,
        exclusiveMods,
        recombProb,
        item1AnnulProb,
        item2AnnulProb,
        multimodCount,
        aspectSuffixCount,
        eldritchAnnulCount,
        failedItemProbs,
      } = recombDetails;

      // skip if has aspect and cant include
      if (!allowAspect && aspectSuffixCount > 0) continue;

      // explore path if haven't yet
      if (!allPaths.hasOwnProperty(item1)) {
        bestPathForTarget(item1);
      }

      if (!allPaths.hasOwnProperty(item2)) {
        bestPathForTarget(item2);
      }

      let item1Path = allPaths[item1];
      let item2Path = allPaths[item2];

      // benchcost
      let benchcraftCost = getBenchcraftCost(
        pathConfig,
        recombDetails,
        targetSuffixCount
      );

      // get overall prob that factors in getting one mod items
      let overallProb = recombProb;

      if (!isOneModRare && item1AnnulProb > 0) {
        overallProb *= item1AnnulProb;
      }
      if (!isOneModRare && item2AnnulProb > 0) {
        overallProb *= item2AnnulProb;
      }

      // get prob of current item in path
      let pathProb =
        item1Path["pathProb"] * item2Path["pathProb"] * overallProb;

      let totalItemCost = getRecombCost(
        item1,
        item2,
        item1Path["pathCost"],
        item2Path["pathCost"],
        allPaths,
        failedItemProbs,
        finalPrefixCount,
        finalSuffixCount,
        targetPrefixCount,
        targetSuffixCount,
        bestPathForTarget
      );

      // get cost of current item in path
      let pathCost = (benchcraftCost + baseCost + totalItemCost) / recombProb;

      if (totalItemCost == Infinity && pathCost != Infinity) {
        console.log("inf cost not matching");
      }

      if (
        targetItem == "3p/2s" &&
        item2 == "3p/0s" &&
        item1 == "2p/2s" &&
        exclusiveMods == "0c/4c0a"
      ) {
        console.log("a");
      }

      // set as path if sort by prob and highest prob, or sort by cost and lowest cost
      if (
        (sortProb && pathProb >= bestPath["pathProb"]) ||
        (sortCost && pathCost <= bestPath["pathCost"])
      ) {
        // always update if is "better" or is cheaper
        if (
          (sortProb && pathProb > bestPath["pathProb"]) ||
          (sortCost && pathCost < bestPath["pathCost"]) ||
          pathCost < bestPath["pathCost"]
        ) {
          let curPathItems = [...item1Path["path"], ...item2Path["path"]];
          curPathItems.push({
            final: targetItem,
            feeder: item2 + " + " + item1,
            exclusive: exclusiveMods,
            cost: pathCost,
            prob: recombProb,
          });
          bestPath = {
            item1: item1,
            item2: item2,
            pathProb: pathProb,
            pathCost: pathCost,
            path: curPathItems,
          };
        }
      }
      // }
    }

    // add to allPaths
    allPaths[targetItem] = bestPath;
  }

  // start exploring paths from last item
  bestPathForTarget("3p/3s");

  return allPaths;
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
