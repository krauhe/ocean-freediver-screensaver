# Interaction behaviour

Updated 2026-11-07. `animal-interaction.js` owns bounded forces and release recovery; adapters in `ocean.js` connect each actor's native position and behaviour. Existing shark/moon-jelly elastic interaction is retained. Decorative bottom-life instances and shark-attached remoras are not separate draggable actors.

Mouse: left pushes, right pulls, movement steers. Touch: hold 280 ms without moving more than 12 px to grab, then drag; depth only decreases. Touch-up/cancel, lost capture, blur, hidden document and pause release the grip. A background tap still minimizes the menu. Hidden species cannot remain held. The bottom hint uses 14–18 px text and touch-specific wording.

## Implemented rules

| Actor | Hold and release | Status / limits |
|---|---|---|
| Manta | Continues swimming, stronger wing effort; bounded momentum decays toward its current forward swimming velocity | Simplified; no measured handling response or muscle model |
| Turtle | Cancels grazing, swims; breathing ascent overrides the grip, with protection through breathing/redescent | Simplified; uses the existing breathing schedule, not measured oxygen stores |
| Comb jelly | Small reversible body compression, disturbance flash, retained translation followed by current and propulsion | Simplified; no soft-body fluid solver; moon jellies retain their prior elastic model |
| King crab | Folded walking legs while lifted; settles to the sand and chooses a new local foraging area | Simplified; landing uses the sand height field, not arbitrary wreck/deck surfaces |
| School fish | Individual selection; nearby fish flee, then existing schooling rules regroup them | Implemented through existing avoidance forces; small fish can be difficult to hit on a phone |
| Recreational freediver | Native physical controller continues, grip adds bounded displacement/velocity; existing air reserve or an 8-second hold limit forces ascent | Simplified animation safety budget, not physiology; recovery must complete before another grab |
| Rope divers | Bounded positional recovery, automatic ascent, 18-second surface recovery, then rejoin a surface phase rather than snap back to a deep route point | Simplified; retains the existing competition animation and cycle underneath |
| Scuba | Corrective swimming and buddy follow; 18-second limit ends exploration via the existing buoy/stop/surface sequence | Simplified scenario timing; no cylinder gas model. Open-water watch retains its existing habitat-hidden behaviour |

An available rope diver can follow a held recreational diver; the other rope/scuba buddy follows within a few metres. Released kinematic actors approach the existing target at bounded speed instead of resetting position. Collision handling reuses the scene's approximate constraints, not continuous articulated-body collision detection. Safe ascent and recovery override further grabs. Timing values are deliberately conservative **simulation design choices**, not diving guidance.

## Evidence and provenance

These interactions implement the user's G2 brief. They do not claim observed responses to actual handling of wildlife. Existing anatomy, swimming and breathing references remain in [MANTA.md](MANTA.md), [SEA-TURTLE.md](SEA-TURTLE.md) and [RECREATIONAL-FREEDIVER.md](RECREATIONAL-FREEDIVER.md), with their original access limitations. No new video was watched for this interaction change. Full physical contact between two independently articulated bodies is deferred; the current grip applies to the actor as a whole.

## Validation

- `tests/animal-interaction.cjs`: bounded movement/acceleration at 15, 30 and 60 Hz, retained release momentum, unchanged-time pause, automatic ascent/recovery, refusal to regrab during ascent, crab landing and visibility.
- Headless Chrome/WebGL, desktop and 390×844 touch emulation: no JavaScript errors. Actual touch events verified delayed grab, decreasing camera distance and release. This is not a physical phone performance test.
- Native manta, turtle, comb-jelly and crab adapters exercised through hold/release. At 30 Hz, maximum controller displacement was respectively 0.0734, 0.0734, 0.0434 and 0.0467 scene units per step. The crab settled and resumed its native controller. This does not prove every obstacle configuration is safe from correction jumps.
- A 500-second scuba scenario exercise passed through buoy deployment, ascent, safety stop, pickup and the next team after automatic release. Maximum controller step at 15 Hz was 0.0800 scene units; no JavaScript errors.
- Local ignored previews: `validation/interaction-initial.png`, `validation/interaction-touch.png`; scripts under `validation/` are development artifacts, not shipped debugging APIs.

## Boat sound

`ambient-audio.js` mixes the user's supplied `water.wav` below the ambient track: maximum gain is 20% of the master slider (3% at the default 15%), further attenuated by distance. Measured horizontal boat speed drives a 1.4-second fade-in / 1.9-second fade-out. It is silent when stopped, absent or paused. Playback needs the first user gesture; hidden documents pause both tracks. The original 16-second sample is looped unchanged; credits and CC BY 4.0 link are in README. `tests/ambient-audio.cjs` verifies unlock, gain envelope, stationary silence, master mute and hidden pause.
