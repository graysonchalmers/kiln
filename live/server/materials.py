"""Material tags per palette key: stone, wood, metal, cloth, glass, emissive, default. The client maps a tag to roughness,
metallic, grain and fresnel. A tag comes from the palette entry's `mat` field, else from its emit/metal/rough numbers, else
from its colour."""
import colorsys

TAGS = ("default", "stone", "wood", "metal", "cloth", "glass", "emissive")


def _num(v, default=None):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else default


def infer_tag(color: str, entry=None) -> str:
    """Tag for one palette entry: `color` is '#rrggbb', `entry` the raw pal value (string or dict)."""
    e = entry if isinstance(entry, dict) else {}
    mat = e.get("mat", e.get("material"))
    if isinstance(mat, str) and mat.lower() in TAGS:
        return mat.lower()
    if isinstance(e.get("emit"), str) or _num(e.get("glow"), 0) > 0:
        return "emissive"
    if _num(e.get("metal"), 0) >= 0.5:
        return "metal"
    if _num(e.get("rough"), 1.0) <= 0.2:
        return "glass"
    r, g, b = (int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h *= 360
    if 15 <= h <= 45 and 0.2 <= s <= 0.75 and 0.15 <= l <= 0.6:
        return "wood"
    if 40 <= h <= 60 and s >= 0.5 and l >= 0.4:
        return "metal"  # gold and brass
    if s < 0.12:
        return "metal" if l < 0.28 else "stone"
    return "default"
