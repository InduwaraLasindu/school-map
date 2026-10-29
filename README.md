# Louvre College · School Navigator

[Open the live map](https://induwaralasindu.github.io/school-map/)

A category-first school navigator with **118 digitized rooms on 11 floors**, a responsive liquid glass interface, administrator editing, and a dependency-free runtime.

## Find a room

The home page restores the original categories: Lower Nursery, Nursery, Pre-Grade, Grades 1–11, Forms (Secondary), Edexcel, Advanced Level and Other. Choose a category, then a class. Other keeps Administration, Labs, Activities and Services. New categories appear automatically.

A short first-visit guide explains the controls; replay it with the help button. Search by name, grade, keyword, facility, building or floor. Select a result or tap the map. Save rooms, share direct links, compare with the original plan, and zoom or pan for detail.

- Phones: Categories / Map / Rooms / Saved navigation, safe-area spacing, and a compact room description.
- Gestures: one-finger pan and anchored two-finger pan/zoom; Reset returns to the selected room, while Fit shows the whole floor. Panning has no artificial edge restrictions.
- Fullscreen: room details remain inside the fullscreen map. A CSS fallback supports browsers without arbitrary-element fullscreen.
- Tablets and computers: directory alongside the interactive map.
- Large displays: adaptive sizing, plus a TV setting with larger controls and arrow-key navigation.
- Display settings: light/dark/system, interface size, full or reduced glass effects.
- Keyboard: `/` or Ctrl/Cmd K to search; arrows between focused map rooms; +/− to zoom; Home to reset the selected room; Escape to close details.
- Offline: after a successful first visit, the app shell and all vector floors are cached. Original JPEGs are fetched only on demand.

## Update the next school year — no image editing needed

1. Tap the small **padlock beside the footer credit** (or use `#admin` / Ctrl+Shift+E). Enter the administrator password to unlock **Layout studio**.
2. Press **+** beside the school year to copy the selected layout. Name the new year.
3. Select a room. Change its name, category or search keywords.
4. Pick another location in **Move to a space**. Occupied destinations swap the two rooms.
5. Use **Draw space**, drag shapes/corners, or enter coordinates to change physical layouts.
6. Use **Floor and building** to add/copy/rename floors or add buildings. Canvas size changes scale all geometry and markers together.
7. Choose **Use this year by default** when the new layout should open for visitors.
8. **Export** `campus.json`. Replace [data/campus.json](data/campus.json) in GitHub with the exported file and commit it to `main`. GitHub Pages publishes the update.

**Studio changes are encrypted private drafts on the current device.** Only an unlocked administrator session loads them. Lock editor or refresh to return to the published map. A valid older draft is migrated after administrator sign-in.

**Publishing still requires GitHub repository access.** GitHub Pages hosts static files; its password gate controls this app’s supplied editor interface and encrypts local drafts. The public JSON and JavaScript remain readable; it is not a server authorization system.

**Studio changes are drafts on the current device.** They do not modify the public site automatically. Publishing needs repository write access. Keep an exported backup. Undo/redo covers the unlocked session; encrypted drafts survive reloads and reopen after signing in with the same password, when browser storage is available. Import validates before replacing anything. New app versions preserve existing drafts and flag published-data conflicts. Choose **Lock editor** when you finish.

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

[Screen lab](tests/screen-lab.html) includes a **Run browser checks** button and runs the real app inside a resizable iframe. It includes 25 phone, tablet, desktop, ultrawide and 4K presets, interaction checks, and a visible overflow report.

`node tools/admin-browser-test.mjs` prepares isolated local administrator UI tests at `/artifacts/admin-test.html`. These files are excluded from Git and publication. The HTTP preview uses a crypto boundary mock; `tests/admin.test.mjs` independently tests real Web Crypto.

To rotate the administrator password, export private drafts first, run `node tools/configure-admin.mjs` in a terminal, then commit only `data/admin-lock.json`. Passwords are read without echo. The salt changes on rotation, so export old drafts before changing the password. See [administrator access](docs/admin-access.md).

## Project files

| File | Purpose |
| --- | --- |
| `data/campus.json` | Published layout data; replace this when publishing editor exports |
| `lib/admin.js` / `data/admin-lock.json` | Password unlock and encrypted private drafts; no plaintext password |
| `lib/home.js` / `lib/navigation.js` | Original category order, facility groups and dynamic room choices |
| `lib/guide.js` / `lib/fullscreen.js` | First-visit guide and fullscreen description handling |
| `lib/gestures.js` | Anchored gesture and camera calculations |
| `lib/model.js` | Validation, geometry, search, room assignments and layout copies |
| `lib/map.js` | Accessible SVG map, label wrapping, selection, zoom, pan and pinch |
| `lib/studio.js` | Local layout editor |
| `app.js` / `styles.css` | Navigation, draft handling and adaptive glass interface |
| `service-worker.js` | Versioned offline cache and app update handling |
| `tests/` | Automated checks, frozen digitization fixture and screen lab |
| `LFP 26-27/` | Preserved original floor plans and highlighted room images |
| `tools/digitization-report.json` | Source-image provenance and wall-match scores for every room |

The navigator is a schematic visual reference. It does not provide indoor GPS, verified accessible routes or turn-by-turn directions. Unknown source areas need verification by the school before assigning them.


Created by [Induwara Lasindu](https://github.com/InduwaraLasindu).
