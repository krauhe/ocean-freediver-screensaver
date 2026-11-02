# Ocean Freediver Screensaver

[Selected logo: Dynamic Diagonal Stream — transparent overlay](grafisk/ocean-freediver-logo-transparent.png)

An interactive 3D screensaver featuring deep competition freedivers (CWT monofin & bi-fin safety escort), hammerhead sharks, great white sharks, translucent jellyfish and dynamic shear-activated bioluminescence in a deep blue ocean. Waves, sunbeams, elastodynamic fin kinetics and animal models are rendered directly in the browser using Three.js. All required files are included, so the scene also works offline.

**[Open the screensaver in your browser](https://krauhe.github.io/ocean-freediver/)** — no download or installation required.

![Hammerhead sharks swimming beneath a rippling ocean surface, with sunbeams and interactive controls.](docs/screenshots/ocean.png)

## Getting started

1. Download the project as a ZIP file or clone the repository.
2. Extract all files into the same folder.
3. Open `index.html` in Chrome or Edge with graphics acceleration enabled.

No installation, server or build step is required. This is a browser screensaver; it does not install itself as a Windows screensaver or desktop wallpaper.

## Controls

Click or tap the open water to minimize the controls. Select **Menu** to reopen them. Pointer movement preserves the minimized state; the existing five-second idle fade still applies.

1. **Fullscreen:** Click the button, press F or double-click the open water. Press Esc to exit fullscreen.
2. **Pause:** Click Pause or press Space. Repeat to resume.
3. **Swimming speed:** Adjust the slider with the speed icon.
4. **Animal count:** Select a total of 0–40 using the Animals slider. The count is shared as evenly as possible between the checked species, including jellyfish. The scene starts with 30 animals; some may swim outside the field of view. Background fish are separate scenery.
5. **Push:** Hold the left mouse button on a shark or jellyfish bell to push it deeper into the water.
6. **Pull:** Hold the right mouse button on a shark or jellyfish bell to pull it closer. Move the mouse to steer sideways at the same time.
7. **Turn:** Grab away from the centre: the head, tail or fins of a shark, or the edge of a jellyfish bell. Force near the centre mainly moves the animal; force farther from the centre also rotates it.
8. **Touch:** Drag with one finger to move a shark or jellyfish in the screen plane and turn it.
9. **Time of day:** Move the Lighting slider to choose any minute from 00:00 to 23:59. Moving it selects Custom time automatically; choose Local clock to follow your computer again. The displayed time always uses 24-hour HH:mm format. Arrow keys adjust one minute, and Home/End select the endpoints. Lighting changes also work while paused.
10. **Species:** Use the Hammerhead, Great white and Jellyfish checkboxes to mix species or show just one. With one species checked, the Animals slider controls that species alone. Unchecking all species hides the animals while retaining the count setting. The separate **Freedivers** checkbox toggles the deep training rig with its monofin athlete and safety diver.
11. **Particles:** Select 0–5,000 suspended particles. The default is 1,700; zero hides them. Both population sliders work while paused.
12. **Graphics:** Move the 4-step Graphics slider to balance power consumption, frame rate and visual detail. The available modes are **Eco · 24 fps** (battery-friendly 24 fps cap, 1.0× pixel ratio, 512×512 caustic map updated every second frame, 72 sunbeams, 60 background fish and closer distant-shark LOD), **Balanced · 30 fps** (default, 30 fps cap, up to 1.35× pixel ratio, 512×512 caustics at 30 Hz, 108 sunbeams, 95 background fish), **High · 40 fps** (40 fps cap, up to 1.6× pixel ratio, denser 512×512 caustics at 40 Hz, 132 sunbeams, 110 background fish), and **Ultra · 60 fps** (smooth 60 fps cap, up to 2.0× pixel ratio, 1024×1024 caustics at 60 Hz, 132 sunbeams, 110 background fish and full shark mesh detail at all distances). WebGL automatically requests the high-performance discrete GPU (`powerPreference: 'high-performance'`) when one is available.

Sharks and jellyfish follow with elastic motion and retain some momentum after release, then gradually recover their swimming attitude. You can also move them while paused. All text and controls fade out after 5 seconds of inactivity, including after using a slider. Mouse, touch or keyboard input reveals them again.

Hammerheads and great whites have small differences in body shape, mottled skin and visible, weathered scars. Thrust-coupled tail beats vary dynamically in frequency and amplitude with acceleration and steering bursts, flexible pectoral and dorsal fin tips yield elastically during turns, and five curved gill slits ventilate with rhythmic breathing motions. Procedural companion remoras or pilot fish accompany several of the larger sharks. Great whites have a broader snout, small inset eyes and an animated mouth with textured lining, gum pads and three visible tooth rows; the inner rows fold inward. In the background, streamlined silvery pelagic fish school with animated forked tails, gently parting as sharks swim past. Filtered skin details and subdued tooth highlights reduce flickering edges as the animals move into the distance.

Moon-jelly-inspired animals swim toward and away from the camera on three-dimensional paths, with their bells facing their swimming direction. The bells have an inner surface, modelled internal horseshoes and folded oral arms with volume visible from different angles, illuminated by translucent sun backlighting and moving caustic ripples. Each bell contracts, then relaxes slowly while fine tentacles trail behind. Their movement follows Pause and the swimming-speed control, and their tissue remains softly visible under night lighting with subtle pulse-synchronised bioluminescence.

In the background, a freediving training rig with a surface float, weighted vertical line and illuminated bottom plate hosts a Constant Weight (CWT) freediver and safety diver. The deep diver wears a streamlined wetsuit, monofin, crown-mounted headlamp and safety lanyard, cycling through a realistic duck dive, active dolphin-kick descent, hydrodynamic freefall, bottom turn and steady ascent. At one third of the target depth, a safety diver in long bi-fins descends from the buoy to escort the athlete to the surface. Nearby sharks and fish schools gently avoid the dive line, and the divers' kicks part suspended marine snow and stimulate glowing bioluminescent wakes at night.

## Ocean and lighting

The scene includes an upright Gozo-inspired ferry wreck, a rippled sand bed and a submerged limestone ledge on the right. Two scuba buddies explore a continuous circuit around the wreck, truck, cliff edge and bottom stones, slowing at inspection points with articulated frog kicks and long glides. Small regulator bubbles are visible immediately, then follow independent breathing cycles. At night their hand-held torches follow the nearby attraction, with soft beams visible in the water. The freediving line ends beside the wreck. These are procedural 3D models, not photographs or an exact reconstruction of a real dive site.

The bed mixes pale rippled sand, darker silt and scattered gravel. Limestone has mottled strata, cracks and surface relief; the wreck has rust, flaking surfaces, open hull breaches, missing roof panels, bent rails and fallen debris. Rooted seagrass patches sway gently in the current, with shorter algae on the deck. All textures are generated locally and remain available offline. Vegetation freezes with Pause and is included in **Wreck & reef**.

**Hemmoor truck** adds a separately switchable, photo-inspired model of the Kreidesee truck lying on its side in the sand behind the ferry's stern. Its framed cab, raised tipper, fractured windscreen and wheels are retained; KREIDESEE lettering appears only on the cab front, which faces the viewer. The visual reference was [P. Coors / Tauchernest (2018)](https://www.tauchernest.de/Hemmoor/en/index.html). The model is an artistic interpretation placed in the existing scene, not a reconstruction of Hemmoor's lake or underwater layout. Source photographs are not loaded by the screensaver or bundled as GPL assets.

Use **Bioluminescence** to tune the night-time glow from **0–1200%** (default **300%**, remembered on this browser). Moving fins, hands and body-separation edges activate tiny flashes only along the narrow strip of water they cross. Flashes remain in the water after contact, with a brief recovery interval; they do not follow or orbit a swimmer. Strong strokes excite more points than slow gliding. **Scuba buddies** and **Wreck & reef** toggle the new scene elements. Pale suit panels, distinct belt markings and exposed hands/ankles identify the freedivers. The selected upper-right **Dynamic Diagonal Stream** lockup appears in the fading overlay and About panel.

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
| `freediver.js` | Deep freediving buoy rig, monofin diver and safety diver |
| `freediver-rig.js` | Reusable 16-joint skeleton, skin weights and two-segment arm IK |
| `scuba.js` | Articulated buddy pair, breathing bubble pool and torch lights |
| `diver-bubbles.js` | Shared freediver/scuba bubble optics and rise/expansion model |
| `seabed.js` | Batched procedural sand, limestone ledge and ferry wreck geometry |
| `hemmoor-truck.js` | Kreidesee-inspired truck lying on its side behind the ferry |
| `marine-behavior.js` | Shared current, environmental steering and individual shark/school-fish simulation |
| `benthic-life.js` | Instanced bottom fish, shrimp, sea stars, shelters and settling sediment |
| `king-crab.js` | Articulated crab with planted feet, foraging pauses and threat response |
| `comb-jelly.js` | Enlarged Mnemiopsis-inspired comb jellies with moving iridescence and separate stimulated green emission |
| `three.min.js` | Local Three.js r160 library |
| `THREE-LICENSE` | MIT licence for Three.js |
| `GUIDE.md` | User guide and technical limitations |
| `LICENSE` | GPLv3 licence for this project |

The scene is silent and works offline. A hidden browser tab stops rendering. If your system requests reduced motion, the scene starts paused.

**Bottom life** adds eight bottom fish, ten shrimp and seven sea stars. Fish and sharks now navigate using individual state and local interactions; jellyfish drift and pulse in the shared current. Plants and particles respond to the same mild flow, and nearby moving fins or crab footfalls can lift small amounts of settling sediment. See [GUIDE.md](GUIDE.md) for behavior details and model limits. The implementation is species-inspired rather than a scientifically calibrated ecosystem.

## Credits

The reef shelf now has rooted seagrass patches and a compact school along its outer lip. `king-crab.js` adds three independently walking red king crabs on the foreground sand (toggle **King crab**). It uses six walking legs with planted stance phases, unequal claws, reduced grooming legs and a spiny carapace. Hiding the seabed also hides the crab.

Wave crests have a small sharpening harmonic, sparse whitecap texture and individual nighttime bioluminescent flashes controlled by the existing slider. These are visual approximations of breaking and mechanical stimulation, not a fluid simulation. Biological references: [NOAA red king crab](https://www.fisheries.noaa.gov/species/red-king-crab) and [Scripps/Latz Laboratory on mechanically stimulated plankton](https://latzlab.ucsd.edu/bioluminescence/dinoflagellates/dinoflagellate-bioluminescence/). No external images are loaded. The combined scene is an artistic habitat mix, not a reconstruction of one ecosystem.

Visual references: the user-supplied Karwela photographs in `developer input/`, plus [Divewise's Karwela description](https://divewise.com.mt/blogs/dive-sites/mv-karwela-gozo-wrecks). Motion references: [FlowState Divers frog-kick film](https://www.flowstatedivers.com/films/how-to-frog-kick) and [GUE.tv frog-kick technique description](https://gue.tv/programs/de-frog-kick-technik-intensitaet-anwendung-tauchen). The animation is procedural, not motion capture. Source photographs are reference material and are not loaded by the running scene.

* **Creator & Lead Developer:** Kristian R. Harreby
* **AI Architecture & Co-Development:** Gemini AI (Google DeepMind / Google Cloud Vertex AI) & Codec
* **Open Source & Rights:** Open source under the **GNU General Public License v3.0 (GPLv3)** — sharing the exact same open-source rights, freedoms and principles as the [T1D Simulator](https://github.com/krauhe/T1D-Simulator) project.

## Licence

Ocean Freediver Screensaver is open source under the **GNU General Public License v3.0 (GPLv3)**, the same licence as T1D Simulator. See [LICENSE](LICENSE) for the full terms.

Copyright © 2026 Kristian R. Harreby. Co-developed with Gemini AI & Codec.

The bundled Three.js library retains its own MIT licence in [THREE-LICENSE](THREE-LICENSE).

Freedivers use articulated skinned 3D meshes rather than shader-only limb interpolation. Their line-supported bottom turn coordinates independent arms, a fixed grip, sinking hips and bent knees. The skeleton is exposed through `freedivers.rigs` for future poses and camera views.
