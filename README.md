# Hammerheads · The Blue Deep

An interactive 3D screensaver with hammerheads, great white sharks and translucent jellyfish in a deep blue ocean. Waves, sunbeams, swimming and animal models are rendered directly in the browser using Three.js. All required files are included, so the scene also works offline.

**[Open the screensaver in your browser](https://krauhe.github.io/Hammerheads/)** — no download or installation required.

![Hammerhead sharks swimming beneath a rippling ocean surface, with sunbeams and interactive controls.](docs/screenshots/ocean.png)

## Getting started

1. Download the project as a ZIP file or clone the repository.
2. Extract all files into the same folder.
3. Open `index.html` in Chrome or Edge with graphics acceleration enabled.

No installation, server or build step is required. This is a browser screensaver; it does not install itself as a Windows screensaver or desktop wallpaper.

## Controls

1. **Fullscreen:** Click the button, press F or double-click the open water. Press Esc to exit fullscreen.
2. **Pause:** Click Pause or press Space. Repeat to resume.
3. **Swimming speed:** Adjust the slider with the speed icon.
4. **Animal count:** Select a total of 0–40 using the Animals slider. The count is shared as evenly as possible between the checked species, including jellyfish. The scene starts with 30 animals; some may swim outside the field of view. Background fish are separate scenery.
5. **Push:** Hold the left mouse button on a shark or jellyfish bell to push it deeper into the water.
6. **Pull:** Hold the right mouse button on a shark or jellyfish bell to pull it closer. Move the mouse to steer sideways at the same time.
7. **Turn:** Grab away from the centre: the head, tail or fins of a shark, or the edge of a jellyfish bell. Force near the centre mainly moves the animal; force farther from the centre also rotates it.
8. **Touch:** Drag with one finger to move a shark or jellyfish in the screen plane and turn it.
9. **Time of day:** Move the Lighting slider to choose any minute from 00:00 to 23:59. Moving it selects Custom time automatically; choose Local clock to follow your computer again. The displayed time always uses 24-hour HH:mm format. Arrow keys adjust one minute, and Home/End select the endpoints. Lighting changes also work while paused.
10. **Species:** Use the Hammerhead, Great white and Jellyfish checkboxes to mix species or show just one. With one species checked, the Animals slider controls that species alone. Unchecking all species hides the animals while retaining the count setting.
11. **Particles:** Select 0–5,000 suspended particles. The default is 1,700; zero hides them. Both population sliders work while paused.
12. **Graphics:** Move the 4-step Graphics slider to balance power consumption, frame rate and visual detail. The available modes are **Eco · 24 fps** (battery-friendly 24 fps cap, 1.0× pixel ratio, 512×512 caustic map updated every second frame, 72 sunbeams, 60 background fish and closer distant-shark LOD), **Balanced · 30 fps** (default, 30 fps cap, up to 1.35× pixel ratio, 512×512 caustics at 30 Hz, 108 sunbeams, 95 background fish), **High · 40 fps** (40 fps cap, up to 1.6× pixel ratio, denser 512×512 caustics at 40 Hz, 132 sunbeams, 110 background fish), and **Ultra · 60 fps** (smooth 60 fps cap, up to 2.0× pixel ratio, 1024×1024 caustics at 60 Hz, 132 sunbeams, 110 background fish and full shark mesh detail at all distances). WebGL automatically requests the high-performance discrete GPU (`powerPreference: 'high-performance'`) when one is available.

Sharks and jellyfish follow with elastic motion and retain some momentum after release, then gradually recover their swimming attitude. You can also move them while paused. All text and controls fade out after 5 seconds of inactivity, including after using a slider. Mouse, touch or keyboard input reveals them again.

Hammerheads and great whites have small differences in body shape, mottled skin and visible, weathered scars. Thrust-coupled tail beats vary dynamically in frequency and amplitude with acceleration and steering bursts, flexible pectoral and dorsal fin tips yield elastically during turns, and five curved gill slits ventilate with rhythmic breathing motions. Procedural companion remoras or pilot fish accompany several of the larger sharks. Great whites have a broader snout, small inset eyes and an animated mouth with textured lining, gum pads and three visible tooth rows; the inner rows fold inward. In the background, streamlined silvery pelagic fish school with animated forked tails, gently parting as sharks swim past. Filtered skin details and subdued tooth highlights reduce flickering edges as the animals move into the distance.

Moon-jelly-inspired animals swim toward and away from the camera on three-dimensional paths, with their bells facing their swimming direction. The bells have an inner surface, modelled internal horseshoes and folded oral arms with volume visible from different angles, illuminated by translucent sun backlighting and moving caustic ripples. Each bell contracts, then relaxes slowly while fine tentacles trail behind. Their movement follows Pause and the swimming-speed control, and their tissue remains softly visible under night lighting with subtle pulse-synchronised bioluminescence.

## Ocean and lighting

Lighting follows your computer's local clock and turns orange-red at low sun angles. The visual day cycle uses sunrise at 06:00, the highest sun at 12:00 and sunset at 18:00. It does not calculate the sun's position from your location or the season.

At night, stars shimmer through the refracting surface and soft blue starlight keeps the sharks visible. Starlight brightness is artistically enhanced for visibility, while mechanical shear from swimming or user-dragged animals excites cyan-blue bioluminescent plankton flashes and swirling trails.

Surface reflection and refraction depend on the viewing angle, wave slope and the refractive index of water. The sky, underwater environment and sunbeams are simplified visual models. See the [detailed guide](GUIDE.md).

Sunbeams extend through the water into the foreground. Each shaft refracts through its own moving patch of the surface, so wave slopes change its direction, width and brightness. Overhead sharks cast soft, penumbra-widened shadows through the sunbeams and projected caustics, balanced by gentle forward scattering through thin fin edges and translucent jellyfish bells.

Moving bands of sunlight on sharks, jellyfish and companion fish also come from refraction through those waves. The caustic light map is computed with analytical vertex-Jacobian flux conservation and mipmapped penumbra filtering, ensuring soft light bands glide across skin and tissue without sparkle or temporal flicker. The pattern changes with depth and solar direction, stays anchored in the water as animals swim through it, and switches off at night. Depth-dependent Beer–Lambert spectral absorption attenuates red wavelengths faster with vertical depth and optical path length, naturally enriching deep-water blues.

Suspended particles drift together in a gentle current at several depths, including close to the camera. Passing sharks and jellyfish part particles smoothly around their contours and leave swirling vortex wakes behind their tails. Small local eddies and slowly tumbling flakes add variation, and wave-focused sunlight makes passing particles glint. Motion freezes with Pause; particles remain faintly visible in the blue night lighting. Particles fade out before recycling at the edges of their water volume.

## Files

| File | Contents |
| --- | --- |
| `index.html` | Page and controls |
| `ocean.css` | Layout and appearance |
| `ocean.js` | Shark models, animation, physics, lighting and interaction |
| `jellyfish.js` | Translucent jellyfish models, pulsing bells and trailing tissue |
| `three.min.js` | Local Three.js r160 library |
| `THREE-LICENSE` | MIT licence for Three.js |
| `GUIDE.md` | User guide and technical limitations |
| `LICENSE` | GPLv3 licence for this project |

The scene is silent and makes no network requests. A hidden browser tab stops rendering. If your system requests reduced motion, the scene starts paused.

## Licence

Hammerheads is open source under the **GNU General Public License v3.0 (GPLv3)**, the same licence as T1D Simulator. See [LICENSE](LICENSE) for the full terms.

Copyright © 2026 Kristian R. Harreby.

The bundled Three.js library retains its own MIT licence in [THREE-LICENSE](THREE-LICENSE).
