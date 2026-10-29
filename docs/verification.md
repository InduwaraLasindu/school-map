# Verification

The release was checked against the original assets, the pure data model, service-worker simulations and the running app in Chrome.

All **43 automated checks** passed locally and in [GitHub CI](https://github.com/InduwaraLasindu/school-map/actions/runs/40862115260). [GitHub Pages deployment](https://github.com/InduwaraLasindu/school-map/actions/runs/40862114422) succeeded. The public URL was opened and verified to show the new interface, 118 rooms and 11 floors; `preview.jpg` captures that deployed page.

## Automated checks

Run `npm run check` with Node.js 22+. There are no npm runtime or test dependencies.

- Every original room ID/name and all 11 floors survive the digitization, using a frozen fixture. The currently published data is validated independently so future room changes remain permitted.
- Every original image reference exists with exact filename case.
- Concave auditorium/lobby geometry and interior label positions.
- Cross-floor room swaps, unplaced rooms, new buildings/categories, different canvas aspect ratios, floor duplication and isolated school-year copies.
- Keyword/punctuation/Unicode search, combined filters and saved-room filtering.
- Geometry translation/resizing and validation of malformed JSON, unknown schema versions, duplicate IDs/occupancy, broken references, invalid or crossed polygons, unsafe source paths and oversized imports.
- Export/import data round trip.
- Offline installation, update activation, old-cache cleanup, online campus revalidation, offline room deep links, correct missing-code responses, bounded lazy image caching and project-scope isolation.

CI runs the same checks on pushes to `main` and pull requests.

## Browser viewport checks

The screen lab uses real iframe CSS viewports, scaled visually to fit the testing monitor. The following sizes showed no horizontal page overflow or panels extending outside the viewport:

| View | CSS viewport |
| --- | --- |
| Small phone | 320 × 568 |
| Phone | 390 × 844 |
| Large phone | 430 × 932 |
| Phone landscape | 844 × 390 |
| Tablet portrait | 768 × 1024 |
| Tablet landscape | 1024 × 768 |
| Laptop | 1366 × 768 |
| Desktop | 1440 × 900 |
| TV | 1920 × 1080 |
| 4K TV | 3840 × 2160 |
| Ultrawide | 2560 × 1080 |

Short phone viewports use vertical scrolling to preserve usable map space. Selecting a room on a phone focuses it automatically above the details sheet. Room details were also checked with the enlarged TV interface.

All 11 rendered floors were inspected for room-shape presence and text extending outside room bounds. The source plans were inspected separately before digitization.

## Browser interaction checks

- Search a facility, switch to its correct building/floor, and highlight it; select a room directly on the SVG.
- Fit/zoom controls and directional keyboard focus between map rooms.
- Create a separate school year; rename a room, introduce a category, swap occupied locations, undo/redo and confirm that the original year stays unchanged.
- Reload and recover the saved draft; search reflects edited data.
- Export JSON through the browser, then validate the downloaded data and original/copy isolation.
- Reject an invalid imported schema without replacing the working map.
- Resize a physical space, drag it, draw another space, create a room there, and find the new room through public search.
- Light/dark preferences, reduced effects, adaptive/TV sizing, and reset-to-published confirmation.

These are browser viewport and interaction checks, not physical-device tests. Safari/Firefox and actual TV remotes were not available in this environment. Offline network failures and cache behaviour were tested in a service-worker harness; no claim is made that every browser-specific install prompt or offline mode was tested on hardware.
