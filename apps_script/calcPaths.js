// -----------------------------------------------------
// calcPaths
// Returns dict w/ best path for all 4 path options
// -----------------------------------------------------

// defined in getPathResults()
let allRecombs,
  sheetConfig,
  guarItems,
  pathProbType,
  pathDivType,
  maxDesP,
  maxDesS,
  itemValues;

// starts finding best path, called from on edit
function getPathResults() {
  if (typeof allRecombs === "undefined") {
    allRecombs = getFeederRecombs(); // results from calcRecombs
    sheetConfig = getSheetConfig(); // options from sheet
    guarItems = sheetConfig.guarItems; // guaranteed items
    [pathProbType, pathDivType] = getPathTypes(); // prob and divines for sheet item
    [maxDesP, maxDesS] = getAffixCount(sheetConfig.finalItem); // max desired mods
    itemValues = {}; // filed out when param is empty
  }

  // getPath(sortProb, allowAspect)
  const pathCost = getPath(false, false);
  const pathCostAspect = getPath(false, true);
  const pathProb = getPath(true, false);
  const pathProbAspect = getPath(true, true);

  return { pathProb, pathProbAspect, pathCost, pathCostAspect };
}

// need to grab options from sheet
function getSheetConfig() {
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

// returns string for prob and divines based on item for path
function getPathTypes() {
  const sheetConfig = getSheetConfig();

  // get string for prob to use for sheet options
  let pathProbType = "prob";
  let pathDivType = "divines";
  if (sheetConfig.itemOptions.aspectOkay) {
    pathProbType = "probAspect";
    pathDivType = "divinesAspect";
  } else if (sheetConfig.itemOptions.eldritchItem) {
    pathProbType = "probEldritch";
    pathDivType = "divinesEldritch";
  }

  return [pathProbType, pathDivType];
}

// find best path
function getPath(sortProb, allowAspect) {
  // Need to setup item details if given is empty
  let setValues = Object.keys(itemValues).length == 0;

  let dp = {}; // create dp table

  // if no item values, need to set values for each item
  if (setValues) {
    // need to set values for itemValues
    initDP(); // add one mods, no guar items to set values
    fillDP(); // fill in dp table

    dp = {}; // reset dp
    setValues = false; // values are now set
  }

  initDP(); // add one mods and guar items
  fillDP(); // fill in dp table

  // key to get path w/ all guar items
  const guarKey = {};
  for (const guarItem in guarItems) {
    guarKey[guarItem + " R"] = guarItems[guarItem].count;
  }

  // return best path that has all guar at final item
  return dp[sheetConfig.finalItem + " R"][JSON.stringify(guarKey)];

  // get best option from dp table
  //   function getBestDP() {
  //     const finalItem = dp[sheetConfig.finalItem + " R"];
  //     let bestPath = { pathProb: -Infinity, pathCost: Infinity };

  //     const requiredGuar = [];
  //     for (const itemStr in guarItems) {
  //       if (guarItems[itemStr].cost === 0) {
  //         requiredGuar.push(itemStr + " R");
  //       }
  //     }

  //     // options for guar options in path
  //     const guarOptions = getGuarOptions(guarItems);

  //     for (const guarPath of guarOptions) {
  //       const guarKey = JSON.stringify(guarPath);
  //       const curPath = finalItem[guarKey];

  //       if (!curPath) continue;

  //       const isBetter = isBetterRecomb(
  //         bestPath.pathProb,
  //         bestPath.pathCost,
  //         curPath.pathProb,
  //         curPath.pathCost
  //       );

  //       if (
  //         isBetter &&
  //         requiredGuar.every((guarItem) => guarKey.includes(guarItem))
  //       ) {
  //         bestPath = JSON.parse(JSON.stringify(curPath));
  //       }
  //     }
  //     return bestPath;
  //   }

  // get list of base items, one mod items and guar items
  function getQueueItems() {
    const queueItems = [];

    // add base items, need to have desired affix to check
    if (maxDesP > 0) {
      queueItems.push(...["1p/0s M", "1p/0s R"]);
    }
    if (maxDesS > 0) {
      queueItems.push(...["0p/1s M", "0p/1s R"]);
    }

    // add guar items if not setting values
    if (!setValues) {
      for (const itemStr in guarItems) {
        queueItems.push(itemStr + " R");

        if (itemStr === "1p/1s") {
          queueItems.push(itemStr + " M");
        }
      }
    }

    return queueItems;
  }

  // fill in dp table w/ best path for each variant of guar path
  function fillDP() {
    const queue = getQueueItems();
    const guarOptions = getGuarOptions(guarItems);

    while (queue.length > 0) {
      const currentItem = queue.shift();
      const recombOptions = allRecombs[currentItem];

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

        const item1Paths = dp[item1Str] || [];
        const item2Paths = dp[item2Str] || [];

        // both items need to have paths
        if (!item1Paths || !item2Paths) {
          continue;
        }

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

              // Get prob, cost, and path history
              const prob = recomb[pathProbType];
              const pathProb = getPathProb(prob, item1Details, item2Details);
              const cost = getRecombCost(recomb, item1Str, item2Str);
              const pathCost =
                cost + item1Details.pathCost + item2Details.pathCost;
              const history = [
                ...item2Details.pathHistory,
                ...item1Details.pathHistory,
              ];
              history.push({ recomb: recomb, cost: cost });

              const recombStr = recomb.feederItems.str;

              const guarKey = JSON.stringify(guarUsed);

              // create dp dict for item and key
              if (!dp[finalStr] || !dp[finalStr][guarKey]) {
                if (!dp[finalStr]) {
                  dp[finalStr] = {};
                }

                dp[finalStr][guarKey] = {
                  pathProb: -Infinity,
                  pathCost: Infinity,
                  recombStr: recombStr,
                };
              }

              const curPath = dp[finalStr][guarKey];

              const isBetter = isBetterRecomb(
                curPath.pathProb,
                curPath.pathCost,
                pathProb,
                pathCost
              );

              const isSameRecomb = recombStr === curPath.recombStr;
              const moreCost = pathCost > curPath.pathCost;

              if (isBetter || (setValues && isSameRecomb && moreCost)) {
                // set base value, no guars
                if (setValues && guarKey === "{}") {
                  itemValues[finalStr] = pathCost;
                }

                // update guar key for item
                dp[finalStr][guarKey] = {
                  pathProb: pathProb,
                  pathCost: pathCost,
                  pathHistory: history,
                  guarUsed: guarUsed,
                  recombStr: recombStr,
                };

                // check uses for final str as feeder
                if (!queue.includes(finalStr)) {
                  queue.push(finalStr);
                }
                // update cost for recomb, need to re check curent feeder
                if (
                  !queue.includes(currentItem) &&
                  setValues &&
                  isSameRecomb &&
                  moreCost
                ) {
                  queue.push(currentItem);
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
        if (sheetConfig.itemOptions.modsRolled) {
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
          ? sheetConfig.costOptions.prefixModCost
          : sheetConfig.costOptions.suffixModCost;
      };

      const itemProb = getOneModProb();
      const modCost = getOneModCost() / itemProb;
      const itemValue = modCost + sheetConfig.costOptions.baseCost;

      const plainStr = prefixCount == 1 ? "1p/0s" : "0p/1s";
      const itemStr = isMagic ? plainStr + " M" : plainStr + " R";

      const regalProb = ((((2 / 3) * 2) / 3) * 1) / 2 + ((1 / 3) * 1) / 2;
      const regalDetails = {
        recomb: {
          desStr: plainStr,
          feederItems: { desStr: plainStr, excStr: "Regal", str: "Regal" },
          prob: regalProb,
          probEldritch: regalProb,
          probAspect: regalProb,
        },
        cost: itemValue,
      };
      const history =
        isMagic || sheetConfig.itemOptions.modsRolled ? [] : [regalDetails];

      if (!dp[itemStr]) {
        dp[itemStr] = {};
      }

      dp[itemStr]["{}"] = {
        pathProb: itemProb,
        pathCost: modCost,
        pathHistory: history,
        guarUsed: {},
      };

      if (setValues) {
        itemValues[itemStr] = itemValue;
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

        if (!dp[dpStr]) {
          dp[dpStr] = {};
        }

        dp[dpStr][guarKey] = {
          pathProb: 1,
          pathCost: guarItems[itemStr].cost,
          pathHistory: [],
          guarUsed: guarUsed,
        };

        // if item can also be magic, make item
        // only works with 1p/1s, think fine to only check that
        const dpStrM = itemStr + " M";
        if (itemStr == "1p/1s") {
          if (!dp[dpStrM]) {
            dp[dpStrM] = {};
          }

          dp[dpStrM][guarKey] = {
            pathProb: 1,
            pathCost: guarItems[itemStr].cost,
            pathHistory: [],
            guarUsed: guarUsed,
          };
        }
      }
    }
  }

  // get all types of guar items in path
  function getGuarOptions(guarItems) {
    // no guar options when setting item values
    if (setValues) {
      return [{}];
    }
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
    const isTooManyMods = (item) => {
      return item.desP > maxDesP || item.desS > maxDesS;
    };
    if (
      isTooManyMods(finalItem) ||
      isTooManyMods(item1) ||
      isTooManyMods(item2)
    ) {
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
  function getRecombCost(recomb, str1, str2) {
    let feederValue = itemValues[str1] + itemValues[str2]; // value of feeder items

    let failedValue = 0; // value of expected failed items
    for (let failedRecomb of recomb.failedRecombs) {
      const failedDesStr = failedRecomb.desStr;
      const failedProb = failedRecomb[pathProbType];
      // Get magic details if can be magic, otherwise get details
      const itemValue =
        itemValues[failedDesStr + " M"] || itemValues[failedDesStr + " R"];

      // known base value of item
      if (itemValue) {
        failedValue += itemValue * failedProb;
      }
    }

    // options from sheet
    const costOptions = sheetConfig.costOptions;
    const itemOptions = sheetConfig.itemOptions;

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

// gets number of prefixes and suffixes
function getAffixCount(desStr) {
  const match = desStr.match(/(\d+)p\/(\d+)s/);

  return [parseInt(match[1]), parseInt(match[2])];
}
