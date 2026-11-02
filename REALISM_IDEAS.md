# Realism ideas for The Blue Deep

This roadmap groups possible improvements from small visual changes to more advanced simulations. Items without an implementation status remain ideas, not committed work.

## Reef-life review — 2026-11-02

Implemented: a procedural king crab with six planted walking legs, unequal moving claws and a spiny shell; additional rooted vegetation on the submerged shelf; a compact reef-edge school using the existing instanced fish; sharper wave crests, sparse whitecaps and discrete crest-localized nighttime plankton flashes. These are bounded visual models, not biomechanical or fluid solvers.

Follow-up implementation and remaining ideas:

1. **Implemented:** eight goby-inspired bottom fish, ten shrimp and seven slowly crawling sea stars, using individual state machines and irregularly spaced rubble refuges.
2. **Implemented:** one shared mild current for grass tips, suspended particles, jellyfish and fish advection, with a smooth sheltered region behind the wreck. Particle trajectories use an analytical displacement approximation rather than integrating each mote.
3. **Implemented:** small settling sediment puffs at crab footfalls, bottom-fish movement and moving scuba/freediver blade tips near sand. Fin contacts use the same geometric tip estimates as the wake effects.
4. Better crevice shading and substrate-specific growth: encrusting algae on rock, grass rooted in sediment pockets, darker sheltered cavities.
5. Optional habitat presets separating cold-water king crabs, Mediterranean scenery and freshwater Hemmoor. The present combined scene is deliberately artistic.

Individual shark and school-fish navigation now runs at a fixed 30 Hz with persistent state, per-animal random seeds and goals, acceleration limits, local separation, shelter/terrain anticipation and threat responses. White sharks have wider spacing and no alignment; hammerheads have weak grouping. Jellyfish do not use fish-like threat vision or schooling. The king crab has foraging pauses and a close-threat freeze response. No predation, reproduction, learning or calibrated energy budget is simulated. Diver choreography remains the established competition/buddy animation.

Validation includes equal fish trajectories at 30/60 render updates, pause invariance, a near-threat escape trial, two minutes of shark navigation without jumps, finite bounded speeds, sediment contact gating and settling, crab freezing, slow star movement, day/night rendering and mobile controls.

The first requested Argon4 consultation timed out after 1,800 seconds; the second shorter behavior review was submitted separately. Do not attribute these implementation decisions to Argon without a returned review.

Behavior references: [NOAA on white shark social behavior](https://www.fisheries.noaa.gov/feature-story/cape-cod-seals-and-sharks-shared-traits-and-top-10-facts), [Australian Museum on shrimp gobies and shelter](https://australian.museum/learn/animals/fishes/what-is-a-shrimpgoby/), [NOAA on sea-star tube feet](https://oceanservice.noaa.gov/facts/starfish.html), [Monterey Bay Aquarium on jellies](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/jellies). Animal depictions are generalized, not exact reconstructions of every species in these sources.

Biological references: [NOAA red king crab](https://www.fisheries.noaa.gov/species/red-king-crab), [Scripps/Latz Laboratory on plankton flashes](https://latzlab.ucsd.edu/bioluminescence/dinoflagellates/dinoflagellate-bioluminescence/). References remain in development documentation, not in an on-screen photo gallery.

## 1. Shark behaviour and animation

1. **Boids / schooling — expanded 2026-10-27.** Separation helps sharks avoid each other and steer smoothly clear of the vertical freediving line and training rig. Alignment and cohesion could be explored, with behaviour appropriate to each species rather than applying the same schooling rules to every shark.
2. **More shark species — partially implemented.** Hammerheads and great whites are available. Great whites now have their own body/head profile, embedded eyes, a mouth cavity, teeth and an animated lower jaw. Species data holds proportions and facial features. Tiger sharks, whale sharks and others would still need their own geometry, materials and swimming style.
3. **Dynamic swimming — expanded 2026-10-26.** The tail beat is asymmetric and the head sways in opposition. Tail beat frequency and amplitude now respond dynamically to acceleration and boid avoidance bursts, pectoral and dorsal fin tips flex elastically during turns and dragging, and the five gill slits ventilate sequentially.
4. **Responses to the user.** Sharks could react to a nearby pointer instead of only responding when grabbed.
5. **Individual variation — initial implementation 2026-10-04.** Each species has three shared, subtly asymmetric body shapes, with individual skin mottling, colour variation and healed marks. Great whites also have a broader snout, smaller eyes and uneven teeth. Gills use pixel-filtered skin shading rather than glossy tubes. Further variation could include species-specific wear and fin damage; age or sex would require appropriate anatomical features.
6. **Symbiotic companion fish — implemented 2026-10-26.** Procedural remoras/pilot fish accompany several larger sharks in a single instanced draw call, tracking host spine flexion, caustics and overhead shark shadows.

## 2. Visual realism

1. **Wave-projected caustics — expanded 2026-10-26.** Sunlight now refracts through the same moving wave field as the surface. Converging rays form brighter bands on shark skin; spreading rays form dimmer regions. A shared light map represents depths of 5, 15 and 30 scene units, blended at each shark fragment's depth. Translucent jellyfish bells, internal organs, oral arms and companion remoras now also sample the three-depth wave-projected sunlight map, with soft capsule occlusion when a shark swims overhead. The pattern follows world position and solar direction, fades with depth and distance, freezes when paused and switches off at night. This is a bounded real-time approximation; it uses analytical capsule projection rather than full ray-traced shadows or light transport.
2. **Volumetric shadows and sunbeams — capsule occlusion added 2026-10-26.** Soft shafts now occupy 3D water near and far from the camera. Each ray refracts through its own moving wave normal, with width changes from neighbouring slopes. Foreground and mid-water sunbeams and projected caustics softly dim beneath overhead sharks using analytical spine-capsule occlusion with distance-widening penumbras, plus forward subsurface scattering through thin shark fin edges and jellyfish bells.
3. **Camera effects.** Explore depth of field for distant objects, lens distortion and chromatic aberration for an underwater-camera appearance, or motion blur. Assess clarity and rendering cost before adding them.
4. **Background fish — implemented 2026-10-26.** Replaced static four-sided cones with streamlined procedural pelagic fish featuring forked tails, countershaded silvery flanks, GPU tail-beat animation, smooth 3D elliptical schooling and gentle shark avoidance.
5. **Freedivers and deep training rig — implemented 2026-10-27.** A procedural background freediving buoy rig (`freediver.js`) features a surface float, tensioned vertical line and illuminated bottom plate. A Constant Weight (CWT) freediver in a streamlined wetsuit and monofin, equipped with a crown headlamp and wrist lanyard, cycles through duck dives, dolphin-kick descent, freefall, bottom turn and ascent, accompanied at one third depth by a bi-fin safety diver. The rig and divers receive wave caustics and night lighting, part suspended particles, excite nocturnal bioluminescent wakes, and are avoided by sharks and fish schools.

## 3. Environment and water

1. **Particles and bubbles — suspended particles and wakes expanded 2026-10-27.** There are 1,700 drifting particles, including a denser foreground distribution and a few tumbling flakes. Wave-focused sunlight changes their brightness. Passing sharks, jellyfish and freedivers part suspended particles around their bodies and leave swirling vortex wakes behind their tails and monofins. At night, mechanical shear from swimming animals or freedivers triggers cyan-blue bioluminescent plankton flashes and trails, alongside subtle pulse-synchronised canal bioluminescence in jellyfish. Rising bubbles with refraction remain an idea.
2. **Depth and distant surroundings — updated 2026-10-26.** Three-dimensional Beer–Lambert vertical depth and path spectral attenuation absorbs red wavelengths faster with depth across sharks, companion fish, schools and jellyfish, preserving open-ocean scale and atmospheric distance without flat fog.
3. **Water currents — particle eddies and wakes expanded 2026-10-26.** Nearby particles share slow circulation with superposed drift in three dimensions. Analytical bow parting and rotational vortex wakes deflect particles behind passing sharks and jellyfish without requiring heavy Navier–Stokes fluid simulation. The bounded analytic motion freezes with Pause.
4. **Atmospheric sky.** A Rayleigh/Mie scattering model could provide more detailed sunrise and sunset colours.
