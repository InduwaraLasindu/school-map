# Verification — School Navigator 3.1

## Automated checks

`npm run check` checks application/maintenance JavaScript syntax and runs 66 tests, covering:

- All 118 preserved room records and all 11 floors; source paths and the special auditorium/lobby shapes.
- School-year isolation, room swaps, geometry, labels, category changes and import validation.
- The original 18 category groups, the four original Other subcategories, full room coverage and newly introduced categories.
- PBKDF2/AES-GCM unlock with correct/incorrect passwords, random salts/IVs, tampered ciphertext, full-layout draft encryption, locked sessions and password rotation.
- Anchored off-centre pinch, combined pan/zoom, pointer capture, tap versus drag, lifted/cancelled/extra pointers, unrestricted pan and selected-room reset.
- Offline shell/data/admin-lock revalidation, app updates, image cache limits, deep links and project scope. Visitor precaching excludes the editor module.

The separately delivered administrator note was checked against the production lock without printing its password.

## Browser checks

The real application passed 19 functional checks and 75 responsive states in the screen lab: category/facility/class navigation, visitor editor restrictions, room selection and description, zoom/reset, simulated two-finger gestures, fullscreen room changes, fullscreen exit, guide replay/completion, and home search.

Each of these 25 CSS viewport sizes was checked in three states: home, selected room and fullscreen fallback. No horizontal page/panel overflow was observed. Every map state retained a visible selected room and visible room description.

| Viewports | Width × height in CSS pixels |
| --- | --- |
| Small and Android phone sizes | 320×568, 360×640, 360×800, 412×915, 440×956 |
| iPhone sizes | 375×667, 375×812, 390×844, 393×852, 402×874, 414×896, 430×932 |
| Tablet sizes | 600×960, 744×1133, 768×1024, 820×1180, 834×1194, 1024×768, 1180×820 |
| Phone landscape | 844×390, 932×430 |
| Laptop / TV / ultrawide | 1366×768, 1920×1080, 3840×2160, 2560×1080 |

Run the repeatable browser checks at `tests/screen-lab.html` using **Run browser checks**.

## Administrator integration fixture

`node tools/admin-browser-test.mjs` generates an isolated fixture under ignored `artifacts/`. Its fake configuration/password and in-memory storage are separate from production credentials and browser drafts. The HTTP preview cannot expose SubtleCrypto, so that fixture mocks only the crypto boundary; real cryptography is covered independently by Node’s Web Crypto tests. Fixture outputs are never published.

All 15 administrator integration checks passed. Checks cover wrong/correct passwords, room renaming, draft isolation, undo/redo, locking, reload, recovery, invalid import, school-year copies, unreadable draft fallback/preservation and cancellation during unlock.

## Limits

Browser checks use Chromium and actual CSS iframe dimensions, with simulated Pointer Events. They are not physical device tests, Safari/Firefox execution, real multitouch hardware, browser keyboard/notch simulation or native TV remote testing. Fullscreen fallback was exercised; browsers with native fullscreen use the same map/details subtree. The layout adapts by viewport and input capabilities rather than phone brand detection. Original floor drawings and their digitized geometry were not changed by this update.
