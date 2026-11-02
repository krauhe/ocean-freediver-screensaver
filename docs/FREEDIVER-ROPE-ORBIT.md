# Freediver rope orbit and safety position

The competition pair shares a slowly changing azimuth around the rope. Random azimuth targets are chosen at intervals; angular speed is limited to 0.055 rad/s and angular acceleration to 0.025 rad/s2. Both horizontal offsets and root orientations rotate together around the local moving rope position. Motion slows during the bottom-turn grip, and the tag target rotates with the approach side.

During rendezvous and escorted ascent, the safety diver's position target is 1.55 scene metres in front of the active diver. Existing inertial position tracking provides a gradual approach. The two face each other while retaining the existing vertical offset. Equipment roles alternate, so this applies to either the mono or bifin diver as safety. Surface wave following, skeletal poses and grip IK remain active.

This is a procedural behavior requested by the user, not a measured training protocol. It does not add a full physical rotation model or vision system.

Validation: local `validation/freediver-orbit-check.cjs` measures angular bounds and front-facing safety placement across both roles over five minutes. `validation/freediver-articulation-check.cjs` verifies grip, elbow limits, smooth hand transitions and pause. These local scripts/screenshots are ignored artifacts.


## Rope-diver ankles

Both rope divers now use articulated foot pockets rather than skinning the entire
foot/fin to the knee. A modest stroke-dependent foot angle is centred at 0.62 rad
from the original straight-shin mesh. Bifins retain the equipment offset of 28 degrees; the monofin uses a separately tuned 0.35 rad offset. These are animation
choices, not measured joint-range claims. Existing shader kick motion and elastic
blade oscillators are retained. The two monofin lower-leg frames remain synchronized
(including surface corrections) to avoid splitting the shared blade. Fin-tip and
bioluminescence sampling now follow the fin bones. Tests cover foot articulation,
shared-blade synchronization and existing rope-diver articulation.


### Shared foot-pocket shape review

Reviewed both rope divers after the recreational foot correction. Their inherited
boot/instep geometry had the same oversized bulge. All three freediver meshes now
use one slimFootPockets helper, with a smooth transition from the ankle opening.
The monofin keeps its own pocket root and centre; the bifins use theirs. Existing
rope-diver ankle angles, kicks and elastic fin oscillators are retained. Reviewed
rendered views of both divers and reran the articulation/rope-grip regression and
ankle tests successfully. Scuba models and behavior were not changed.
