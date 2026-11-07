# School fish sunlight

The instanced fish have outward-facing trunk normals and deformation normals that include both the tail-wave and its envelope derivative. They sample the shared RGB depth-layer caustic texture, with the same world-space projection as the other underwater materials.

Broad silver sheen and a narrower highlight respond to sunlight, viewing angle and the fish's orientation. A stable per-instance variation breaks up identical reflections; it does not introduce timed random flashing. Screen-space normal variation broadens small highlights to reduce aliasing. Sunlight effects fade with depth, daylight and solar visibility, and disappear when sun power is zero. The existing 600-fish instance budget is unchanged.

Visual references supplied by the user: [Facebook reel](https://www.facebook.com/reel/1318496920204407) and [Instagram reel](https://www.instagram.com/reels/DWRPVN6DfWp/). The observed broad flank reflections informed the appearance; their intensity and colour are not physical calibration data.

Gemini 4 Argon High proposed the geometry and shader edits. Codex checked and integrated them, corrected the solar visibility convention against the actual shared shader, and tested rendering. `node tests/fish-normals.cjs` checks all trunk normals. The local browser diagnostic `validation/fish-light.cjs` checks compilation, angle-dependent reflection, response to the caustic texture, night gating and deterministic repeated rendering.
