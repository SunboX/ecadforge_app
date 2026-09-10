# Light and dark appearance

The sun/moon switch in the header changes the application appearance. On a first visit the app follows the system color preference, including changes made while the page is open. Browsers without a supported dark preference start in light mode.

Choosing either mode manually saves `light` or `dark` in local storage under `ecadforge.theme`. That choice takes precedence over the system on future visits and is shared with other tabs on the same origin. Clearing site storage restores automatic system selection. If storage is blocked, switching still works for the current page.

`ThemeController.mjs` runs as a small classic script before the stylesheet. It applies the root `data-theme` and native `color-scheme` before first paint, then binds the translated, keyboard-accessible checkbox switch when the DOM is ready. Theme selection does not depend on app loading, a network service, or a document being open.

The light styles remain the baseline. `40-theme.css` defines the switch and dark application palette; `41-theme-viewer.css` styles the workbench, reports, menus, and renderer variables. Schematic colors use the toolkit's semantic CSS properties. PCB composite views adapt the light palette to a slate board surface, warm front copper, cool teal back copper, and pale silkscreen. Top/bottom views preserve those layer identities, and layer identity swatches retain their original colors. The transparent 3D canvas uses its normal model materials over a dark stage. Theme changes do not reparse files, replace renderer output, or reset selection or zoom.

`npm test` covers theme selection, persistence, storage failure, live system changes, cross-tab updates, and cache versioning for the early script. Browser verification screenshots and interaction results are in `output/playwright/dark-mode/` (local, untracked artifacts).

The landing preview has separate light and dark static captures before the demo is parsed. CSS selects them from the same root theme, so saved choices and live toggles work even if the app modules or demo files are still loading. Once ready, the live SVG replaces both captures. The dark capture is generated from the application's actual PCB renderer and theme stylesheet at 760 × 430 pixels; it uses the same slate/copper palette as the full viewer.
