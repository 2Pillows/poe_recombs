# main.py

# Toggle for if eldritch possible
eldritch_annul = False


def calculate_probability(
    desired_prefix_count,
    crafted_prefix_count,
    desired_suffix_count,
    crafted_suffix_count,
    aspect_suffix_count,
):
    total_prefix_count = desired_prefix_count + crafted_prefix_count
    total_suffix_count = (
        desired_suffix_count + crafted_suffix_count + aspect_suffix_count
    )

    # Weights table for final mod counts given initial mod counts
    weights_table = [
        [0.0, 0.0, 0.0, 0.0],  # 0 initial mod
        [0.41, 0.59, 0.0, 0.0],  # 1 initial mod
        [0.0, 0.67, 0.33, 0.0],  # 2 initial mods
        [0.0, 0.39, 0.52, 0.10],  # 3 initial mods
        [0.0, 0.11, 0.59, 0.31],  # 4 initial mods
        [0.0, 0.0, 0.43, 0.57],  # 5 initial mods
        [0.0, 0.0, 0.28, 0.72],  # 6 initial mods
    ]

    max_initial = 6
    max_final = 3

    # get odds of at least final for each possible final
    cumsum = []
    for row in weights_table:
        row_reversed = row[::-1]
        accumulated = []
        total = 0.0
        for value in row_reversed:
            total = min(total + value, 1.0)
            accumulated.append(total)
        cumsum.append(accumulated[::-1])

    # probabilities for prefix/suffix for if prefix or suffix chosen first
    prefix_first_prefix_prob = 0 if desired_prefix_count != 0 else 1
    suffix_first_prefix_prob = 0 if desired_prefix_count != 0 else 1

    suffix_first_suffix_prob = 0 if desired_suffix_count != 0 else 1
    prefix_first_suffix_prob = 0 if desired_suffix_count != 0 else 1

    # probs for getting a reuseable base
    reuse_prefix_first_prefix_prob = 0 if desired_prefix_count != 0 else 1
    reuse_suffix_first_prefix_prob = 0 if desired_prefix_count != 0 else 1

    reuse_suffix_first_suffix_prob = 0 if desired_suffix_count != 0 else 1
    reuse_prefix_first_suffix_prob = 0 if desired_suffix_count != 0 else 1

    # Prefixes
    if desired_prefix_count != 0:
        # from desired to max mods, get odds including odds of avoid crafted mods
        # assumes that you cannot avoid crafted mods, impossible to get 3 desired wo/ crafted
        required_prefixes = desired_prefix_count + min(crafted_prefix_count, 1)

        if required_prefixes <= max_final and total_prefix_count <= max_initial:
            prefix_first_prefix_prob = cumsum[total_prefix_count][required_prefixes]
            reuse_prefix_first_prefix_prob = cumsum[total_prefix_count][
                required_prefixes - 1
            ]

        # suffixes are calculated first
        # remove any crafted / exclusive mods from pool
        if (
            desired_suffix_count < max_final
            and total_prefix_count <= max_initial
            and crafted_suffix_count > 0
        ):
            suffix_first_prefix_prob = cumsum[total_prefix_count][desired_prefix_count]
            reuse_suffix_first_prefix_prob = cumsum[total_prefix_count][
                desired_prefix_count - 1
            ]

    # Suffixes
    if desired_suffix_count != 0:

        # from desired to max mods, get odds including odds of avoid crafted mods
        exclusive_suffixes = crafted_suffix_count + aspect_suffix_count
        required_suffixes = desired_suffix_count + min(exclusive_suffixes, 1)

        if required_suffixes <= max_final and total_suffix_count <= max_initial:
            suffix_first_suffix_prob = cumsum[total_suffix_count][required_suffixes]
            reuse_suffix_first_suffix_prob = cumsum[total_suffix_count][
                required_suffixes - 1
            ]

            # if there is an aspect, u need to calc odds of avoiding or annuling
            if aspect_suffix_count:

                # get another exclusive suffix
                avoid_aspect_prob = suffix_first_suffix_prob * (
                    1 - aspect_suffix_count / exclusive_suffixes
                )

                # assume u get perfect prefixes
                annul_prob = (
                    1 / required_suffixes
                    if eldritch_annul
                    else 1 / (desired_prefix_count + required_suffixes)
                )

                annul_aspect_prob = (
                    suffix_first_suffix_prob
                    * (aspect_suffix_count / exclusive_suffixes)
                    * annul_prob
                )

                reuse_annul_prob = (
                    1 / (required_suffixes - 1)
                    if eldritch_annul
                    else 1 / (desired_prefix_count + required_suffixes - 1)
                )

                reuse_annul_aspect_prob = (
                    reuse_suffix_first_suffix_prob
                    * (aspect_suffix_count / exclusive_suffixes)
                    * reuse_annul_prob
                )

                suffix_first_suffix_prob = avoid_aspect_prob + annul_aspect_prob
                reuse_suffix_first_suffix_prob = (
                    avoid_aspect_prob + reuse_annul_aspect_prob
                )

        # prefixes are calculated first
        # remove any crafted / exclusive mods from pool
        if (
            desired_prefix_count < max_final
            and total_suffix_count <= max_initial
            and crafted_prefix_count > 0
        ):
            prefix_first_suffix_prob = cumsum[total_suffix_count][desired_suffix_count]
            reuse_prefix_first_suffix_prob = cumsum[total_suffix_count][
                desired_suffix_count - 1
            ]

    # Total odds of success
    prefix_first_prob = 0.5 * prefix_first_prefix_prob * prefix_first_suffix_prob
    suffix_first_prob = 0.5 * suffix_first_prefix_prob * suffix_first_suffix_prob
    total_probability = prefix_first_prob + suffix_first_prob

    reuse_prefix_first_prob = (
        0.5 * reuse_prefix_first_prefix_prob * reuse_prefix_first_suffix_prob
    )
    reuse_suffix_first_prob = (
        0.5 * reuse_suffix_first_prefix_prob * reuse_suffix_first_suffix_prob
    )
    reuse_total_probability = reuse_prefix_first_prob + reuse_suffix_first_prob

    # if (
    #     desired_prefix_count == 2
    #     and desired_suffix_count == 0
    #     and crafted_prefix_count == 1
    #     and crafted_suffix_count == 1
    #     and aspect_suffix_count == 0
    # ):
    #     print("a")

    return total_probability, reuse_total_probability


results = {}

max_total_mods = 6

combinations = [
    (
        desired_prefix_count,
        crafted_prefix_count,
        desired_suffix_count,
        crafted_suffix_count,
        aspect_suffix_count,
    )
    for desired_prefix_count in range(4)
    for crafted_prefix_count in range(5)
    if desired_prefix_count + crafted_prefix_count <= max_total_mods
    for desired_suffix_count in range(4)
    for crafted_suffix_count in range(7)
    if crafted_prefix_count + crafted_suffix_count <= 6
    for aspect_suffix_count in range(2)
]

# Process each combination
for combo in combinations:
    (
        desired_prefix_count,
        crafted_prefix_count,
        desired_suffix_count,
        crafted_suffix_count,
        aspect_suffix_count,
    ) = combo

    if (
        desired_suffix_count + crafted_suffix_count + aspect_suffix_count
    ) > max_total_mods or (desired_prefix_count == 0 and desired_suffix_count == 0):
        continue

    prob_success, prob_reusable_base = calculate_probability(
        desired_prefix_count,
        crafted_prefix_count,
        desired_suffix_count,
        crafted_suffix_count,
        aspect_suffix_count,
    )

    # add probability if possible
    if prob_success > 0:
        if (desired_prefix_count, desired_suffix_count) not in results:
            results[(desired_prefix_count, desired_suffix_count)] = []

        results[(desired_prefix_count, desired_suffix_count)].append(
            {
                "crafted prefixes": crafted_prefix_count,
                "crafted suffixes": crafted_suffix_count,
                "aspect suffixes": aspect_suffix_count,
                "success": prob_success,
                "reusable base": prob_reusable_base,
            }
        )

# write all results
with open("results.txt", "w") as f:
    for (desired_prefix_count, desired_suffix_count), entries in results.items():
        f.write(f"\n{desired_prefix_count}p/{desired_suffix_count}s\n")
        f.write("-----------------------------------\n")

        # sort and write options
        sorted_entries = sorted(entries, key=lambda x: x["success"], reverse=True)
        for entry in sorted_entries:
            # Format the percentage values
            reusable_base = f"{entry['reusable base']:.2%}"
            success = f"{entry['success']:.2%}"
            reusable_base = reusable_base.rjust(7)
            success = success.rjust(7)

            # Write the formatted string
            f.write(
                f"{entry['crafted prefixes']}c / {entry['crafted suffixes']}c {entry['aspect suffixes']}a, "
                f"reusable: {reusable_base}, "
                f"success: {success}\n"
            )

# write results for wo/ multicrafting
with open("no_multimod_results.txt", "w") as f:
    for (desired_prefix_count, desired_suffix_count), entries in results.items():
        f.write(f"\n{desired_prefix_count}p/{desired_suffix_count}s\n")
        f.write("-----------------------------------\n")

        # sort and write options
        sorted_entries = sorted(entries, key=lambda x: x["success"], reverse=True)
        for entry in sorted_entries:
            if entry["crafted prefixes"] + entry["crafted suffixes"] > 2:
                continue

            # Format the percentage values
            reusable_base = f"{entry['reusable base']:.2%}"
            success = f"{entry['success']:.2%}"
            reusable_base = reusable_base.rjust(7)
            success = success.rjust(7)

            # Write the formatted string
            f.write(
                f"{entry['crafted prefixes']}c / {entry['crafted suffixes']}c {entry['aspect suffixes']}a, "
                f"reusable: {reusable_base}, "
                f"success: {success}\n"
            )
