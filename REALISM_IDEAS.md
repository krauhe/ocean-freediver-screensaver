# Realism ideas for The Blue Deep

This roadmap groups possible improvements from small visual changes to more advanced simulations. Items without an implementation status remain ideas, not committed work.

## 1. Shark behaviour and animation

1. **Boids / schooling — partially implemented.** Separation helps sharks avoid each other. Alignment and cohesion could be explored, with behaviour appropriate to each species rather than applying the same schooling rules to every shark.
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

## 3. Environment and water

1. **Particles and bubbles — suspended particles and wakes expanded 2026-10-26.** There are 1,700 drifting particles, including a denser foreground distribution and a few tumbling flakes. Wave-focused sunlight changes their brightness. Nearby sharks and jellyfish part suspended particles around their bodies and leave swirling vortex wakes behind their tails. At night, mechanical shear from swimming or user-dragged animals triggers cyan-blue bioluminescent plankton flashes and trails, alongside subtle pulse-synchronised canal bioluminescence in jellyfish. Rising bubbles with refraction remain an idea.
2. **Depth and distant surroundings — updated 2026-10-26.** Three-dimensional Beer–Lambert vertical depth and path spectral attenuation absorbs red wavelengths faster with depth across sharks, companion fish, schools and jellyfish, preserving open-ocean scale and atmospheric distance without flat fog.
3. **Water currents — particle eddies and wakes expanded 2026-10-26.** Nearby particles share slow circulation with superposed drift in three dimensions. Analytical bow parting and rotational vortex wakes deflect particles behind passing sharks and jellyfish without requiring heavy Navier–Stokes fluid simulation. The bounded analytic motion freezes with Pause.
4. **Atmospheric sky.** A Rayleigh/Mie scattering model could provide more detailed sunrise and sunset colours.
