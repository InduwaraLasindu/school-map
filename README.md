# School Navigator Companion

An interactive, mobile-friendly school room finder for the **2026–2027 academic year**.

**Live site:** https://induwaralasindu.github.io/school-map/

## Features

- Search **118 mapped rooms**, including classroom names, grade, category, building, level and room numbers.
- Browse classrooms by category or see all **11 floor plans** across the Primary and Main buildings.
- Filter rooms by building, or view only saved rooms.
- Save favourite rooms and see recently visited rooms (stored locally on your device).
- Share direct room links, for example: `?room=p1-1`.
- Open a room's marked floor plan or the full floor overview.
- Expand room maps and use zoom controls for more detail.
- Dark and light themes, saved on your device.
- Keyboard navigation: **/** or **Ctrl/Cmd + K** to search; **Esc** to clear search or close the map.
- Responsive layouts, reduced-motion support, visible focus rings and accessible labels.
- On-demand floor-plan image loading; once visited, maps may be available offline via a service worker.

## Running locally

This is a dependency-free static site. Serve the repository folder with an HTTP server rather than opening `index.html` directly:

```sh
python -m http.server 8000
```

Then open http://localhost:8000. GitHub Pages can publish this repository's root directly.

## Project files

- `index.html` — app markup, original room dataset, navigation logic and image references.
- `enhancements.css` — responsive redesign and theme styles.
- `enhancements.js` — search, favourites, share links, zoom and UI enhancements.
- `service-worker.js` — offline app shell and visited-image caching.
- `LFP 26-27/` — original classroom and floor-plan JPEGs.

## Managing room information

Edit the `roomData` list in `index.html`. Each entry has a stable `id`, room `name`, `cat`, `bldg`, `floor`, and `img` path. Some also specify `roomNum`, `subCat`, and `tags`.

To avoid broken links or saved-room references, keep existing IDs stable when renaming rooms.

**Note:** This site provides visual floor-plan references, not indoor GPS or automated turn-by-turn directions. Saved rooms and recent history remain in the user's browser (they are not synced across devices). Offline use requires a previous online visit and a supported browser.
