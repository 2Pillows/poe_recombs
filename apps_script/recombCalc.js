// script that perfoms calcs to make recomb data
// writes results to sheets

// -----------------------------------------------------
// Main Function
// -----------------------------------------------------

function startRecombCalc() {
  const allFeederPairs = getAllFeederPairs();

  const allRecombResults = getRecombResults(allFeederPairs);

  // console.log(allRecombResults);
}

// -----------------------------------------------------
// Tables for recomb odds
// -----------------------------------------------------
const weightsTable = [
  // 0    1     2     3         final mods
  [1.0, 0.0, 0.0, 0.0], // 0 initial mods, guaranteed 0 mods
  [0.41, 0.59, 0.0, 0.0], // 1 initial mod
  [0.0, 0.67, 0.33, 0.0], // 2 initial mods
  [0.0, 0.39, 0.52, 0.1], // 3 initial mods
  [0.0, 0.11, 0.59, 0.31], // 4 initial mods
  [0.0, 0.0, 0.43, 0.57], // 5 initial mods
  [0.0, 0.0, 0.28, 0.72], // 6 initial mods
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
  constructor(feederItems, finalItem, finalItemStr) {
    this.feederItems = feederItems;
    this.finalItem = finalItem;
    this.finalItemStr = finalItemStr;

    // divines for multimod
    // prefix lock used when have only aspect as suffix
    // but don't need to lock prefix if can use edlritch annul
    this.divines = feederItems.multimods;
    this.divinesEldritch = feederItems.multimods;

    // Eldritch annuls used to remove aspect
    this.eldritchAnnuls = 0;

    // Prob of recomb
    // probs have only desired mods and crafted, probAspects has aspects
    [this.prob, this.probAspects] = this.getProb(false);
    [this.probEldritch, this.probEldritchAspects] = this.getProb(true);

    // list of all items and their probabilites for if recomb fails
    this.failedProbs = this.getFailed();
  }

  getProb(isEldritch) {
    // get probs for final item for two scenarios of prefix or suffix chosen first
    // clean prob has no other mods besides desired, prob has aspects
    let [pProb, pProbAspect] = this.calcItemProb(isEldritch, true);
    let [sProb, sProbAspect] = this.calcItemProb(isEldritch, false);

    // Edge case if item has 1 exclusive affix and no desired affixes
    // The side chosen by recomb may not get any mods, meaning exclusive must appear on other side
    // If more than 1 exclusive affix then guaranteed to land on first chosen side
    // 59% chance to get exclusive, 41% chance to move exclusive to other side
    const adjustProbs = (fProb, sProb) => {
      return [fProb * 0.59, sProb * 1.41];
    };
    if (this.feederItems.totalExcP == 1 && this.finalItem.desP == 0) {
      [pProb, sProb] = adjustProbs(pProb, sProb);
      [pProbAspect, sProbAspect] = adjustProbs(pProbAspect, sProbAspect);
    } else if (this.feederItems.totalExcS == 1 && this.finalItem.desS == 0) {
      [sProb, pProb] = adjustProbs(sProb, pProb);
      [sProbAspect, pProbAspect] = adjustProbs(sProbAspect, pProbAspect);
    }

    let recombProb = 0.5 * (pProb + sProb);
    let recombProbAspect = 0.5 * (pProbAspect + sProbAspect);

    // Adjust prob if need to regal final item if magic
    if (
      this.finalItem.desP == 1 &&
      this.finalItem.desS == 1 &&
      this.feederItems.totalExc == 0
    ) {
      recombProb *= isEldritch ? 1 / 2 : 1 / 3;
    }

    return [recombProb, recombProbAspect];
  }

  calcItemProb(isEldritch, prefixChosen) {
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
    const prefixProb = cumsumTable[this.feederItems.totalP][requiredP];
    const suffixProb = cumsumTable[this.feederItems.totalS][requiredS];

    // Invalid required mods
    if (!prefixProb || !suffixProb) {
      return [0, 0];
    }

    // Apply chances to avoid or annul aspect
    let suffixProbClean = suffixProb;
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

        const annulAspProb = isEldritch
          ? 1 / requiredS
          : 1 / (requiredP + requiredS);

        // Can either avoid aspect or get and annul
        suffixProbClean =
          suffixProbClean * (avoidAspProb + getAspProb * annulAspProb);
      }
    }

    // Chances of getting prefixes and suffixes
    return [prefixProb * suffixProbClean, prefixProb * suffixProb];
  }

  getFailed() {
    // know starting total mods in pool
    // get row of options for final affix count
    const prefixOption = weightsTable[this.feederItems.totalP];
    const suffixOptions = weightsTable[this.feederItems.totalS];

    // know options for affixes
    // get probs for prefix or suffix?
    // if have exclusive affixes on both then 50 / 50, except for 1 exclusive

    return [];
  }

  // Moved to path calcs, recombs list if one mod item used, then factored into path
  // // Prob of getting one mod starting items
  // const getModRollingProb = (item) => {
  //   if (item.desP + item.desS == 1) {
  //     if (
  //       item.desP + item.craftP > 1 ||
  //       item.desS + item.craftS + item.aspS > 1
  //     ) {
  //       // regal adds +1 mod
  //       // 2/3 to get 2 mods, 2 annuls
  //       // 1/3 to get 1 mod, 1 annul
  //       return (2 / 3) * (2 / 3) * (1 / 2) + (1 / 3) * (1 / 2);
  //     } else {
  //       // 2/3 to get 2 mods, 1 annul
  //       return (2 / 3) * (1 / 2) + 1 / 3;
  //     }
  //   }

  //   return 1;
  // };
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
    // 2/0 + 1/1 -> 2/1 is okya

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
        const finalItemStr = `${finalP}p/${finalS}s`;

        // Fine to have same number of mods as feeder, used for transfering
        if (
          // Final can't have less total mods than both feeders
          // Maybe okay to use || instead of &&, not sure
          finalP + finalS < item1.desP + item1.desS &&
          finalP + finalS < item2.desP + item2.desS
        ) {
          continue;
        }

        const recomb = new Recombinator(feederItems, finalItem, finalItemStr);

        // Add recomb to all results
        if (!(finalItemStr in allResults)) {
          allResults[finalItemStr] = [];
        }

        allResults[finalItemStr].push(recomb);
      }
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
startRecombCalc();

// notes from old py
//include prob if need to regal and annul to fit exclusive mods

//1/2 alt gives prefix and suffix, regal into 2/3 annul and 1/3 annul
//1/4 alt gives prefix or suffix, regal into 1/2 annul
//if prefix or suffix, 2/3 chance to have other mod. 1/3 to be one mod

//if 1 mod item and no regal, need to include chance of being a 1 mod item

//regal_chances = 2 / 3 * 2 / 3 * 1 / 2 + 1 / 3 * 1 / 2
//magic_chances = 2 / 3 * 1 / 2 + 1 / 3 * 1

//annul_chances = 1

////if item1 has max 1 prefix or suffix its assumed magic
////if item is magic, need to factor in chance of regal and annuling
//if self.item1_desired_prefixes + self.item1_desired_suffixes == 1:
//    //magic item that needs to be regaled
//    if self.item1_rare:
//        annul_chances *= regal_chances
//    //magic item, no regal needed
//    else:
//        annul_chances *= magic_chances

//if self.item2_desired_prefixes + self.item2_desired_suffixes == 1:
//    //magic item that needs to be regaled
//    if self.item2_rare:
//        annul_chances *= regal_chances
//    //magic item, no regal needed
//    else:
//        annul_chances *= magic_chances

//self.overallProb = round(
//    0.5 * annul_rare_mod * annul_chances * (prefix_first + suffix_first), 4
//)

//get odds for all options for recomb

//prefix_options = WEIGHTS[self.total_prefixes]
//suffix_options = WEIGHTS[self.total_suffixes]

//max_prefix = self.total_desired_prefixes
//max_suffix = self.total_desired_suffixes
//total_mods = self.total_desired_prefixes + self.total_desired_suffixes

////if exclusive_prefix and total_mods > 1:
////    max_prefix -= 1

////if exclusive_suffix and total_mods > 1:
////    max_suffix -= 1

//for final_prefixes, prefix_percent in enumerate(prefix_options):
//    for final_suffixes, suffix_percent in enumerate(suffix_options):

//        //if prefix count and suffix count > required prefixes and suffixes, then is counted as success
//        //otherwise, its a failure, need to get final item after removing exclusive mod

//        //adjust prefix and suffix count for exclusive mods
//        prefix_count = final_prefixes
//        suffix_count = final_suffixes

//        if exclusive_prefix:
//            prefix_count -= 1

//        if exclusive_suffix:
//            suffix_count -= 1

//        if (
//            //successful item
//            (
//                prefix_count >= self.final_prefixes
//                and suffix_count >= self.final_suffixes
//            )
//            //can't get item
//            or prefix_percent == 0
//            or suffix_percent == 0
//            //invalid affix count
//            or prefix_count < 0
//            or suffix_count < 0
//            //too many mods
//            //or max_prefix < prefix_count
//            //or max_suffix < suffix_count
//        ):
//            continue

//        percent = prefix_percent * suffix_percent

//        //NEED TO FIGURE OUT HOW TO LIST ITEMS FOR READING PATH COST
//        //should be possible to get more than final number of prefixes or suffixes
//        //can't have more than desired prefixes or suffixes

//        self.itemOptions.append(
//            (
//                f"{min(self.total_desired_prefixes, prefix_count)}p/{min(self.total_desired_suffixes, suffix_count)}s",
//                //f"{prefix_count}p/{suffix_count}s",
//                percent,
//            )
//        )
//        self.total_fail_prob += percent

//        //if percent < 0.1:
//        //    print("a")

//        //item = f"({prefix_count}p/{suffix_count}s, {percent})"

//        //itemStrings += ", " + item if len(itemStrings) > 0 else item

//return prefix_prob * suffix_prob

//def getRecombFailStrings(self):
//    itemStrings = ""
//    scaling = 1 / self.total_fail_prob if self.total_fail_prob > 0 else 1

//    for item in self.itemOptions:
//        new_prob = round(item[1] * scaling, 4)
//        item = f"({item[0]} {new_prob})"
//        itemStrings += " " + item if len(itemStrings) > 0 else item

//    if itemStrings != "":
//        self.all_recomb_odds += itemStrings + " "
//    else:
//        self.all_recomb_odds = "(0p/0s 1.0)"

//if same multimod count, aspect, and magic_multimods but better prob, remove current and add other
//def add_to_item_pair_recombs(item_pair_recombs, recomb: Recombinate):
//    match_found = False

//    for i, cur_recomb in enumerate(item_pair_recombs):
//        cur_recomb: Recombinate
//        if (
//            cur_recomb.item1_rare != recomb.item1_rare
//            or cur_recomb.item2_rare != recomb.item2_rare
//        ):
//            print("a")
//        //find other recomb w/ same multimods and aspects, same cost
//        if (
//            cur_recomb.multimods_used == recomb.multimods_used
//            and cur_recomb.aspect_suffix_count == recomb.aspect_suffix_count
//            and cur_recomb.item1_rare == recomb.item1_rare
//            and cur_recomb.item2_rare == recomb.item2_rare
//        ):
//            //if better prob, replace index w/ new recomb
//            if cur_recomb.recombProb < recomb.recombProb or (
//                cur_recomb.recombProb == recomb.recombProb
//                and (
//                    (
//                        cur_recomb.total_desired_prefixes > 0
//                        and cur_recomb.total_exclusive_prefixes
//                        < recomb.total_exclusive_prefixes
//                    )
//                    or (
//                        cur_recomb.total_desired_suffixes > 0
//                        and cur_recomb.total_exclusive_suffixes
//                        < recomb.total_exclusive_suffixes
//                    )
//                )
//            ):
//                item_pair_recombs[i] = recomb

//            match_found = True
//            break

//    if not match_found:
//        item_pair_recombs.append(recomb)

//    return item_pair_recombs

//def write_to_file(filename, data, format_line):
//    with open(filename, "w") as f:
//        for final_item, items_list in data.items():
//            if not items_list:
//                continue

//            f.write(f"\n-------------------------------------\n")
//            f.write(f"{final_item.to_string()}\n")

//            for item in items_list:
//                f.write(format_line(item))

//def format_recomb_line(recomb: Recombinate):
//    return (
//        f"Items: {recomb.get_item1().to_string()} + {recomb.get_item2().to_string()}, "
//        f"Exclusive: {recomb.get_exclusive_mods()}, "
//        f"Prob: {recomb.recombProb:.2%}\n"
//    )

//def format_recomb_detailed_line(recomb: Recombinate):
//    return (
//        f"item1: {recomb.get_item1().to_string()}, "
//        f"item2: {recomb.get_item2().to_string()}, "
//        f"exclusiveMods: {recomb.get_exclusive_mods()}, "
//        f"recombProb: {recomb.recombProb}, "
//        f"overallProb: {recomb.overallProb}, "
//        f"item1Rare: {recomb.item1_rare}, "
//        f"item2Rare: {recomb.item2_rare}, "
//        f"multimodCount: {recomb.multimods_used}, "
//        f"aspectSuffixCount: {recomb.aspect_suffix_count}, "
//        f"eldritchAnnulCount: {recomb.annuls_used}, "
//        f"failedItemProbs: {recomb.all_recomb_odds}\n"
//    )

//def main():
//    item_combos = get_item_combos()
//    exclusive_combos = get_exclusive_combinations()

//    recomb_dict = get_recomb_dict(item_combos, exclusive_combos, eldritch_annul=False)
//    recomb_dict_eldritch = get_recomb_dict(
//        item_combos, exclusive_combos, eldritch_annul=True
//    )

//    script_recomb_dict = get_script_dict(
//        item_combos, exclusive_combos, eldritch_annul=False
//    )
//    script_recomb_dict_eldritch = get_script_dict(
//        item_combos, exclusive_combos, eldritch_annul=True
//    )

//    write_to_file("results/all_recombs.txt", recomb_dict, format_recomb_line)
//    write_to_file(
//        "results/all_recombs_eldritch.txt",
//        recomb_dict_eldritch,
//        format_recomb_line,
//    )

//    write_to_file("results/best_recombs.txt", script_recomb_dict, format_recomb_line)
//    write_to_file(
//        "results/best_recombs_eldritch.txt",
//        script_recomb_dict_eldritch,
//        format_recomb_line,
//    )

//    write_to_file(
//        "results/detailed_recombs.txt",
//        script_recomb_dict,
//        format_recomb_detailed_line,
//    )
//    write_to_file(
//        "results/detailed_recombs_eldritch.txt",
//        script_recomb_dict_eldritch,
//        format_recomb_detailed_line,
//    )
