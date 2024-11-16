// -----------------------------------------------------
// calcRecombs
// Returns dict w/ recomb results
// -----------------------------------------------------

// final recomb dict - {final item: recombs to final}
function getFinalRecombs() {
  const [finalRecombs, feederRecombs] = getRecombResults();
  return finalRecombs;
}

// feeder recomb dict - {feeder items: recombs w/ feeder}
function getFeederRecombs() {
  const [finalRecombs, feederRecombs] = getRecombResults();
  return feederRecombs;
}

// -----------------------------------------------------
// Tables for recomb odds
// -----------------------------------------------------

const weightsTable = [
  // 0    1     2     3         final mods
  [1.0, 0.0, 0.0, 0.0], // 0 initial mods, guaranteed 0 mods
  [0.41, 0.59, 0.0, 0.0], // 1 initial mod
  [1.0, 0.67, 0.33, 0.0], // 2 initial mods
  [1.0, 0.39, 0.52, 0.1], // 3 initial mods
  [1.0, 0.11, 0.59, 0.31], // 4 initial mods
  [1.0, 1.0, 0.43, 0.57], // 5 initial mods
  [1.0, 1.0, 0.28, 0.72], // 6 initial mods
];

// min affixes on final item
const minAffixes = {
  1: 0,
  2: 1,
  3: 1,
  4: 1,
  5: 2,
  6: 2,
};

// Sum of odds, chance of getting at least
const cumsumTable = [
  // 0    1     2     3         final mods
  [1.0, 0.0, 0.0, 0.0], // 0 initial mods, guaranteed 0 mods
  [1.0, 0.59, 0.0, 0.0], // 1 initial mod
  [1.0, 1.0, 0.33, 0.0], // 2 initial mods
  [1.0, 1.0, 0.62, 0.1], // 3 initial mods
  [1.0, 1.0, 0.9, 0.31], // 4 initial mods
  [1.0, 1.0, 1.0, 0.57], // 5 initial mods
  [1.0, 1.0, 1.0, 0.72], // 6 initial mods
];

// -----------------------------------------------------
// Functions for recombination calculations
// -----------------------------------------------------

const getRecombResults = () => {
  const recombsForFinal = {};
  const recombsForFeeder = {};
  const allFeederPairs = getFeederPairs();

  for (const feederItems of allFeederPairs) {
    const item1 = feederItems.item1;
    const item2 = feederItems.item2;

    // All possible recombs for feeder items
    const feederRecombs = [];

    calcRecombs(); // populate recombs for final and feeder
    calcFailed(); // add failed list and strings to recombs

    // get recomb w/ feeder items for each possible final item
    function calcRecombs() {
      for (
        let finalP = 0;
        finalP <= Math.min(3, item1.desP + item2.desP);
        finalP++
      ) {
        for (
          let finalS = 0;
          finalS <= Math.min(3, item1.desS + item2.desS);
          finalS++
        ) {
          // dont think can make 0 mod results
          // can make 0 mod items if only get single exclusive
          // if (finalP == 0 && finalS == 0) {
          //   continue;
          // }

          const finalItem = { desP: finalP, desS: finalS };

          const recomb = new Recombinator(feederItems, finalItem);

          // skip if impossible to recomb
          if (recomb.prob == 0) continue;

          // Add as recomb result for feeder items
          feederRecombs.push(recomb);

          // Add recomb to all results
          if (!(recomb.desStr in recombsForFinal)) {
            recombsForFinal[recomb.desStr] = [];
          }
          recombsForFinal[recomb.desStr].push(recomb);

          const getItemStr = (item) => {
            return item.isMagic ? item.desStr + " M" : item.desStr + " R";
          };

          const item1DesStr = getItemStr(item1);
          const item2DesStr = getItemStr(item2);

          const addRecombForFeeder = (itemStr) => {
            if (!recombsForFeeder[itemStr]) {
              recombsForFeeder[itemStr] = [];
            }
            recombsForFeeder[itemStr].push(recomb);
          };

          addRecombForFeeder(item1DesStr);

          if (item1DesStr != item2DesStr) {
            addRecombForFeeder(item2DesStr);
          }
        }
      }
    }

    // Find failed possibilities for each successful recomb
    function calcFailed() {
      for (let successRecomb of feederRecombs) {
        // if success recomb won't fail then skip
        if (successRecomb.probAspect == 1) {
          successRecomb.failedRecombs = [];
          continue;
        }

        let tProb = 0;
        let tProbEldritch = 0;
        let tProbAspect = 0;

        let posFailed = [];

        // Collect failed recombs and get total prob
        for (let failedRecomb of feederRecombs) {
          // isn't failed if has at least same prefixes and suffixes as success
          // if only have successful recomb and 0p/0s, then dont skip
          // think only applies to 1 mod
          if (
            failedRecomb.finalItem.desP >= successRecomb.finalItem.desP &&
            failedRecomb.finalItem.desS >= successRecomb.finalItem.desS &&
            feederRecombs.length > 2
          ) {
            continue;
          }

          // if failed recomb then add to total to adjust prob
          tProb += failedRecomb.exactProb;
          tProbEldritch += failedRecomb.exactProbEldritch;
          tProbAspect += failedRecomb.exactProbAspect;

          // Add to list of failed
          posFailed.push(failedRecomb);
        }

        // adjust probs and make list and string
        let failedRecombs = [];
        let failedStr = "";
        for (let failedRecomb of posFailed) {
          const finalItem = failedRecomb.finalItem;
          const totalDes = finalItem.desP + finalItem.desS;
          let desStr = failedRecomb.desStr;

          const adjustProbs = (baseProb, probsSum) => {
            return probsSum > 0 ? baseProb / probsSum : 0.0;
          };

          let exactProb = adjustProbs(failedRecomb.exactProb, tProb);
          let exactProbEldritch = adjustProbs(
            failedRecomb.exactProbEldritch,
            tProbEldritch
          );
          let exactProbAspect = adjustProbs(
            failedRecomb.exactProbAspect,
            tProbAspect
          );

          // dont add to failed options if impossible to get
          if (exactProb == 0) continue;

          failedStr += `(${desStr}: ${exactProb.toFixed(
            4
          )}, ${exactProbEldritch.toFixed(4)}, ${exactProbAspect.toFixed(4)}) `;

          failedRecombs.push({
            finalItem: finalItem,
            feederItems: failedRecomb.feederItems,
            hasLessMods: failedRecomb.hasLessMods,
            desStr: desStr,
            totalDes: totalDes,
            desP: finalItem.desP,
            desS: finalItem.desS,
            prob: exactProb,
            probEldritch: exactProbEldritch,
            probAspect: exactProbAspect,
          });
        }

        const addFailed = (itemStr, desP, desS) => {
          failedRecombs.push({
            desStr: itemStr,
            totalDes: 1,
            desP: desP,
            desS: desS,
            prob: 1,
            probEldritch: 1,
            probAspect: 1,
          });
          failedStr += `(${itemStr}: 1.0000, 1.0000, 1.0000)`;
        };

        if (
          failedRecombs.length == 0 ||
          (posFailed.length == 1 &&
            successRecomb.desStr !== "1p/0s" &&
            successRecomb.desStr !== "0p/1s")
        ) {
          console.log("should have failed but none found");
        }

        // if (successRecomb.feederItems.str === "1p/2c + 1p/3c" && successRecomb.desStr === "2p/0s") {
        // if (successRecomb.feederItems.str === "1c/1s + 1p2c/1c" && successRecomb.desStr === "1p/1s") {
        // if (successRecomb.feederItems.str === "1p/0s + 1p/0s" && successRecomb.desStr === "2p/0s") {
        // if (successRecomb.feederItems.str === "2c/1s1c + 1p2c/1s1c1a" && successRecomb.desStr === "1p/2s") {
        // if (successRecomb.feederItems.str === "1c/1s + 1p/0s" && successRecomb.desStr === "1p/1s") {
        // if (successRecomb.feederItems.str === "1c/1s1c + 1p/3c" && successRecomb.desStr === "1p/0s") {
        // if (
        //   successRecomb.feederItems.str === "2c/1s1c + 1p2c/1s1c1a" &&
        //   successRecomb.desStr === "1p/2s"
        // ) {
        //   // 1p/1s - 1c/1s + 1p/0s
        //   // prefix chosen = 0p/1s w/ 57%
        //   // suffix chosen = 0p/1s w/ 57%
        //   // final items' cant have 0 mods, but think can land w/ only exclusive
        //   console.log("a");
        // }

        successRecomb.failedRecombs = failedRecombs;
        successRecomb.failedStr = failedStr.trim();
      }
    }
  }

  return [recombsForFinal, recombsForFeeder];
};

// -----------------------------------------------------
// Recombinator class for single recombination
// -----------------------------------------------------
class Recombinator {
  constructor(feederItems, finalItem) {
    this.feederItems = feederItems;
    this.finalItem = finalItem;
    this.totalDes = finalItem.desP + finalItem.desS;
    this.desStr = `${finalItem.desP}p/${finalItem.desS}s`;

    this.divines = feederItems.multimods * 2; // lock prefix to clean suffixes
    this.divinesEldritch = feederItems.multimods * 2; // eldritch annul to clean suffixes
    this.divinesAspect = feederItems.multimods * 2; // don't need anything beside multimods

    // Eldritch annuls used to remove aspect
    this.eldritchAnnuls = 0;

    // Bool if each feeder has less mods than final, 0 mods is fine
    const checkLessMods = (item) => {
      // if item doesn't have more mods than final
      // and isn't same as final, then okay
      return (
        item.desP <= finalItem.desP &&
        item.desS <= finalItem.desS &&
        item.desStr != this.desStr
      );
    };
    this.hasLessMods =
      checkLessMods(feederItems.item1) && checkLessMods(feederItems.item2);

    // Prob of recomb
    // probs have only desired mods and crafted, probAspect has aspects
    [
      // At least desired mods
      this.prob,
      this.probEldritch,
      this.probAspect,
      // Exactly desired mods
      this.exactProb,
      this.exactProbEldritch,
      this.exactProbAspect,
    ] = this.getProb();

    // if (this.feederItems.str === "1c/1s + 1p/0s" && this.desStr === "0p/0s") {
    //   const [
    //     prob,
    //     probEldritch,
    //     probAspect,
    //     exactProb,
    //     exactProbEldritch,
    //     exactProbAspect,
    //   ] = this.getProb();
    //   console.log("a")
    // }
  }

  getProb() {
    // get probs for final item depending on prefix or suffix first
    // returns prob, prob aspect, and prob aspect eldritch
    // has probs for at least and probs for exactly desired mods
    const [pProbs, sProbs] = [
      this.calcItemProb(true),
      this.calcItemProb(false),
    ];

    // Edge case if item has 1 exclusive affix and no desired affixes
    // The side chosen by recomb may not get any mods, meaning exclusive must appear on other side
    // If more than 1 exclusive affix then guaranteed to land on first chosen side
    // 59% chance to get exclusive, 41% chance to move exclusive to other side

    let [pMod, sMod] = [0.5, 0.5];
    const adjustProbs = (fMod, sMod) => [fMod * 0.59, sMod * 1.41];

    const totalExcP = this.feederItems.totalExcP;
    const totalP = this.feederItems.totalP;
    const totalExcS = this.feederItems.totalExcS;
    const totalS = this.feederItems.totalS;

    // if only 1 exclusive prefix ans one total affix, can not roll on selected side
    // adjust mods to increase prob of other side exclusive
    if (totalExcP === 1 && totalP === 1) {
      [pMod, sMod] = adjustProbs(pMod, sMod);
    } else if (totalExcS === 1 && totalS === 1) {
      [sMod, pMod] = adjustProbs(sMod, pMod);
    }

    let itemProbs = [];
    for (let i = 0; i < pProbs.length; i++) {
      itemProbs.push(pProbs[i] * pMod + sProbs[i] * sMod);
    }

    // if (this.feederItems.str === "1c/1s + 1p/0s" && this.desStr === "0p/0s") {
    //   // prefix first, always get the 1 suffix, impossible to get 0
    //   // suffix first, chance to get 0 suffix if only get 1 mod and exclusive
    //   console.log("a")
    // }

    return itemProbs;
  }

  calcItemProb(prefixChosen) {
    // Decides where the exclusive mod is on item
    const getExcChosen = (reqExc = false) => {
      const allocateExclusive = (des1, exc1, des2, exc2, reqExc) => {
        // If primary and desired mod
        if (exc1 > 0 && (des1 > 0 || reqExc)) {
          return [true, false];
        }

        // If no primary, but secondary and desired mod
        else if (exc1 == 0 && exc2 > 0 && (des2 > 0 || reqExc)) {
          return [false, true];
        }

        // Has no exclusive mods or no desired mods / required mods
        return [false, false];
      };

      let [excPrefix, excSuffix] = [false, false];
      const totalExcP = this.feederItems.totalExcP;
      const totalExcS = this.feederItems.totalExcS;
      if (prefixChosen) {
        [excPrefix, excSuffix] = allocateExclusive(
          desP,
          totalExcP,
          desS,
          totalExcS,
          reqExc
        );
      } else {
        [excSuffix, excPrefix] = allocateExclusive(
          desS,
          totalExcS,
          desP,
          totalExcP,
          reqExc
        );
      }

      return [excPrefix, excSuffix];
    };

    // Returns total number of affixes required
    const getRequiredAffixes = (excPrefix, excSuffix) => {
      // Add exclusive to prefixes or suffixes
      const reqP = excPrefix ? desP + 1 : desP;
      const reqS = excSuffix ? desS + 1 : desS;

      return [reqP, reqS];
    };

    const desP = this.finalItem.desP;
    const desS = this.finalItem.desS;

    const feederItems = this.feederItems;
    const totalP = feederItems.totalP;
    const totalS = feederItems.totalS;

    // Get probs of at least getting desired + exclusive
    const [excPrefix, excSuffix] = getExcChosen();
    const [reqP, reqS] = getRequiredAffixes(excPrefix, excSuffix);
    const pProb = cumsumTable[totalP][reqP];
    const sProbAspect = cumsumTable[totalS][reqS];

    // Exact probs of getting desired + exclusive
    const [eExcPrefix, eExcSuffix] = getExcChosen(true);
    const [eReqP, eReqS] = getRequiredAffixes(eExcPrefix, eExcSuffix);
    // number of mods required on final item
    const getMinMods = (totalDes, totalMods, excMod) => {
      let minMods = minAffixes[totalMods];
      if (minMods > 0 && excMod) minMods -= 1;
      return Math.min(totalDes, minMods);
    };
    const minP = getMinMods(feederItems.totalDesP, totalP, eExcPrefix);
    const minS = getMinMods(feederItems.totalDesS, totalS, eExcSuffix);

    // if final item has too little mods, invalid. otherise get prob from table
    const exactPProb = desP < minP ? 0 : weightsTable[totalP][eReqP];
    const exactSProbAspect = desS < minS ? 0 : weightsTable[totalS][eReqS];

    // if (this.feederItems.str === "1p/2c + 1p/3c" && this.desStr === "2p/0s") {
    // if (this.feederItems.str === "1c/1s + 1p2c/1c" && this.desStr === "1p/0s") {
    // if (this.feederItems.str === "1c/1s + 1p/0s" && this.desStr === "0p/0s") {
    // if (this.feederItems.str === "2c/1s1c + 1p2c/1s1c1a" && this.desStr === "0p/2s") {
    // if (this.feederItems.str === "1c/1s1c + 1p/3c" && this.desStr === "0p/1s") {
    //   console.log("a")
    // }

    // Invalid required mods
    // if final item has too little mods, then invalid
    if (!pProb || !sProbAspect) {
      return [0, 0, 0, 0, 0, 0];
    }

    // Apply chances to avoid or annul aspect
    let sProb = sProbAspect;
    let sProbEldritch = sProbAspect;

    let exactSProb = exactSProbAspect;
    let exactSProbEdlritch = exactSProbAspect;

    if (!prefixChosen && this.feederItems.totalAspS) {
      // Only called once for each item calc when suffix first

      // If no suffixes needed on final, can lock prefix or eldritch annul
      if (this.finalItem.desS == 0) {
        // if not eldritch need to prefix lock
        this.divines += 1;
        // if eldritch, then use eldritch annul
        this.eldritchAnnuls += 1;
      } else {
        // Avg 1 / required suffixes to remove
        this.eldritchAnnuls += reqS;

        const getAspProb =
          this.feederItems.totalAspS / this.feederItems.totalExcS;
        const avoidAspProb = 1 - getAspProb;

        // need to make option for edlrtich or not
        const annulAspProb = 1 / (reqP + reqS);
        const annulAspProbEldritch = 1 / reqS;

        const applyAspectProb = (suffixProb, annulProb) =>
          suffixProb * avoidAspProb + suffixProb * getAspProb * annulProb;

        // Can either avoid aspect or get and annul
        sProb = applyAspectProb(sProb, annulAspProb);
        sProbEldritch = applyAspectProb(sProbEldritch, annulAspProbEldritch);
        exactSProb = applyAspectProb(exactSProb, annulAspProb);
        exactSProbEdlritch = applyAspectProb(
          exactSProbEdlritch,
          annulAspProbEldritch
        );
      }
    }

    // Chances of getting prefixes and suffixes
    return [
      pProb * sProb, // prob
      pProb * sProbEldritch, // probEldritch
      pProb * sProbAspect, // probAspect

      exactPProb * exactSProb, // exactProb
      exactPProb * exactSProbEdlritch, // exactProbEldritch
      exactPProb * exactSProbAspect, // exactProbAspect
    ];
  }
}

class FeederItems {
  constructor(item1, item2) {
    this.item1 = item1;
    this.item2 = item2;

    // String for desired item1 + item2
    this.desStr = [item1.desStr, item2.desStr].join(" + ");

    // Make string for full item1 + item2
    this.str = [item1.str, item2.str].join(" + ");

    // Totals for des in pool
    this.totalDesP = item1.desP + item2.desP;
    this.totalDesS = item1.desS + item2.desS;

    // Totals for exclusive in pool
    this.totalExcP = item1.craftP + item2.craftP;
    this.totalCraftedS = item1.craftS + item2.craftS;
    this.totalAspS = item1.aspS + item2.aspS;
    this.totalExcS = this.totalCraftedS + this.totalAspS;
    this.totalExc = this.totalExcP + this.totalExcS;

    // Total mods in pool
    this.totalP = this.totalDesP + this.totalExcP;
    this.totalS = this.totalDesS + this.totalExcS;

    this.excStr = `${this.totalExcP}c/${this.totalCraftedS}c${this.totalAspS}a`;

    // Total multimods
    this.multimods = item1.multimods + item2.multimods;

    // Total magic items
    this.magicCount = [item1, item2].filter((item) => item.isMagic).length;
  }
}

class Item {
  constructor(desP, desS, craftP, craftS, aspS) {
    this.desP = desP;
    this.desS = desS;
    this.craftP = craftP;
    this.craftS = craftS;
    this.aspS = aspS;

    this.totalP = desP + craftP;
    this.totalS = desS + craftS + aspS;

    this.desStr = `${desP}p/${desS}s`;
    this.str = `${this.addAffixStr(desP, "p", craftP)}/${this.addAffixStr(
      desS,
      "s",
      craftS,
      aspS
    )}`;

    this.isMagic = this.totalP <= 1 && this.totalS <= 1;

    this.multimods = craftP + craftS > 1 ? 1 : 0;
  }

  addAffixStr(xVal, xChar, cVal, aVal) {
    let str = "";

    if (xVal != 0) str += `${xVal}${xChar}`;
    if (cVal != 0) str += `${cVal}c`;
    if (aVal && aVal != 0) str += `${aVal}a`;

    return str == "" ? `0${xChar}` : str;
  }
}

// -----------------------------------------------------
// Functions for creating affix combinations
// -----------------------------------------------------

// All combinations of prefixes and suffixes
const getItemDesCombos = () => {
  const desCombos = [];
  for (let desP = 0; desP <= 3; desP++) {
    for (let desS = 0; desS <= 3; desS++) {
      if (desP == 0 && desS == 0) {
        continue;
      }
      desCombos.push({ desP, desS });
    }
  }
  return desCombos;
};

// All combinations of exclusive mods
const getItemExcCombos = () => {
  const excCombos = [];
  for (let aspS = 0; aspS <= 1; aspS++) {
    for (let craftS = 0; craftS <= 3 - aspS; craftS++) {
      const maxCraftP = craftS ? 2 : 1;
      for (let craftP = 0; craftP <= maxCraftP; craftP++) {
        if (craftP + craftS > 3) {
          continue;
        }
        excCombos.push({ craftP, craftS, aspS });
      }
    }
  }
  return excCombos;
};

// Get all possible items w/ affix and exc mods
const getAllItems = () => {
  const allItems = [];

  const allDesCombos = getItemDesCombos();
  const allExcCombos = getItemExcCombos();

  for (const desAffixes of allDesCombos) {
    for (const excAffixes of allExcCombos) {
      const { desP, desS } = desAffixes;
      const { craftP, craftS, aspS } = excAffixes;

      const item = new Item(desP, desS, craftP, craftS, aspS);

      if (item.totalP > 3 || item.totalS > 3) {
        continue;
      }

      allItems.push(item);
    }
  }

  return allItems;
};

// All item affix and exclusive mod combinations
const getFeederPairs = () => {
  const allItems = getAllItems();

  // Loop through all items and find every unique item pair
  // Unique pairs have their own desired and exclusive mods
  // If an item pair is found with more magic items, it is used instead
  const seenFeeders = {};

  for (const posItem1 of allItems) {
    for (const posItem2 of allItems) {
      // Sort items based on desired strings
      const [item1, item2] = [posItem1, posItem2].sort((a, b) => {
        if (a.desStr < b.desStr) return -1;
        if (a.desStr > b.desStr) return 1;
        return 0;
      });

      const feederItems = new FeederItems(item1, item2);
      const desStr = feederItems.desStr;
      const excStr = feederItems.excStr;
      const magicCount = feederItems.magicCount;
      const multiCount = feederItems.multimods;

      // If haven't seen item, init
      if (!(desStr in seenFeeders)) {
        seenFeeders[desStr] = {};
      }

      // If haven't seen exclusive pool, add w/ magic count
      // Set new magic count if found more
      const matchingFeeder = seenFeeders[desStr][excStr];

      if (
        !matchingFeeder ||
        magicCount > matchingFeeder.magicCount ||
        multiCount < matchingFeeder.multiCount
      ) {
        seenFeeders[desStr][excStr] = { feederItems, magicCount, multiCount };
      }
    }
  }

  // Collect all feeders into list
  const allFeederPairs = [];
  for (const excPools of Object.values(seenFeeders)) {
    for (const { feederItems } of Object.values(excPools)) {
      allFeederPairs.push(feederItems);
    }
  }

  return allFeederPairs;
};
