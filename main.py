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
        #     # result item
        #     self.final_prefix_count == 2
        #     and self.final_suffix_count == 0
        #     # prefixes
        #     and self.desired_prefix_count == 2
        #     and self.crafted_prefix_count == 2
        #     # suffixes
        #     and self.desired_suffix_count == 0
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
        #     # result item
        #     self.final_prefix_count == 2
        #     and self.final_suffix_count == 0
        #     # prefixes
        #     and self.desired_prefix_count == 2
        #     and self.crafted_prefix_count == 1
        #     # suffixes
        #     and self.desired_suffix_count == 0
        #     and self.crafted_suffix_count == 1
        #     and self.aspect_suffix_count == 0
        # ):
        #     print("check")

        return 0.5 * (prefix_first + suffix_first)

    # calculate prefix and suffix probability
    def _item_probability(
        self,
        # prefixes
        prefix_pool,
        required_prefixes,
        # suffixes
        suffix_pool,
        required_suffixes,
        aspect_chance,
    ):

        if (
            prefix_pool >= CUMSUM_N
            or required_prefixes >= CUMSUM_M
            or suffix_pool >= CUMSUM_N
            or required_suffixes >= CUMSUM_M
        ):
            return 0

        prefix_prob = CUMSUM[prefix_pool][required_prefixes]
        suffix_prob = CUMSUM[suffix_pool][required_suffixes]

        # if you won't be aspect, or the only suffix is an aspect
        if aspect_chance == 0 or (required_suffixes == 1 and aspect_chance == 1):
            return prefix_prob * suffix_prob

        # need to get odds of avoiding or annuling aspect

        # avoiding is aspect count / exclusive count

        # if self.eldritch annul
        # annuling is 1 / final suffixes
        # else
        # annuling is 1 / (final prefixes + final suffixes)

        avoid_prob = suffix_prob * (1 - aspect_chance)

        annul_odds = (
            1 / required_suffixes
            if self.eldritch_annul
            else 1 / (required_prefixes + required_suffixes)
        )
        annul_prob = suffix_prob * aspect_chance * annul_odds

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


def pathfind(result_probs):

    result_probs = dict(sorted(result_probs.items(), key=lambda item: sum(item[0])))

    # prob for cumm prob of getting item, cost for multimod cost
    final_probs = {result: {"prob": 0, "cost": 0} for result in result_probs.keys()}
    final_probs.update(
        {
            (0, 0): {"prob": 1.0, "cost": 0},  # scour
            (1, 0): {"prob": 1.0, "cost": 0},  # alt spam
            (0, 1): {"prob": 1.0, "cost": 0},  # alt spam
        }
    )
    best_recombs = {result: [] for result in result_probs.keys()}

    cheapest_probs = {result: {"prob": 0, "cost": 0} for result in result_probs.keys()}
    cheapest_probs.update(
        {
            (0, 0): {"prob": 1.0, "cost": 0},  # scour
            (1, 0): {"prob": 1.0, "cost": 0},  # alt spam
            (0, 1): {"prob": 1.0, "cost": 0},  # alt spam
        }
    )
    cheapest_recombs = {result: [] for result in result_probs.keys()}

    for result, edges in result_probs.items():

        for edge in edges:
            edge: Recomb_Edge
            prob = edge.probability
            # cost of base
            cost = 0.5
            # add 2 divs for multicraft or lock prefix to remove aspect
            if edge.crafted_prefix_count + edge.crafted_suffix_count > 2 or (
                edge.final_suffix_count == 0 and edge.aspect_suffix_count > 1
            ):
                cost += 2

            item1_prob = final_probs.get(edge.starting_item())["prob"]
            item2_prob = final_probs.get(edge.paired_item())["prob"]

            item1_cost = cheapest_probs.get(edge.starting_item())["cost"]
            item2_cost = cheapest_probs.get(edge.paired_item())["cost"]

            recomb_prob = prob * item1_prob * item2_prob
            recomb_cost = cost / prob
            total_cost = recomb_cost + item1_cost + item2_cost

            if recomb_prob > final_probs[result]["prob"]:
                final_probs[result]["prob"] = recomb_prob
                final_probs[result]["cost"] = total_cost
                best_recombs[result] = [
                    {"edge": edge, "overall prob": recomb_prob, "avg cost": total_cost}
                ]

            # if within 2% also include
            elif abs(recomb_prob - final_probs[result]["prob"]) <= 0.02:
                best_recombs[result].append(
                    {"edge": edge, "overall prob": recomb_prob, "avg cost": total_cost}
                )

            # add to cheapest avg cost
            if cheapest_probs[result]["prob"] == 0 or total_cost < (
                cheapest_probs[result]["cost"]
            ):
                cheapest_probs[result]["prob"] = recomb_prob
                cheapest_probs[result]["cost"] = total_cost
                cheapest_recombs[result] = [
                    {"edge": edge, "overall prob": recomb_prob, "avg cost": total_cost}
                ]

            # if within 2% also include
            elif abs(total_cost - cheapest_probs[result]["cost"]) <= 2:
                cheapest_recombs[result].append(
                    {"edge": edge, "overall prob": recomb_prob, "avg cost": total_cost}
                )

    # sort by overall prob
    for recombs in best_recombs.values():
        recombs.sort(key=lambda obj: obj["overall prob"], reverse=True)

    for recombs in cheapest_recombs.values():
        recombs.sort(key=lambda obj: obj["overall prob"], reverse=True)

    return best_recombs, cheapest_recombs


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

            final_item = (
                f"{recombs[0].final_prefix_count}p/{recombs[0].final_suffix_count}s"
            )
            f.write(f"\n-------------------------------------\n")
            f.write(f"{final_item}\n")
            for recomb in recombs:
                recomb: Recomb_Edge

                recomb_item = recomb.recomb_item()
                recomb_prob = recomb.probability
                f.write(f"Recomb: {recomb_item}, Prob: {recomb_prob:.2%}\n")


def write_paths(result_probs, filename):

    with open(filename, "w") as f:
        for item, recombs in result_probs.items():
            final_item = ""
            if len(recombs) == 0:
                if item == (1, 0):
                    final_item = "1p/0s"
                elif item == (0, 1):
                    final_item = "0p/1s"
                else:
                    print("wrong final item")
            else:
                final_item = f"{recombs[0]['edge'].final_prefix_count}p/{recombs[0]['edge'].final_suffix_count}s"

            f.write(f"\n-------------------------------------\n")
            f.write(f"{final_item}\n")
            for recomb_info in recombs:
                recomb = recomb_info["edge"]
                recomb: Recomb_Edge

                overall_prob = recomb_info["overall prob"]
                avg_cost = recomb_info["avg cost"]

                recomb_item = recomb.recomb_item()
                recomb_prob = recomb.probability
                f.write(
                    f"Recomb: {recomb_item}, Avg Cost: {avg_cost:0.2f}, Overall Prob: {overall_prob:.2%}\n"
                )


def process_graph(eldritch=False):
    result_file = f"results{'_eldritch' if eldritch else ''}.txt"
    paths_file = f"paths{'_eldritch' if eldritch else ''}.txt"
    cheapest_paths_file = f"cheapest_paths{'_eldritch' if eldritch else ''}.txt"

    graph = build_graph(eldritch)

    result_probs = get_probs_for_result(graph)
    write_results(result_probs, result_file)

    best_path, cheapest_path = pathfind(result_probs)
    write_paths(best_path, paths_file)
    write_paths(cheapest_path, cheapest_paths_file)


def main():

    process_graph()
    process_graph(eldritch=True)


if __name__ == "__main__":
    main()
