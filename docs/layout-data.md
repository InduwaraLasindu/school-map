# Layout data and maintenance

The public app reads `data/campus.json`. Its top-level `schemaVersion` is `1`, `activeLayoutId` chooses the default school year, and `layouts` contains independent year snapshots. The editor exports this exact format.

```json
{
  "schemaVersion": 1,
  "activeLayoutId": "2027-2028",
  "layouts": [{
    "id": "2027-2028", "name": "2027–2028",
    "buildings": [{"id":"primary", "name":"Primary Building"}],
    "floors": [{
      "id":"primary-1", "buildingId":"primary", "name":"Level 1", "order":1,
      "width":1000, "height":800,
      "spaces":[{"id":"space-01", "label":"Room 01", "kind":"room", "points":[[50,50],[450,50],[450,350],[50,350]]}],
      "markers":[{"id":"entry-1", "label":"Entrance", "point":[500,700]}]
    }],
    "rooms":[{"id":"p1-1", "name":"1A", "category":"Grade 1", "tags":"g1a one", "spaceId":"space-01"}]
  }]
}
```

- Coordinates are floor canvas units, independent of pixels, screen size and device scale. SVG preserves proportions, fits the geometry and supports zooming.
- Space kinds are `room`, `unassigned`, `lift` and `void`. Only room/unassigned spaces can hold room assignments.
- One room occupies one space. A room can use `spaceId: null` while awaiting assignment. IDs are unique within a layout; space IDs must also be unique across its floors.
- A room ID belongs to the logical room/class record. Keep it stable for saved places and room links. A space ID belongs to the physical area, independent of its current occupant.
- `labelPoint: [x,y]` can position text in an irregular space. Otherwise the renderer chooses an interior point. Dragging/resizing resets this override.
- `sourceImage` on a floor is optional. Use a repository-relative image path, add the image to the repository, and retain the source for comparison. Images are reference material; vectors remain authoritative after edits. Floor copies intentionally omit the old image.
- Changing canvas dimensions in the editor scales every space and marker. To change just a room, edit its polygon or bounding box instead.
- Export includes all years. Replacing the file with just one year removes other years from the published data. Keep older snapshots if old links should continue to work.

## Validation and future changes

The importer rejects unsupported schema versions, malformed JSON, duplicate IDs or occupancy, missing references, invalid coordinates, crossed/zero-area polygons, unsafe image paths and files larger than 2 MB. Validation is atomic. Valid layouts are rendered from data with escaped text; no imported scripts or HTML are executed.

Add fields compatibly before introducing a new schema version. Version migrations belong in the model/importer, with tests; do not silently guess a newer file format. Current limits are deliberately generous for a school: 30 years, 30 buildings per year, 150 floors per year, 600 spaces per floor and 3,000 room records per year, subject to the 2 MB import limit.

Automated transformation tests use a frozen 2026 fixture. The published campus is checked separately, so legitimate renames and new layouts do not break tests just because the original room count changed.

## Original digitization

All 11 unedited JPEG plans were inspected. All 118 highlighted room JPEGs were read to locate their blue overlays. The extraction matched those overlays to enclosed regions in the original plans, correcting small placement drift by snapping to original wall boundaries. The lobby corridor and auditorium recess were reviewed as concave polygons. Six labelled lift elements, source entrances and unlabelled areas were retained without inventing walking routes.

`tools/room-sources.json` records the original room data. `tools/digitization-report.json` links each room to its highlighted source and extraction match score. Original assets remain unchanged.

`tools/digitize.py` reproduces the initial conversion with Pillow, numpy and scipy. **It overwrites `data/campus.json`; run it only on a separate copy when investigating the original conversion.** Use Layout studio for ongoing maintenance and next-year changes.

## App updates and offline data

The service worker caches the shell and vectors during installation. Navigation, code and campus data revalidate online; cached data is used on network failure. Reference images load lazily and are limited to 24 cached entries. Caches are isolated to this GitHub Pages project. Old app caches are removed on activation.

For a code release, update the release suffixes on the stylesheet/module URLs in `index.html` and the service-worker version/precache list together. Existing tabs offer an explicit reload action. A data-only room/layout update needs only `data/campus.json`; its network-first handling refreshes it on the next online visit. Drafts are separate from caches and survive app updates when browser storage remains available.
