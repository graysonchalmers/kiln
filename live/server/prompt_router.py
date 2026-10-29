"""Picks the stage prompt for a request: man-made things (shell plus internal structure: barrels, crates, lamps) or organic
things (plants, mushrooms, creatures, characters). Cheap keyword counts; ties go to man-made, the prompt that was already
the default. A wrong pick still builds something, it just gets the other prompt's habits."""
import asyncio
import re

ORGANIC = ("mushroom toadstool fungus fungi tree bush shrub flower plant sprout seedling vine grass leaf leaves cactus palm pine oak bonsai "
           "fern lily rose tulip sunflower creature monster animal dog cat kitten puppy bird duck chicken owl fish frog toad snake lizard "
           "turtle spider bug beetle ant bee butterfly rabbit bunny mouse rat horse cow pig sheep goat bear wolf fox deer dragon dinosaur "
           "slime blob ghost goblin orc elf dwarf troll zombie skeleton person man woman human character child baby knight wizard witch "
           "warrior soldier king queen princess pirate alien octopus jellyfish coral fruit pumpkin apple carrot pear acorn pinecone egg "
           "snail worm squid crab shark whale dolphin penguin girl boy gnome dandelion daisy orchid cabbage mushrooms "
           "willow maple birch cedar redwood elm cypress baobab bamboo sapling branch ivy lotus clover thistle weed flytrap hedgehog hippo hippopotamus "
           "mermaid merman stag antler antlers elephant giraffe zebra lion tiger leopard monkey ape gorilla kangaroo camel rhino crocodile alligator bat eagle "
           "hawk parrot swan goose seagull seal otter beaver squirrel raccoon panda koala sloth wasp moth caterpillar scorpion centipede ghoul vampire "
           "werewolf giant ogre fairy pixie nymph centaur unicorn phoenix griffin hydra kraken treant ent ladybug dragonfly firefly hamster llama alpaca "
           "gecko iguana chameleon seahorse starfish clam mussel oyster lobster shrimp bull ox donkey mule pony foal lamb calf chick rooster hen turkey").split()
MANMADE = ("barrel bucket crate chest box lamp lantern bottle flask jar cup mug table chair stool bench door gate fence signpost sign mailbox "
           "machine vending car cart wagon boat ship tower bridge sword shield axe hammer key lock clock radio computer robot engine "
           "cannon torch candle book scroll anvil forge pot pan vase statue pillar column crystal tent bed shelf cabinet wardrobe "
           "furnace oven stove fountain well barricade turret generator terminal console camera").split()


def _hits(words, text: str) -> list[int]:
    """Start positions of every word of the list found in the text (plural and compounds: wildflowers, goldfish)."""
    out = []
    for w in words:
        for m in re.finditer(rf"\b(?:\w*{w}|{w})(s|es)?\b" if w in STEMS else rf"\b{w}(s|es)?\b", text):
            out.append(m.start())
    return out


STEMS = {"flower", "fish", "tree", "bird"}  # also match inside compounds: wildflower, goldfish, pinetree, songbird


def classify(prompt: str) -> tuple[str, bool]:
    """('organic'|'manmade', confident) from keywords: more keywords wins; on a tie the thing named first wins (the head noun comes
    first: "mushroom house with a round door", "barrel with a vine"). Confident only when one side has at least two more
    hits (one stray word is not enough: "bird house", "oak writing desk"); anything less is a guess, and the router then asks the model."""
    text = (prompt or "").lower()
    org, man = _hits(ORGANIC, text), _hits(MANMADE, text)
    if len(org) != len(man):
        kind_ = "organic" if len(org) > len(man) else "manmade"
        return kind_, abs(len(org) - len(man)) >= 2
    if org and man:
        return ("organic" if min(org) < min(man) else "manmade"), False
    return "manmade", False


def kind(prompt: str) -> str:
    """The keyword pick alone (no model call)."""
    return classify(prompt)[0]


class Router:
    """prompt -> pool. Keywords decide when they are clear; otherwise one cheap model call (`ask`: async prompt -> text, or None)
    breaks the tie, and a failed or odd answer falls back to the keyword guess."""
    def __init__(self, pools: dict, ask=None, timeout: float = 6.0):
        self.pools, self.ask, self.timeout = pools, ask, timeout
        self.asked = 0

    async def kind(self, prompt: str) -> str:
        k, sure = classify(prompt)
        if sure or self.ask is None:
            return k
        self.asked += 1
        try:
            answer = (await asyncio.wait_for(self.ask(prompt), self.timeout) or "").strip().lower()
        except Exception:
            return k
        return answer if answer in ("organic", "manmade") else k

    async def pool_for(self, prompt: str):
        before = self.asked
        k = await self.kind(prompt)
        print(f"route {k} ({'model' if self.asked > before else 'keywords'}): {(prompt or '')[:70]}", flush=True)
        return self.pools.get(k) or self.pools["manmade"]
