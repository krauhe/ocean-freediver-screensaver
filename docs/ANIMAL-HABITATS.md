# Visitors and resident schools

Updated 2026-11-02 from the user's request: large fish can pass through with gaps between visits; small fish should remain near shelter and food. These are visual behavior rules, not a calibrated ecosystem or food-consumption simulation.

| Group | Implemented behavior | Code |
|---|---|---|
| Sharks | Forward passages with staggered arrivals; only a small subset of the enabled population visits concurrently. After leaving the camera view, wait 60–240 seconds before becoming eligible for another visit. A busy scene delays arrival further. Investigating a school is limited to the early part of a visit. | `marine-behavior.js`: `initShark`, `planPatrol`, `step` |
| Mantas | Keep forward passes, stagger the second animal's first arrival, and wait 65–210 seconds after departure. | `manta-ray.js`: `update` |
| Small fish | Three resident schools near the wreck, reef shelf and bottom stones. Choose local goals within their habitat instead of broad cross-scene routes. Keep individual separation/alignment and flee nearby threats, then steer back toward home. | `marine-behavior.js`: `schools`, `prepareSchools`, fish steering |
| Hidden reef | Home areas move gradually to open-water locations; individual fish swim to them rather than teleporting. | `createMarineEnvironment.hasHabitat`, `prepareSchools` |

The Animals control limits population/visit opportunities; it no longer implies that every enabled shark is visible simultaneously. Food availability is represented only by habitat choice. Feeding, depletion and species-specific diet decisions remain unimplemented. Turtles and jellyfish retain their current swimming/drifting behavior in this change.

Validation: a 15-minute local simulation varied between one and three visible sharks, with nine departures and nine arrivals. All 60 test fish ended within 5.44 scene units of their school home. No JavaScript errors. Local reproducible test: ignored `validation/visitor-resident-check.cjs`. This does not establish behavior for every camera orientation or every obstacle configuration.
