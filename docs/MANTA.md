# Manta implementation and reference review

Implemented plan:
1. Build a closed, volumetric body with flexible pectoral wings, tail and integrated head.
2. Deform wings with spanwise/chordwise phase delays and corrected normals; alternate strokes with gliding.
3. Animate feeding with open mouth and extended cephalic lobes, returning toward a closed cruising pose.
4. Use forward curved passes, banked turns and delayed offscreen replacements.
5. Connect population to Animals and quality, with a separate Manta rays toggle; batch fixed details (10 draw calls per animal).
6. Check appearance in WebGL, pause, visibility, population and a 20-minute simulated path.

References reviewed as text describing video-based measurements:
- Fish et al. 2016: https://bpb-us-w2.wpmucdn.com/wordpress.lehigh.edu/dist/a/171/files/2017/01/Fish_2016-1smh7sk.pdf
- Menzer et al. 2022: https://pmc.ncbi.nlm.nih.gov/articles/PMC9036258/
- Feeding anatomy: https://mantawatch.com/site/education-zone/feeding/

Direct video playback and the PDF video-frame screenshot could not be inspected in this session. This is a procedural interpretation of published kinematics, not motion capture or a calibrated biomechanics model. Further side/front video comparison remains useful.

## Finding-to-implementation record

Reconciled with code on 2026-11-02; the original source-access date and exact paper passages were not retained. Do not interpret this reconstruction as new verification of those sources.

| ID | Finding / source | Evidence access | Inclusion and code | Remaining work |
|---|---|---|---|---|
| M01 | Flexible pectoral-fin locomotion — Fish et al. (2016), Menzer et al. (2022), linked above | Text review of video-based research; actual video not played | **Simplified**: [manta-ray.js](../manta-ray.js), vertex shader uses span/chord phase differences and twist | Recheck the exact paper figures and compare real side/front video frames; amplitudes and phase delays are not calibrated. |
| M02 | Feeding anatomy involves the mouth and cephalic lobes — MantaWatch, linked above | Text reference | **Simplified**: `update` blends jaw, mouth opening and paired lobes between feeding/cruising poses | No plankton field, ingestion model or observed feeding sequence; replace timer-based feeding with environment-driven decisions if desired. |
| M03 | Animals should traverse the scene and avoid obstacles — user brief | Project requirement, not a biological source | **Implemented**: `update` steers forward passes, banks turns and schedules offscreen replacement | Expand clearance and camera-boundary tests across user camera positions. |
| M04 | Individual belly spots and variable markings — [NOAA manta catalog](https://flowergarden.noaa.gov/science/mantacatalog.html), [Manta Trust identification guide](https://www.mantatrust.org/mantabase); distinctive mottles and scars described in [Marshall et al., 2010, institutional abstract](https://eprints.ncl.ac.uk/173701) | Text excerpts reviewed 2026-11-02; not a new video analysis | **Simplified**: `skinAtlas` gives each animal its own underside spots, mottled dorsal pigmentation, fine grain and sparse pale streaks | Layout, roughness and healed-looking streaks are artistic choices for the requested rustic appearance, not a replica of an identified individual. |

Surface refinement: two 1024×512 procedural atlases are generated once, UVs stay in undeformed body space, subtle bump and higher roughness reduce the smooth plastic appearance. No additional geometry, draw calls or per-frame texture generation. Daylight WebGL preview compiled without shader errors. Existing swimming behavior is unchanged; local preview script/image are ignored artifacts in `validation/manta-preview.cjs` and `validation/manta-preview.jpg`.

Later visit-frequency adjustment: the second manta's first arrival is staggered, and departures now have a 65–210 second offscreen waiting period. See [visitor and habitat behavior](ANIMAL-HABITATS.md). These intervals implement the user's preference for occasional encounters; they are not biological measurements.

Tuned parameters: feeding speed 0.52 and cruising speed 0.82 scene units/s; wing phase advances by `1.0 + speed * 0.9` rad/s. Gliding and feeding schedules use procedural oscillations. These are simulation choices, not sourced measurements. A precise manta species/life-stage calibration has not yet been recorded.

Validation: no WebGL errors; feeding blend spans 0–1; pause holds position; visibility and density work. A 20-minute simulation observed departure and re-entry with maximum continuous step 0.084 m at time steps up to 0.1 s.

## User interaction (2026-11-07)

Bounded dragging and release recovery now reuse this locomotion controller. Reactions and automatic release are simulation design choices, not new biological observations. See [interaction implementation and validation](INTERACTIONS.md). The research provenance above is unchanged.
