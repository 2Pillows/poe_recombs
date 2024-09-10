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
        self, item1, item2, exclusive_mods, final_item, eldritch_annul
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

        # get probability of recombination
        self.probability = self._get_recombinate_prob()

        self.bench_cost = self._get_bench_cost()

    def get_item1(self):
        return self.item1

    def get_item2(self):
        return self.item2

    def get_exclusive_mods(self):
        return f"{self.crafted_prefix_count}c/{self.crafted_suffix_count}c{self.aspect_suffix_count}a"

    # returns chance to recombinate item1 + item2 = final item
    def _get_recombinate_prob(self):
        (item1_desired_prefixes, item1_desired_suffixes) = self.item1.get_item()
        (item2_desired_prefixes, item2_desired_suffixes) = self.item2.get_item()

        # desired mods
        self.total_desired_prefixes = item1_desired_prefixes + item2_desired_prefixes
        self.total_desired_suffixes = item1_desired_suffixes + item2_desired_suffixes

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

        if self._invalid_crafted_mods():
            return 0

        # if (
        #     # final item
        #     self.final_item.get_item() == (2, 1)
        #     # # item1
        #     and self.item1.get_item() == (1, 0)
        #     # # item2
        #     and self.item2.get_item() == (1, 1)
        #     # # exclusive mods
        #     and self.crafted_prefix_count == 4
        #     and self.crafted_suffix_count == 2
        #     and self.aspect_suffix_count == 1
        # ):
        #     print("check")

        # if prefix first, suffixes assume no exclusive, but requires there to be exclusive prefixes
        prefix_first = self._item_probability(prefix_first=True)
        suffix_first = self._item_probability(suffix_first=True)

        return 0.5 * (prefix_first + suffix_first)

    def _invalid_crafted_mods(self):
        (final_prefixes, final_suffixes) = self.final_item.get_item()

        # basic item check, can get valid mods and less ovrall item
        if (
            # need at least desired number of affixes
            self.total_desired_prefixes < final_prefixes
            or self.total_desired_suffixes < final_suffixes
            # dont include if a single item has more desired mods than final
            or sum(self.item1.get_item()) >= sum(self.final_item.get_item())
            or sum(self.item2.get_item()) >= sum(self.final_item.get_item())
        ):
            return True

        item1_crafted_combos = self.item1.get_crafted_combos(self.aspect_suffix_count)
        item2_crafted_combos = self.item2.get_crafted_combos(self.aspect_suffix_count)

        valid_crafted_mods = False

        for item1_crafted in item1_crafted_combos:
            for item2_crafted in item2_crafted_combos:

                crafted_prefixes = item1_crafted[0] + item2_crafted[0]
                crafted_suffixes = item1_crafted[1] + item2_crafted[1]

                # require matching crafted mods
                if (
                    crafted_prefixes == self.crafted_prefix_count
                    and crafted_suffixes == self.crafted_suffix_count
                ):
                    valid_crafted_mods = True

                    # add multimod if either item has more than 1 crafted mod
                    recomb_multimods = 0
                    if sum(item1_crafted) > 1:
                        recomb_multimods += 1
                    if sum(item2_crafted) > 1:
                        recomb_multimods += 1

                    if recomb_multimods < self.multimods_used:
                        self.multimods_used = recomb_multimods
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

    # calculate prefix and suffix probability
    def _item_probability(self, prefix_first=False, suffix_first=False):
        (required_prefixes, required_suffixes) = self.final_item.get_item()

        # if prefix first, need to add exclusive mod to final prefixes
        # if no exclusive prefixes, add exclusive suffix
        if prefix_first:
            # if there is an exclsuive prefix, add 1 required prefix
            if self.total_exclusive_prefixes > 0 and self.total_desired_prefixes > 0:
                required_prefixes += 1
            # if there is no required prefix and a required suffix, add a req suffix
            elif self.total_exclusive_suffixes > 0:
                required_suffixes += 1

        # if suffix first, need to add exclusive mod to final suffixes
        # if no exclusive suffixes, add exclusive prefix
        elif suffix_first:
            # if there is an exclsuive suffix, add 1 required suffix
            if self.total_exclusive_suffixes > 0 and self.total_desired_suffixes > 0:
                required_suffixes += 1
            # if there is no required suffix and a required prefix, add a req prefix
            elif self.total_exclusive_prefixes > 0:
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
            self.annuls_used = 1

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

        # if only 1 prefix and suffix wo/ exclusive mods, need to reagl and annul
        if (
            self.final_item.prefix_count == 1
            and self.final_item.suffix_count == 1
            and self.total_exclusive_mods == 0
        ):
            annul_rare_mod = 1 / 2 if self.eldritch_annul else 1 / 3
            return prefix_prob * suffix_prob * annul_rare_mod
        else:
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
            or (prefix_count == 1 and suffix_count == 0)
            or (prefix_count == 0 and suffix_count == 1)
            or (prefix_count == 3 and suffix_count == 3)
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

                # for each set of exclusive mods, create combination with items
                for exclusive_mods in exclusive_combos:
                    recombination = Recombinate(
                        item1, item2, exclusive_mods, final_item, eldritch_annul
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
            or (prefix_count == 3 and suffix_count == 3)
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

                    # if same multimod count and aspect but better prob, remove current and add other
                    index = 0
                    matching_recomb_found = False
                    while index < len(item_pair_recombs):
                        pair_recomb_prob = item_pair_recombs[index].probability
                        pair_recomb_multis = item_pair_recombs[index].multimods_used
                        pair_recomb_aspects = item_pair_recombs[
                            index
                        ].aspect_suffix_count

                        if (
                            pair_recomb_multis == recomb.multimods_used
                            and pair_recomb_aspects == recomb.aspect_suffix_count
                        ):
                            matching_recomb_found = True
                            if pair_recomb_prob < recomb.probability:
                                item_pair_recombs[index] = recomb

                        index += 1

                    if not matching_recomb_found:
                        item_pair_recombs.append(recomb)

                if item_pair_recombs:
                    recomb_dict[final_item].extend(item_pair_recombs)

        # sort results by highest prob
        recomb_dict[final_item] = sorted(
            recomb_dict[final_item],
            key=lambda recomb: recomb.probability,
            reverse=True,
        )

    return recomb_dict


def write_to_file(filename, data, format_line):
    with open(filename, "w") as f:
        for final_item, items_list in data.items():
            if not items_list:
                continue

            f.write(f"\n-------------------------------------\n")
            f.write(f"{final_item.to_string()}\n")

            for item in items_list:
                f.write(format_line(item))


def format_recomb_line(recomb):
    return (
        f"Items: {recomb.get_item1().to_string()} + {recomb.get_item2().to_string()}, "
        f"Exclusive: {recomb.get_exclusive_mods()}, "
        f"Prob: {recomb.probability:.2%}\n"
    )


def format_path_line(path_details):
    recomb = path_details["recomb"]
    if recomb is None:
        return ""
    path_prob = path_details["path prob"]
    path_cost = path_details["path cost"]

    return (
        f"Items: {recomb.get_item1().to_string()} + {recomb.get_item2().to_string()}, "
        f"Exclusive: {recomb.get_exclusive_mods()}, "
        f"Path Cost: {path_cost:.2f}, Path Prob: {path_prob:.2%}\n"
    )


def format_recomb_detailed_line(recomb: Recombinate):
    return (
        f"Item1: {recomb.get_item1().to_string()}, "
        f"Item2: {recomb.get_item2().to_string()}, "
        f"Exclusive: {recomb.get_exclusive_mods()}, "
        f"Prob: {recomb.probability}, "
        f"Multimods: {recomb.multimods_used}, "
        f"Eldritch Annuls: {recomb.annuls_used}, "
        f"Aspect Suffix Count: {recomb.aspect_suffix_count}, "
        f"Desired Suffixes: {recomb.total_desired_suffixes}\n"
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
