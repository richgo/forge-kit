# Trail Desk distance units

## Feature FEAT-104 — Distance units

Outcome: Visitors can compare trail distances in their preferred unit.

### Story STORY-104 — Switch between kilometers and miles

Architecture owner: `distance_sort`

As a trail visitor, I want to choose between kilometers and miles so that I can compare trails in the unit I know.

#### Acceptance AC-108 — Show kilometers by default

- Given the current trail catalog is available.
- When a visitor opens Trail Desk.
- Then the distance unit control is labeled and shows kilometers, and each trail displays its original kilometer distance.
- Check: `trail-desk.miles`

#### Acceptance AC-109 — Switch distance units

- Given the catalog shows distances in kilometers.
- When the visitor selects miles and then switches back to kilometers.
- Then each mile distance is rounded to one decimal place, and switching back restores the original kilometer distances.
- Check: `trail-desk.miles`

#### Acceptance AC-110 — Combine unit selection, sorting and filtering

- Given the visitor has selected miles.
- When the visitor sorts by distance, filters for step-free trails and switches units.
- Then sorting and filtering follow the same rules in either unit and switching units preserves the active sort and filter.
- Check: `trail-desk.miles`
