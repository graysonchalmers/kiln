pal({ r: "#a8432f", d: "#6e2c1f", g: { color: "#8fd3ff", rough: 0.1 }, k: "#2b2b2b", y: "#d9b44a" })
model("vend", voxfn([10, 18, 8], (x, y, z) => {
  if (y < 1 && (x < 1 || x > 8) && (z < 1 || z > 6)) return "k"
  if (y < 1) return null
  if (z === 7 && x > 1 && x < 7 && y > 3 && y < 15) return "g"
  if (z === 7 && x > 7 && y > 9 && y < 12) return "y"
  return (y + x) % 5 === 0 ? "d" : "r"
}, { size: 0.1 }))
