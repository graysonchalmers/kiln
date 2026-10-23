// One view of a model at a chosen camera, no ground: the matched-camera render for image -> blockout.
//   node lib/grayson/shot.ts <scene.kx.js> <model> [--yaw 20] [--pitch 20] [--size 400] [--bg "#f0f0f0"] [--out shot.png]
// --bg: a solid backdrop matching the reference, so a judge compares colours under the same surround.
import { writeFileSync } from "node:fs";
import { loadProject } from "../../src/node/load.ts";
import { viewPng } from "../../src/node/preview.ts";

const [scene, name, ...rest] = process.argv.slice(2);
if (!scene || !name) { console.error("usage: shot.ts <scene.kx.js> <model> [--yaw 20] [--pitch 20] [--size 400] [--out shot.png]"); process.exit(2); }
const opt = (k: string, d: string) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
const size = Number(opt("size", "400")), out = opt("out", `${name}.shot.png`);
const b = loadProject(scene).build(name);
writeFileSync(out, viewPng(b, { yaw: Number(opt("yaw", "20")), pitch: Number(opt("pitch", "20")), w: size, h: size, ground: false, bg: rest.includes("--bg") ? opt("bg", "") : undefined }));
console.log(out);
