# HydroSim Simulation Engine — Parameters & Assumptions

This document explains the deterministic **grey-box** growth-and-stress engine
(`backend/app/sim/engine.py`): the formulae, every parameter's meaning and units,
the reasoning behind the chosen values, the assumptions we make, and how the
parameters will be calibrated and validated against real data.

It is the reference for anyone tuning the engine or defending it, and the source
material for the thesis *Design* and *Testing* sections.

> **Grey-box, by design.** The engine is a transparent agronomy-based model with a
> small number of hand-set parameters that are then *calibrated* against real
> datasets. It is deliberately **not** a black-box ML model: every number has a
> meaning and can be adjusted by a non-ML domain expert. A separate ML model
> (trained on the AGC tomato data) approximates/refines this engine; the grey-box
> remains the transparent, always-available core.

## 1. The formulae

**Stress** — a weighted sum of how far each environment variable sits from its
crop-optimal target, each deviation normalized by a per-field tolerance and
capped so no single field dominates:

```
raw     = Σ_supplied  min(1.0, |value − target| / tolerance) × weight
stress  = clamp(raw × 100 / Σ_supplied weight, 0, 100)
```

The score is rescaled by the weight actually supplied so that a partial reading
still spans the full 0–100 range. `STRESS_WEIGHTS` sums to exactly 100, so when
all eight fields are present the divisor is 100 and the formula reduces to the
plain weighted sum. An empty reading yields 0.

**Growth rate** — the per-tick growth multiplier, high in good conditions and
falling toward zero under severe stress:

```
growth_rate = max(0.0, 1.0 − stress / 100)
```

**Yield (harvest quality)** — a linear mapping from accumulated stress:

```
yield = clamp(100 − round(1.15 × stress), 0, 100)
```

**Risk classification** — stress ≥ 60 → `high / critical`; ≥ 30 → `medium / warning`;
otherwise `low / stable`.

All functions are deterministic: identical inputs always produce identical outputs.

## 2. Optimal targets (per crop)

The target (ideal) value for each environment variable. Deviation from these
drives stress. Values sit within commonly published controlled-environment
hydroponic ranges; the code tags each crop with a reference profile
(`osu_hydroponics_lettuce_profile`, `purdue_greenhouse_tomato_profile`).

| Field | Unit | Lettuce | Tomato | Typical published range |
|---|---|---|---|---|
| pH | – | 6.0 | 6.0 | ~5.5–6.5 |
| EC (nutrient strength) | mS/cm | 1.2 | 2.5 | lettuce ~0.8–1.2, tomato ~2.0–3.5 |
| Air temperature | °C | 20.0 | 25.0 | lettuce ~15–22, tomato ~21–27 |
| Water temperature | °C | 19.0 | 22.0 | ~18–22 |
| Humidity | % RH | 60.0 | 70.0 | ~55–75 |
| CO₂ | ppm | 800 | 900 | ambient ~400, enriched ~800–1000 |
| Water level | % | 85 | 85 | operational |
| Light hours | h/day | 14.0 | 16.0 | ~14–18 |

> **Assumption / known caveat:** tomato air-temperature target is **25.0 °C** here,
> to keep the seeded dataset stable. The dashboard (`CROPS[].optimal`) and
> `_OPTIMALS` in `sim.py` currently use 26.0 °C. These are reconciled to a single
> source of truth when the prediction endpoint is wired to the engine (issue #3).

## 3. Stress weights

How much each field's deviation counts toward total stress. Higher weight = that
variable matters more to plant health. The ordering reflects standard agronomic
priority in hydroponics — root-zone chemistry (pH, EC) first, then temperature and
water level, with CO₂ least (it modulates growth rate more than it causes acute
stress).

| Field | Weight | Rationale |
|---|---|---|
| pH | 18 | Governs nutrient availability; small drifts lock out nutrients. |
| EC | 16 | Over/under-feeding directly stresses uptake and osmotic balance. |
| Air temperature | 14 | Drives transpiration and metabolic rate. |
| Water level | 14 | Root oxygenation / drought risk. |
| Water temperature | 10 | Affects dissolved O₂ and root function. |
| Humidity | 10 | VPD / transpiration and disease pressure. |
| Light hours | 10 | Photoperiod; energy budget. |
| CO₂ | 8 | Enhances growth but rarely acutely stressful. |

## 4. Tolerances

The deviation from target that saturates a field's full stress contribution
(i.e. reaches `min(1.0, …) = 1.0`). Smaller tolerance = the plant is more
sensitive to that variable. Example: a full **1.0 pH unit** away from target
already applies the entire pH weight, whereas humidity needs **30 %** off-target
to do the same — reflecting that pH is far less forgiving than humidity.

| Field | Full-stress deviation | Unit |
|---|---|---|
| pH | 1.0 | pH units |
| EC | 1.0 | mS/cm |
| Air temperature | 8.0 | °C |
| Water temperature | 6.0 | °C |
| Humidity | 30.0 | % RH |
| CO₂ | 500 | ppm |
| Water level | 50.0 | % |
| Light hours | 6.0 | h |

## 5. Hard limits

Plausibility bounds used by the dataset generator to keep synthetic values
physically realistic (they do not affect the live stress math directly):
pH 4–8, EC 0.5–4.0, air temp 10–40 °C, water temp 10–32 °C, humidity 25–100 %,
CO₂ 300–1200 ppm, water level 20–100 %, light 8–20 h.

## 6. Assumptions

1. **Weights and tolerances are expert-informed initial estimates, not yet
   empirically fitted.** They encode reasonable agronomic priority but are
   provisional pending calibration (§7). This is the expected state for a
   grey-box v1.
2. **Optimal targets are single crop-level values.** Stage-specific optima
   (seedling vs fruiting) are not yet applied — the `stage` argument is accepted
   for forward-compatibility but ignored in v1 (issue #5 will use it).
3. **Missing fields are skipped**, not penalized. Callers may pass a partial
   reading (the UI sends only pH / EC / air temperature / humidity / CO₂), and
   the score is normalized over the fields supplied (§1) so a partial reading can
   still reach 100. Skipping treats an unmeasured field as *no evidence of
   stress*, not as *at target* — with a caveat: a reading of a single field
   scores that field's deviation on the whole 0–100 scale.
4. **Stress is memoryless at the formula level;** cumulative/path-dependent
   behavior comes from the simulation loop that steps the engine over time
   (issue #3), not from the formula itself.
5. **Linear yield mapping** (`100 − 1.15·stress`) is a simplification; a
   non-linear response may be fitted during calibration.

## 7. Calibration & validation plan

The parameters above are the *starting point*. They will be validated and tuned
against public datasets, targeting the charter's accuracy bar:

- **Accuracy target:** within **±10%** of real-world benchmarks.
- **Lettuce:** HydroGrowNet.
- **Tomato:** Autonomous Greenhouse Challenge (AGC), 2nd Edition — already
  processed into a training table (`data_processing/`).
- **Method:** compare engine-predicted yield/stress trajectories against measured
  outcomes; adjust `STRESS_WEIGHTS` / `TOLERANCES` (and, if needed, the yield
  mapping) to close the gap; document the before/after error.

Until this calibration is complete, the parameter *values* should be presented as
**reasoned initial estimates**, while the *formulae and structure* are the stable,
defensible core.

## 8. Calibration model & sanity invariants

The engine is grey-box: the constants are engineering estimates (no ground-truth dataset exists
for our water-culture systems — AGC is substrate tomato, and no lettuce set pairs our inputs with
yield). It is therefore calibrated for **internal consistency and agronomic plausibility**, not
statistical fit. A permanent guard, `backend/tests/test_calibration.py`, sweeps the whole UI input
grid and asserts these invariants so a future constant change that produces nonsense fails CI:

- **Ideal is perfect** — all fields on target → 0 stress, 100 yield, full growth, plant heals.
- **Monotonic** — moving any field away from target never lowers stress.
- **Bounded** — stress/yield 0–100, growth 0–1, health rate within its decay/recovery limits.
- **Life/death ordering** — ideal never dies; a fully-wrecked plant dies in ~3 sim-days; and **no
  single field, at any slider value, kills faster than ~5 sim-days** (a lone bad parameter must
  never be as lethal as an entirely-wrecked environment).
- **System ordering** — DWC is never harsher than NFT (its reservoir buffers deviations).

**Health vs. survival — two accepted limitations to note in the write-up:**
- *Liebig's law of the minimum:* survival is driven by the **worst single field** (`health_stress`),
  not the weighted-average stress, because a catastrophic parameter (e.g. pH lockout) is not offset
  by good conditions elsewhere. The per-field "excess past tolerance" is **capped at 1× tolerance**
  so a field with a narrow tolerance relative to its slider range (EC) is not disproportionately
  lethal — without the cap, EC 4.0 killed as fast as an all-wrecked plant.
- *Yield saturates while survival does not:* stress caps each field's contribution, so e.g. pH 4 and
  pH 5 read the same harvest quality, yet they die at very different rates. Yield reflects
  instantaneous within-model stress; the health/death mechanic carries the severity.
- Tolerances are **symmetric**, so the model does not capture crop-specific asymmetry (lettuce
  tolerates cool better than heat; high CO₂ is harmless while low CO₂ is not).
- **Health has no equilibrium floor.** Any stress above the neutral point decays health monotonically
  toward 0, so sustained *mild* stress (e.g. two parameters moderately off, stress ~35) eventually
  kills the plant if run well past harvest — ~54 sim-days vs a 45-day cycle, so within a normal cycle
  it survives to harvest at reduced quality. A real plant would settle at a reduced but stable vigour.
  A stress-dependent equilibrium (health relaxes toward a floor, only severe conditions reach 0) is
  future work.
- **Health is fully reversible — no permanent damage.** A plant that nearly died recovers all the way
  to 100% once conditions are restored; there is no injury cap or lost-growth penalty. Pedagogically
  this is a reasonable teaching message ("fix the environment and the crop recovers"), but a real plant
  that was severely stressed does not fully bounce back. A recovery cap that ratchets down with
  accumulated damage is future work.

## 9. Where to change things

- Parameters and formulae: `backend/app/sim/engine.py` (canonical source).
- The dataset generator imports from the engine, so the two cannot drift.
- Tests locking in the behavior: `backend/tests/test_engine.py`; calibration invariants:
  `backend/tests/test_calibration.py`.
