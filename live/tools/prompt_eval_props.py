"""The 12 props of the better-builds eval (shared by prompt_eval.py and paired_retry.py)."""
GROUPS = {
    "organic": {
        "mushroom": ("stylised mushroom house: big red spotted cap roof, cream round stem with a small door and a window", [1.0, 1.1, 1.0]),
        "oaktree": ("stylised oak tree with a thick trunk, a few branches and a round leafy crown", [1.0, 1.6, 1.0]),
        "frog": ("stylised green frog sitting upright, big eyes, wide mouth, front and back legs", [0.8, 0.7, 0.8]),
        "cactus": ("stylised saguaro cactus with two upturned arms and a few flowers", [0.8, 1.4, 0.5]),
        "knight": ("stylised knight in plate armour standing, helmet with a visor, a sword and a shield", [0.7, 1.7, 0.5]),
        "slime": ("stylised friendly slime blob with big eyes and a small crown", [0.8, 0.7, 0.8]),
    },
    "manmade": {
        "potion": ("stylised potion bottle: round glass flask with a long neck, a cork stopper and glowing liquid inside", [0.5, 0.8, 0.5]),
        "lantern": ("stylised hanging lantern: metal frame, a glowing flame inside glass panes, a top ring and a base", [0.5, 0.9, 0.5]),
        "chest": ("stylised treasure chest: wooden body, rounded lid, iron bands, a gold lock", [0.9, 0.6, 0.55]),
        "bucket": ("stylised wooden water bucket: tapered wooden staves, two iron hoops, a rope handle arching over the top", [0.5, 0.55, 0.5]),
        "signpost": ("stylised wooden signpost: a tall post with two arrow-shaped planks pointing opposite ways", [0.8, 1.6, 0.25]),
        "crate": ("stylised military ammo crate: olive wooden box, metal latches, a hinged lid and rope handles", [1.0, 0.5, 0.6]),
    },
}

ALL = {**GROUPS["organic"], **GROUPS["manmade"]}
