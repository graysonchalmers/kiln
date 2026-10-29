import asyncio
import json
import pathlib
import unittest
import _path  # noqa: F401
from prompt_router import Router, classify, kind

HERE = pathlib.Path(__file__).parent
LISTS = {n: json.loads((HERE / f"router_{n}.json").read_text()) for n in ("labels", "heldout", "fresh")}


def accuracy(lists):
    hit = tot = 0
    for lab in ("organic", "manmade"):
        for p in lists[lab]:
            tot += 1
            hit += kind(p) == lab
    return hit / tot


class KeywordTests(unittest.TestCase):
    def test_clear_cases_are_confident(self):
        self.assertEqual(classify("a wooden barrel next to a bucket and a crate"), ("manmade", True))
        self.assertEqual(classify("a green frog and a toad on a lily pad"), ("organic", True))
        self.assertFalse(classify("bird house on a pole")[1], "one stray organic word is a guess")

    def test_ties_and_no_hits_are_guesses_and_the_first_named_thing_wins_a_tie(self):
        self.assertEqual(classify("mushroom house with a round door"), ("organic", False))
        self.assertEqual(classify("wooden barrel with a vine"), ("manmade", False))
        self.assertEqual(classify("a fancy zorblax"), ("manmade", False))   # no hits: the default prompt
        self.assertEqual(classify(""), ("manmade", False))

    def test_compounds_and_plurals(self):
        self.assertEqual(kind("bunch of wildflowers"), "organic")
        self.assertEqual(kind("a swimming goldfish"), "organic")

    def test_accuracy_on_the_lists(self):
        # labels and heldout were used to tune the word lists (100%); fresh was written afterwards: 31 of 40 when measured
        self.assertEqual(accuracy(LISTS["labels"]), 1.0)
        self.assertEqual(accuracy(LISTS["heldout"]), 1.0)
        self.assertGreaterEqual(accuracy(LISTS["fresh"]), 0.7)


class RouterTests(unittest.IsolatedAsyncioTestCase):
    def make(self, ask):
        return Router({"manmade": "M", "organic": "O"}, ask=ask)

    async def test_clear_prompts_never_call_the_model(self):
        calls = []

        async def ask(p):
            calls.append(p)
            return "organic"
        r = self.make(ask)
        self.assertEqual(await r.pool_for("a barrel, a crate and a chest"), "M")
        self.assertEqual(await r.pool_for("a frog and a toad"), "O")
        self.assertEqual(calls, [])

    async def test_a_guess_asks_the_model_and_uses_its_one_word(self):
        async def ask(p):
            return " Organic\n"
        r = self.make(ask)
        self.assertEqual(await r.pool_for("a fancy zorblax"), "O")
        self.assertEqual(r.asked, 1)

    async def test_a_failing_slow_or_odd_model_falls_back_to_the_keyword_guess(self):
        async def boom(p):
            raise RuntimeError("no model")

        async def slow(p):
            await asyncio.sleep(5)

        async def odd(p):
            return "I think it is a plant."
        for ask in (boom, slow, odd):
            r = Router({"manmade": "M", "organic": "O"}, ask=ask, timeout=0.2)
            self.assertEqual(await r.pool_for("mushroom house with a round door"), "O", ask.__name__)   # the tie-break guess
            self.assertEqual(await r.pool_for("a fancy zorblax"), "M", ask.__name__)

    async def test_no_model_means_keywords_only(self):
        r = self.make(None)
        self.assertEqual(await r.pool_for("a fancy zorblax"), "M")


if __name__ == "__main__":
    unittest.main()
