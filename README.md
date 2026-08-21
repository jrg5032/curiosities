curiosities
===========

## Where the War Was Fought

An interactive map of 143 principal battles of the American Civil War, placed by
coordinate and sized by cost, with a scrubber that moves through April 1861 –
June 1865. Battles bloom on the day they are fought and then fade toward a faint
trace, so the map fills in with everywhere the war has already been.

Open `index.html` — it is a single self-contained file with no runtime
dependencies beyond a webfont.

### Layout

| Path | What it is |
|---|---|
| `index.html` | The built page. Generated; do not edit by hand. |
| `src/map.html` | The template — markup, styles and behaviour. Edit this. |
| `data/battles.json` | The battle dataset, as `fields` + `rows`. |
| `data/us-states.json` | Simplified state outlines, built from `us-atlas`. |
| `scripts/build.mjs` | Inlines the data into the template to produce `index.html`. |
| `scripts/build-map.mjs` | Rebuilds `data/us-states.json` from the `us-atlas` TopoJSON. |
| `scripts/check-data.mjs` | Structural audit of the dataset. |
| `data/VERIFICATION.md` | How the data was checked, and what was changed. |

### Working on it

```sh
node scripts/check-data.mjs   # audit the data
node scripts/build.mjs        # rebuild index.html
```

`check-data.mjs` verifies every battle's coordinates against real state polygons,
checks dates fall inside the war, and flags casualty counts that exceed the force
that took them. Run it before committing a data change; it should report no
structural issues.

### The data

Casualties are killed + wounded + captured/missing. Where a garrison
surrendered, the surrendered men are counted — which is why Vicksburg and Harpers
Ferry show enormous losses against modest forces. Strengths are troops engaged.
Figures come from the standard references (NPS/CWSAC, the American Battlefield
Trust, Livermore and Fox) and were independently re-checked; see
`data/VERIFICATION.md`.
