# main.py

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
        eldritch_annul,
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

        self.eldritch_annul = eldritch_annul

        self.exclusive_prefixes = self.crafted_prefix_count
        self.exclusive_suffixes = self.crafted_suffix_count + self.aspect_suffix_count

        self.probability = self._probability()

    def _probability(self):

        # total number of affixes in pool
        total_prefixes = self.desired_prefix_count + self.exclusive_prefixes
        total_suffixes = self.desired_suffix_count + self.exclusive_suffixes

        # if (
        #     self.final_prefix_count == 1
        #     and self.final_suffix_count == 1
        #     and self.desired_prefix_count == 1
        #     and self.crafted_prefix_count == 2
        #     and self.desired_suffix_count == 1
        #     and self.crafted_suffix_count == 0
        #     and self.aspect_suffix_count == 2
        # ):
        #     print("check")

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
            0,  # can't get aspect if prefix first
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
            self.aspect_suffix_count
            / max(self.exclusive_suffixes, 1),  # chance of getting aspect
        )

        # if (
        #     self.final_prefix_count == 1
        #     and self.final_suffix_count == 1
        #     and self.desired_prefix_count == 1
        #     and self.crafted_prefix_count == 2
        #     and self.desired_suffix_count == 1
        #     and self.crafted_suffix_count == 0
        #     and self.aspect_suffix_count == 2
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
        chance_aspect,
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
        if chance_aspect == 0 or final_suffixes == 0:
            return prefix_prob * suffix_prob

        # need to get odds of avoiding or annuling aspect

        # avoiding is aspect count / exclusive count

        # if self.eldritch annul
        # annuling is 1 / final suffixes
        # else
        # annuling is 1 / (final prefixes + final suffixes)

        avoid_prob = suffix_prob * (1 - chance_aspect)

        annul_odds = (
            1 / final_suffixes
            if self.eldritch_annul
            else 1 / (final_prefixes + final_suffixes)
        )
        annul_prob = suffix_prob * chance_aspect * annul_odds

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

    def recomb_details(self):
        return (
            sorted((self.starting_item(), self.paired_item())),
            self.exclusive_mods(),
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


def build_graph(eldritch=False):
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
                        eldritch,
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


# recursion? or build dict from gorund up and lookup other probs?
def pathfind(result_probs):
    final_probs = {
        (0, 0): 1.0,  # scour
        (1, 0): 1.0,  # alt spam
        (0, 1): 1.0,  # alt spam
    }

    best_recombs = {}

    result_probs = dict(sorted(result_probs.items(), key=lambda item: sum(item[0])))

    # want to collect best probabilities for each final item
    #
    for result, edges in result_probs.items():

        for edge in edges:
            edge: Recomb_Edge
            prob = edge.probability

            item1_prob = final_probs.get(edge.starting_item())
            item2_prob = final_probs.get(edge.paired_item())

            recomb_prob = prob * item1_prob * item2_prob

            if result not in final_probs:
                final_probs[result] = 0

            if result not in best_recombs:
                best_recombs[result] = []

            if recomb_prob > final_probs[result]:
                final_probs[result] = recomb_prob
                best_recombs[result] = [{"edge": edge, "overall prob": recomb_prob}]

            # if within 2% also include
            elif abs(recomb_prob - final_probs[result]) <= 0.02:
                best_recombs[result].append({"edge": edge, "overall prob": recomb_prob})

    return best_recombs


def get_probs_for_result(graph):
    result_probs = {}

    for parent, edges in graph.items():

        for edge in edges:
            edge: Recomb_Edge

            result_item = edge.result_item()

            if result_item not in result_probs:
                result_probs[result_item] = []

            if any(
                existing_edge.recomb_details() == edge.recomb_details()
                and existing_edge.exclusive_mods() == edge.exclusive_mods()
                for existing_edge in result_probs[result_item]
            ):
                continue

            result_probs[result_item].append(edge)

    # sort by prob
    for recombs in result_probs.values():
        recombs.sort(key=lambda obj: obj.probability, reverse=True)

    return result_probs


def write_results(result_probs, filename):

    with open(filename, "w") as f:
        for item, recombs in result_probs.items():

            f.write(f"\n-------------------------------------\n")
            f.write(f"{item}\n")
            for recomb in recombs:
                recomb: Recomb_Edge

                recomb_item = recomb.recomb_item()
                recomb_prob = recomb.probability
                f.write(f"Recomb: {recomb_item}, Probability: {recomb_prob:.2%}\n")


def write_paths(result_probs, filename):

    with open(filename, "w") as f:
        for item, recombs in result_probs.items():

            f.write(f"\n-------------------------------------\n")
            f.write(f"{item}\n")
            for recomb_info in recombs:
                recomb = recomb_info["edge"]
                recomb: Recomb_Edge

                overall_prob = recomb_info["overall prob"]

                recomb_item = recomb.recomb_item()
                recomb_prob = recomb.probability
                f.write(
                    f"Recomb: {recomb_item}, Probability: {recomb_prob:.2%}, Overall Probability: {overall_prob:.2%}\n"
                )


def process_graph(eldritch=False):
    resulte_file = "results"
    paths_file = "paths"
    if eldritch:
        resulte_file += "_eldritch"
        paths_file += "_eldritch"
    resulte_file += ".txt"
    paths_file += ".txt"

    graph = build_graph(eldritch)

    result_probs = get_probs_for_result(graph)
    write_results(result_probs, resulte_file)

    best_path = pathfind(result_probs)
    write_paths(best_path, paths_file)


def main():

    process_graph()
    process_graph(eldritch=True)


if __name__ == "__main__":
    main()
