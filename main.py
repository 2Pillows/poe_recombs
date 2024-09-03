# new main.py

from collections import deque, defaultdict
import heapq

# constants
MAX_MOD_POOL = 6
MAX_BASE_CRAFTED_MODS = 2
MAX_MULTI_CRAFTED_MODS = 6
MAX_CRAFTED_PER_MULTIMOD = 3

MAX_INITIAL_MODS = 6
MAX_FINAL_MODS = 3

# costs
BASE_COST = 0.5
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

    def __eq__(self, other):
        if isinstance(other, Item):
            return (self.prefix_count, self.suffix_count) == (
                other.prefix_count,
                other.suffix_count,
            )
        return False

    def __hash__(self):
        return hash((self.prefix_count, self.suffix_count))


class Recombinate:
    def __init__(
        self, item1, item2, exclusive_mods, final_item, eldritch_annul
    ) -> None:
        # two items used in recomb
        self.item1: Item = item1
        self.item2: Item = item2

        # exclusive mods
        (
            self.crafted_prefix_count,
            self.crafted_suffix_count,
            self.aspect_suffix_count,
        ) = exclusive_mods

        # goal final item of recomb
        self.final_item: Item = final_item

        self.eldritch_annul = eldritch_annul

        # get probability of recombination
        self.probability = self._get_recombinate_prob()

        self.multimod_required = False
        self.prefix_lock_required = False

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

        # total mods
        self.total_prefixes = (
            self.total_desired_prefixes + self.total_exclusive_prefixes
        )
        self.total_suffixes = (
            self.total_desired_suffixes + self.total_exclusive_suffixes
        )

        # total crafted
        self.total_crafted_mods = self.crafted_prefix_count + self.crafted_suffix_count

        if self._invalid_recomb():
            return 0

        # need more validation checks
        # think requires building items and checking if possible, buidlw / exclusive mods

        # more crafted check

        # need a suffix craft in order to have at least 3 crafted

        # if prefix first, suffixes assume no exclusive, but requires there to be exclusive prefixes
        prefix_first = self._item_probability(prefix_first=True)
        suffix_first = self._item_probability(suffix_first=True)

        return 0.5 * (prefix_first + suffix_first)

    def _invalid_recomb(self):
        (final_prefixes, final_suffixes) = self.final_item.get_item()

        # basic item check, can get valid mods and less ovrall item
        if (
            # need at least desired number of affixes
            self.total_desired_prefixes < final_prefixes
            or self.total_desired_suffixes < final_suffixes
            # dont include if a single item has more desired mods than final
            or sum(self.item1.get_item()) > sum(self.final_item.get_item())
            or sum(self.item2.get_item()) > sum(self.final_item.get_item())
        ):
            return True

        item1_crafted_combos = self.item1.get_crafted_combos(self.aspect_suffix_count)
        item2_crafted_combos = self.item2.get_crafted_combos(self.aspect_suffix_count)

        valid_crafted_mods = False

        for item1_crafted in item1_crafted_combos:
            for item2_crafted in item2_crafted_combos:
                crafted_prefixes = item1_crafted[0] + item2_crafted[0]
                crafted_suffixes = item1_crafted[1] + item2_crafted[1]

                # if no crafted suffixes, subtract 4 from

                if (
                    crafted_prefixes == self.crafted_prefix_count
                    and crafted_suffixes == self.crafted_suffix_count
                ):
                    valid_crafted_mods = True

        if (
            # final item
            self.final_item.get_item() == (2, 3)
            # # item1
            and self.item1.get_item() == (1, 2)
            # # item2
            and self.item2.get_item() == (1, 3)
            # # exclusive mods
            and self.crafted_prefix_count == 3
            and self.crafted_suffix_count == 0
            and self.aspect_suffix_count == 0
        ):
            print("check")

        return not valid_crafted_mods

    # calculate prefix and suffix probability
    def _item_probability(self, prefix_first=False, suffix_first=False):
        (required_prefixes, required_suffixes) = self.final_item.get_item()

        # if prefix first, need to add exclusive mod to final prefixes
        # if no exclusive prefixes, add exclusive suffix
        if prefix_first:
            if self.total_exclusive_prefixes > 0:
                required_prefixes += 1
            else:
                required_suffixes += 1

        # if suffix first, need to add exclusive mod to final suffixes
        # if no exclusive suffixes, add exclusive prefix
        elif suffix_first:
            if self.total_exclusive_suffixes > 0:
                required_suffixes += 1
            else:
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

        return prefix_prob * suffix_prob


def get_recomb_dict(item_combos, exclusive_combos, eldritch_annul=False):

    recomb_dict = {
        Item(prefix_count, suffix_count): []
        for prefix_count in range(4)  # 0-3 final prefixes
        for suffix_count in range(4)  # 0-3 final suffixes
        if not (
            prefix_count == 0
            and suffix_count == 0
            or prefix_count == 1
            and suffix_count == 0
            or prefix_count == 0
            and suffix_count == 1
            or prefix_count == 3
            and suffix_count == 3
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


def write_to_file(filename, data, format_line):
    with open(filename, "w") as f:
        for final_item, items_list in data.items():
            if not items_list:
                continue

            f.write(f"\n-------------------------------------\n")
            f.write(f"{final_item.to_string()}\n")

            for item in items_list:
                f.write(format_line(item))


def format_recomb_line(recombination):
    return (
        f"Items: {recombination.get_item1().to_string()} + {recombination.get_item2().to_string()}, "
        f"Exclusive: {recombination.get_exclusive_mods()}, "
        f"Prob: {recombination.probability:.2%}\n"
    )


def format_path_line(path_details):
    recombination = path_details["recomb"]
    path_prob = path_details["path prob"]
    path_cost = path_details["path cost"]

    return (
        f"Items: {recombination.get_item1().to_string()} + {recombination.get_item2().to_string()}, "
        f"Exclusive: {recombination.get_exclusive_mods()}, "
        f"Path Cost: {path_cost:.2f}, Path Prob: {path_prob:.2%}\n"
    )


# instead of gettiing all paths
# assume the highest % prob for each path is best
# build off that?
def find_path_with_details(recomb_dict, starting_item, ending_item, top_n=10):
    top_paths = []

    def dfs(current_item, path, cumulative_prob):
        if (
            current_item.to_string() == starting_item.to_string()
            or current_item not in recomb_dict
        ):
            # Save the path with required items and the probability
            top_paths.append(
                (path + [(current_item, None, None, cumulative_prob)], cumulative_prob)
            )
            top_paths.sort(key=lambda x: x[1], reverse=True)

            if len(top_paths) > top_n:
                top_paths.pop()

            return

        for recomb in recomb_dict[current_item]:
            item1 = recomb.item1
            item2 = recomb.item2
            new_prob = cumulative_prob * recomb.probability

            # Prune paths with low probability if top_n paths are already found
            if len(top_paths) >= top_n and new_prob <= top_paths[-1][1]:
                continue

            # Explore item1 and item2
            dfs(item1, path + [(current_item, item1, item2, new_prob)], new_prob)
            dfs(item2, path + [(current_item, item1, item2, new_prob)], new_prob)

    # Start DFS from the ending item
    dfs(ending_item, [], 1.0)

    return top_paths


def format_paths(paths):
    formatted = []
    for path, prob in paths:
        for step in path:
            final_item, item1, item2, chance = step
            formatted.append(
                [
                    final_item.to_string(),
                    item1.to_string() if item1 else "x/x",
                    item2.to_string() if item2 else "x/x",
                    f"{chance:.4f}",
                ]
            )
        formatted.append([])  # Add a blank line between paths for clarity
    return formatted


def main():
    item_combos = get_item_combos()
    exclusive_combos = get_exclusive_combinations()

    recomb_dict = get_recomb_dict(item_combos, exclusive_combos, eldritch_annul=False)
    recomb_dict_eldritch = get_recomb_dict(
        item_combos, exclusive_combos, eldritch_annul=True
    )
    write_to_file("results/all_recombs.txt", recomb_dict, format_recomb_line)
    write_to_file(
        "results/all_recombs_eldritch.txt",
        recomb_dict_eldritch,
        format_recomb_line,
    )

    print("path done")


if __name__ == "__main__":
    main()
