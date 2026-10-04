# Realism ideas for The Blue Deep

This roadmap groups possible improvements from small visual changes to more advanced simulations. Items without an implementation status remain ideas, not committed work.

## 1. Shark behaviour and animation

1. **Boids / schooling — partially implemented.** Separation helps sharks avoid each other. Alignment and cohesion could be explored, with behaviour appropriate to each species rather than applying the same schooling rules to every shark.
2. **More shark species — partially implemented.** Hammerheads and great whites are available. Great whites now have their own body/head profile, embedded eyes, a mouth cavity, teeth and an animated lower jaw. Species data holds proportions and facial features. Tiger sharks, whale sharks and others would still need their own geometry, materials and swimming style.
3. **Dynamic swimming — partially implemented.** The tail beat is asymmetric and the head sways in opposition. Tail motion could respond more closely to acceleration.
4. **Responses to the user.** Sharks could react to a nearby pointer instead of only responding when grabbed.
5. **Individual variation — initial implementation 2026-10-04.** Each species has three shared, subtly asymmetric body shapes, with individual skin mottling, colour variation and healed marks. Great whites also have a broader snout, smaller eyes and uneven teeth. Gills use pixel-filtered skin shading rather than glossy tubes. Further variation could include species-specific wear and fin damage; age or sex would require appropriate anatomical features.

## 2. Visual realism

1. **Wave-projected caustics — implemented 2026-10-04.** Sunlight now refracts through the same moving wave field as the surface. Converging rays form brighter bands on shark skin; spreading rays form dimmer regions. A shared light map represents depths of 5, 15 and 30 scene units, blended at each shark fragment's depth. The pattern follows world position and solar direction, fades with depth and distance, freezes when paused and switches off at night. It replaces the unrelated moving noise pattern. This is a bounded real-time approximation; it does not calculate shark shadows or full light transport.
2. **Volumetric shadows and sunbeams — foreground shafts implemented 2026-10-04.** Soft shafts now occupy 3D water near and far from the camera. Each ray refracts through its own moving wave normal, with width changes from neighbouring slopes. Depth testing handles sharks in front of the strips. Actual volume shadows cast by sharks remain an idea; the strips approximate light scattering.
3. **Camera effects.** Explore depth of field for distant objects, lens distortion and chromatic aberration for an underwater-camera appearance, or motion blur. Assess clarity and rendering cost before adding them.
4. **Background fish.** Replace the small static cone shapes with simple fish models and animated tails.

## 3. Environment and water

1. **Particles and bubbles — suspended particles implemented 2026-10-04.** There are 1,700 drifting particles, including a denser foreground distribution and a few tumbling flakes. Wave-focused sunlight changes their brightness. Rising bubbles with refraction remain an idea.
2. **Depth and distant surroundings.** Subtle colour gradients or distant rock and vegetation silhouettes could strengthen the sense of scale while preserving the open-ocean setting.
3. **Water currents — particle eddies implemented 2026-10-04.** Nearby particles share slow circulation with superposed drift in three dimensions. The bounded analytic motion freezes with Pause. Fish advection and wakes behind sharks remain ideas, not simulated fluid effects.
4. **Atmospheric sky.** A Rayleigh/Mie scattering model could provide more detailed sunrise and sunset colours.
