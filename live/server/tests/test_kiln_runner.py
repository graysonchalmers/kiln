import pathlib
import tempfile
import time
import unittest
import _path  # noqa: F401
from kiln_runner import build_glb

FIX = pathlib.Path(__file__).parent / "fixtures"


class KilnRunnerTests(unittest.TestCase):
    def run_script(self, script, timeout=10.0):
        with tempfile.TemporaryDirectory() as d:
            return build_glb(script, pathlib.Path(d), timeout=timeout)

    def test_builds_known_script(self):
        r = self.run_script((FIX / "vend.kx.js").read_text())
        self.assertTrue(r.ok, r.error)
        self.assertEqual(r.tris, 346)
        self.assertEqual(r.glb[:4], b"glTF")

    def test_syntax_error_returns_not_ok_with_message(self):
        r = self.run_script('model("a", voxfn([2,2,2], (x,y,z)=> {')
        self.assertFalse(r.ok)
        self.assertTrue(r.error)
        self.assertIsNone(r.glb)

    def test_timeout(self):
        t = time.time()
        r = self.run_script('while(true){}\nmodel("a", box(1,1,1,"wood"))', timeout=2.0)
        self.assertFalse(r.ok)
        self.assertLess(time.time() - t, 6)


if __name__ == "__main__":
    unittest.main()
