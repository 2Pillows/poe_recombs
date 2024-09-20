# new main.py

from collections import deque, defaultdict
import heapq
import re

# constants
MAX_MOD_POOL = 6
MAX_BASE_CRAFTED_MODS = 2
MAX_MULTI_CRAFTED_MODS = 6
MAX_CRAFTED_PER_MULTIMOD = 3

MAX_INITIAL_MODS = 6
MAX_FINAL_MODS = 3

# costs
BASE_COST = 0.1
ASPECT_COST = 0.2

# cumulative sum of weight table
# odds of getting at least X mods
CUMSUM = [
    # 0    1     2     3         final mods
    [1.00, 0.00, 0.00, 0.00],  # 0 initial mods, guaranteed 0 mods
    [1.00, 0.59, 0.00, 0.00],  # 1 initial mod
    [1.00, 1.00, 0.33, 0.00],  # 2 initial mods
    [1.00, 1.00, 0.62, 0.10],  # 3 initial mods
    [1.00, 1.00, 0.90, 0.31],  # 4 initial mods
    [1.00, 1.00, 1.00, 0.57],  # 5 initial mods
    [1.00, 1.00, 1.00, 0.72],  # 6 initial mods
]


def get_item_combos():
    return [
        Item(prefix_count, suffix_count)
        for prefix_count in range(4)  # 0-3 prefixes
        for suffix_count in range(4)  # 0-3 suffixes
    ]


def get_exclusive_combinations():
    return [
        (
            crafted_prefix_count,
            crafted_suffix_count,
            aspect_suffix_count,
        )
        for crafted_prefix_count in range(5)  # 0-4 crafted prefixes
        for crafted_suffix_count in range(7)  # 0-6 crafted suffixes
        for aspect_suffix_count in range(3)  # 0-2 aspect suffixes
    ]


# item
class Item:
    def __init__(self, prefix_count, suffix_count) -> None:
        self.prefix_count = prefix_count
        self.suffix_count = suffix_count

        self.path_prob = 0

    def get_crafted_combos(self, aspect_count=0):
        crafted_combos = set()

        MAX_CRAFTED_PREFIXES = min(2, MAX_FINAL_MODS - self.prefix_count)
        MAX_CRAFTED_SUFFIX = min(
            3,
            MAX_FINAL_MODS - self.suffix_count - aspect_count,
        )

        for crafted_prefix in range(MAX_CRAFTED_PREFIXES, -1, -1):
            for crafted_suffix in range(
                MAX_CRAFTED_SUFFIX,
                -1,
                -1,
            ):
                #
                if crafted_suffix == 0 and crafted_prefix > 1:
                    crafted_prefix = 1

                MAX_ITEM_CRAFTED_MODS = 3 if crafted_suffix > 0 else 1

                if crafted_prefix + crafted_suffix > MAX_ITEM_CRAFTED_MODS:
                    continue

                crafted_combos.add((crafted_prefix, crafted_suffix))

        self.crafted_combos = crafted_combos

        return crafted_combos

    def get_item(self):
        return (self.prefix_count, self.suffix_count)

    def to_string(self):
        return f"{self.prefix_count}p/{self.suffix_count}s"

    def __hash__(self):
        return hash((self.prefix_count, self.suffix_count))

    def __eq__(self, value: object) -> bool:
        if isinstance(value, Item):
            return (
                self.prefix_count == value.prefix_count
                and self.suffix_count == value.suffix_count
            )
        return False


class Recombinate:
    def __init__(
        self,
        item1,
        item2,
        exclusive_mods,
        final_item,
        eldritch_annul,
        equal_affixes=False,
    ) -> None:
        # two items used in recomb
        self.item1: Item = item1
        self.item2: Item = item2

        # goal final item of recomb
        self.final_item: Item = final_item

        # exclusive mods
        (
            self.crafted_prefix_count,
            self.crafted_suffix_count,
            self.aspect_suffix_count,
        ) = exclusive_mods

        self.eldritch_annul = eldritch_annul

        # number of times need to multimod
        self.multimods_used = float("inf")

        # number of annuls used
        self.annuls_used = 0

        # number of times u need to lock prefix to remove aspect
        self.prefix_lock_required = False

        self.regal_item1 = False
        self.regal_item2 = False

        self.recomb_string = self.item1.to_string() + " + " + self.item2.to_string()

        self.equal_affixes = equal_affixes

        # get probability of recombination
        self.probability = 0
        self.annul_chances = 0
        self._get_recombinate_prob()

        self.bench_cost = self._get_bench_cost()

    def get_item1(self):
        return self.item1

    def get_item2(self):
        return self.item2

    def get_exclusive_mods(self):
        return f"{self.crafted_prefix_count}c/{self.crafted_suffix_count}c{self.aspect_suffix_count}a"

    # returns chance to recombinate item1 + item2 = final item
    def _get_recombinate_prob(self):
        (self.item1_desired_prefixes, self.item1_desired_suffixes) = (
            self.item1.get_item()
        )
        (self.item2_desired_prefixes, self.item2_desired_suffixes) = (
            self.item2.get_item()
        )

        # desired mods
        self.total_desired_prefixes = (
            self.item1_desired_prefixes + self.item2_desired_prefixes
        )
        self.total_desired_suffixes = (
            self.item1_desired_suffixes + self.item2_desired_suffixes
        )

        # exclusive mods
        self.total_exclusive_prefixes = self.crafted_prefix_count
        self.total_exclusive_suffixes = (
            self.crafted_suffix_count + self.aspect_suffix_count
        )
        self.total_exclusive_mods = (
            self.total_exclusive_prefixes + self.total_exclusive_suffixes
        )

        # total mods
        self.total_prefixes = (
            self.total_desired_prefixes + self.total_exclusive_prefixes
        )
        self.total_suffixes = (
            self.total_desired_suffixes + self.total_exclusive_suffixes
        )

        if (
            # final item
            self.final_item.get_item() == (0, 2)
            # # item1
            and self.item1.get_item() == (0, 1)
            # # item2
            and self.item2.get_item() == (0, 1)
            # # exclusive mods
            and self.crafted_prefix_count == 1
            and self.crafted_suffix_count == 1
            and self.aspect_suffix_count == 0
        ):
            print("check")

        if self._invalid_crafted_mods():
            return 0, 0

        # if prefix first, suffixes assume no exclusive, but requires there to be exclusive prefixes
        prefix_first = self._item_probability(prefix_first=True)
        suffix_first = self._item_probability(suffix_first=True)

        annul_rare_mod = 1
        # if only 1 prefix and suffix wo/ exclusive mods, need to reagl and annul
        if (
            self.final_item.prefix_count == 1
            and self.final_item.suffix_count == 1
            and self.total_exclusive_mods == 0
        ):
            annul_rare_mod = 1 / 2 if self.eldritch_annul else 1 / 3

        self.probability = 0.5 * annul_rare_mod * (prefix_first + suffix_first)

        # if item1 has max 1 prefix or suffix its assumed magic
        # if item is magic, need to factor in chance of regal and annuling
        if (
            self.item1_desired_prefixes + self.item1_desired_suffixes == 1
            or self.item2_desired_prefixes + self.item2_desired_suffixes == 1
        ):
            # include prob if need to regal and annul to fit exclusive mods

            # 1/2 alt gives prefix and suffix, regal into 2/3 annul and 1/3 annul
            # 1/4 alt gives prefix or suffix, regal into 1/2 annul
            # if prefix or suffix, 2/3 chance to have other mod. 1/3 to be one mod

            # if 1 mod item and no regal, need to include chance of being a 1 mod item

            regal_chances = 2 / 3 * 2 / 3 * 1 / 2 + 1 / 3 * 1 / 2
            magic_chances = 2 / 3 * 1 / 2 + 1 / 3 * 1

            self.annul_chances = 1

            # magic item that needs to be regaled
            if self.regal_item1:
                self.annul_chances *= regal_chances
            # magic item, no regal needed
            else:
                self.annul_chances *= magic_chances

            if self.regal_item2:
                self.annul_chances *= regal_chances
            else:
                self.annul_chances *= magic_chances

    def _invalid_crafted_mods(self):
        (final_prefixes, final_suffixes) = self.final_item.get_item()

        magic_items = [False, False]

        # if both items are magic, limited to 2 prefix and 2 suffix
        if (self.item1_desired_prefixes + self.item1_desired_suffixes == 1) and (
            self.item2_desired_prefixes + self.item2_desired_suffixes == 1
        ):
            # if self.total_prefixes <= 2 and self.total_suffixes <= 2:
            magic_items = [True, True]
            self.regal_item1 = True
            self.regal_item2 = True

        # item1 magic, limited to 1 prefix / suffix on item1 and 3 prefix / suffix on item2
        elif (self.item1_desired_prefixes + self.item1_desired_suffixes == 1) or (
            self.item2_desired_prefixes + self.item2_desired_suffixes == 1
        ):
            # if self.total_prefixes <= 4 and self.total_suffixes <= 4:
            if self.item1_desired_prefixes <= 1 and self.item1_desired_suffixes <= 1:
                magic_items = [True, False]
                self.regal_item1 = True
            else:
                magic_items = [False, True]
                self.regal_item2 = True

        # basic item check, can get valid mods and less ovrall item
        invalid_total_mods = (
            sum(self.item1.get_item()) > sum(self.final_item.get_item())
            or sum(self.item2.get_item()) > sum(self.final_item.get_item())
            if self.equal_affixes
            else sum(self.item1.get_item()) >= sum(self.final_item.get_item())
            or sum(self.item2.get_item()) >= sum(self.final_item.get_item())
        )

        if (
            # need at least desired number of affixes
            self.total_desired_prefixes < final_prefixes
            or self.total_desired_suffixes < final_suffixes
            # dont include if a single item has more desired mods than final
            or invalid_total_mods
        ):
            return True

        def invalid_mods(item1_crafted_combos, item2_crafted_combos):
            valid_crafted_mods = False

            for item1_crafted in item1_crafted_combos:
                for item2_crafted in item2_crafted_combos:

                    crafted_prefixes = item1_crafted[0] + item2_crafted[0]
                    crafted_suffixes = item1_crafted[1] + item2_crafted[1]

                    # require matching crafted mods
                    if (
                        crafted_prefixes != self.crafted_prefix_count
                        or crafted_suffixes != self.crafted_suffix_count
                    ):
                        continue

                    valid_crafted_mods = True

                    # add multimod if either item has more than 1 crafted mod
                    recomb_multimods = 0
                    if sum(item1_crafted) > 1:
                        recomb_multimods += 1
                    if sum(item2_crafted) > 1:
                        recomb_multimods += 1

                    if recomb_multimods < self.multimods_used:
                        self.multimods_used = recomb_multimods

                        # make string for recomb
                        # self.recomb_string = f"{self.item1_desired_prefixes}p{item1_crafted[0]}c/{self.item1_desired_suffixes}s{item2_crafted[0]}c{}a + {}p{}c/{}s{}c{}a"

                    # if items can be magic, get magic recomb amount
                    # if (
                    #     self.total_desired_prefixes + crafted_prefixes <= affix_limit
                    #     and self.total_desired_suffixes
                    #     + crafted_suffixes
                    #     + self.aspect_suffix_count
                    #     <= affix_limit
                    # ):

                    # invalid_exclusive = False
                    # check if item works if magic

                    item1_total_prefixes = (
                        self.item1_desired_prefixes + item1_crafted[0]
                    )
                    item1_total_suffixes = (
                        self.item1_desired_suffixes + item1_crafted[1]
                    )

                    item2_total_prefixes = (
                        self.item2_desired_prefixes + item2_crafted[0]
                    )
                    item2_total_suffixes = (
                        self.item2_desired_suffixes + item2_crafted[1]
                    )

                    # if both magic
                    if magic_items[0] and magic_items[1]:
                        if (
                            item1_total_prefixes <= 1
                            and item1_total_suffixes <= 1
                            and item2_total_prefixes <= 1
                            and item2_total_suffixes <= 1
                            and (
                                item1_total_suffixes
                                + item2_total_suffixes
                                + self.aspect_suffix_count
                                <= 2
                            )
                        ):
                            self.regal_item1 = False
                            self.regal_item2 = False

                    # only item1 magic
                    elif magic_items[0]:
                        if (
                            item1_total_prefixes <= 1
                            and item1_total_suffixes <= 1
                            and (
                                item1_total_suffixes
                                + item2_total_suffixes
                                + self.aspect_suffix_count
                                <= 4
                            )
                        ):
                            self.regal_item1 = False
                    # only item 2 magic
                    elif magic_items[1]:
                        if (
                            item2_total_prefixes <= 1
                            and item2_total_suffixes <= 1
                            and (
                                item1_total_suffixes
                                + item2_total_suffixes
                                + self.aspect_suffix_count
                                <= 4
                            )
                        ):
                            self.regal_item2 = False

                    # if magic_items[0] and (
                    #     self.item1_desired_prefixes + item1_crafted[0] <= 1
                    #     or self.item1_desired_suffixes
                    #     + item1_crafted[1]
                    #     <= 1
                    # ):
                    #     self.regal_item1 = False
                    #     if
                    #     aspects_needed += 1
                    # invalid_exclusive = True

                    # if magic_items[1] and (
                    #     self.item2_desired_prefixes + item2_crafted[0] > 1
                    #     or self.item2_desired_suffixes
                    #     + item2_crafted[1]
                    #     <= 1
                    # ):
                    #     self.regal_item2 = True
                    #     invalid_exclusive = True

                    # if invalid_exclusive:
                    #     continue

                    # if recomb_multimods < self.magic_multimods_used:
                    #     self.magic_multimods_used = recomb_multimods

            # if (
            #     self.magic_multimods_used != self.multimods_used
            #     and self.magic_multimods_used != float("inf")
            # ):
            #     print("a")
            # if (
            #     # final item
            #     self.final_item.get_item() == (1, 1)
            #     # # item1
            #     and self.item1.get_item() == (0, 1)
            #     # # item2
            #     and self.item2.get_item() == (1, 0)
            #     # # exclusive mods
            #     and self.crafted_prefix_count == 0
            #     and self.crafted_suffix_count == 0
            #     and self.aspect_suffix_count == 0
            # ):
            #     print("check")

            return not valid_crafted_mods

        item1_aspect_combos = self.item1.get_crafted_combos(1)
        item2_aspect_combos = self.item2.get_crafted_combos(1)
        item1_combos = self.item1.get_crafted_combos(0)
        item2_combos = self.item2.get_crafted_combos(0)

        if self.aspect_suffix_count >= 2:
            return invalid_mods(item1_aspect_combos, item2_aspect_combos)
        if self.aspect_suffix_count <= 0:
            return invalid_mods(item1_combos, item2_combos)
        if self.aspect_suffix_count == 1:
            # need to check w/ item1 having aspect and item2 having aspect
            return invalid_mods(item1_aspect_combos, item2_combos) or invalid_mods(
                item1_combos, item2_aspect_combos
            )

    # calculate prefix and suffix probability
    def _item_probability(self, prefix_first=False, suffix_first=False):
        (required_prefixes, required_suffixes) = self.final_item.get_item()

        # if prefix first, need to add exclusive mod to final prefixes
        # if no exclusive prefixes, add exclusive suffix
        if prefix_first:
            # if there is an exclsuive prefix, add 1 required prefix
            if self.total_exclusive_prefixes > 0 and self.total_desired_prefixes > 0:
                required_prefixes += 1
            # if there is an exclusive suffix and no exclusive prefix, need additional suffix
            elif (
                self.total_exclusive_suffixes > 0 and self.total_exclusive_prefixes <= 0
            ):
                required_suffixes += 1

        # if suffix first, need to add exclusive mod to final suffixes
        # if no exclusive suffixes, add exclusive prefix
        elif suffix_first:
            # if there is an exclsuive suffix, add 1 required suffix
            if self.total_exclusive_suffixes > 0 and self.total_desired_suffixes > 0:
                required_suffixes += 1
            # if there is an exclusive prefix and no exclusive suffix, need additional prefix
            elif (
                self.total_exclusive_prefixes > 0 and self.total_exclusive_suffixes <= 0
            ):
                required_prefixes += 1

        # else error
        else:
            print("error w/ prefix or suffix first")

        # impossible final item
        if (
            required_prefixes > MAX_FINAL_MODS
            or required_suffixes > MAX_FINAL_MODS
            or self.total_prefixes > MAX_INITIAL_MODS
            or self.total_suffixes > MAX_INITIAL_MODS
        ):
            return 0

        # get probs to complete affixes
        prefix_prob = CUMSUM[self.total_prefixes][required_prefixes]
        suffix_prob = CUMSUM[self.total_suffixes][required_suffixes]

        # if there is an aspect and need suffixes, adjust suffix prob
        if self.aspect_suffix_count > 0 and self.final_item.suffix_count != 0:
            # add annul used
            if self.eldritch_annul:
                self.annuls_used = required_suffixes

            # chance of getting asepct as exclusive mod
            get_aspect_prob = self.aspect_suffix_count / self.total_exclusive_suffixes

            # odds of getting suffixes by avoid aspect
            avoid_aspect_prob = suffix_prob * (1 - get_aspect_prob)

            # odds of annuling aspect
            annul_odds = (
                1 / required_suffixes
                if self.eldritch_annul
                else 1 / (required_prefixes + required_suffixes)
            )

            # odds of getting suffixes by annuling aspect
            annul_aspect_prob = suffix_prob * get_aspect_prob * annul_odds

            # update suffix prob
            suffix_prob = avoid_aspect_prob + annul_aspect_prob

        # if final item is 1 prefix and 1 suffix w/ exclusive mods, need to annul exclusive
        # if eldritch annul is 1/2, if no edlritch annul is 1/3
        # if (
        #     # final item
        #     self.final_item.get_item() == (1, 1)
        #     # # item1
        #     and self.item1.get_item() == (0, 1)
        #     # # item2
        #     and self.item2.get_item() == (1, 0)
        #     # # exclusive mods
        #     and self.crafted_prefix_count == 0
        #     and self.crafted_suffix_count == 1
        #     and self.aspect_suffix_count == 0
        # ):
        #     print("check")

        return prefix_prob * suffix_prob

    def _get_bench_cost(self):
        bench_cost = 0
        # 2 div for each multimod
        bench_cost += self.multimods_used * 2

        return bench_cost

    def to_string(self):
        return f"{self.item1.to_string()} + {self.item2.to_string()} -> {self.final_item.to_string()}"


def get_recomb_dict(item_combos, exclusive_combos, eldritch_annul=False):

    recomb_dict = {
        Item(prefix_count, suffix_count): []
        for prefix_count in range(4)  # 0-3 final prefixes
        for suffix_count in range(4)  # 0-3 final suffixes
        if not (
            (prefix_count == 0 and suffix_count == 0)
            # or (prefix_count == 1 and suffix_count == 0)
            # or (prefix_count == 0 and suffix_count == 1)
            # or (prefix_count == 3 and suffix_count == 3)
        )
    }

    # fill in values for recomb dict
    for final_item in recomb_dict.keys():

        # track item pairs
        seen_items = set()

        # loop through all item combos and add recombination
        for item1 in item_combos:
            item1: Item
            for item2 in item_combos:
                item2: Item

                # cant' use same item as final item
                # if (
                #     item1.get_item() == final_item.get_item()
                #     or item2.get_item() == final_item.get_item()
                # ):
                #     continue

                # avoid adding same items in dif order
                item_pair = tuple(sorted((item1.get_item(), item2.get_item())))
                if item_pair in seen_items:
                    continue
                seen_items.add(item_pair)

                # for each set of exclusive mods, create combination with items
                for exclusive_mods in exclusive_combos:
                    recombination = Recombinate(
                        item1, item2, exclusive_mods, final_item, eldritch_annul, True
                    )

                    if recombination.probability == 0:
                        continue

                    recomb_dict[final_item].append(recombination)

        # sort results by highest prob
        recomb_dict[final_item] = sorted(
            recomb_dict[final_item],
            key=lambda recombination: recombination.probability,
            reverse=True,
        )

    return recomb_dict


# create dict for script, avoids worse probs w/ same items
def get_script_dict(item_combos, exclusive_combos, eldritch_annul=False):

    recomb_dict = {
        Item(prefix_count, suffix_count): []
        for prefix_count in range(4)  # 0-3 final prefixes
        for suffix_count in range(4)  # 0-3 final suffixes
        if not (
            (prefix_count == 0 and suffix_count == 0)
            or (prefix_count == 1 and suffix_count == 0)
            or (prefix_count == 0 and suffix_count == 1)
            # or (prefix_count == 3 and suffix_count == 3)
        )
    }

    recomb_dict = dict(
        sorted(
            recomb_dict.items(),
            key=lambda item: sum(item[0].get_item()),
        )
    )

    # fill in values for recomb dict
    for final_item in recomb_dict.keys():

        # track item pairs
        seen_items = set()

        # loop through all item combos and add recombination
        for item1 in item_combos:
            item1: Item
            for item2 in item_combos:
                item2: Item

                # cant' use same item as final item
                if (
                    item1.get_item() == final_item.get_item()
                    or item2.get_item() == final_item.get_item()
                ):
                    continue

                # avoid adding same items in dif order
                item_pair = tuple(sorted((item1.get_item(), item2.get_item())))
                if item_pair in seen_items:
                    continue
                seen_items.add(item_pair)

                # all recombs for item pair
                item_pair_recombs: list[Recombinate] = []

                # for each set of exclusive mods, create combination with items
                for exclusive_mods in exclusive_combos:
                    recomb = Recombinate(
                        item1, item2, exclusive_mods, final_item, eldritch_annul
                    )

                    if recomb.probability == 0:
                        continue

                    item_pair_recombs = add_to_item_pair_recombs(
                        item_pair_recombs, recomb
                    )

                if item_pair_recombs:
                    recomb_dict[final_item].extend(item_pair_recombs)

        # sort results by highest prob
        recomb_dict[final_item] = sorted(
            recomb_dict[final_item],
            key=lambda recomb: recomb.probability,
            reverse=True,
        )

    return recomb_dict


# if same multimod count, aspect, and magic_multimods but better prob, remove current and add other
def add_to_item_pair_recombs(item_pair_recombs, recomb: Recombinate):
    match_found = False
    for i, cur_recomb in enumerate(item_pair_recombs):
        cur_recomb: Recombinate
        # find other recomb w/ same multimods and aspects, same cost
        if (
            cur_recomb.multimods_used == recomb.multimods_used
            and cur_recomb.aspect_suffix_count == recomb.aspect_suffix_count
            and cur_recomb.annul_chances == recomb.annul_chances
        ):
            # if better prob, replace index w/ new recomb
            if cur_recomb.probability < recomb.probability or (
                cur_recomb.probability == recomb.probability
                and cur_recomb.total_exclusive_mods > recomb.total_exclusive_mods
            ):
                item_pair_recombs[i] = recomb

            match_found = True
            break

    if not match_found:
        item_pair_recombs.append(recomb)

    return item_pair_recombs


def write_to_file(filename, data, format_line):
    with open(filename, "w") as f:
        for final_item, items_list in data.items():
            if not items_list:
                continue

            f.write(f"\n-------------------------------------\n")
            f.write(f"{final_item.to_string()}\n")

            for item in items_list:
                f.write(format_line(item))


def format_recomb_line(recomb: Recombinate):
    return (
        f"Items: {recomb.get_item1().to_string()} + {recomb.get_item2().to_string()}, "
        f"Exclusive: {recomb.get_exclusive_mods()}, "
        f"Prob: {recomb.probability:.2%}\n"
    )


# def format_path_line(path_details):
#     recomb = path_details["recomb"]
#     if recomb is None:
#         return ""
#     path_prob = path_details["path prob"]
#     path_cost = path_details["path cost"]

#     return (
#         f"Items: {recomb.get_item1().to_string()} + {recomb.get_item2().to_string()}, "
#         f"Exclusive: {recomb.get_exclusive_mods()}, "
#         f"Path Cost: {path_cost:.2f}, Path Prob: {path_prob:.2%}\n"
#     )


def format_recomb_detailed_line(recomb: Recombinate):
    return (
        f"Item1: {recomb.get_item1().to_string()}, "
        f"Item2: {recomb.get_item2().to_string()}, "
        f"Exclusive: {recomb.get_exclusive_mods()}, "
        f"Prob: {recomb.probability}, "
        f"Annul Prob: {recomb.annul_chances}, "
        f"Multimods: {recomb.multimods_used}, "
        f"Aspect Suffix Count: {recomb.aspect_suffix_count}, "
        f"Eldritch Annuls: {recomb.annuls_used}, "
        f"Desired Suffixes: {recomb.total_desired_suffixes}\n"
        # f"Magic Item Used: {recomb.magic_item_used}, "
        # f"Magic Multimods: {recomb.magic_multimods_used}\n"
    )


def find_paths(
    recomb_dict,
    final_item,
    f,
    guaranteed_items,
    sort_prob=False,
    sort_cost=False,
    allow_aspect=False,
    visited=None,
):
    if visited is None:
        visited = set()

    # Base case: if the node has already been visited, skip it
    if final_item in visited:
        return

    if final_item not in recomb_dict:
        final_item.path_prob = 1
        return

    # Mark the current node as visited
    visited.add(final_item)

    # Process all recombinations for the final_item
    for recomb in recomb_dict[final_item]:

        # Get the items involved in the recombination
        item1 = recomb.get_item1()
        item2 = recomb.get_item2()

        avail_guaranteed = guaranteed_items.copy()

        # Recursively process item1 and item2
        if item1 not in visited:
            find_paths(
                recomb_dict,
                item1,
                f,
                avail_guaranteed,
                sort_prob,
                sort_cost,
                allow_aspect,
                visited,
            )
        if item2 not in visited:
            find_paths(
                recomb_dict,
                item2,
                f,
                avail_guaranteed,
                sort_prob,
                sort_cost,
                allow_aspect,
                visited,
            )

        # assume no guaranteed
        new_prob = item1.path_prob * item2.path_prob * recomb.probability

        item1_prob_str = item1.path_prob
        item2_prob_str = item2.path_prob

        # if gauranteed available, supplement path prob to 1, remove 1 guar item
        if item1 in guaranteed_items and guaranteed_items[item1] > 0:
            new_prob /= item1.path_prob
            guaranteed_items[item1] -= 1
            item1_prob_str = 1

        # Calculate the new path probability
        if item2 in guaranteed_items and guaranteed_items[item2] > 0:
            new_prob /= item2.path_prob
            guaranteed_items[item2] -= 1
            item2_prob_str = 1

        if new_prob > final_item.path_prob:
            final_item.path_prob = new_prob

        f.write(
            f"Recomb: {recomb.to_string()}, Path Prob: {item1_prob_str} * {item2_prob_str} * {recomb.probability} = {new_prob}\n",
        )


def main():
    item_combos = get_item_combos()
    exclusive_combos = get_exclusive_combinations()

    recomb_dict = get_recomb_dict(item_combos, exclusive_combos, eldritch_annul=False)
    recomb_dict_eldritch = get_recomb_dict(
        item_combos, exclusive_combos, eldritch_annul=True
    )

    script_recomb_dict = get_script_dict(
        item_combos, exclusive_combos, eldritch_annul=False
    )
    script_recomb_dict_eldritch = get_script_dict(
        item_combos, exclusive_combos, eldritch_annul=True
    )

    write_to_file("results/all_recombs.txt", recomb_dict, format_recomb_line)
    write_to_file(
        "results/all_recombs_eldritch.txt",
        recomb_dict_eldritch,
        format_recomb_line,
    )

    write_to_file(
        "results/detailed_recombs.txt",
        script_recomb_dict,
        format_recomb_detailed_line,
    )
    write_to_file(
        "results/detailed_recombs_eldritch.txt",
        script_recomb_dict_eldritch,
        format_recomb_detailed_line,
    )

    # path testing for app script

    # file_path = "results/path_testing.txt"
    # guaranteed_items = {Item(1, 1): 1}
    # with open(file_path, "w") as f:
    #     pass

    # with open(file_path, "a") as f:
    #     find_paths(
    #         recomb_dict=recomb_dict,
    #         guaranteed_items=guaranteed_items,
    #         final_item=Item(3, 2),
    #         f=f,
    #         sort_prob=True,
    #     )

    # # A dictionary to store the highest probability for each "Recomb" item
    # highest_probabilities = defaultdict(float)

    # # Regular expression to extract the recomb pattern, result pattern, and probability
    # line_pattern = re.compile(r"Recomb: (.*?) -> (.*?), Path Prob: .* = (\d+\.\d+)")

    # with open(file_path, "r") as file:
    #     for line in file:
    #         # Extract the components using regular expression
    #         match = line_pattern.search(line)
    #         if match:
    #             recomb_pattern = match.group(1).strip()
    #             result_pattern = match.group(2).strip()
    #             prob = float(match.group(3))

    #             # Update the highest probability and associated line for this result pattern
    #             if (
    #                 result_pattern not in highest_probabilities
    #                 or prob > highest_probabilities[result_pattern][1]
    #             ):
    #                 highest_probabilities[result_pattern] = (line.strip(), prob)

    # # Print out the highest probabilities and associated lines
    # for result, (line, prob) in highest_probabilities.items():
    #     print(f"{line}")


if __name__ == "__main__":
    main()
