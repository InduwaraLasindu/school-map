# Louvre College · Campus Navigator

[Open the live map](https://induwaralasindu.github.io/school-map/)

An editable school map with **118 digitized rooms on 11 floors**, a responsive liquid glass interface, and a dependency-free runtime.

## Find a room

Search by name, grade, keyword, facility, building or floor. Select a result or tap the map. Save rooms, share direct links, compare with the original plan, and zoom or pan for detail.

- Phones: Map / Rooms / Saved navigation and a room details sheet.
- Tablets and computers: directory alongside the interactive map.
- Large displays: adaptive sizing, plus a TV setting with larger controls and arrow-key navigation.
- Display settings: light/dark/system, interface size, full or reduced glass effects.
- Keyboard: `/` or Ctrl/Cmd K to search; arrows between focused map rooms; +/− to zoom; Home to fit; Escape to close details.
- Offline: after a successful first visit, the app shell and all vector floors are cached. Original JPEGs are fetched only on demand.

## Update the next school year — no image editing needed

1. Open **Layout studio**.
2. Press **+** beside the school year to copy the selected layout. Name the new year.
3. Select a room. Change its name, category or search keywords.
4. Pick another location in **Move to a space**. Occupied destinations swap the two rooms.
5. Use **Draw space**, drag shapes/corners, or enter coordinates to change physical layouts.
6. Use **Floor and building** to add/copy/rename floors or add buildings. Canvas size changes scale all geometry and markers together.
7. Choose **Use this year by default** when the new layout should open for visitors.
8. **Export** `campus.json`. Replace [data/campus.json](data/campus.json) in GitHub with the exported file and commit it to `main`. GitHub Pages publishes the update.

**Studio changes are drafts on the current device.** They do not modify the public site automatically. Publishing needs repository write access. Keep an exported backup. Undo/redo covers the current session; drafts survive reloads when browser storage is available. Import validates before replacing anything. New app versions preserve existing drafts and flag published-data conflicts.

Deleting a space or floor leaves its rooms **unplaced**, so they can be reassigned. Choose them in the editor's room menu. Deleting a room record keeps its physical space. Unlabelled source areas remain explicitly unassigned; the app does not guess their purpose.

## How editable maps work

`Room record → Physical space polygon → Floor → Building`

The data is in a versioned JSON file, separate from the interface. A room keeps its stable ID when renamed or moved. A physical space has its own ID and polygon. Labels, highlighting, floor lists, filters and search are derived from those records. New categories, buildings, floors, sizes, aspect ratios and school-year layouts do not require UI rewrites.

See [the schema and maintenance guide](docs/layout-data.md) for the format and [verification notes](docs/verification.md) for test coverage.

## Development

Use Node.js 22 or newer. No package installation is required.

```sh
npm run dev
npm run check
```

Open the local URL printed by the server. GitHub Pages serves the repository root directly; there is no build step and no runtime CDN dependency. The default development port is 3000; `--port` or `PORT` can override it.

[Screen lab](tests/screen-lab.html) runs the real app inside a resizable iframe. It includes phone, tablet, desktop, ultrawide and 4K presets, and a visible overflow check.

## Project files

| File | Purpose |
| --- | --- |
| `data/campus.json` | Published layout data; replace this when publishing editor exports |
| `lib/model.js` | Validation, geometry, search, room assignments and layout copies |
| `lib/map.js` | Accessible SVG map, label wrapping, selection, zoom, pan and pinch |
| `lib/studio.js` | Local layout editor |
| `app.js` / `styles.css` | Navigation, draft handling and adaptive glass interface |
| `service-worker.js` | Versioned offline cache and app update handling |
| `tests/` | Automated checks, frozen digitization fixture and screen lab |
| `LFP 26-27/` | Preserved original floor plans and highlighted room images |
| `tools/digitization-report.json` | Source-image provenance and wall-match scores for every room |

The navigator is a schematic visual reference. It does not provide indoor GPS, verified accessible routes or turn-by-turn directions. Unknown source areas need verification by the school before assigning them.

