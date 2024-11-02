// script that perfoms calcs to make recomb data
// writes results to sheets

// -----------------------------------------------------
// Main Function
// -----------------------------------------------------

function startRecombCalc() {
  const allFeederPairs = getAllFeederPairs();

  const allRecombResults = getRecombResults(allFeederPairs);

  // think done w/ everything earlier
  // need to write to sheet

  // console.log(allRecombResults);
}

// -----------------------------------------------------
// Tables for recomb odds
// -----------------------------------------------------

// think okay to set 0 final mods as 100%
// if no desired mods and any exclusive then its guar, edge case handled separately
// if desired mods then won't have 0 final mods
const weightsTable = [
  // 0    1     2     3         final mods
  [1.0, 0.0, 0.0, 0.0], // 0 initial mods, guaranteed 0 mods
  [1.0, 0.59, 0.0, 0.0], // 1 initial mod
  [1.0, 0.67, 0.33, 0.0], // 2 initial mods
  [1.0, 0.39, 0.52, 0.1], // 3 initial mods
  [1.0, 0.11, 0.59, 0.31], // 4 initial mods
  [1.0, 0.0, 0.43, 0.57], // 5 initial mods
  [1.0, 0.0, 0.28, 0.72], // 6 initial mods
];

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
// Recombinator class for single recombination
// -----------------------------------------------------
class Recombinator {
  constructor(feederItems, finalItem) {
    this.feederItems = feederItems;
    this.finalItem = finalItem;
    this.desStr = `${finalItem.desP}p/${finalItem.desS}s`;

    // divines for multimod
    // prefix lock used when have only aspect as suffix
    // but don't need to lock prefix if can use edlritch annul
    this.divines = feederItems.multimods;
    this.divinesEldritch = feederItems.multimods;

    // Eldritch annuls used to remove aspect
    this.eldritchAnnuls = 0;

    // Prob of recomb
    // probs have only desired mods and crafted, probAspect has aspects

    [
      // At least desired mods
      this.prob,
      this.probEldritch,
      this.probAspect,
      this.probEldritchAspect,
      // Exactly desired mods
      this.exactProb,
      this.exactProbEldritch,
      this.exactProbAspect,
      this.exactProbEldritchAspect,
    ] = this.getProb();
  }

  addFailedItems(
    failedList,
    totalProb,
    totalProbEldritch,
    totalProbAspect,
    totalProbEldritchAspect
  ) {
    // Update probs to make sum 1
    for (let recomb of failedList) {
      recomb.exactProb /= totalProb;
      recomb.exactProbEldritch /= totalProbEldritch;
      recomb.exactProbAspect /= totalProbAspect;
      recomb.exactProbEldritchAspect /= totalProbEldritchAspect;

      if (
        this.desStr == "0p/2s" &&
        (recomb.exactProb != 1 ||
          recomb.exactProbEldritch != 1 ||
          recomb.exactProbAspect != 1 ||
          recomb.exactProbEldritchAspect != 1)
      ) {
        console.log("chekc");
      }
    }

    this.failedItems = failedList;
  }

  clone() {
    return new Recombinator(this.feederItems, this.finalItem);
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

    if (this.feederItems.totalExcP === 1 && this.finalItem.desP === 0) {
      [pMod, sMod] = adjustProbs(pMod, sMod);
    } else if (this.feederItems.totalExcS === 1 && this.finalItem.desS === 0) {
      [sMod, pMod] = adjustProbs(sMod, pMod);
    }

    // Adjust prob if need to regal final item if magic
    let regalMod = 1;
    let regalModEldritch = 1;
    if (
      this.finalItem.desP == 1 &&
      this.finalItem.desS == 1 &&
      this.feederItems.totalExc == 0
    ) {
      regalMod = 1 / 3;
      regalModEldritch = 1 / 2;
    }

    const applyMod = ([pProb, sProb], rMod) =>
      rMod * (pProb * pMod + sProb * sMod);

    return [
      applyMod([pProbs[0], sProbs[0]], regalMod), // prob
      applyMod([pProbs[0], sProbs[0]], regalModEldritch), // probEldritch
      applyMod([pProbs[1], sProbs[1]], regalMod), // probAspect
      applyMod([pProbs[2], sProbs[2]], regalModEldritch), // probEldritchAspect

      applyMod([pProbs[3], sProbs[3]], regalMod), // exactProb
      applyMod([pProbs[3], sProbs[3]], regalModEldritch), // exactProbEldritch
      applyMod([pProbs[4], sProbs[4]], regalMod), // exactProbAspect
      applyMod([pProbs[5], sProbs[5]], regalModEldritch), // exactProbEldritchAspect
    ];
  }

  calcItemProb(prefixChosen) {
    // Decides where the exclusive mod is on item
    const allocateExclusive = (des1, exc1, des2, exc2) => {
      // Must be primary if have exclusive and desired
      // If no desired mods, then don't need to add a required
      if (exc1 > 0 && des1 > 0) {
        return [true, false];
      }
      // If not primary, but secondary, then need secondary
      else if (exc2 > 0 && des2 > 0) {
        return [false, true];
      }
      // Has no exclusive mods or no desired mods
      else {
        return [false, false];
      }
    };

    let [excPrefix, excSuffix] = [false, false];
    if (prefixChosen) {
      [excPrefix, excSuffix] = allocateExclusive(
        this.finalItem.desP,
        this.feederItems.totalExcP,
        this.finalItem.desS,
        this.feederItems.totalExcS
      );
    } else {
      [excSuffix, excPrefix] = allocateExclusive(
        this.finalItem.desS,
        this.feederItems.totalExcS,
        this.finalItem.desP,
        this.feederItems.totalExcP
      );
    }

    // Add exclusive to prefixes or suffixes
    const requiredP = excPrefix ? this.finalItem.desP + 1 : this.finalItem.desP;
    const requiredS = excSuffix ? this.finalItem.desS + 1 : this.finalItem.desS;

    // Get probs of getting required mods
    const pProb = cumsumTable[this.feederItems.totalP][requiredP];
    const sProbAspect = cumsumTable[this.feederItems.totalS][requiredS];

    const exactPProb = weightsTable[this.feederItems.totalP][requiredP];
    const exactSProbAspect = weightsTable[this.feederItems.totalS][requiredS];

    // Invalid required mods
    if (!pProb || !sProbAspect) {
      return [0, 0, 0, 0, 0, 0];
    }

    // Apply chances to avoid or annul aspect
    let sProb = sProbAspect;
    let sProbEldritchAspect = sProbAspect;
    let exactSProb = exactSProbAspect;
    let exactSProbEdlritchAspect = exactSProbAspect;

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
        this.eldritchAnnuls += requiredS;

        const getAspProb =
          this.feederItems.totalAspS / this.feederItems.totalExcS;
        const avoidAspProb = 1 - getAspProb;

        // need to make option for edlrtich or not
        const annulAspProb = 1 / (requiredP + requiredS);
        const annulAspProbEldritch = 1 / requiredS;

        const applyAspectProb = (suffixProb, annulProb) =>
          suffixProb * avoidAspProb + suffixProb * getAspProb * annulProb;

        // Can either avoid aspect or get and annul
        sProb = applyAspectProb(sProb, annulAspProb);
        sProbEldritchAspect = applyAspectProb(
          sProbEldritchAspect,
          annulAspProbEldritch
        );
        exactSProb = applyAspectProb(exactSProb, annulAspProb);
        exactSProbEdlritchAspect = applyAspectProb(
          exactSProbEdlritchAspect,
          annulAspProbEldritch
        );
      }
    }

    // Chances of getting prefixes and suffixes
    return [
      pProb * sProb, // prob
      pProb * sProbAspect, // probAspect
      pProb * sProbEldritchAspect, // probEldritchAspect

      exactPProb * exactSProb, // exactProb
      exactPProb * exactSProbAspect, // exactProbAspect
      exactPProb * exactSProbEdlritchAspect, // exactProbEldritchAspect
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

    this.excStr = `${this.totalExcP}/${this.totalExcS}`;

    // Total multimods
    this.multimods = item1.multimods + item2.multimods;
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
    this.str = `${desP}p${craftP}c/${desS}s${craftS}c${aspS}a`;

    this.isMagic = this.totalP <= 1 && this.totalS <= 1;

    this.multimods = craftP + craftS > 1 ? 1 : 0;
  }
}

// -----------------------------------------------------
// Functions for recombination calculations
// -----------------------------------------------------

const getRecombResults = (allFeederPairs) => {
  const allResults = {};

  for (const feederItems of allFeederPairs) {
    const item1 = feederItems.item1;
    const item2 = feederItems.item2;

    // loop through all possible final items
    // all recomb

    // want better way of getting probabiltiies as well as failed itme probs
    // doing full calc for each possible final item seems inefficient
    //    get all final items for item combo
    //    caclate prob and all failes for each item
    //    same logic as better method? can improve later if need

    // when is an item combination valid for a final item?
    // impossible if des affixes on items are less than final
    // but don't want to have 0/1 + 3/3 to get 0/1 for example
    // but if you have a 3/3, then 0/1 is a downgrade
    // 2/0 + 2/0 -> 3/0 is fine
    // 3/0 + 0/1 -> 1/1 is fine
    // 1/2 + 0/1 -> 1/2 is bad
    // 2/0 + 1/1 -> 2/1 is fine

    // All possible recombs for feeder items
    const posRecombs = [];

    let totalProb = 0;
    let totalProbEldritch = 0;
    let totalProbAspect = 0;
    let totalProbEldritchAspect = 0;

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
        const finalItem = { desP: finalP, desS: finalS };

        // dont think can make 0 mod results
        if (finalP == 0 && finalS == 0) {
          continue;
        }

        // Want to get all options for final item, used to add failed
        // Fine to have same number of mods as feeder, used for transfering
        // if (
        //   // Final can't have less total mods than both feeders
        //   // Maybe okay to use || instead of &&, not sure
        //   finalP + finalS < item1.desP + item1.desS &&
        //   finalP + finalS < item2.desP + item2.desS
        // ) {
        //   continue;
        // }

        const recomb = new Recombinator(feederItems, finalItem);

        // skip if impossible to recomb
        if (recomb.prob == 0) continue;

        // Add recomb to all results
        if (!(recomb.desStr in allResults)) {
          allResults[recomb.desStr] = [];
        }
        allResults[recomb.desStr].push(recomb);

        // skip if can't get exact final item
        if (recomb.exactProb == 0) continue;

        totalProb += recomb.exactProb;
        totalProbEldritch += recomb.exactProbEldritch;
        totalProbAspect += recomb.exactProbAspect;
        totalProbEldritchAspect += recomb.exactProbEldritchAspect;

        posRecombs.push(recomb);
      }
    }

    // add failed items to recombs
    while (posRecombs.length > 0) {
      const recomb = posRecombs.pop();

      totalProb -= recomb.exactProb;
      totalProbEldritch -= recomb.exactProbEldritch;
      totalProbAspect -= recomb.exactProbAspect;
      totalProbEldritchAspect -= recomb.exactProbEldritchAspect;

      // need to make copy of recombs for failed
      const failedItems = [];
      for (let failedRecomb of posRecombs) {
        failedItems.push(failedRecomb.clone());
      }

      recomb.addFailedItems(
        failedItems,
        totalProb,
        totalProbEldritch,
        totalProbAspect,
        totalProbEldritchAspect
      );
    }
  }

  return allResults;
};

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
const getAllFeederPairs = () => {
  const allItems = getAllItems();

  // Loop through all items and find every unique item pair
  // Unique pairs have their own desired and exclusive mods
  // If an item pair is found with more magic items, it is used instead
  let seenFeeders = {};

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

      const magicCount = [item1, item2].filter((item) => item.isMagic).length;

      // If haven't seen item, init
      if (!(desStr in seenFeeders)) {
        seenFeeders[desStr] = {};
      }

      // If haven't seen exclusive pool, add w/ magic count
      // Set new magic count if found more
      const matchingFeeder = seenFeeders[desStr][excStr];
      if (!matchingFeeder || magicCount > matchingFeeder.magicCount) {
        seenFeeders[desStr][excStr] = { feederItems, magicCount };
      }
    }
  }

  const allFeederPairs = [];
  for (const excPools of Object.values(seenFeeders)) {
    for (const { feederItems } of Object.values(excPools)) {
      allFeederPairs.push(feederItems);
    }
  }

  return allFeederPairs;
};

// -----------------------------------------------------
// Call main func to start, used for VS Code
// -----------------------------------------------------
// startRecombCalc();
