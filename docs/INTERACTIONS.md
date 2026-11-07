# Interaction behaviour

Updated 2026-11-07. `animal-interaction.js` owns bounded forces and release recovery; adapters in `ocean.js` connect each actor's native position and behaviour. Existing shark/moon-jelly elastic interaction is retained. Decorative bottom-life instances and shark-attached remoras are not separate draggable actors.

Mouse: left pushes, right pulls, movement steers. Touch: hold 280 ms without moving more than 12 px to grab, then drag; depth only decreases. Touch-up/cancel, lost capture, blur, hidden document and pause release the grip. A background tap still minimizes the menu. Hidden species cannot remain held. The bottom hint uses 14–18 px text and touch-specific wording.

All held actors, including sharks, moon jellies and the ballast, use one damped grab response and a common six-unit/s speed ceiling multiplied by a quadratic distance gain (up to sixfold). Species cruise speeds no longer cap the grip. Both implementations use simulation time. Rotation, tether limits, obstacles and the ballast's horizontal plane can still limit the resulting movement. Release momentum brakes smoothly. Animals remain at least four scene units from the camera, including a conservative body envelope.

Pulling a contact already inside the usual eight-unit grip distance never moves its target outward. Comb jellies retain their individual scale, with only gradual 3% vertical compression. Mantas, turtles and the recreational freediver rotate under off-centre pulls; spin damps after release. Her physical controller takes over immediately on release, preserving position, velocity and orientation, and uses approach speed when displaced from an inspection subject.

## Implemented rules

| Actor | Hold and release | Status / limits |
|---|---|---|
| Manta | Continues swimming, stronger wing effort; bounded momentum decays toward its current forward swimming velocity | Simplified; no measured handling response or muscle model |
| Turtle | Cancels grazing, swims; breathing ascent overrides the grip, with protection through breathing/redescent | Simplified; uses the existing breathing schedule, not measured oxygen stores |
| Comb jelly | Small reversible body compression, disturbance flash; common held response independent of slow native swimming | Simplified; no soft-body fluid solver |
| King crab | Asynchronous leg movements while held and airborne after release; eases into planted feet on landing, then chooses a new foraging area | Procedural response, not measured animal behaviour; landing uses the sand height field |
| School fish | Individual selection with a 14-pixel mouse / 22-pixel touch near-miss allowance; chooses the nearest projected fish and does not override a direct hit on another actor | Nearby fish flee, then existing schooling rules regroup them |
| Recreational freediver | Native physical controller continues, grip adds bounded displacement/velocity; existing air reserve or an 8-second hold limit forces ascent | Simplified animation safety budget, not physiology; recovery must complete before another grab |
| Rope divers | Two-unit horizontal lanyard reach; further held tension moves the weight at up to three units/s. Divers track their local part of the flexible line | Random cycle initialization now starts at the corresponding depth; autonomous vertical movement is capped at three units/s, including surface corrections |
| Ballast weight | Enlarged picking area and common responsive grip on a horizontal plane; movement propagates through the rope before the buoy and divers follow | Twelve-unit placement radius. Swept weight moves reject solids or the viewing margin; rope nodes have their own collision checks |
| Scuba | Body hit areas and grabs throughout visible in-water phases; corrective swimming and buddy follow; 18-second hold limit starts the existing return sequence | Boat boarding/departure and protected recovery cannot be grabbed; no cylinder gas model |

Body hit areas track freediver skeletons and scuba torsos. Rope divers stay attached to the moving rig; the scuba buddy follows a held teammate. Released kinematic actors approach the existing target at bounded speed instead of resetting position. Collision handling reuses the scene's approximate constraints, not continuous articulated-body collision detection. Protected recovery overrides further grabs. Timing values are deliberately conservative **simulation design choices**, not diving guidance.

## Evidence and provenance

These interactions implement the user's G2 brief. They do not claim observed responses to actual handling of wildlife. Existing anatomy, swimming and breathing references remain in [MANTA.md](MANTA.md), [SEA-TURTLE.md](SEA-TURTLE.md) and [RECREATIONAL-FREEDIVER.md](RECREATIONAL-FREEDIVER.md), with their original access limitations. No new video was watched for this interaction change. Full physical contact between two independently articulated bodies is deferred; the current grip applies to the actor as a whole.

## Validation

- `tests/rope-physics.cjs`: 24-segment line with tension-only length constraints, damped inertia and a buoyant surface endpoint; checks limited extension, delayed following, pause and frame rates. This is a reduced rope simulation, not a calibrated material model.
- `validation/diver-start-check.cjs`: six cycle start phases, bounded autonomous depth motion and unchanged-time pause. `validation/fish-pick-check.cjs` and `validation/ballast-pointer-check.cjs` exercise actual mouse selection/dragging.

- `validation/grab-rig-check.cjs`: browser checks of both rope/scuba body picks, tether-limited travel, movement of the rig through the ballast, and continuous crab feet through lifting/landing. Comb-jelly held speed is separate from cruise speed.
- The full crab hold/release path also checks heading beyond 90 degrees: resetting all ground-pose Euler angles prevents quaternion/Euler branch flips (the prior path reproduced an 88-degree discontinuity). Recreational-diver native handoff and return travel, jelly scale retention, and bounded ballast movement are covered in the same browser check.

- `tests/animal-interaction.cjs`: bounded movement/acceleration at 15, 30 and 60 Hz, retained release momentum, unchanged-time pause, automatic ascent/recovery, refusal to regrab during ascent, crab landing and visibility.
- Headless Chrome/WebGL, desktop and 390×844 touch emulation: no JavaScript errors. Actual touch events verified delayed grab, decreasing camera distance and release. This is not a physical phone performance test.
- Native manta, turtle, comb-jelly and crab adapters exercised through hold/release. At 30 Hz, maximum controller displacement was respectively 0.0734, 0.0734, 0.0434 and 0.0467 scene units per step. The crab settled and resumed its native controller. This does not prove every obstacle configuration is safe from correction jumps.
- A 500-second scuba scenario exercise passed through buoy deployment, ascent, safety stop, pickup and the next team after automatic release. Maximum controller step at 15 Hz was 0.0800 scene units; no JavaScript errors.
- Local ignored previews: `validation/interaction-initial.png`, `validation/interaction-touch.png`; scripts under `validation/` are development artifacts, not shipped debugging APIs.

## Boat sound

`ambient-audio.js` mixes the user's supplied `water.wav` below the ambient track: maximum gain is 20% of the master slider (3% at the default 15%), further attenuated by distance. Measured horizontal boat speed drives a 1.4-second fade-in / 1.9-second fade-out. It is silent when stopped, absent or paused. Playback needs the first user gesture; hidden documents pause both tracks. The original 16-second sample is looped unchanged; credits and CC BY 4.0 link are in README. `tests/ambient-audio.cjs` verifies unlock, gain envelope, stationary silence, master mute and hidden pause.
