# Green sea turtle

2026-11-07 close-view revision: a separate beveled shell rim with shallow scalloping, thicker closed foreflippers with corrected outward triangle winding, and fuller rear flippers. Off-centre grabs rotate the entire animal. Top/side WebGL previews and geometry checks are in `validation/manta-turtle-detail.cjs`; shape dimensions remain artistic approximations.

First procedural implementation of **Chelonia mydas**. One turtle at normal density; two at high density and sufficient graphics quality. The Sea turtles control hides the species independently.

## Evidence and approximations

- [NOAA species account](https://www.fisheries.noaa.gov/species/green-turtle): appearance, habitat and ecology. Adults commonly feed on seagrass and algae.
- [NOAA science and photographs](https://www.fisheries.noaa.gov/species/green-turtle/science): shell, head and flipper proportions.
- [Video-based swimming kinematics research, 2022](https://pubmed.ncbi.nlm.nih.gov/36316441/): three-dimensional foreflipper motion and twist, rather than a simple rigid up/down stroke.

The research paper's supplementary videos remain unavailable. On 2026-11-02, two independent videos by JUN HO LEE were played and visually sampled on Pexels: [close-up, 15 seconds](https://www.pexels.com/video/close-up-video-of-green-sea-turtle-underwater-30862157/) and [reef swimming, 8 seconds](https://www.pexels.com/video/sea-turtle-swimming-in-vibrant-coral-reef-30869675/). The close-up around 00:09 shows head scales, wrinkled shoulder skin and the mottled scutes; the swimming clip was sampled at its start and later during playback (exact later timestamp not retained), showing a tapered foreflipper and a comparatively steady body. These are qualitative references, not a measured stroke reconstruction. Stroke frequency, speed, route and timing remain artistic simulation choices. No reference media are bundled.

## Behavior

### Finding-to-implementation record

Record reconciled with code on 2026-11-02. The original research date was not separately recorded. Source links refer to the bibliography above; source media have not been copied into the repository.

| ID | Finding / source | Evidence access | Inclusion and code | Remaining work |
|---|---|---|---|---|
| T01 | Adult diet includes seagrass and algae — NOAA species account | Text reference | **Simplified, implemented**: `approach grass` and `grazing` in [sea-turtle.js](../sea-turtle.js), using actual shelf vegetation positions exported by `seabed.js` | Vegetation is not depleted or regrown; duration and bite rate are artistic parameters. |
| T02 | Shell, head and long foreflipper silhouette — NOAA science/photo references | Image-search references; exact original inspected frames not retained | **Simplified, revised**: `atlas`, shell UV mapping and `flipperGeometry` replace the repeated hexagon shell and oval blades | Scutes remain stylized; compare an orthogonal anatomical reference before claiming exact plate layout. |
| T03 | Foreflipper motion involves three-dimensional motion and twist — 2022 kinematics study | Indexed research description; research video access blocked | **Simplified, revised**: shoulder down/back sweep, `flexibleSkin` distal lag and twist; `update` couples speed to the power stroke | Measure actual distal motion. The phase relationship and amplitudes are tuned approximations. |
| T04 | Need route guidance with obstacle avoidance — user requirement | Direct project brief, not biological evidence | **Implemented**: `update` combines route direction, `environment.steer` and nearby-swimmer avoidance | Extend tests to deliberately blocked routes and measure full-body clearance. |
| T05 | Mottled scutes, pale scale boundaries and tapered flippers — JUN HO LEE videos linked above | Played and visually sampled 2026-11-02 | **Simplified**: procedural shell/skin atlases with subtle bump, cambered foreflipper geometry | Shoulder wrinkles and individualized markings are not anatomically reconstructed. |
| T06 | Visible jitter — user report and code inspection | Old bank was assigned directly from rapidly changing steering input | **Implemented**: filtered steering, bounded turn acceleration and smoothed bank; local elapsed time freezes pose when paused/hidden | Controlled 8 Hz threat tests pass; this is not proof against every possible scene collision. |

Current artistic parameters in `update`: target speed approximately 0.275–0.45 scene units/s with gradual acceleration, yaw limit 0.18 rad/s, yaw acceleration limit 0.12 rad/s², pitch rate limit 0.12 rad/s, stroke phase rate 1.05–1.55 rad/s. These replace the initial constant-rate stroke and are not measurements from T03. Surface visits and gliding schedules remain procedural choices.

Random initial position, direction, stroke phase and route entry vary each launch. A loose six-point cruise route visits open water, the wreck vicinity and near-surface water, interrupted by visits to actual vegetation patches on the submerged shelf. Forward swimming has limited yaw and pitch rates, alternating strokes and glides, front flipper twist, and rear flipper steering. Shared environment look-ahead and nearby swimmers influence direction before the route target. The existing collision constraint remains a final guard. Grazing slows forward travel, reduces flipper strokes and lowers the articulated head/jaw toward vegetation. Feeding ends after a variable interval or when a nearby swimmer/animal disturbs it. Hiding the habitat cancels feeding. Independent ascent, wave-following surface breathing and redescending states interrupt feeding and cruising. Only time with the sampled nose above the local wave counts toward a completed breath.

## Validation

Headless Chrome/WebGL: 20 simulated minutes at 30 updates/s, both turtles completed over two routes (13 and 14 waypoints). Maximum position step was 0.01485 m. No JavaScript errors; unchanged-time pause and hidden updates preserved position. A close screenshot was inspected. These checks cover the default scene and route, not every possible user configuration or physical mobile hardware.

Refinement check, 2026-11-02: 20 minutes again, 15–16 waypoints, maximum step 0.01472 m and orientation change 0.00776 rad at 30 Hz. A synthetic nearby threat oscillating at 8 Hz was tested at 15/30/60 updates/s: maximum bank steps 0.00439/0.00212/0.00105 rad, with positive forward displacement throughout. Shader compilation, paused pose, hidden state and an above/front screenshot were checked. Reproducible local script: ignored `validation/turtle-check.cjs`; screenshots in that directory are local artifacts, not committed documentation assets.

The reusable research/modelling workflow is installed locally as `$add-marine-animal` in the user's Codex skills directory.

## Grazing research and startup variation (2026-11-02)

| ID | Finding / source | Evidence access | Status and implementation | Limitation / next step |
|---|---|---|---|---|
| T07 | Green turtles repeatedly crop particular feeding plots, rather than selecting every bite at random. [Florida Museum, Green turtles and seagrasses](https://www.floridamuseum.ufl.edu/savingwildlife/sea-turtles/green-turtles-and-seagrasses/) | Full page text read | **Simplified**: nearby planted shelf patches are revisited between cruises | No growth, depletion or nutritional model |
| T08 | Low body, head directed down toward vegetation, foreflippers spread with slow repositioning. [Adrien JACTA: Turtle eating sea grass - Mayotte](https://www.pexels.com/video/turtle-eating-sea-grass-mayotte-17801322/), 18 s | Played in browser; full frames inspected around 00:12 and 00:13; earlier playback frame inspected without timestamp. Existing swimming/texture clips above retained | **Simplified**: reduced speed and flipper effort, lowered head, small bite/jaw motion | Qualitative animation; exact bite frequency and joint angles were not measured |

Per-launch randomization changes turtle position, heading, flipper phase and first feeding delay. Other animal modules now also vary previously fixed seeds/phases; fish retain their shelter habitats and crabs remain on clear sand patches. Static scenery and procedural texture identities remain stable. No new random value is injected into steering every frame; choices occur at activity boundaries.

Grazing validation: two 20-minute Chrome/WebGL runs reached 3 and 6 feeding visits combined. After smoothing the collision-clearance transition, maximum positional step was 0.0158 m or less at 30 Hz, orientation step below 0.008 rad. Pause/hidden-state checks, habitat removal, 15/30/60 Hz oscillating-threat checks and a close feeding screenshot were inspected. Local reproducible script: `validation/turtle-grazing-check.cjs` (ignored artifact).

## Power stroke and breathing revision (2026-11-02)

| ID | Finding / source | Evidence access | Status and code | Remaining work |
|---|---|---|---|---|
| T09 | Green turtles must surface to breathe. [NOAA species science](https://www.fisheries.noaa.gov/species/green-turtle/science) | Official page text | **Simplified**: `ascend`, `breathe`, `dive`; raised head, reduced strokes, sampled nose/wave clearance and independent breathing timers | No lung-volume or oxygen-consumption physiology. Intervals (120-240 simulation seconds after a breath) and 2-4 seconds above water are animation choices |
| T10 | Forward propulsion is primarily associated with the downstroke. [van der Geest et al., 2022, Scientific Reports](https://doi.org/10.1038/s41598-022-21459-y); posterior sweep during downstroke discussed in [Southampton thesis](https://eprints.soton.ac.uk/385840/1/_userfiles.soton.ac.uk_Users_slb1_mydesktop_Thesis_Sain-Gee_20Keith_20Man_20Final_20submission.pdf) | Indexed research text; PMC full text blocked by browser check on this review. Existing played swimming video references above retained | **Corrected**: mirrored foreflipper sweep now goes backward while the positive-sine power phase lowers both flippers; slower recovery returns them forward | Angles and hydrodynamic feathering remain approximate, not inverse dynamics |

Cruise speed was approximately doubled in response to the user's observation; near-grass and feeding speeds remain low. The fixed y=14.25 ceiling was removed because it prevented the nose reaching air. Surface heave follows sampled waves with bounded vertical adjustment, and a breath completes only after measured above-water nose time.

Validation: 20 minutes with both turtles produced 7 and 6 surface visits, including descent afterward and further feeding. Maximum position step 0.054 m, maximum orientation step 0.008 rad at 30 Hz. Pause/hidden states, habitat removal and oscillating-threat tests at 15/30/60 Hz passed. Local script: `validation/turtle-breathing-check.cjs`; rendered surface pose inspected.

## User interaction (2026-11-07)

Bounded dragging and release recovery now reuse this locomotion controller. Reactions and automatic release are simulation design choices, not new biological observations. See [interaction implementation and validation](INTERACTIONS.md). The research provenance above is unchanged.
