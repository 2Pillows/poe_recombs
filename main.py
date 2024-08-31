# main.py

import random

MAX_MOD_POOL = 6
MAX_CRAFTED_MODS = 6

MAX_FINAL_AFFIX = 3

# cumulative sum of weight table
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

CUMSUM_N = len(CUMSUM)
CUMSUM_M = len(CUMSUM[0])


# Inputs for reomb, edges between two result nodes
class Recomb_Edge:
    def __init__(
        self,
        starting_prefix_count,
        starting_suffix_count,
        paired_prefix_count,
        paired_suffix_count,
        final_prefix_count,
        final_suffix_count,
        recomb_details,
    ):

        # two items used for recomb
        self.starting_prefix_count = starting_prefix_count
        self.starting_suffix_count = starting_suffix_count
        self.paired_prefix_count = paired_prefix_count
        self.paired_suffix_count = paired_suffix_count

        self.final_prefix_count = final_prefix_count
        self.final_suffix_count = final_suffix_count

        (
            self.desired_prefix_count,
            self.desired_suffix_count,
            self.crafted_prefix_count,
            self.crafted_suffix_count,
            self.aspect_suffix_count,
        ) = recomb_details

        self.exclusive_prefixes = self.crafted_prefix_count
        self.exclusive_suffixes = self.crafted_suffix_count + self.aspect_suffix_count

        self.probability = self._probability()

    def _probability(self):

        # total number of affixes in pool
        total_prefixes = self.desired_prefix_count + self.exclusive_prefixes
        total_suffixes = self.desired_suffix_count + self.exclusive_suffixes

        # if aspect suffix, need to get chances of avoiding / annulling
        avoid_aspect_prob = 1 - self.aspect_suffix_count / max(
            self.exclusive_suffixes, 1
        )

        # if prefix first, suffixes assume no exclusive, but requires there to be exclusive prefixes
        prefix_first = self._item_probability(
            total_prefixes,
            self.final_prefix_count
            + (
                1 if self.exclusive_prefixes > 0 else 0
            ),  # only require at most 1 exclusive prefix
            total_suffixes,
            self.final_suffix_count
            + (
                1 if self.exclusive_prefixes == 0 else 0
            ),  # require 1 exclusive suffix if no exclusive prefix
            avoid_aspect_prob,  # chance of avoiding aspect
        )

        suffix_first = self._item_probability(
            total_prefixes,
            self.final_prefix_count
            + (
                1 if self.exclusive_suffixes == 0 else 0
            ),  # require 1 exclusive prefix if no exclusive suffix
            total_suffixes,
            self.final_suffix_count
            + (
                1 if self.exclusive_suffixes > 0 else 0
            ),  # only require at most 1 exclusive suffix
            avoid_aspect_prob,  # chance of avoiding aspect
        )

        # if (
        #     self.final_prefix_count == 0
        #     and self.final_suffix_count == 2
        #     and self.desired_prefix_count == 0
        #     and self.crafted_prefix_count == 0
        #     and self.desired_suffix_count == 2
        #     and self.crafted_suffix_count == 2
        #     and self.aspect_suffix_count == 0
        # ):
        #     print("check")

        return 0.5 * (prefix_first + suffix_first)

    # calculate prefix and suffix probability
    def _item_probability(
        self,
        # prefixes
        initial_prefixes,
        final_prefixes,
        # suffixes
        initial_suffixes,
        final_suffixes,
        avoid_aspect_odds,
    ):

        if (
            initial_prefixes >= CUMSUM_N
            or final_prefixes >= CUMSUM_M
            or initial_suffixes >= CUMSUM_N
            or final_suffixes >= CUMSUM_M
        ):
            return 0

        prefix_prob = CUMSUM[initial_prefixes][final_prefixes]
        suffix_prob = CUMSUM[initial_suffixes][final_suffixes]

        # if no suffixes are required, can lock prefix and wipe
        # aspect doesn't matter
        if avoid_aspect_odds == 0 or final_suffixes == 0:
            return prefix_prob * suffix_prob

        # need to get odds of avoiding or annuling aspect
        # will assume eldritch availlable

        # avoiding is aspect count / exclusive count

        # annulling is 1 / final suffixes

        avoid_prob = suffix_prob * avoid_aspect_odds
        annul_prob = suffix_prob * (1 - avoid_aspect_odds) * 1 / final_suffixes

        return prefix_prob * (avoid_prob + annul_prob)

    def starting_item(self):
        return (self.starting_prefix_count, self.starting_suffix_count)

    def paired_item(self):
        return (self.paired_prefix_count, self.paired_suffix_count)

    def exclusive_mods(self):
        return (
            self.crafted_prefix_count,
            self.crafted_suffix_count,
            self.aspect_suffix_count,
        )

    def result_item(self):
        return (self.final_prefix_count, self.final_suffix_count)

    def recomb_item(self):
        # item 1 + item 2
        return f"{self.starting_prefix_count}p/{self.starting_suffix_count}s + {self.paired_prefix_count}p/{self.paired_suffix_count}s | {self.crafted_prefix_count}c/{self.crafted_suffix_count}c{self.aspect_suffix_count}a"


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
        for aspect_suffix_count in range(3)  # 0-2 aspect suffixes
        if (
            desired_prefix_count + crafted_prefix_count <= MAX_MOD_POOL
            and desired_suffix_count + crafted_prefix_count + aspect_suffix_count
            <= MAX_MOD_POOL
            and crafted_prefix_count + crafted_suffix_count <= MAX_CRAFTED_MODS
        )
    ]


def build_graph():
    graph = {}

    recomb_options = get_recomb_options()

    # parent node, starting item w/ final affixes
    for starting_prefix_count in range(4):  # 0-3 final prefixes
        for starting_suffix_count in range(4):  # 0-3 final suffixes

            # edges to nodes
            edges = []

            for recomb_details in recomb_options:
                (
                    desired_prefix_count,
                    desired_suffix_count,
                    crafted_prefix_count,
                    crafted_suffix_count,
                    aspect_suffix_count,
                ) = recomb_details

                paired_prefix_count = desired_prefix_count - starting_prefix_count
                paired_suffix_count = desired_suffix_count - starting_suffix_count

                if (
                    # impossible item to make
                    paired_prefix_count > MAX_FINAL_AFFIX
                    or paired_suffix_count > MAX_FINAL_AFFIX
                ):
                    continue

                starting_desired_mods = starting_prefix_count + starting_suffix_count
                paired_desired_mods = paired_prefix_count + paired_suffix_count

                # #  0p/2s + 3p/1s
                # if (
                #     starting_prefix_count == 0
                #     and starting_suffix_count == 1
                #     and paired_prefix_count == 1
                #     and paired_suffix_count == 1
                #     # and desired_prefix_count == 5
                #     # and crafted_prefix_count == 1
                #     # and desired_suffix_count == 2
                #     # and crafted_suffix_count == 4
                #     # and aspect_suffix_count == 0
                # ):
                #     print("check")

                # all possible edges from point
                possible_edges = [
                    (
                        starting_prefix_count + additional_prefix,
                        starting_suffix_count + additional_suffix,
                    )
                    for additional_prefix in range(paired_prefix_count + 1)
                    for additional_suffix in range(paired_suffix_count + 1)
                    if not (additional_prefix == 0 and additional_suffix == 0)
                ]

                for final_prefix_count, final_suffix_count in possible_edges:
                    if (
                        # impossible item to make
                        final_prefix_count > MAX_FINAL_AFFIX
                        or final_suffix_count > MAX_FINAL_AFFIX
                        # can't make final item, not enough desired in pool
                        or desired_prefix_count < final_prefix_count
                        or desired_suffix_count < final_suffix_count
                        # starting item needs to have most mods, unless (0,0)
                        # for (0,0), paired can't be more than 1
                        or max(starting_desired_mods, 1) < paired_desired_mods
                    ):
                        continue

                    new_edge = Recomb_Edge(
                        starting_prefix_count,
                        starting_suffix_count,
                        paired_prefix_count,
                        paired_suffix_count,
                        final_prefix_count,
                        final_suffix_count,
                        recomb_details,
                    )
                    if new_edge.probability > 0:
                        edges.append(new_edge)

            # add parent and edges to graph
            graph[(starting_prefix_count, starting_suffix_count)] = edges

    return graph


# pathfinding algorithm
# want to know best way to go from one item to another
# need options, multimod, cheapest, highest prob, least steps?
# for price just use divs for estimate, use multimod constant, prefix lock for aspect. assume multimod needs to be reapplied


# collect methods of getting to a node in a dict (final prefix, final suffix): combos to get to node and prob of direct combo
# problem is getting the probs for each item in the combo for overall prob

# example:
# (3,2): 2p/2s + 3p/1s, 0c/3c0a, prob is 41.04% for this combo
# need to get prob of 2p/2s and prob of 3p/1s to find overall
# but for both of these, also need to get prob of items used


def get_probs_for_result(graph):
    result_probs = {}

    for parent, edges in graph.items():

        for edge in edges:
            edge: Recomb_Edge

            result_item = edge.result_item()

            if result_item not in result_probs:
                result_probs[result_item] = []

            # item = edge.starting_item
            # item = edge.paired_item
            # exclusive mods = edge.exclusive_mods
            # don't add to result_item if there is another match with both item item and exclusive mods
            if any(
                (
                    (
                        existing_edge.starting_item() == edge.starting_item()
                        and existing_edge.paired_item() == edge.paired_item()
                    )
                    or (
                        existing_edge.starting_item() == edge.paired_item()
                        and existing_edge.paired_item() == edge.starting_item()
                    )
                )
                and existing_edge.exclusive_mods() == edge.exclusive_mods()
                for existing_edge in result_probs[result_item]
            ):
                continue

            result_probs[result_item].append(edge)

    # sort by prob
    for recombs in result_probs.values():
        recombs.sort(key=lambda obj: obj.probability, reverse=True)

    return result_probs


def write_final_probabilities(result_probs, filename="graph_edges.txt"):

    with open(filename, "w") as f:
        for item, recombs in result_probs.items():

            f.write(f"\n-------------------------------------\n")
            f.write(f"{item}\n")
            for recomb in recombs:
                recomb: Recomb_Edge

                recomb_item = recomb.recomb_item()
                recomb_prob = recomb.probability
                f.write(f"Recomb: {recomb_item}, Probability: {recomb_prob:.2%}\n")


def main():
    graph = build_graph()

    result_probs = get_probs_for_result(graph)

    write_final_probabilities(result_probs)


if __name__ == "__main__":
    main()
