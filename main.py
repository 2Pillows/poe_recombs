# new main.py

# constants
MAX_MOD_POOL = 6
MAX_CRAFTED_MODS = 6

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

    def get_item1(self):
        return self.item1.to_string()

    def get_item2(self):
        return self.item2.to_string()

    def get_exclusive_mods(self):
        return f"{self.crafted_prefix_count}c/{self.crafted_suffix_count}c{self.aspect_suffix_count}a"

    # returns chance to recombinate item1 + item2 = final item
    def _get_recombinate_prob(self):
        (item1_desired_prefixes, item1_desired_suffixes) = self.item1.get_item()
        (item2_desired_prefixes, item2_desired_suffixes) = self.item2.get_item()
        (final_prefixes, final_suffixes) = self.final_item.get_item()

        # desired mods
        total_desired_prefixes = item1_desired_prefixes + item2_desired_prefixes
        total_desired_suffixes = item1_desired_suffixes + item2_desired_suffixes

        # exclusive mods
        self.total_exclusive_prefixes = self.crafted_prefix_count
        self.total_exclusive_suffixes = (
            self.crafted_suffix_count + self.aspect_suffix_count
        )

        # total mods
        self.total_prefixes = total_desired_prefixes + self.total_exclusive_prefixes
        self.total_suffixes = total_desired_suffixes + self.total_exclusive_suffixes

        # total crafted
        self.total_crafted_mods = self.crafted_prefix_count + self.crafted_suffix_count

        if (
            # need at least desired number of affixes
            total_desired_prefixes < final_prefixes
            or total_desired_suffixes < final_suffixes
            # dont include if a single item has more desired mods than final
            or sum(self.item1.get_item()) > sum(self.final_item.get_item())
            or sum(self.item2.get_item()) > sum(self.final_item.get_item())
            # cant have more than max initial mods
            or self.total_prefixes > MAX_INITIAL_MODS
            or self.total_suffixes > MAX_INITIAL_MODS
            # cant have more than max crafted mods
            or self.total_crafted_mods > MAX_CRAFTED_MODS
        ):
            return 0

        # if (
        #     # final item
        #     self.final_item.get_item() == (3, 2)
        #     # # item1
        #     and self.item1.get_item() == (3, 1)
        #     # # item2
        #     and self.item2.get_item() == (3, 1)
        #     # # exclusive mods
        #     and self.crafted_prefix_count == 0
        #     and self.crafted_suffix_count == 3
        #     and self.aspect_suffix_count == 1
        # ):
        #     print("check")

        # if prefix first, suffixes assume no exclusive, but requires there to be exclusive prefixes
        prefix_first = self._item_probability(prefix_first=True)
        suffix_first = self._item_probability(suffix_first=True)

        return 0.5 * (prefix_first + suffix_first)

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
        if required_prefixes > MAX_FINAL_MODS or required_suffixes > MAX_FINAL_MODS:
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
        f"Items: {recombination.get_item1()} + {recombination.get_item2()}, "
        f"Exclusive: {recombination.get_exclusive_mods()}, "
        f"Prob: {recombination.probability:.2%}\n"
    )


def format_path_line(path_details):
    recombination = path_details["recomb"]
    path_prob = path_details["path prob"]
    path_cost = path_details["path cost"]

    return (
        f"Items: {recombination.get_item1()} + {recombination.get_item2()}, "
        f"Exclusive: {recombination.get_exclusive_mods()}, "
        f"Path Cost: {path_cost:.2f}, Path Prob: {path_prob:.2%}\n"
    )


class GraphEdge:
    def __init__(self, recombinate: Recombinate):
        self.item1 = recombinate.item1
        self.item2 = recombinate.item2
        self.recombinate = recombinate

    def to_string(self):
        return f"Edge({self.item1.to_string()} + {self.item2.to_string()} -> {self.recombinate.final_item.to_string()}), Prob: {self.recombinate.probability:.2%}%"


class Graph:
    def __init__(self):
        self.nodes = {}

    def add_edge(self, recombinate):
        final_item = recombinate.final_item
        if final_item not in self.nodes:
            self.nodes[final_item] = []

        edge = GraphEdge(recombinate)
        self.nodes[final_item].append(edge)

    def print_graph(self):
        for final_item, edges in self.nodes.items():
            print(f"Final Item: {final_item.to_string()}")
            for edge in edges:
                print(f"  {edge.to_string()}")

    def find_all_paths(self, start_nodes):
        all_paths = []
        for start_node in start_nodes:
            for final_item in self.nodes:
                self._dfs(start_node, final_item, [], all_paths)
        return all_paths

    def _dfs(self, current_node, target_node, path, all_paths):
        # Add the current node to the path
        path.append(current_node)

        # If current node is the target, store the path
        if current_node == target_node:
            all_paths.append(list(path))
        else:
            # Continue DFS for all adjacent nodes
            if current_node in self.nodes:
                for edge in self.nodes[current_node]:
                    next_node = edge.recombinate.final_item
                    if next_node not in path:
                        self._dfs(next_node, target_node, path, all_paths)

        # Backtrack
        path.pop()

    def print_graph_to_file(self, file):
        for final_item, edges in self.nodes.items():
            file.write(f"Final Item: {final_item.to_string()}\n")
            for edge in edges:
                file.write(f"  {edge.to_string()}\n")


def build_graph(recomb_dict):
    graph = Graph()
    for final_item, recombinations in recomb_dict.items():
        for recomb in recombinations:
            recomb: Recombinate

            graph.add_edge(recomb)

    return graph


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

    graph = build_graph(recomb_dict)
    graph_eldritch = build_graph(recomb_dict_eldritch)


if __name__ == "__main__":
    main()
