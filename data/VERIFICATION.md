# How this data was checked

The dataset was compiled from the standard references, then put through two
independent passes before anything was drawn.

## Pass 1 — structural audit (`scripts/check-data.mjs`)

Machine checks that catch the errors a human eye slides past:

- **Coordinates against real geography.** Every battle's lat/lon is point-in-polygon
  tested against the actual state boundary it claims to be in. This caught four
  misplaced battles: Belmont and Milliken's Bend were on the wrong side of the
  Mississippi, Sabine Pass was in Louisiana rather than Texas, and Island No. 10
  was attributed to Missouri with coordinates in Tennessee (renamed to
  *New Madrid and Island No. 10* and moved to New Madrid).
- **Dates inside the war**, ordered start-before-end, and no single entry spanning
  more than 60 days.
- **Casualties against strength.** Losses may not exceed the force that took them.
  This caught four impossible rows: Roanoke Island, Arkansas Post, Mobile Bay and
  Fort McAllister.
- Duplicate names, bad result/theatre codes, zero-casualty entries.

Battles fought on water or on barrier islands (Fort Sumter, Hampton Roads, Port
Royal, Mobile Bay and others) are allowlisted from the coordinate check, as are
actions that ended in surrender from the losses check — losing most of your force
is the historical fact there, not a data error.

## Pass 2 — adversarial source review

All 143 battles were divided into six slices and each slice given to an
independent reviewer instructed to assume the data was wrong until a source said
otherwise, and to verify date, location, strength, casualties and result against
published figures. Roughly 190 web searches were made in total. Every battle was
checked; none came back unverifiable.

Twenty-three discrepancies were found and applied:

| Battle | Field | From | To |
|---|---|---|---|
| Savage's Station | result | CS | inconclusive |
| Pilot Knob | result | CS | US |
| Iuka | result | inconclusive | US |
| Rocky Face Ridge | result | inconclusive | US |
| Spring Hill | result | inconclusive | US |
| Averasborough | result | inconclusive | US |
| Belmont | result | inconclusive | CS |
| Mobile Bay | C.S. casualties | 1,822 | 1,500 (1,822 was the both-sides total) |
| Fort Henry | C.S. casualties | 173 | 79 |
| Boydton Plank Road | end date | 27 Oct 1864 | 28 Oct 1864 |
| Drewry's Bluff | start date | 16 May 1864 | 12 May 1864 |
| Piedmont | coordinates | 38.29, −79.05 | 38.213, −78.896 |
| Roanoke Island | C.S. engaged | 2,500 | 3,000 |
| Arkansas Post | C.S. engaged | 5,000 | 5,500 |
| Fort McAllister | C.S. engaged | 230 | 250 |
| New Hope Church | C.S. engaged | 11,000 | 4,000 |
| Jackson | Union engaged | 20,000 | 11,500 |
| Rappahannock Station | Union engaged | 30,000 | 2,000 |
| Averasborough | engaged | 25,000 / 6,000 | 12,000 / 7,000 |
| Griswoldville | C.S. engaged | 4,000 | 2,300 |
| Jenkins' Ferry | engaged | 4,000 / 6,000 | 10,000 / 10,000 |

Two proposed changes were **not** applied, because the existing value is at least
as defensible:

- **Pleasant Hill**, result. CWSAC records a Union victory; most narratives read it
  as a Confederate strategic success. Left inconclusive.
- **Sailor's Creek**, Confederate strength. 11,000 is the engaged figure; the
  proposed 18,500 is troops present.

## Known limitations

- **"Engaged" is not uniform.** For most battles it means troops brought into the
  fight. For a few large campaign actions — Mine Run, Rocky Face Ridge, Resaca —
  the published figure is closer to troops present. Sizing by casualties, the
  default, is unaffected.
- **Source pairing.** A few rows mix one source's Union figure with another's
  Confederate figure, Antietam among them, because that is how the commonly cited
  numbers are published. Both halves are within the accepted range.
- **Coordinates** mark the centre of a battlefield and are good to a mile or two.
- **Modern state boundaries** are used throughout. Philippi, Rich Mountain,
  Carnifex Ferry and Harpers Ferry were in Virginia at the time; Honey Springs was
  in Indian Territory.
- Casualty figures for this war genuinely vary between sources, sometimes by 20%
  or more. Differences inside that band were left alone rather than adjudicated.
