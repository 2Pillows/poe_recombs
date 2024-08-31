# main.py

import random

MAX_MOD_POOL = 6
MAX_CRAFTED_MODS = 6

MAX_FINAL_AFFIX = 3

# cumulative sum of weight table
CUMSUM = [
    [1.00, 0.00, 0.00, 0.00],  # 0 initial mods, guaranteed 0 mods
    [1.00, 0.59, 0.00, 0.00],  # 1 initial mod
    [1.00, 1.00, 0.33, 0.00],  # 2 initial mods
    [1.00, 1.00, 0.62, 0.10],  # 3 initial mods
    [1.00, 1.00, 0.90, 0.31],  # 4 initial mods
    [1.00, 1.00, 1.00, 0.57],  # 5 initial mods
    [1.00, 1.00, 1.00, 0.72],  # 6 initial mods
]

CUMSUM_N = len(CUMSUM)
CUMSUM_M = len(CUMSUM[0])


# Inputs for reomb, edges between two result nodes
class Recomb_Edge:
    def __init__(self, final_prefix_count, final_suffix_count, recomb_deatils):
        self.final_prefix_count = final_prefix_count
        self.final_suffix_count = final_suffix_count
        (
            self.desired_prefix_count,
            self.desired_suffix_count,
            self.crafted_prefix_count,
            self.crafted_suffix_count,
            self.aspect_suffix_count,
        ) = recomb_deatils

        self.exclusive_prefixes = self.crafted_prefix_count
        self.exclusive_suffixes = self.crafted_suffix_count + self.aspect_suffix_count

        self.probability = self._probability()

    def _probability(self):

        # total number of affixes in pool
        total_prefixes = self.desired_prefix_count + self.exclusive_prefixes
        total_suffixes = self.desired_suffix_count + self.exclusive_suffixes

        # easiest way to calc, have func that takes final, total, desired, exclusive affixes and returns prob
        # change inputs for calc, assuming prefix and suffix first, removing exclusive mods

        # use total mods to fine odds of getting x mods
        # required number of mods is final + min(exclusive, 1)
        # if aspect suffix, need to get chances of avoiding / annulling

        prefix_first = self._item_probability(
            total_prefixes,
            self.final_prefix_count + min(self.exclusive_prefixes, 1),
            total_suffixes,
            self.final_suffix_count,
        )

        suffix_first = self._item_probability(
            total_prefixes,
            self.final_prefix_count,
            total_suffixes,
            self.final_suffix_count + min(self.exclusive_suffixes, 1),
        )

        return 0.5 * (prefix_first + suffix_first)

        # result
        # 0.5 * (pre pre first * suf pre first + pre suf first * suf suf first)
        # 0.5 * (pre first item + suf first item)

        # return round(random.random(), 4)

    # calculate prefix and suffix probability
    def _item_probability(
        self,
        # prefixes
        initial_prefixes,
        final_prefixes,
        # suffixes
        initial_suffixes,
        final_suffixes,
    ):

        if (
            initial_prefixes >= CUMSUM_N
            or final_prefixes >= CUMSUM_M
            or initial_suffixes >= CUMSUM_N
            or final_suffixes >= CUMSUM_M
        ):
            return 0

        return (
            CUMSUM[initial_prefixes][final_prefixes]
            * CUMSUM[initial_suffixes][final_suffixes]
        )

    def result_item(self):
        return (self.final_prefix_count, self.final_suffix_count)

    def recomb_item(self):
        return f"{self.desired_prefix_count}p{self.exclusive_prefixes}e/{self.desired_suffix_count}s{self.exclusive_suffixes}e{self.aspect_suffix_count}a"


# every combo of affixes
def get_recomb_options():
    return [
        (
            desired_prefix_count,
            desired_suffix_count,
            crafted_prefix_count,
            crafted_suffix_count,
            aspect_suffix_count,
        )
        for desired_prefix_count in range(7)  # 0-6 desired prefixes
        for crafted_prefix_count in range(5)  # 0-4 crafted prefixes
        for desired_suffix_count in range(7)  # 0-6 desired suffixes
        for crafted_suffix_count in range(7)  # 0-6 crafted suffixes
        for aspect_suffix_count in range(2)  # 0-1 aspect suffixes
        if (
            desired_prefix_count + crafted_prefix_count <= MAX_MOD_POOL
            and desired_suffix_count + crafted_prefix_count + aspect_suffix_count
            <= MAX_MOD_POOL
            and crafted_prefix_count + crafted_suffix_count <= MAX_CRAFTED_MODS
        )
    ]


# graph dict with {(prefix, suffix): [edges from node]}
def build_graph():
    graph = {}

    recomb_options = get_recomb_options()

    # parent node, starting item w/ final affixes
    for final_prefix_count in range(4):  # 0-3 final prefixes
        for final_suffix_count in range(4):  # 0-3 final suffixes

            # edges to nodes
            edges = []

            for recomb_details in recomb_options:

                possible_edges = [
                    (final_prefix_count + 1, final_suffix_count),  # +1 prefix
                    (final_prefix_count, final_suffix_count + 1),  # +1 suffix
                ]

                for new_prefix, new_suffix in possible_edges:
                    if new_prefix <= MAX_FINAL_AFFIX and new_suffix <= MAX_FINAL_AFFIX:
                        new_edge = Recomb_Edge(new_prefix, new_suffix, recomb_details)
                        if new_edge.probability > 0:
                            edges.append(new_edge)

            # add parent and edges to graph
            graph[(final_prefix_count, final_suffix_count)] = edges

    return graph


def save_edges_to_file(graph, filename="graph_edges.txt"):
    with open(filename, "w") as f:
        for parent, edges in graph.items():
            for edge in edges:
                edge: Recomb_Edge
                f.write(
                    f"From: {parent} -> To: {edge.result_item()} (Recomb: {edge.recomb_item()}) (Probability: {edge.probability:.4f})\n"
                )


def main():
    graph = build_graph()

    save_edges_to_file(graph)


if __name__ == "__main__":
    main()
