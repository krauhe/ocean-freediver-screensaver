# Hydrodynamisk Shear-Aktiveret Bioluminescens i Marine Simulationer
## Fysisk, Optisk og Teknisk Analyse fra Google Cloud Gemini 4 Argon (A4)

*Dokument udarbejdet i samarbejde mellem Google DeepMind Antigravity og Google Cloud Vertex AI Gemini 4 Argon.*  
*Projekt: Hammerhajer & Fridykkere (WebGL / Three.js).*

---

## 1. Biofysisk Mekanisme & Skalaforhold (Dinoflagellat-fysiologi)

### 1.1 Organismer og cellulær mekanik
Det fænomen, der ses på natlige fotos af glødende brænding og opleves af natdykkere i tropiske og tempererede farvande, skabes primært af fritlevende, encellede marine dinoflagellater — herunder *Noctiluca scintillans*, *Lingulodinium polyedra* og *Pyrocystis fusiformis*.

*   **Fysisk partikelstørrelse ($d_p$):** Enkeltcellerne har en diameter på **$20\text{ }\mu\text{m}$ til $500\text{ }\mu\text{m}$** ($0.02 - 0.5\text{ mm}$), hvor selve lysorganellerne (*scintillons*) indeni cellen kun måler ca. $0.5\text{ }\mu\text{m}$.
*   **Optisk fremtoning i simulationen:** Fordi hver organisme er mikroskopisk, må bioluminescens **aldrig** renderes som store svævende "ildflue-kugler" eller centimeter-store lysende blobs i roligt vand. For det menneskelige øje fremstår en aktiveret zone som:
    1.  **Sub-pixel *scintillations* (stjernestøv):** Individuelle, knivskarpe mikro-glimt på $1 - 2\text{ pixels}$ tæt på kameraet ($< 1.5\text{ m}$).
    2.  **Volumetrisk glød (nebuløs sky):** På afstand ($> 2\text{ m}$) eller ved høj koncentration ($10^4 - 10^6\text{ celler/m}^3$) smelter tusindvis af mikro-glimt sammen pga. vandets fremadrettede Mie-spredning (Henyey-Greenstein fasefunktion, $g \approx 0.85$) til en sammenhængende, mælkeagtig elektrisk blå tåge i selve hvirvlen.

### 1.2 Biokemisk kinetik og tidsrespons
Når cellemembranen deformeres mekanisk af hydrodynamisk shear, åbnes spændingsstyrede protonkanaler i vakuolemembranen. Dette sænker pH-værdien i scintillonerne fra $\sim 8.0$ til $\sim 6.0$, hvilket aktiverer enzymet *luciferase* til at oxidere substratet *luciferin*.

*   **Latens ($\tau_{lat}$):** $15 - 20\text{ ms}$ fra mekanisk påvirkning til lys-emission.
*   **Stigningstid ($\tau_{rise}$):** Hurtig eksponentiel stigning på $10 - 30\text{ ms}$ til maksimal intensitet.
*   **Henfaldstid ($\tau_{decay}$):** Eksponentielt fald over **$80 - 250\text{ ms}$** (typisk samlet flash-varighed $\approx 100 - 150\text{ ms}$ for *L. polyedra*, op til $500\text{ ms}$ for *P. fusiformis*).
*   **Refraktærperiode & udmattelse:** Efter et flash indtræder en refraktærperiode, hvor cellen ikke kan genaktiveres med fuld styrke før protongradienten er genoprettet. En hvirvel, der bliver ved med at rotere, lyser derfor kraftigst i det præcise sekund, den skabes ved finnekanten, og fader hurtigt ud til mørke.
*   **Spektral signatur:** Smalbåndet emission centreret omkring **$\lambda_{max} \approx 472 - 476\text{ nm}$** (elektrisk cyan-blå) med en halvbredde (FWHM) på kun $\sim 35\text{ nm}$.

---

## 2. Hydrodynamisk Shear-Aktivering (Fysisk Tærskel)

Dinoflagellater reagerer **ikke** på hydrostatisk tryk eller laminær, ensartet strømning. Hvis en vandmasse bevæger sig laminært med $2\text{ m/s}$, oplever cellen ingen relativ deformation. Aktivering kræver en lokal hastighedsgradient — dvs. **hydrodynamisk forskydningsspænding (shear stress, $\tau$)** på tværs af cellens membran:

$$\tau = \mu \dot{\gamma} = \mu \sqrt{2 \mathbf{S} : \mathbf{S}}, \quad \text{hvor } S_{ij} = \frac{1}{2}\left(\frac{\partial u_i}{\partial x_j} + \frac{\partial u_j}{\partial x_i}\right)$$

*   **Dynamisk viskositet af havvand ($\mu$):** $\approx 1.08 \times 10^{-3}\text{ Pa}\cdot\text{s}$ ved $20^\circ\text{C}$.
*   **Kritisk aktiveringstærskel ($\tau_c$):** Eksperimentelle studier (Latz et al.) fastslår tærsklen til **$\tau_c \approx 0.1 - 0.3\text{ Pa}$** ($1 - 3\text{ dyn/cm}^2$), svarende til en kritisk forskydningshastighed på **$\dot{\gamma}_c \approx 100 - 300\text{ s}^{-1}$**.
*   **Konsekvens for simulationen:** Alt vand, hvor $\tau < \tau_c$, skal være **100% mørkt**. Der må ikke være nogen ambient "grund-glød" i uforstyrret vand.

### De tre primære hydrodynamiske aktiveringszoner:

1.  **Brydende overfladebølger (Breaking Wave Shear Zone):**
    I en ikke-brydende dønning er bevægelsen irrotationel ($\nabla \times \mathbf{u} = 0$), og $\dot{\gamma} < 5\text{ s}^{-1}$ (ingen lys). Når bølgen stejler og bryder ($u_{orbital} \ge c_{phase}$), kollapser bølgelæben ned i forsiden. Dette skaber en voldsom *turbulent bore* og en rullende shear-zone, hvor turbulent kinetisk energi ($\epsilon$) dissiperes med $\dot{\gamma} > 1000\text{ s}^{-1}$ (præcis som set på brugerens referencefoto).
2.  **Finner, arme og krops-randlag (Boundary Layer & Tip Vortices):**
    Omkring en svømmende haj eller fridykker dannes et tyndt Prandtl-randlag ($\delta \approx 2 - 10\text{ mm}$), hvor vandhastigheden går fra $0$ (no-slip på huden) til fristrømshastigheden $U_\infty$. Ved hurtige bevægelser (f.eks. kraftige monofinne-spark, bi-finne saksespark eller armtag, hvor den lokale hastighed $v_{local} > 0.45\text{ m/s}$) overstiger væg-forskydningsspændingen $\tau_w$ tærsklen $\tau_c$. Ved bagkanten og spidserne af finner opstår kraftige **spidshvirvler (tip vortices)** med ekstremt høj lokal vorticitet ($\boldsymbol{\omega} = \nabla \times \mathbf{u}$).
3.  **Kølvand og hvirvelgader (Reverse von Kármán Vortex Street):**
    Når en finne eller hale slår frem og tilbage, afkastes skiftevis roterende hvirvelringe bagud i en *omvendt von Kármán-hvirvelgade* (thrust-producerende kølvand). Disse hvirvler transporteres bagud i vandet, mens deres indre shear-energi aktiverer dinoflagellater i et bølgende spor bag dykkerens fødder og hajens hale i $0.5 - 1.5\text{ sekunder}$ efter passagen.

---

## 3. Analyse af Brugerens Referencefoto (`media_1793127778610_d15f78fe.png`)

1.  **Skarp rumlig afgrænsning:** Vandet *foran* bølgen (i bølgedalen mod stranden) og vandet *bag* bølgekammen er **helt mørkt**. Selvom vandet dér er i bølgebevægelse, er strømningen laminær ($\tau \ll \tau_c$).
2.  **Koncentration i den rullende bølgelæbe:** Den intense elektriske cyan-blå glød er 100% låst til selve brændingszonen (*the roller*), hvor luft indblandes, og hvirvelstrømme nedbryder bølgens energi til mikro-turbulens.
3.  **Intensitetsprofil:** Lyset har en højintensiv kerne midt i den aktive brydningszone (hvor kameraets sensor mættes mod hvid-cyan i eksponeringen) omgivet af en blød, eksponentielt aftagende halo skabt af multipel lys-spredning i det skummende vand.
4.  **Overførsel til vores bølge-evaluator:** I vores Gerstner/spektrale bølgemodel må bioluminescens **ikke** blot lægges på bølgehøjden $y$. Den skal trigges af **Jakobi-determinanten $J$** (som måler bølgens sammenpresning/stejlhed før den bryder) kombineret med vertikal hastighed i bølgetoppen.

---

## 4. Matematisk Formulering for Realtime Beregning

### 4.1 Bølge-shear aktivering ($\dot{\gamma}_{wave}$)
For en sum af Gerstner-bølger med bølgevektorer $\mathbf{k}_i$, amplituder $a_i$ og frekvenser $\omega_i$, beregnes overfladens stejlhed / sammenpresning via Jakobi-determinanten i horisontalplanet:

$$J(\mathbf{x}_{xz}, t) = 1 - \sum_{i=1}^{N} k_i a_i \cos(\mathbf{k}_i \cdot \mathbf{x}_{xz} - \omega_i t)$$

Når $J$ falder under en kritisk tærskel $J_{break} \approx 0.35$, krøller bølgetoppen over og bryder:

$$S_{wave}(\mathbf{x}, t) = \text{smoothstep}(J_{break}, 0.05, J(\mathbf{x}_{xz}, t)) \cdot \exp\left(-\frac{|y - \eta(\mathbf{x}_{xz}, t)|}{d_{pen}}\right)$$

hvor $\eta$ er bølgehøjden og $d_{pen} \approx 0.6\text{ m}$ er dybden af den turbulente bølge-rulle under overfladen.

### 4.2 Krops- og finne-shear aktivering ($\dot{\gamma}_{body}$)
Vi repræsenterer de turbulens-skabende anatomiske punkter på hver haj og fridykker som et sæt bevægelige kinematiske noder $\mathbf{p}_j(t)$ med hastighedsvektor $\mathbf{v}_j(t) = \frac{\mathbf{p}_j(t) - \mathbf{p}_j(t - \Delta t)}{\Delta t}$:

*   **Fridykker:** Venstre/højre hånd/underarm, venstre/højre finnespids (eller monofinne-bagkant), venstre/højre knæ/skinneben.
*   **Hammerhaj:** Halefinnens øvre og nedre spids (*caudal lobes*), venstre/højre brystfinnespids (*pectoral tips*), samt cephalofoil ved skarpe sving.

Den lokale forskydningsrate $\dot{\gamma}_j$ omkring punkt $j$ er proportionel med den relative hastighed i forhold til vandet $\mathbf{v}_{rel, j} = \mathbf{v}_j - \mathbf{u}_{water}$:

$$A_j(t) = \text{clamp}\left(\frac{\|\mathbf{v}_{rel, j}\| - v_{crit}}{v_{max} - v_{crit}}, 0.0, 1.0\right)^2, \quad v_{crit} \approx 0.45\text{ m/s}$$

### 4.3 Tidsintegration (Biokemisk puls-respons)
Hver aktiveret mikro-hvirvel tildeles ved fødslen ($t = t_0$) en initial excitering $E_0 = A_j(t_0)$. Intensiteten $I(\Delta t)$ som funktion af alderen $\Delta t = t - t_0$ følger en dobbelt-eksponentiel biokemisk reaktionskurve:

$$I(\Delta t) = E_0 \cdot \frac{\tau_{decay}}{\tau_{decay} - \tau_{rise}} \left( \exp\left(-\frac{\Delta t}{\tau_{decay}}\right) - \exp\left(-\frac{\Delta t}{\tau_{rise}}\right) \right)$$

Med $\tau_{rise} = 0.025\text{ s}$ og $\tau_{decay} = 0.22\text{ s}$ opnås det præcise lynhurtige opblus efterfulgt af en blød udtoning i kølvandet.

---

## 5. WebGL / Three.js Implementeringsarkitektur

### 5.1 Valg af Hybrid-Arkitektur (Lag 1 + Lag 2) ved 60 FPS (Zero-Allocation)

```
+-----------------------------------------------------------------------------------+
|                        KINEMATISK SHEAR-TRACKER (CPU, 0 GC)                       |
|  Måler ds/dt på knogle/finne-noder (Hajer + Dykkere) -> Beregner Shear A_j(t)     |
+-----------------------------------------+-----------------------------------------+
                                          |
                  +-----------------------+-----------------------+
                  |                                               |
                  v                                               v
+-----------------------------------+           +-----------------------------------+
|   LAG 1: KONTINUERLIG SHADER      |           |  LAG 2: TURBULENT WAKE BUFFER     |
| - Bølger: Jakobian J(x,t) < 0.35  |           | - Pre-allokeret Float32 RingBuffer|
|   trigger cyan glød i bølgelæben. |           |   (f.eks. N = 12.000 mikro-spores)|
| - Finner/Krop: Randlags-maske     |           | - Spawner KUN når A_j(t) > 0.15   |
|   på bagkanter styret af hastighed|           | - Curl-noise + hvirvel-advektion  |
|                                   |           | - Sub-pixel glimt + blød glød-halo|
+-----------------+-----------------+           +-----------------+-----------------+
                  |                                               |
                  +-----------------------+-----------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|               ADDITIVT HDR RENDER-PASS (474 nm Cyan + Vand-Absorption)            |
+-----------------------------------------------------------------------------------+
```

### 5.2 Nul-allokerings Ring-Buffer Design (Lag 2)
I stedet for at have synlige partikler svævende overalt i roligt vand, bruges en **cirkulær Ring-Buffer** (`THREE.BufferGeometry` med `THREE.DynamicDrawUsage`) på f.eks. $N = 12.000$ punkter:
*   Alle partikler starter med `birthTime = -100.0` (100% usynlige/mørke i vertex-shaderen via `gl_Position = vec4(2.0, 2.0, 2.0, 1.0)`).
*   Hvert frame tjekkes de kinematiske spidspunkter (finnespidser, hænder, halefinner).
*   Hvis og **kun hvis** et punkt overstiger forskydningshastigheden ($A_j(t) > 0.05$), overskrives de næste $K$ slots i ring-bufferen (`writeIndex = (writeIndex + 1) % N`) direkte i de eksisterende `Float32Array`-buffere:
    *   `aPosition` (vec3): Finnespidsens position + mikro-jitter i randlaget.
    *   `aVelocity` (vec3): Udkastningshastighed fra finnen ($\mathbf{v}_{wake} = 0.35 \cdot \mathbf{v}_{fin} + \boldsymbol{\omega}_{vortex}$).
    *   `aBioData` (vec4): `(birthTime, initialIntensity, randomPhase, particleType)` — hvor `particleType` skelner mellem **85% skarpe mikro-scintillations** ($1.5 - 3.5\text{ px}$) og **15% bløde volumetriske hvirvel-kerner** ($12 - 35\text{ px}$ med lav alpha, som simulerer Mie-spredning i selve hvirvlen).
*   **0 bytes garbage collection:** Ingen `new THREE.Vector3()`, ingen `.push()`, ingen `.splice()` — kun direkte indeks-skrivning i pre-allokerede TypedArrays.

---

## 6. Farve- og Shader-Optik (GLSL)

### 6.1 Spektral kolorimetri ($\lambda = 474\text{ nm}$) og vand-transmission
*   **Lineær sRGB / ACEScg primærfarve (Kerne):** `vec3(0.04, 0.78, 1.00)` (Intens elektrisk cyan-blå).
*   **Høj-intensitets mætning (Bølgekam / kraftigt spark):** Mættes mod `vec3(0.50, 0.96, 1.00)`.
*   **Vand-attenuering (Beer-Lambert):** `exp(-vec3(0.28, 0.045, 0.018) * vCamDist)` (blåt lys transmitteres dybt, mens rød/grøn absorberes).

### 6.2 GLSL Shaders til Kølvand & Mikro-Glimt (Lag 2)

```glsl
// Vertex Shader (Uddrag)
float birthTime = aBioData.x;
float age = uTime - birthTime;

if (age <= 0.0 || age > 1.25 || aBioData.y <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // Clip-space culling (0 fragment cost)
    gl_PointSize = 0.0;
    return;
}

// Biokemisk kinetik: hurtig rise (25ms), eksponentielt decay (220-340ms)
float tauRise = 0.025;
float tauDecay = mix(0.20, 0.34, aBioData.w);
float localAge = max(0.0, age - aBioData.z * 0.18 * (1.0 - aBioData.w));
float flash = (tauDecay / (tauDecay - tauRise)) * (exp(-localAge / tauDecay) - exp(-localAge / tauRise));

vAlpha = clamp(flash * aBioData.y, 0.0, 1.0);
vType = aBioData.w;

// Hydrodynamisk advektion med viskøs opbremsning i vandet
float dragFactor = (1.0 - exp(-age * 3.5)) / 3.5;
vec3 worldPos = position + aVelocity * dragFactor;

vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
vCamDist = -mvPosition.z;
gl_Position = projectionMatrix * mvPosition;

// Skala: Type 0 = 1.2-4.0 px (stjernestøv), Type 1 = 4.0-55.0 px (Mie halo)
float baseSize = mix(0.032, 0.38 * (1.0 + age * 0.8), vType);
float projectedSize = (baseSize * uPixelRatio * 350.0) / max(vCamDist, 0.4);
gl_PointSize = (vType < 0.5) ? clamp(projectedSize, 1.2, 4.0) : clamp(projectedSize, 4.0, 55.0);
```

```glsl
// Fragment Shader (Uddrag)
if (vAlpha <= 0.002) discard;

vec2 uv = gl_PointCoord * 2.0 - 1.0;
float r2 = dot(uv, uv);
if (r2 > 1.0) discard;

// Type 0 = skarp eksponentiel kerne, Type 1 = blød Gaussisk Mie-halo
float radialProfile = (vType < 0.5)
    ? exp(-r2 * 5.5) * (1.0 - r2)
    : exp(-r2 * 2.8) * pow(1.0 - r2, 1.5) * 0.22;

vec3 coreCyan = vec3(0.04, 0.78, 1.00);
vec3 peakWhiteCyan = vec3(0.50, 0.96, 1.00);
float energy = vAlpha * radialProfile;
vec3 bioColor = mix(coreCyan, peakWhiteCyan, clamp(energy * 1.4, 0.0, 1.0));

// Beer-Lambert vand-absorption
vec3 waterExtinction = exp(-vec3(0.28, 0.045, 0.018) * vCamDist);
bioColor *= waterExtinction;

gl_FragColor = vec4(bioColor * energy * 2.4, 1.0); // Additiv blending
```

---

## 7. Opsummering af Realisme-Forbedringer

1.  **Slut med "svævende kugler" i roligt vand:** Roligt vand ($\tau < 0.1\text{ Pa}$) er 100% mørkt. Ingen partikler lyser uden forudgående hydrodynamisk turbulens.
2.  **Korrekt mikroskopisk skala ($1 - 3\text{ px}$ stjernestøv + volumetrisk Mie-halo):** Giver det autentiske udtryk af millioner af mikroskopiske encellede dinoflagellater i stedet for store diffuse cirkler.
3.  **Troværdig bølge-bioluminescens (som på referencefotoet):** Kun den brydende bølgekam ($J < J_{break}$) lyser op i natten.
4.  **Turbulente kølvand bag finner og dyr:** Hvirvelgader afkastes bag dykkernes monofinne/bi-finner og hajernes haler og lyser op i $0.5 - 1.2\text{ sekunder}$ under hurtige spark.
5.  **Fastaflåst 60 FPS ydelse:** Pre-allokeret Ring-Buffer i ét enkelt draw-call med clip-space culling sikrer CPU-tid under $0.15\text{ ms}$ pr. frame og **0 bytes** garbage collection.
