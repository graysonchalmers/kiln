// Animation: named parts rotate / move / scale about their pivots; clips export as glTF animations.
pal({ wood: "#9c6a4d", woodD: "#6e4535", stone: "#8a8f9c", roof: "#b5473a", cloth: "#f2e6cf", grass: "#74c45a",
  iron: { color: "#7a808c", metal: 0.7, rough: 0.4 }, flame: { color: "#ff9b2f", emit: "#ffa030", glow: 6 } })

model("windmill",
  box(3, 0.1, 3, "grass"),
  cyl(0.7, 2.6, { mat: "stone", sides: 8, top: 0.45, pos: [0, 0.1, 0] }),
  cone(0.62, 0.7, { mat: "roof", sides: 8, pos: [0, 2.7, 0] }),
  // the door hinges on its left edge
  part("door", { pivot: [-0.2, 0.1, 0.68] }, box(0.4, 0.75, 0.06, { mat: "woodD", pos: [0, 0.1, 0.68] })),
  // four sails on a hub; the hub axis points out of the front (+z)
  part("sails", { pivot: [0, 2.3, 0.6] },
    cyl(0.12, 0.2, { mat: "iron", sides: 8, rot: [90, 0, 0], pos: [0, 2.3, 0.5] }),
    [0, 90, 180, 270].map((a) => tf({ pos: [0, 2.3, 0.62], rot: [0, 0, a] },
      box(0.08, 1.4, 0.04, { mat: "woodD", pos: [0, 0, 0] }), box(0.3, 1.1, 0.02, { mat: "cloth", pos: [0.19, 0.25, 0.02] })))),
  // a lantern bobbing on a post; its light moves with it, its flame flickers
  cyl(0.04, 1.2, { mat: "woodD", sides: 6, pos: [1.1, 0.1, 0.9] }),
  part("lantern", { pivot: [1.1, 1.3, 0.9] },
    box(0.16, 0.2, 0.16, { mat: "iron", pos: [1.1, 1.0, 0.9] }),
    part("flame", { pivot: [1.1, 1.06, 0.9] }, cone(0.04, 0.12, { mat: "flame", sides: 5, pos: [1.1, 1.04, 0.9] })),
    light({ color: "#ffa040", power: 30, pos: [1.1, 1.1, 1.05] })))

animate("windmill", "turn", { frames: 48, fps: 24 }, {
  sails: { rot: [[0, [0, 0, 0], "linear"], [48, [0, 0, -360]]] },                         // one full turn, constant speed
  door: { rot: [[0, [0, 0, 0]], [12, [0, -80, 0]], [36, [0, -80, 0]], [48, [0, 0, 0]]] },   // open, hold, close
  lantern: { rot: [[0, [0, 0, 8]], [24, [0, 0, -8]], [48, [0, 0, 8]]] },                  // sway
  flame: { scale: [[0, 1, "step"], [7, 0.5, "step"], [9, 1, "step"], [30, 0.6, "step"], [31, 1]] },  // flicker
})
