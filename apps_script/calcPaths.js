// starts finding best path, called from on edit
function getPathResults() {
  let baseValues = {};

  const pathCost = getPath(baseValues, false, false);
  const pathCostAspect = getPath(baseValues, false, true);
  const pathProb = getPath(baseValues, true, false);
  const pathProbAspect = getPath(baseValues, true, true);

  return { pathProb, pathProbAspect, pathCost, pathCostAspect };
}

// need to grab options from sheet
function getSheetOptions() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SHEET_NAMES.PATH_SHEET
  );

  // helper func to grab vals
  const getSheetVals = (
    cellNames,
    sheetRange1,
    range1Name,
    sheetRange2,
    range2Name
  ) => {
    const valMap = {};

    cellNames.forEach((name, index) => {
      if (!range1Name) {
        // single col w/ vals
        valMap[name] = sheetRange1[index];
      }
      // multiple ranges w/ vals
      else if (sheetRange1[index] !== "") {
        valMap[name] = {
          [range1Name]: sheetRange1[index],
          [range2Name]: sheetRange2[index] !== "" ? sheetRange2[index] : 0,
        };
      }
    });

    return valMap;
  };

  // Final item
  const finalItem = sheet.getRange(SHEET_RANGES.finalItem).getValue();

  // Cost Options
  const costRange = sheet.getRange(SHEET_RANGES.costOptions).getValues().flat();
  const costNames = [
    "baseCost",
    "prefixModCost",
    "suffixModCost",
    "aspectCost",
    "eldritchAnnulCost",
  ];
  const costVals = getSheetVals(costNames, costRange);

  // Item Options
  const itemRange = sheet.getRange(SHEET_RANGES.itemOptions).getValues().flat();
  const itemNames = ["eldritchItem", "aspectOkay", "modsRolled"];
  const itemVals = getSheetVals(itemNames, itemRange);

  // Guaranteed items
  const guarCountRange = sheet
    .getRange(SHEET_RANGES.guarCount)
    .getValues()
    .flat();
  const guarCostRange = sheet
    .getRange(SHEET_RANGES.guarCost)
    .getValues()
    .flat();
  const guarNames = sheet.getRange(SHEET_RANGES.guarNames).getValues().flat();
  const guarVals = getSheetVals(
    guarNames,
    guarCountRange,
    "count",
    guarCostRange,
    "cost"
  );

  return {
    finalItem: finalItem,
    costOptions: costVals,
    itemOptions: itemVals,
    guarItems: guarVals,
  };
}

function getPathTypes() {
  const sheetOptions = getSheetOptions();

  // get string for prob to use for sheet options
  let pathProbType = "prob";
  let pathDivType = "divines";
  if (sheetOptions.itemOptions.aspectOkay) {
    pathProbType = "probAspect";
    pathDivType = "divinesAspect";
  } else if (sheetOptions.itemOptions.eldritchItem) {
    pathProbType = "probEldritch";
    pathDivType = "divinesEldritch";
  }

  return [pathProbType, pathDivType];
}

// find best path
function getPath(baseValues, sortProb, allowAspect) {
  const [finalRecombs, feederRecombs] = getRecombResults();
  const sheetOptions = getSheetOptions();
  const guarItems = sheetOptions.guarItems;

  // Need to setup item details if given is empty
  let setValues = Object.keys(baseValues).length == 0;

  // name for prob and divines to reference based on sheet options
  const [pathProbType, pathDivType] = getPathTypes();

  // max number of total desired mods, limits number of items that can be made
  const [maxDesP, maxDesS] = getAffixCount(sheetOptions.finalItem);

  // options for guar options in path
  const guarOptions = getGuarOptions(guarItems);

  const dp = {}; // create dp table
  initDP(); // add one mods and guar items
  fillDP(); // fill in dp table

  // if setting values, won't include guar items in first pass
  if (setValues && Object.keys(guarItems).length > 0) {
    setValues = false;
    initDP();
    fillDP();
  }

  // look at all variants for final item, choose best one
  return getBestDP();

  // get best option from dp table
  function getBestDP() {
    const finalItem = dp[sheetOptions.finalItem + " R"];
    let bestPath = { pathProb: -Infinity, pathCost: Infinity };

    for (const guarPath of guarOptions) {
      const guarKey = JSON.stringify(guarPath);
      const curPath = finalItem[guarKey];

      const isBetter = isBetterRecomb(
        bestPath.pathProb,
        bestPath.pathCost,
        curPath.pathProb,
        curPath.pathCost
      );

      if (isBetter) {
        bestPath = JSON.parse(JSON.stringify(curPath));
      }
    }
    return bestPath;
  }

  // get list of base items, one mod items and guar items
  function getQueueItems() {
    const queueItems = [];
    if (maxDesP > 0) {
      queueItems.push(...["1p/0s M", "1p/0s R"]);
    }
    if (maxDesS > 0) {
      queueItems.push(...["0p/1s M", "0p/1s R"]);
    }

    for (const itemStr in guarItems) {
      queueItems.push(itemStr + " R");
    }
    return queueItems;
  }

  // fill in dp table w/ best path for each variant of guar path
  function fillDP() {
    const queue = getQueueItems();
    const visited = new Set();

    while (queue.length > 0) {
      const currentItem = queue.shift();
      const recombOptions = feederRecombs[currentItem];

      for (const recomb of recombOptions) {
        if (!isValidRecomb(recomb)) continue;

        const { item1, item2 } = recomb.feederItems;

        const getItemStr = (item) => {
          return item.isMagic ? item.desStr + " M" : item.desStr + " R";
        };

        const item1Str = getItemStr(item1);
        const item2Str = getItemStr(item2);

        const isMagic =
          recomb.feederItems.totalExc == 0 && recomb.desStr == "1p/1s";
        const finalStr = isMagic ? recomb.desStr + " M" : recomb.desStr + " R";

        // if (finalStr == "3p/2s R") {
        //   console.log("final item")
        // }

        // Add the new item to the queue if it's not already there and no dp
        // if (!queue.includes(finalStr) && !visited.has(finalStr)) {
        //   queue.push(finalStr);
        //   visited.add(finalStr);
        // }

        const item1Paths = dp[item1Str] || [];
        const item2Paths = dp[item2Str] || [];

        // both items need to have paths
        if (!item1Paths || !item2Paths) {
          continue;
        }

        // NEED TO IMPLEMENT GUAR ITEMS
        for (const guarKey1 in item1Paths) {
          for (const guarKey2 in item2Paths) {
            for (const guarPath of guarOptions) {
              // details for specific guar key
              const item1Details = item1Paths[guarKey1];
              const item2Details = item2Paths[guarKey2];

              // guar guars for path
              const guarUsed = { ...item1Details.guarUsed };
              for (const [item, count] of Object.entries(
                item2Details.guarUsed
              )) {
                guarUsed[item] = (guarUsed[item] || 0) + count;
              }

              // skip if too many guar
              let invalidGuar = false;
              for (const guarItem in guarUsed) {
                const gUsed = guarUsed[guarItem];
                const gAvail = guarPath[guarItem] || 0;
                if (gUsed > gAvail) {
                  invalidGuar = true;
                }
              }
              if (invalidGuar) {
                continue;
              }

              const guarKey = JSON.stringify(guarUsed);

              // Get prob, cost, and path history
              const prob = recomb[pathProbType];
              const pathProb = getPathProb(prob, item1Details, item2Details);
              const cost = getRecombCost(recomb, item1Details, item2Details);
              const pathCost =
                cost + item1Details.pathCost + item2Details.pathCost;

              const history = [
                ...item2Details.pathHistory,
                ...item1Details.pathHistory,
              ];
              history.push({ recomb: recomb, cost: cost });

              // create dp dict for item and key
              if (!dp[finalStr] || !dp[finalStr][guarKey]) {
                if (!dp[finalStr]) {
                  dp[finalStr] = {};
                }

                dp[finalStr][guarKey] = {
                  pathProb: -Infinity,
                  pathCost: Infinity,
                };
              }

              const curPath = dp[finalStr][guarKey];
              const isBetter = isBetterRecomb(
                curPath.pathProb,
                curPath.pathCost,
                pathProb,
                pathCost
              );

              if (isBetter) {
                // set base value, no guars
                if (setValues && guarKey === "{}") {
                  baseValues[finalStr] = pathCost;
                }

                // update guar key for item
                dp[finalStr][guarKey] = {
                  pathProb: pathProb,
                  pathCost: pathCost,
                  baseValue: baseValues[finalStr],
                  pathHistory: history,
                  guarUsed: guarUsed,
                };

                if (!queue.includes(finalStr)) {
                  queue.push(finalStr);
                  // visited.add(finalStr);
                }
              }
            }
          }
        }
      }
    }
  }

  // set base values in dp
  function initDP() {
    // create {item: {pathProb, pathCost, pathHistory}}
    const addOneMod = (prefixCount, isMagic) => {
      const getOneModProb = () => {
        // if mod is already rolled then its guaranteed
        if (sheetOptions.itemOptions.modsRolled) {
          return 1;
        }
        // 1/2 alt gives prefix and suffix, regal into 2/3 annul and 1/3 annul
        // 1/4 alt gives prefix or suffix, regal into 1/2 annul
        // if prefix or suffix, 2/3 chance to have other mod. 1/3 to be one mod
        // if is magic return probs to get single mod magic
        if (isMagic) {
          return ((2 / 3) * 1) / 2 + (1 / 3) * 1;
        }
        // item is rare, need to regal and annul
        return ((((2 / 3) * 2) / 3) * 1) / 2 + ((1 / 3) * 1) / 2;
      };

      const getOneModCost = () => {
        // return prefix or suffix mod cost
        return prefixCount == 1
          ? sheetOptions.costOptions.prefixModCost
          : sheetOptions.costOptions.suffixModCost;
      };

      let itemProb = getOneModProb();
      let itemValue =
        getOneModCost() / itemProb + sheetOptions.costOptions.baseCost;

      let itemStr = prefixCount == 1 ? "1p/0s" : "0p/1s";
      itemStr += isMagic ? " M" : " R";

      if (!dp[itemStr]) {
        dp[itemStr] = {};
      }

      dp[itemStr]["{}"] = {
        pathProb: itemProb,
        pathCost: 0,
        baseValue: itemValue,
        pathHistory: [],
        guarUsed: {},
      };

      if (setValues) {
        baseValues[itemStr] = itemValue;
      }
    };

    // add one mods to dp table
    if (maxDesP > 0) {
      addOneMod(1, true); // "1p/0s" magic
      addOneMod(1, false); // "1p/0s" rare
    }
    if (maxDesS > 0) {
      addOneMod(0, true); // "0p/1s" magic
      addOneMod(0, false); // "0p/1s" rare
    }

    // dont want to use guar items when setting base values
    if (!setValues) {
      // add guar items
      for (const itemStr in guarItems) {
        const dpStr = itemStr + " R";
        const guarUsed = { [dpStr]: 1 };
        const guarKey = JSON.stringify(guarUsed);
        const cost = guarItems[itemStr].cost;
        // const count = guarItems[itemStr].count;

        if (!dp[dpStr]) {
          dp[dpStr] = {};
        }

        dp[dpStr][guarKey] = {
          pathProb: 1,
          pathCost: cost,
          baseValue: cost,
          pathHistory: [],
          guarUsed: guarUsed,
        };
      }
    }
  }

  // get all types of guar items in path
  function getGuarOptions(guarItems) {
    const allItems = Object.keys(guarItems);
    const result = [];

    function helper(currentCombination, index) {
      if (index === allItems.length) {
        const filteredCombination = {};
        for (const key in currentCombination) {
          if (currentCombination[key] > 0) {
            filteredCombination[key] = currentCombination[key];
          }
        }
        result.push(filteredCombination);
        return;
      }

      const item = allItems[index];
      for (let i = 0; i <= guarItems[item].count; i++) {
        currentCombination[item + " R"] = i;
        helper(currentCombination, index + 1);
      }
    }

    helper({}, 0);
    return result;
  }

  // gets number of prefixes and suffixes
  function getAffixCount(desStr) {
    const match = desStr.match(/(\d+)p\/(\d+)s/);

    return [parseInt(match[1]), parseInt(match[2])];
  }

  // checkcs if recomb has aspects, too many mods, or a feeder that is a finished item
  function isValidRecomb(recomb) {
    const finalItem = recomb.finalItem;
    const item1 = recomb.feederItems.item1;
    const item2 = recomb.feederItems.item2;

    // if recomb has aspects and none allowed, skip
    if (recomb.feederItems.totalAspS > 0 && !allowAspect) {
      return false;
    }
    // skip if too many desired mods
    if (finalItem.desP > maxDesP || finalItem.desS > maxDesS) {
      return false;
    }

    // if a feeder item is same or better version of final, skip
    const isFeederBetter = (item) => {
      return finalItem.desP <= item.desP && finalItem.desS <= item.desS;
    };
    if (isFeederBetter(item1) || isFeederBetter(item2)) {
      return false;
    }
    return true;
  }

  // get prob of recomb
  function getPathProb(recombProb, details1, details2) {
    let pathProb = recombProb * details1.pathProb * details2.pathProb;

    if (pathProb == Infinity) pathProb = -Infinity;

    return pathProb;
  }

  // get costs of recomb
  function getRecombCost(recomb, details1, details2) {
    let feederValue = details1.baseValue + details2.baseValue; // value of feeder items

    let failedValue = 0; // value of expected failed items
    for (let failedRecomb of recomb.failedRecombs) {
      const failedDesStr = failedRecomb.desStr;
      const [failedDesP, failedDesS] = getAffixCount(failedDesStr);
      const failedProb = failedRecomb[pathProbType];
      // Get magic details if can be magic, otherwise get details
      const itemValue =
        baseValues[failedDesStr + " M"] || baseValues[failedDesStr + " R"];

      // known base value of item
      if (itemValue) {
        failedValue += itemValue * failedProb;
      }

      // DONT THINK NEEDED
      // if same number of desired mods as final, assume same value as final
      // else if (failedRecomb.totalDes == recomb.totalDes && failedDesP <= maxDesP && failedDesS <= maxDesS) {
      //   // failedValue +=
      //   //   (details1.baseValue + details2.baseValue) * failedProb;
      // }
    }

    // options from sheet
    const costOptions = sheetOptions.costOptions;
    const itemOptions = sheetOptions.itemOptions;

    // cost of each recomb attempt. divines, aspects, eldritch annuls
    let constantCost = recomb[pathDivType];

    // add aspect cost
    const aspectsUsed = recomb.feederItems.totalAspS;
    if (aspectsUsed != 0) {
      constantCost += aspectsUsed * costOptions.aspectCost;
    }

    // add eldritch annul cost
    const eAnnulsUsed = recomb.eldritchAnnuls;
    if (
      !itemOptions.aspectOkay &&
      itemOptions.eldritchItem &&
      eAnnulsUsed != 0
    ) {
      constantCost += eAnnulsUsed * costOptions.eldritchAnnulCost;
    }

    // item cost for each recomb is feeders - expected return from failed
    // can't be less than the cost of a base
    // always costs the divines, aspects, and eldritch annuls
    const netCost =
      Math.max(feederValue - failedValue, costOptions.baseCost) + constantCost;

    // expected cost of recomb until success
    return netCost / recomb[pathProbType];
  }

  // if the current details are better than final details
  function isBetterRecomb(fProb, fCost, cProb, cCost) {
    // Comparators between current and final probs and costs
    const isHigherProb = cProb > fProb;
    const isSameProb = cProb === fProb;
    const isLowerCost = cCost < fCost;
    const isSameCost = cCost.toFixed(2) === fCost.toFixed(2);

    return (
      (sortProb && (isHigherProb || (isSameProb && isLowerCost))) ||
      (!sortProb && (isLowerCost || (isSameCost && isHigherProb)))
    );
  }
}
