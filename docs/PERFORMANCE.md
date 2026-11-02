# Graphics performance review — 2026-11-02

The baseline below predates manta integration. Implementation status was updated on 2026-11-02; baseline measurements are retained for context.

## Implemented follow-up

- **Unconditional, preserving geometry/material detail:** batch rigid scuba torso/head meshes by material and RIB components by material. Moving joints, torch parts and their references remain separate. The wreck was already batched in `seabed.js`; the initial recommendation overstated the opportunity there.
- **Unconditional, preserving live particles:** indexed draw lists omit dead scuba bubbles and expired bioluminescent points. Slot order is preserved. Scuba physics uses a live-slot set and sorted indices, retaining the original integration/merge ordering and gas-expansion laws.
- **Unconditional:** split `scuba-scenarios.js` into timeline/boat update and post-pose attachment/contact refresh. The boat wake now updates once per scene frame instead of twice.
- **Quality-dependent:** new scuba bubble emission is multiplied by `0.5 + 0.5 * particles`, so High/Ultra retain full density. Existing bubbles are never removed when lowering quality. Existing presets still govern pixel ratio, caustic resolution/frequency, optical-animal budget, fish/animal population, grass, ambient particles, wake detail and jellyfish tentacles.
- **UI:** display measured rendered FPS over approximately one-second windows in both manual and Auto modes. Pause shows `paused`; startup shows `measuring…`. The existing 30 fps rendering cap is retained; it is no longer presented as if it were a measurement.

Validation: `validation/optimization-check.cjs` (local ignored script) checks manual/Auto FPS output, one wake update per render and bubble draw count equal to the live radius count. A desktop comparison submitted 350 versus 310 draw calls, with the same 1,623,476 triangles; approximately 20,372 versus 3,198 points. RIB meshes fell from 14 to 4. The scenes advanced for different wall-clock durations while checking the UI, so timing and live-population differences are **not** a controlled speedup benchmark. Quality-tier tests passed. This is not a physical phone test.

Not implemented speculatively: GPU timer-query instrumentation, renderer recreation to switch MSAA, and lower-frequency distant animal simulation. Those require profiling and motion/image comparisons before treating them as improvements. The existing distance-based LOD remains enabled through the presets. Argon has still not returned a result; these changes follow the local review, not an external response.

## Measured baseline

Headless Chrome, Windows, ANGLE / Direct3D 11, **NVIDIA GeForce RTX 3080**. Each case warms six frames and samples 20 frames. `gl.finish()` synchronizes completion, so times include JavaScript simulation, render submission, GPU work and synchronization; they are not isolated GPU timings or end-user FPS. The animation is advanced manually at 1/30 s. Draw counts include every render pass. Desktop device-pixel ratio is 1. The 390×844 viewport uses the **same desktop GPU**, not a real phone.

The scene starts at a random time, and cases advance sequentially: populations and camera visibility can vary. Short captures do not measure thermal throttling, mobile power consumption or long-lived bubble plumes.

| Viewport | Lighting | Quality | Median / p95 ms | Draw calls (last frame) | Triangles (last frame) |
| --- | --- | --- | --- | --- | --- |
| 1440×900 | Day | Eco | 7.2 / 8.2 | 288 | 604,653 |
| 1440×900 | Day | Balanced | 8.9 / 11.6 | 307 | 884,139 |
| 1440×900 | Day | Ultra | 9.6 / 13.5 | 319 | 1,775,839 |
| 390×844 | Day | Eco | 4.1 / 5.2 | 136 | 488,291 |
| 390×844 | Day | Balanced | 6.7 / 7.3 | 153 | 671,845 |
| 390×844 | Day | Ultra | 7.2 / 9.8 | 164 | 1,184,465 |
| 1440×900 | Night | Eco | 3.8 / 5.2 | 286 | 534,765 |
| 1440×900 | Night | Balanced | 5.2 / 7.5 | 305 | 775,083 |
| 1440×900 | Night | Ultra | 6.5 / 7.8 | 316 | 1,389,215 |
| 390×844 | Night | Eco | 2.8 / 3.6 | 132 | 457,407 |
| 390×844 | Night | Balanced | 3.7 / 4.1 | 149 | 648,989 |
| 390×844 | Night | Ultra | 5.7 / 6.9 | 160 | 1,008,785 |

The 30 fps budget is 33.3 ms/frame. This desktop sample has substantial headroom. It does **not** establish phone performance. Raw captures and the reproducible local script are in ignored `validation/performance-sample.json` and `validation/performance-sample.cjs`.

## Highest-value candidates

1. **Batch static geometry by material and spatial region.** Roughly 286–319 draw submissions remain at desktop resolution even across large quality changes. Wreck details, boat components and humanoid equipment are individual meshes. Merge static objects with the same material; instance repeated fittings. Keep spatial batches small enough for culling. Preserve articulated limbs and animated elements separately. Expected benefit: CPU/driver overhead, especially phone and integrated GPU; savings need an A/B measurement.
2. **Draw only live effect particles.** These captures submit about 19,000–20,000 point vertices regardless of quality. Bioluminescence has a 10,000-slot ring buffer and scuba bubbles an 8,192-slot pool; dead points are hidden in shaders instead of omitted from draw submission. Build compact live index buffers / draw ranges, and upload changed ranges. Preserve bubble lifetimes; never delete live bubbles merely to meet a budget. Expected benefit: fewer vertex invocations and buffer uploads without changing visible density.
3. **Reduce pixel work before deleting wildlife.** The water performs a ten-wave field and refraction/lighting; daylight adds caustic passes and beams. Keep dynamic resolution, caustic frequency and optical-animal limits as primary GPU controls. Add separate CPU/GPU budgets so a large phone display can lower resolution while preserving animal counts. Hardware antialiasing is fixed at context creation: a low-cost phone startup option is possible, but toggling it requires rebuilding the renderer or an explicit postprocess approach.
4. **Remove redundant update work.** `scuba.update` calls `playback.update` twice, and each call currently updates boat wave sampling and traverses the full wake pool. Split timeline/boat update from post-pose hand/spool attachment refresh. Maintain an active list for the scuba bubble solver rather than repeatedly scanning all 8,192 slots; keep its existing height-local merge search.
5. **Keep the fish simulation approach.** Fish already use one instanced draw call and a spatial neighbour grid. Lower school population when CPU timings justify it; it should not automatically be the first visual sacrifice. Update distant schools at a lower simulation frequency with interpolation if profiling shows their steering is material.
6. **Distance-based animation detail.** Keep near silhouettes and articulated fins. Reduce distant jelly tentacle geometry, far crab leg IK and distant diver equipment detail; tick distant simulation less often while interpolating rendered motion. The current quality tiers already reduce grass, fish and tentacles, so extend rather than duplicate that mechanism.

## Phone validation and implementation order

First add per-stage CPU timings and (where supported) disjoint GPU timer queries; report medians and p95 over sustained windows. Measure physical Android/iOS devices for 5–10 minutes at native DPR, daylight/night, reef on/off and active bubble plumes. Avoid calling `gl.finish()` in production.

Then implement static batching and live-particle draw reduction independently, repeating identical seeded scenes. Next split duplicate boat updates. Only then tune tier thresholds, far animation rates and mobile antialiasing. Keep Auto's hysteresis and 30 fps cap, and compare image quality before/after. On a phone, stable frame time and thermal behaviour matter more than a brief maximum-FPS result.

## External review status
An explicitly requested Gemini 4 Argon review was submitted with the quality presets and rendering architecture. The service had not returned a result when this report was prepared. The findings above are local measurements and analysis, not attributed to Argon.
