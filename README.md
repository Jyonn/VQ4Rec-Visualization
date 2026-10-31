# VQ4Rec Visualization

Interactive companion to a survey of vector-quantized recommendation methods.

## Run locally

```sh
python -m http.server 43879 --directory dist
```

Open http://127.0.0.1:43879/. No dependency installation or build step is required.

## Default view

- Global overview across all applications.
- Optimized layered tree layout.
- Hide links spanning **2 or more levels** (direct adjacent-layer links remain).
- All node circles have the same radius.
- Nodes with no visible comparison edge are removed after filtering.

You can switch to concentric rings, change the depth limit, filter datasets/metrics/years, search methods, inspect original experiment records, and export SVG.

## Visual encoding

Application categories use node colors, with segmented rings for papers belonging to multiple applications. Resolved external baselines use neutral gray. Concentric mode places baseline context outside survey methods and retains multiple method layers.

The representative experiment prioritizes NDCG@10, then Beauty, then stable field ordering. Its absolute direction-adjusted change determines edge style:

| Relative change | Style |
| --- | --- |
| <10% | Light dotted, 1.2px |
| 10–20% | Light solid, 1.2px |
| 20–30% | Dark solid, 2px |
| ≥30% | Thick dark solid, 3px |

Signed changes and attribution limits remain available in the evidence panel. Unknown magnitudes use neutral dots. No cross-protocol mean or cumulative gain is calculated.

## Data

The bundled data contains 179 survey papers, 67 resolved external baseline identities, 368 relationships, and 5,931 experimental records before filtering. It was extracted from the workbook export dated 2026-10-30 using its paper catalog, raw experiments, citation relations, baseline citation audit, and baseline BibTeX sheets. It is not a direct rendering of the 503-node sheet.

Explicit citation relations and bibliography mappings are labeled separately. A bibliography mapping is not presented as an independently verified citation relation. Original-language attribution notes are retained inside provenance disclosures. Partial extraction does not establish isolated VQ effects or exhaustive coverage.

To refresh, place `VQ4Rec_论文与基线引用.xlsx` in the parent directory and run `python scripts/extract.py`. The original workbook is not included in this repository.

## Layout algorithm and checks

Strongly connected components determine comparison ranks without deleting original cyclic evidence. Three deterministic starting orders undergo constrained node swaps and layer compaction or ring rotation. The objective uses the same cubic curves as rendering, estimated with 18 segments. Nonincident crossing pairs are estimated with 12 segments. Label clearance uses 218 × 32 SVG-unit boxes. Results are heuristic local optima, not guaranteed global minima.

Depth visibility is applied after computing ranks from the currently filtered complete graph. Ranks are retained when hidden edges and isolated nodes are removed. Metrics use pre-display-scale SVG units, so Fit does not alter measurements.

```sh
node --check dist/app.js
node scripts/check-layout.mjs
```

GitHub Actions validates the layouts. Hosting and public GitHub Pages are not enabled.
