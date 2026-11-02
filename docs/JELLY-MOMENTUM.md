# Jellyfish momentum and glide

The bell contraction now applies a thrust acceleration rather than driving velocity toward a prescribed speed. Between pulses, water-relative velocity follows quadratic drag: `dv/dt = -k * |v| * v`. The exact drag-only update is `v /= 1 + k * |v| * dt`; symmetric thrust kicks surround it. Bell pulses use substeps up to 1/60 s.

Velocity retains its direction while the animal turns. Ocean current advection is added separately. The shared model is also used with continuous, weaker propulsion for comb jellies; they do not receive artificial bell pulses. Existing depth/scene-boundary corrections remain behavioral constraints, not hydrodynamic forces.

Coefficients are visual tuning, absorbing effective mass, area and drag coefficient. This is a reduced momentum model requested by the user, not CFD or calibrated species physiology. `tests/jelly-momentum.cjs` checks analytic drag decay, the fourfold force ratio at double speed, retained momentum direction, pause and 15/30/60/144 Hz agreement. Local browser integration: `validation/jelly-glide-check.cjs`.
