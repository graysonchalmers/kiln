import pathlib
import tempfile
import time
import unittest
import _path  # noqa: F401
from kiln_runner import build_glb

FIX = pathlib.Path(__file__).parent / "fixtures"


class KilnRunnerTests(unittest.TestCase):
    def run_script(self, script, timeout=10.0, **kw):
        with tempfile.TemporaryDirectory() as d:
            return build_glb(script, pathlib.Path(d), timeout=timeout, **kw)

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
        r = self.run_script('while(true){}\nmodel("a", box(1,1,1,"wood"))', timeout=2.0, retry_factor=1)
        self.assertFalse(r.ok)
        self.assertLess(time.time() - t, 6)

    def test_a_timeout_is_retried_once_with_more_time(self):
        import kiln_runner
        calls = []
        real = kiln_runner._build_once

        def flaky(script, workdir, timeout):
            calls.append(timeout)
            if len(calls) == 1:  # the first try misses its time on a loaded box
                return kiln_runner.BuildResult(False, None, None, "kiln timed out after 10s", 10.0)
            return kiln_runner.BuildResult(True, b"glTF", 1, None, 0.1)
        kiln_runner._build_once = flaky
        try:
            r = kiln_runner.build_glb("x", pathlib.Path("."), timeout=10.0)
            self.assertEqual((r.ok, calls), (True, [10.0, 40.0]))
            calls.clear()
            kiln_runner._build_once = lambda s, w, t: (calls.append(t), kiln_runner.BuildResult(False, None, None, "kiln: syntax error", 0.1))[1]
            r = kiln_runner.build_glb("x", pathlib.Path("."), timeout=10.0)
            self.assertEqual((r.ok, calls), (False, [10.0]), "a real error is not retried")
        finally:
            kiln_runner._build_once = real


if __name__ == "__main__":
    unittest.main()
