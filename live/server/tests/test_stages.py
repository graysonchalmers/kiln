import unittest
import _path  # noqa: F401
from stages import StageSplitter, clean_script

S1 = 'pal({r:"#a00"})\nmodel("a", voxfn([2,2,2], (x,y,z)=>"r", {size:0.1}))'
S2 = 'pal({r:"#a00"})\nmodel("a", voxfn([4,4,4], (x,y,z)=>"r", {size:0.05}))'
S3 = 'pal({r:"#a00"})\nmodel("a", voxfn([8,8,8], (x,y,z)=>"r", {size:0.025}))'
SEP = "\n//---STAGE---\n"


def feed_all(text, n):
    sp = StageSplitter()
    out = []
    for i in range(0, len(text), n):
        out += sp.feed(text[i:i + n])
    return sp, out


class StageTests(unittest.TestCase):
    def test_split_across_chunks(self):
        sp, out = feed_all(S1 + SEP + S2 + SEP + S3, 7)
        out += sp.finish()
        self.assertEqual(out, [S1, S2, S3])

    def test_fences_stripped(self):
        sp, out = feed_all("```js\n" + S1 + "\n```" + SEP + "```\n" + S2 + "\n```", 5)
        out += sp.finish()
        self.assertEqual(len(out), 2)
        self.assertFalse(any("`" in s for s in out))

    def test_unbalanced_last_stage_dropped(self):
        sp, out = feed_all(S1 + SEP + S2[:-6], 9)
        out += sp.finish()
        self.assertEqual(out, [S1])

    def test_no_stage_returns_empty(self):
        sp, out = feed_all("Sorry, I can't help with that.", 4)
        self.assertEqual(out + sp.finish(), [])

    def test_clean_script_strips_prose_lines(self):
        self.assertEqual(clean_script("Here you go:\n" + S1 + "\nHope it helps!"), S1)


if __name__ == "__main__":
    unittest.main()
