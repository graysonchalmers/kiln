import asyncio
import json
import pathlib
import unittest
import _path  # noqa: F401
from prompt_router import Router, classify, kind, subject

HERE = pathlib.Path(__file__).parent
LISTS = {n: json.loads((HERE / f"router_{n}.json").read_text()) for n in ("labels", "heldout", "fresh")}


class KeywordTests(unittest.TestCase):
    def test_the_subject_is_the_phrase_before_its_parts(self):
        self.assertEqual(subject("stylised mushroom house: big red spotted cap roof, cream round stem with a small door and a window"), "mushroom house")
        self.assertEqual(subject("stylised knight in plate armour standing, helmet with a visor, a sword and a shield"), "knight")
        self.assertEqual(subject("a wooden barrel with a vine"), "wooden barrel")
        self.assertEqual(subject("a frog and a toad on a lily pad"), "frog")
        self.assertEqual(subject(""), "")

    def test_parts_clothes_and_tools_do_not_decide_the_kind(self):
        # these were sent to the wrong prompt when the whole text was counted: "door", "sword", "vine"
        self.assertEqual(kind("mushroom house: red cap, a door and a window"), "organic")
        self.assertEqual(kind("knight in plate armour holding a sword and a shield"), "organic")
        self.assertEqual(kind("wooden barrel with a vine and a bird on top"), "manmade")

    def test_confident_only_with_a_margin_of_two(self):
        self.assertEqual(classify("barrel crate"), ("manmade", True))   # two man-made words in the subject
        self.assertEqual(classify("frog toad"), ("organic", True))
        self.assertFalse(classify("bird house on a pole")[1], "one stray organic word is a guess")
        self.assertFalse(classify("oak writing desk with drawers")[1])
        self.assertEqual(classify("a fancy zorblax"), ("manmade", False))   # no hits: the default prompt
        self.assertEqual(classify(""), ("manmade", False))

    def test_compounds_and_plurals(self):
        self.assertEqual(classify("bunch of wildflowers"), ("organic", False))
        self.assertEqual(classify("wildflowers, daisies, roses")[0], "organic")

    def test_a_confident_keyword_decision_is_never_wrong_on_any_list(self):
        for name, lists in LISTS.items():
            for lab in ("organic", "manmade"):
                for prompt in lists[lab]:
                    k, sure = classify(prompt)
                    if sure:
                        self.assertEqual(k, lab, (name, prompt))


class RouterTests(unittest.IsolatedAsyncioTestCase):
    def make(self, ask):
        return Router({"manmade": "M", "organic": "O"}, ask=ask)

    async def test_clear_prompts_never_call_the_model(self):
        calls = []

        async def ask(p):
            calls.append(p)
            return "organic"
        r = self.make(ask)
        self.assertEqual(await r.pool_for("barrel crate"), "M")
        self.assertEqual(await r.pool_for("frog toad"), "O")
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
            self.assertEqual(await r.pool_for("frog toad"), "O", ask.__name__)   # confident by keywords: no model needed
            self.assertEqual(await r.pool_for("a fancy zorblax"), "M", ask.__name__)   # a failed model: the default prompt

    async def test_no_model_means_keywords_only(self):
        r = self.make(None)
        self.assertEqual(await r.pool_for("a fancy zorblax"), "M")


if __name__ == "__main__":
    unittest.main()
