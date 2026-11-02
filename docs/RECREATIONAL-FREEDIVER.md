# Recreational freediver

Adult woman with mask, turquoise sports bikini, long bifins and a weighted belt. The shared skeleton and separate appearance adapter allow the controller to be reused with another diver model.

## Controller and physics

`freediver-physics.js` integrates forces and angular velocity; `recreational-freediver.js` makes decisions at fixed 60 Hz. Position is no longer sampled from a spline. The controller chooses visible attractions by interest, distance and recent visits: wreck, truck, reef, crab, turtle or fish school. It approaches an observation offset, brakes, looks at the subject, changes observation position and eventually ascends. Missing targets are discarded. Surface recovery and an abstract time/effort budget determine the next dive; this is not an oxygen-consumption model.

The reduced body model includes inertia, directional drag relative to the current, bounded propulsion and steering torque, compressible lung volume, constant tissue displacement, belt mass and partial immersion at the wave surface. Bikini configuration has no compressible wetsuit volume. Defaults are animation parameters, not measured physiology. Whole-body forces are approximated; there is no fluid solver or articulated muscle dynamics.

Hip and knee bones supply the recreational kick, with angle and rate limits and no backward knee extension. Shader leg displacement is disabled for this variant to avoid double animation. Fin blades use damped springs loaded against foot velocity, with progressive bending toward the tip. Propulsion effort drives the kick. Arms scull asymmetrically and head angles track the selected subject. Surface recovery rolls the face upward and allows buoyancy to support the body instead of fixing its height.

Obstacle steering is followed by six overlapping head/body/fin collision samples. This is an approximate capsule, not continuous swept-mesh collision detection. Targets use observation offsets rather than a route planner; complex enclosed passages remain unsupported. Animation is procedural rather than motion capture.

## Evidence and implementation record

Updated 2026-11-02. Astra high reviewed the original controller and proposed the reduced physical model after Argon4 timed out.

| Finding / source | Access and inclusion | Remaining work |
|---|---|---|
| [We Freedive: Sarah Whitcher - Ninja Duckdives](https://vimeo.com/167843662), around 00:11 and 00:18: horizontal preparation transitions to head-down descent | Earlier session played and sampled these frames. Simplified hip fold during entry; not a frame-matched reproduction | More intermediate frames and open-water exploration footage |
| [DDRC: buoyancy and diving](https://www.ddrc.org/diving/buoyancy-diving/): compression reduces displaced gas volume with depth | Primary educational source, indexed text. Implemented Boyle-law lung approximation and pressure-dependent buoyancy in `freediver-physics.js` | Calibrated body/volume measurements; non-linear lung mechanics |
| [British Freediving Association: equipment](https://britishfreediving.org/freediving/equipment/): weighting offsets buoyancy; belt fit changes with compression | Primary association source, indexed text. Visible belt attached to pelvis; belt mass participates in force model | Detailed belt inertia and material deformation |
| Independent interest selection and efficient descent/ascent - user brief | Implemented conditional states, novelty memory, moving targets and abstract activity reserve | Ecological interaction and more sophisticated unreachable-target handling |
| Compliant long fins - user observation and reduced mechanical model | Implemented damped blade loading, progressive deformation and articulated kicks | Measured blade stiffness, fluid loading and video comparison; spring constants are visual tuning |

## Validation

`tests/freediver-physics.cjs` covers force signs across depth, unpowered momentum, surface equilibrium, current invariance, turning bounds, ascent/descent, pause and timestep consistency. Browser/WebGL integration exercises ten simulated minutes, visits, ascent, joint bounds, fin deflection and pause. Rendered inspection complements numerical checks; it does not establish biomechanical accuracy.

## Arm locomotion revision (2026-11-02)

Model-local hand targets now select a narrow overhead streamline or hands beside the thighs during transit. Inspection, angular corrections and lateral-force demand blend into outward catch/backward pull/tucked recovery strokes. The same power phase gates available sculling force in `freediver-physics.js` and attributes up to 25% of existing forward thrust to the arms. This is force allocation, not extra thrust; it remains a reduced controller rather than a fluid/limb force solver. Hand targets are rate-limited to 1.25 model units/s and use shared fixed-length arm IK. Descending nose touches are brief instead of permanently occupying the left hand.

Source: user's observed stiff, unstreamlined arm pose. Existing duck-dive video above is retained; the new correction/arm-pull cycle is a procedural interpretation, not newly measured video motion. Local `validation/recreational-arms-check.cjs` checks that hands-down, streamline and active pulls all occur, with bounded hand-goal motion, completed dives and pause.

Elbow correction: custom swimming hand targets use an outward elbow plane, separate from the competition rope-grip solver. The IK elbow circle is constrained to no more than 0.065 model units behind the shoulder; segment lengths remain unchanged. This is a visual/anatomical guard, not a clinically calibrated joint limit. `validation/recreational-elbows-check.cjs` measured the rearward bound and fixed arm segment lengths across ten minutes of all arm modes.


### Loaded ascent and flexible fins (2026-11-02)

The recreational diver now uses the physics actuator's stroke clock for both
propulsion and the leg pose. Frequency scales with requested force (0.4–1.25
complete cycles per second per leg); alternating blades produce a bounded thrust
pulse strongest mid-sweep. Hip travel increases with load. The previous 1.8 rad/s
animation limit clipped vigorous strokes; the limit is now 4.5 rad/s. Blade bending
uses squared measured foot sweep speed with a damped elastic recovery, rather than
an unrelated sine wave. These are animation-tuned reduced dynamics, not a resolved
fluid/fin simulation. The default weighting already produces negative buoyancy at
20–25 m; sustained ascent therefore needs active propulsion.

Lung compression still uses Boyle's-law volume with a fixed surface-equivalent gas
store. Metabolic gas exchange is not yet modeled: CO2 does not intrinsically occupy
less volume per mole than O2 at equal pressure/temperature. Dissolution and tissue
storage complicate net lung gas loss; do not substitute an arbitrary linear O2
consumption term for a validated gas-exchange model. Relevant primary research:
[Tissue oxygen and carbon dioxide stores and breath-hold diving in humans](https://pubmed.ncbi.nlm.nih.gov/8002498/)
and [Alveolar gas composition and exchange during deep breath-hold diving](https://pubmed.ncbi.nlm.nih.gov/1902459/).

Validation: `tests/freediver-physics.cjs` checks unpowered sinking, loaded ascent,
stroke frequency, pulsed force and pause. A browser simulation additionally checks
actual hip excursion and elastic fin bend during deep ascents, and retains the
elbow/segment-length and full-dive regression checks.


### Descent around neutral depth

The configured swimmer is neutral at 10.3 m. Positive buoyancy above that depth
requires active downward kicks. On a clear steep descent, propulsive effort is
smoothly reduced between 10.3 and 18 m, reaching unpowered freefall. Steering and
braking remain available; swimming resumes near a subject, obstacle or a shallower
heading. Freefall speed emerges from negative buoyancy and quadratic drag, rather
than a prescribed sinking velocity. This neutral depth belongs to this model's
weighting, not all freedivers. Regression tests check downward work above neutral
and sinking without fin thrust below it.


### Horizontal swimming: fin compliance

Blade loading now includes through-water speed multiplied by foot sweep, alongside
the quadratic lateral-sweep term. This retains visible flex in moderate horizontal
kicks, where the previous sweep-only model produced too little deformation. The
elastic response is softer (spring 40, damping 7.5) with a bounded bend of 0.85;
the blade lags reversals and then unloads. Recreational blade thickness is reduced
to 32% of the inherited competition geometry, around its existing centreline.
Other divers keep their geometry and animation. These coefficients remain visual
tuning, not measured carbon-laminate material properties.

A ten-minute browser regression recorded 1,792 moving-horizontal samples and
verified flex in both directions, while retaining ascent, elbow, pause and full
dive checks. Physics tests and JavaScript syntax checks passed.


### Fin recoil correction (supersedes the preceding load tuning)

Use signed water velocity normal to each blade, including hip/knee motion and
body travel in the lower-leg frame. Scalar travel speed no longer amplifies bend
regardless of the blade's direction. Elastic recovery uses the rope divers'
spring/damping values (36 / 8.5); their existing animation is unchanged. The rest
shape is straight, with a 0.70 bend limit and no outward velocity accumulation at
that limit. Tests unload both bend directions and require 85% recovery within
0.5 seconds and a straight resting blade within 2 seconds.

The recreational shader now bends the blade centreline along a fixed-length arc,
shortening its axial projection rather than stretching it sideways. Normals rotate
with that arc, and bioluminescence tip sampling follows the new tip position.
Browser regression checks passed for horizontal travel, deep ascent, full dives,
arm articulation and pause. This remains a reduced elastic animation model.


### Separate fin tips

The proximal 35% of her flexible blade region now stays firm, with elastic arc
bending concentrated farther towards the tip. This reduces the exaggerated
whole-blade return towards the opposite fin during scissor kicks. Left/right
amplitude varies slightly (4%) and the second leg has a small smoothly varying
phase offset (at most 0.1 rad), avoiding exact mirrored motion. Each blade retains
its own load and spring state; a regression test loads one while requiring the
other to remain at rest. Rope divers remain unchanged. Wake tip sampling follows
the shortened bending region as well.


### Tucked elbows

The recreational arm pole now favors a forward/tucked bend instead of pointing
almost entirely sideways. When needed, the IK solver searches its fixed-length
elbow circle for a solution within 0.12 model metres outside the shoulder, while
also enforcing the existing rear-extension bound and clearance from the torso.
The hand catch is narrower (0.21–0.28 model metres from the centreline). Rope-diver
arm solving remains unchanged. A ten-minute browser regression measured maximum
outward extension of 0.1202, rear extension of 0.0111, unchanged limb lengths and
successful rest, streamline, arm-pull and full-dive states.


### Articulated ankles and manufactured blade angle (2026-11-02)

Reference images inspected directly in the browser:
- [Molchanovs swimmer kicking upward](https://www.molchanovs.com/cdn/shop/files/7_ab8f6ff6-d937-45fb-a1d4-50154ca76c10_1800x1800.jpg): foot pocket is visibly angled relative to the shin; the two loaded blades have distinct curves. A still photograph does not establish recoil timing.
- [Molchanovs reef swimmer](https://www.molchanovs.com/cdn/shop/files/8_24241e1a-325e-4ef7-b803-d1cbe40d5234_1800x1800.jpg): separate parallel blades during a less flexed phase; rear view limits ankle-angle inference.
- [Manufacturer specification](https://www.molchanovs.com/products/pro-bifins-3-carbon): 28-degree blade/foot-pocket angle compensates for less flexible ankles. This is equipment geometry, not an anatomical joint limit.

Implemented: previously all foot/fin vertices were skinned to the knee and the
ankle bone was unused. The recreational rig now has an ankle at the existing
foot-pocket root and a separate fin-root bone. Foot vertices blend into the ankle;
blade vertices follow their own fin bone. The foot departs from the straight-shin
rest mesh by roughly 39 degrees with small, smoothed stroke-dependent motion
(allowed 30–47 degrees); the equipment angle offsets it by 28 degrees. These
animation limits are a chosen recreational pose, not a clinical ROM measurement.
Blade load now includes the articulated ankle's angle and angular velocity. Wake
positions use the fin bone too. The rope divers retain their original skeleton.

Validation: `tests/freediver-ankles.cjs` checks actual skinned vertex motion,
left/right independence, length preservation, bounded foot angle and unchanged
legacy rig. Elastic recoil tests and a ten-minute full-dive browser regression
passed. Inspected the rendered recreational pose as well. Exact hydrodynamic
material calibration and measured video-derived joint trajectories remain open.


### Video check: apparently linked fin tips (2026-11-02)

Actual YouTube playback was paused and stepped forward in batches of eight frames,
not inferred from thumbnails or transcripts:

- [Molchanovs, 129 m CWTB dive](https://www.youtube.com/watch?v=L9iLuZUDgww&t=48s), approximately 0:48–0:49: separated feet, curved blades whose tips approach, overlap in the camera projection, then separate/change curvature. Apparent crossing is not proof of physical contact.
- [Alenka Artnik – Bifin Dive, FreediveInt](https://www.youtube.com/watch?v=L_EubTvpfMY&t=3s), approximately 0:03–0:04: a visibly open pair of blades progresses into a rounded outline with nearly meeting tips, then opens again. The school explicitly presents this clip as good technique.
- [FreeDive International explanation](https://freediveinternational.com/freediving-fins/): discusses stiffness, bending distribution, kick amplitude and ankle control; distinguishes its good-technique example from another clip in which fins are kicked together. That separate bad-technique clip was not visually analyzed here.

Conclusion: reject the earlier assumption that tips appearing drawn together are
inherently a rendering error. This can occur with real independent flexible blades
through part of a kick cycle. Camera projection matters. The videos do not identify
material stiffness, prove contact, or isolate length from technique. Mechanical
inference: with otherwise comparable construction/loading, greater length and lower
bending stiffness permit larger deflection; real fins also vary their stiffness
along the blade. Do not infer a universal tip-distance target or simply suppress
convergence. Preserve independent forces, foot articulation and elastic recovery;
future calibration should compare several phases rather than one still frame.
No animation parameters changed during this research-only check.


### Applying the video findings to the recreational swimmer

The user's requested follow-up to the video analysis restores elastic bending
along the full blade region (apart from the existing small root transition),
replacing the artificial 35% rigid section introduced solely to separate tips.
The arc still preserves centreline length. Blade normals and disturbance sampling
use the same geometry. Independent signed water loads and spring states remain;
there is no attraction, imposed crossing, or target distance between the tips.
The hip-led kick is slightly narrower (amplitude coefficient 0.46 rather than
0.50), and trailing knee bend is reduced (0.30 rather than 0.40). Load-dependent
cadence and the articulated foot/pocket angle are retained. These are qualitative
adjustments guided by the 0:03–0:04 Alenka and 0:48–0:49 Molchanov sequences above,
not a claim of motion-captured or hydrodynamically calibrated fin performance.
The earlier recommendation to suppress tip convergence is superseded.


### Propagating blade recoil

Replaced the single whole-blade curvature with three independently integrated
elastic states: root, middle and tip. Motion is passed along the blade with
inertia/damping, allowing opposite signs of curvature during reversal (an S-shaped
transition). The root response is faster than the preceding 6 rad/s spring, which
lagged excessively at the swimmer's approximately 1 Hz cadence. The renderer
integrates three constant-curvature sections with continuous tangent and preserved
centreline length; normals and wake positions use the same section states.

This is a one-way reduced travelling-response model, not a calibrated coupled beam
or fluid solver. It does not prescribe a distance between left/right tips.
`tests/freediver-blade-wave.cjs` verifies successive reversal at the root, middle
and tip (0.092 / 0.158 / 0.225 s in a step-load test), opposite curvature during
reversal, complete unloaded recovery, and length preservation. Full-dive browser
regression and physics tests also passed. These timings describe the tuned model,
not measurements extracted from the reference videos.


### User-supplied side-view references: foot pocket and kick posture

Compared the three user photographs supplied 2026-11-02 (clipboard IDs
8a6558e8-4547-49bf-87ee-72b4dc996008, 53e53154-f529-47d9-b2fd-034eeb522a17,
261f7aeb-6427-41fc-9b28-6c43e3554473) with a rendered body-relative side view.
The close-up distinguishes shin, heel/instep, rubber foot pocket and blade junction;
the swimming pictures also show the blades can converge during a kick.

Corrections: the recreational skin shader had painted the entire foot pocket as
skin, accentuating an inherited oversized boot bulge. It now renders dark rubber
below the ankle, with the pocket's cross-section slimmed around its centreline.
Ankle target is centred at 0.58 rad with 0.055 rad load-scaled oscillation (previously
0.68 / 0.10), retaining the separate 28-degree equipment angle and travelling blade
bend. These are visual tuning choices, not angles measured from perspective photos.

Also fixed an unrelated but conspicuous pose error: every new underwater target
could restart the four-second duck-dive leg motion. That motion now requires the
upper three metres AND a downward heading; horizontal underwater transfers retain
alternating kicks. Verified a rendered side view and ankle/independence tests.


### Elbow hinge and continuous arm transitions

The recreational forearm previously used a free shortest-arc quaternion independent
of upper-arm twist. It now rotates only around a fixed bind-space elbow hinge; the
upper arm is oriented with the corresponding bending plane. The preferred elbow
position is towards the feet rather than strongly forward. A conservative 125-degree
flexion limit replaces 145 degrees for this swimmer's animation. Target-pole history
and 3 rad/s shoulder/hinge rate limits prevent abrupt branch changes. The hand may
briefly lag its requested target while the joints follow; limb lengths remain fixed.
Tucked target bounds include room for these transitions. Rope-diver and scuba arm
solvers are unchanged.

`tests/freediver-arms.cjs` sweeps hands through rest/raised/folded positions and checks
hinge-axis alignment, segment lengths, flexion and elbow continuity. Maximum elbow
step was 0.0172 model metres. A ten-minute browser simulation passed with maximum
outward extension 0.1403, rear extension 0.0355 and unchanged limb lengths. These
constraints are an animation model, not a complete anatomical shoulder simulation.
