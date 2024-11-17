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
  }

  // getPath(sortProb, allowAspect)
  itemValues = { base: {}, mods: {}, prep: {} }; // new item values for lowest cost
  const pathCost = getPath(false, false);
  const pathCostAspect = getPath(false, true);

  itemValues = { base: {}, mods: {}, prep: {} }; // new item values for highest prob
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
  let setValues = Object.keys(itemValues.base).length == 0;

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

              // if setting values, adjust the failed item probs
              // wont' always have enough desired mods to make all
              if (setValues) {
                adjustFailed(recomb.failedRecombs);
              }

              // Get prob, cost, and path history
              const prob = recomb[pathProbType];
              const pathProb = getPathProb(prob, item1Details, item2Details);

              // each recomb uses 1 base, number of bases needed depends on failed recovery
              const baseCost = getBaseCost(recomb, item1Str, item2Str);
              const pathBaseCost =
                baseCost + item1Details.baseCost + item2Details.baseCost;

              const modCost = getModCost(recomb, item1Str, item2Str);
              const pathModCost =
                modCost + item1Details.modCost + item2Details.modCost;

              const prepCost = getPrepCost(recomb);
              const pathPrepCost =
                prepCost + item1Details.prepCost + item2Details.prepCost;

              const cost = baseCost + modCost + prepCost;
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
              const moreCost =
                parseFloat(pathCost.toFixed(4)) >
                parseFloat(curPath.pathCost.toFixed(4));

              if (isBetter || (setValues && isSameRecomb && moreCost)) {
                // set base value, no guars
                if (setValues && guarKey === "{}") {
                  itemValues.base[finalStr] = pathBaseCost;
                  itemValues.mods[finalStr] = pathModCost;
                  itemValues.prep[finalStr] = pathPrepCost;
                }

                // update guar key for item
                dp[finalStr][guarKey] = {
                  pathProb: pathProb,
                  pathCost: pathCost,
                  baseCost: pathBaseCost,
                  modCost: pathModCost,
                  prepCost: pathPrepCost,
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
        const costs = sheetConfig.costOptions;
        // return prefix or suffix mod cost
        return prefixCount === 1 ? costs.prefixModCost : costs.suffixModCost;
      };

      const itemProb = getOneModProb();
      const modCost = getOneModCost() / itemProb;
      const baseCost = sheetConfig.costOptions.baseCost;
      const pathCost = modCost;

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
        cost: modCost,
      };
      const history =
        isMagic || sheetConfig.itemOptions.modsRolled ? [] : [regalDetails];

      if (!dp[itemStr]) {
        dp[itemStr] = {};
      }

      dp[itemStr]["{}"] = {
        pathProb: itemProb,
        pathCost: pathCost,
        baseCost: baseCost,
        modCost: modCost,
        prepCost: 0,
        pathHistory: history,
        guarUsed: {},
      };

      if (setValues) {
        itemValues.base[itemStr] = baseCost;
        itemValues.mods[itemStr] = modCost;
        itemValues.prep[itemStr] = 0;
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
        const baseCost = sheetConfig.costOptions.baseCost;

        if (!dp[dpStr]) {
          dp[dpStr] = {};
        }

        dp[dpStr][guarKey] = {
          pathProb: 1,
          pathCost: guarItems[itemStr].cost,
          baseCost: baseCost,
          modCost: 0,
          prepCost: 0,
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
            baseCost: baseCost,
            modCost: 0,
            prepCost: 0,
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

    if (
      isTooManyMods(finalItem) ||
      isTooManyMods(item1) ||
      isTooManyMods(item2)
    ) {
      return false;
    }

    // if a feeder item is same or better version of final, skip
    // const isFeederBetter = (item) => {
    //   return finalItem.desP < item.desP || finalItem.desS < item.desS || item.desStr === this.desStr;
    // };
    // if (isFeederBetter(item1) || isFeederBetter(item2)) {
    if (!recomb.hasLessMods) {
      return false;
    }
    return true;
  }

  // skip if too many desired mods
  function isTooManyMods(item) {
    return item.desP > maxDesP || item.desS > maxDesS;
  }

  function adjustFailed(failedRecombs) {
    let totalProb = 0;
    for (const recomb of failedRecombs) {
      const finalItem = recomb.finalItem;
      if (isTooManyMods(finalItem)) {
        continue;
      }
      totalProb += recomb[pathProbType];
    }

    for (const recomb of failedRecombs) {
      const finalItem = recomb.finalItem;
      if (isTooManyMods(finalItem)) {
        continue;
      }
      recomb[pathProbType] = recomb[pathProbType] / totalProb;
    }
  }

  // get prob of recomb
  function getPathProb(recombProb, details1, details2) {
    let pathProb = recombProb * details1.pathProb * details2.pathProb;

    if (pathProb == Infinity) pathProb = -Infinity;

    return pathProb;
  }

  function getBaseCost(recomb, str1, str2) {
    const baseValues = itemValues.base;

    const feederBases = baseValues[str1] + baseValues[str2];
    const savedBases = getSavedValue(feederBases, recomb, baseValues);

    const baseCost = sheetConfig.costOptions.baseCost;
    const netBases = Math.max(feederBases - savedBases, baseCost);

    return netBases / recomb[pathProbType];
  }

  function getModCost(recomb, str1, str2) {
    const modValues = itemValues.mods;

    const feederMods = modValues[str1] + modValues[str2];
    const savedMods = getSavedValue(feederMods, recomb, modValues);

    const netMods = Math.max(feederMods - savedMods, 0);
    // if (feederMods - savedMods < 0) {
    //   console.log("neg mod cost");
    // }

    // 3p/0s = 1p1c/0s + 2p1c/2c
    // feeder - 1p/0s + 2p/0s, 5.058
    // saved - ?? - 2.86
    // net - 2.195

    // 3p/1s = 1p2c/1s1c + 2p1c/2c
    // feeder - 1p/1s + 2p/0s, 7.4545
    // saved - ??, 9.4283
    // net - 0
    // if (
    //   recomb.desStr === "3p/1s" &&
    //   recomb.feederItems.str === "1p2c/1s1c + 2p1c/2c"
    // ) {
    //   console.log("match");
    // }

    return netMods / recomb[pathProbType];
  }

  function getPrepCost(recomb) {
    // options from sheet
    const costOptions = sheetConfig.costOptions;
    const itemOptions = sheetConfig.itemOptions;

    // cost of each recomb attempt. divines, aspects, eldritch annuls
    let prepCost = recomb[pathDivType];

    // add aspect cost
    const aspectsUsed = recomb.feederItems.totalAspS;
    if (aspectsUsed != 0) {
      prepCost += aspectsUsed * costOptions.aspectCost;
    }

    // add eldritch annul cost
    const eAnnulsUsed = recomb.eldritchAnnuls;
    if (
      !itemOptions.aspectOkay &&
      itemOptions.eldritchItem &&
      eAnnulsUsed != 0
    ) {
      prepCost += eAnnulsUsed * costOptions.eldritchAnnulCost;
    }

    return prepCost / recomb[pathProbType];
  }

  function getSavedValue(feederValue, recomb, itemValues) {
    const finalItem = recomb.finalItem;
    const failedRecombs = recomb.failedRecombs;
    let savedCost = 0;

    for (const recomb of failedRecombs) {
      const desStr = recomb.desStr;

      const value = itemValues[desStr];
      const prob = recomb[pathProbType];
      const flippedFinal =
        finalItem.desP === recomb.desS && finalItem.desS === recomb.desP;
      const failedFinal = recomb.finalItem;

      // if same as final but flipped then use feeder cost
      if (flippedFinal && !isTooManyMods(failedFinal)) {
        savedCost += feederValue * prob;
      }

      // known base value of item
      else if (value) {
        savedCost += Math.min(value, feederValue) * prob;
        // savedCost += value * prob;
      }
    }

    //
    return savedCost;
  }

  // if the current details are better than final details
  function isBetterRecomb(fProb, fCost, cProb, cCost) {
    // Comparators between current and final probs and costs
    const round = (num) => {
      return parseFloat(num.toFixed(4));
    };
    const isHigherProb = round(cProb) > round(fProb);
    const isSameProb = round(cProb) === round(fProb);
    const isLowerCost = round(cCost) < round(fCost);
    const isSameCost = round(cCost) === round(fCost);

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
