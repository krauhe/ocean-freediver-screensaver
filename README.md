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

Sharks and jellyfish follow with elastic motion and retain some momentum after release, then gradually recover their swimming attitude. You can also move them while paused. All text and controls fade out after 5 seconds of inactivity, including after using a slider. Mouse, touch or keyboard input reveals them again.

Hammerheads and great whites have small differences in body shape, mottled skin and visible, weathered scars. Their gill slits curve toward the tail. Great whites have a broader snout, small inset eyes and an animated mouth with textured lining, gum pads and three visible tooth rows; the inner rows fold inward. Filtered skin details and subdued tooth highlights reduce flickering edges as the sharks move into the distance.

Moon-jelly-inspired animals swim toward and away from the camera on three-dimensional paths, with their bells facing their swimming direction. The bells have an inner surface, modelled internal horseshoes and folded oral arms with volume visible from different angles. Each bell contracts, then relaxes slowly while fine tentacles trail behind. Their movement follows Pause and the swimming-speed control, and their tissue remains softly visible under night lighting.

## Ocean and lighting

Lighting follows your computer's local clock and turns orange-red at low sun angles. The visual day cycle uses sunrise at 06:00, the highest sun at 12:00 and sunset at 18:00. It does not calculate the sun's position from your location or the season.

At night, stars shimmer through the refracting surface and soft blue starlight keeps the sharks visible. Starlight brightness is artistically enhanced for visibility.

Surface reflection and refraction depend on the viewing angle, wave slope and the refractive index of water. The sky, underwater environment and sunbeams are simplified visual models. See the [detailed guide](GUIDE.md).

Sunbeams extend through the water into the foreground. Each shaft refracts through its own moving patch of the surface, so wave slopes change its direction, width and brightness. Soft edges and distance fading keep the light gentle near the camera.

Moving bands of sunlight on the sharks also come from refraction through those waves. The pattern changes with depth and solar direction, stays anchored in the water as sharks swim through it, and switches off at night.

Suspended particles drift together in a gentle current at several depths, including close to the camera. Small local eddies and slowly tumbling flakes add variation, and wave-focused sunlight makes passing particles glint. Motion freezes with Pause; particles remain faintly visible in the blue night lighting. Particles fade out before recycling at the edges of their water volume.

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
