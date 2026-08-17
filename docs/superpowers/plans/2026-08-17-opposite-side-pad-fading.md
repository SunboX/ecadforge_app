# Opposite-Side Pad Fading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fade opposite-side SMD pads like opposite-side traces in Altium and KiCad while keeping through-hole and multilayer pads full-strength in the active side's trace color.

**Architecture:** Keep the behavior in ECAD Forge's app palette. Add the missing KiCad Top/Bottom root class in `EcadRendererService`, then use renderer-semantic pad type and physical layer metadata for side-aware CSS selectors. Do not change either toolkit.

**Tech Stack:** ECMAScript modules, Node.js test runner, SVG semantic attributes, CSS custom properties, Playwright CLI.

## Global Constraints

- Apply behavior symmetrically to Top and Bottom views.
- Support Altium and KiCad only; do not alter Gerber or CircuitJSON palettes.
- Fade only SMD pads on the non-active copper side.
- Keep through-hole and multilayer pads full-strength.
- Color through-hole and multilayer pads with the active side's trace color.
- Preserve geometry, drills, metadata, selection, and layer visibility.
- Bump the local app version to `1.13.20` and synchronize structured data.
- Do not push, publish, release, or deploy.

---

### Task 1: Add failing side and palette regressions

**Files:**
- Modify: `tests/core/ecad-renderer-pad-context.test.mjs`
- Modify: `tests/ui/viewer-layout.test.mjs`
- Modify: `tests/ui/pcb-through-hole-pad-palette.test.mjs`

**Interfaces:**
- Consumes: `EcadRendererService.renderPcb(document, { side })` and `src/styles/25-kicad-pcb.css`.
- Produces: regression expectations for root side classes and side-aware pad selectors.

- [ ] **Step 1: Require KiCad root side classes**

Extend the existing KiCad pad-context test with:

```js
assert.match(topMarkup, /class="[^"]*\bpcb-svg--top\b/u)
assert.match(bottomMarkup, /class="[^"]*\bpcb-svg--bottom\b/u)
```

- [ ] **Step 2: Require side-aware Altium and KiCad SMD fading**

Replace the existing Altium-only palette assertion with expectations for:

```js
assert.match(
    css,
    /\.pcb-svg--altium\.pcb-svg--top[\s\S]*?\.pcb-pad--smd\[data-layer-id='32'\][\s\S]*?\.pcb-pad__ring/u
)
assert.match(
    css,
    /\.pcb-svg--altium\.pcb-svg--bottom[\s\S]*?\.pcb-pad--smd\[data-layer-id='1'\][\s\S]*?\.pcb-pad__ring/u
)
assert.match(
    css,
    /\.pcb-svg--kicad\.pcb-svg--top[\s\S]*?\.pcb-pad\[data-pad-type='smd'\]\[data-layer-id='31'\]/u
)
assert.match(
    css,
    /\.pcb-svg--kicad\.pcb-svg--bottom[\s\S]*?\.pcb-pad\[data-pad-type='smd'\]\[data-layer-id='0'\]/u
)
assert.match(css, /--pcb-opposite-pad-opacity:\s*0\.45;/u)
assert.match(css, /--pcb-opposite-pad-opacity:\s*0\.78;/u)
assert.match(css, /opacity:\s*var\(--pcb-opposite-pad-opacity\);/u)
```

Also require KiCad's opposite trace selectors to be side-aware for `B.Cu` on
Top and `F.Cu` on Bottom so the pad comparison remains valid.

- [ ] **Step 3: Require active-side through-hole colors**

Update the through-hole palette test to require:

```js
assert.match(
    paletteRules,
    /--pcb-through-hole-pad-fill:\s*var\(--pcb-surface-track-color\);/
)
assert.match(
    css,
    /\.pcb-svg--kicad \.pcb-pad\[data-pad-type='thru_hole'\][\s\S]*?fill:\s*var\(--pcb-surface-track-color\);/u
)
```

Keep the Altium through-hole selector expectation and verify neither
through-hole selector uses `--pcb-opposite-pad-opacity`.

- [ ] **Step 4: Run focused tests and verify RED**

Run:

```bash
node --test tests/core/ecad-renderer-pad-context.test.mjs tests/ui/viewer-layout.test.mjs tests/ui/pcb-through-hole-pad-palette.test.mjs
```

Expected: FAIL because KiCad SVG roots lack side classes, KiCad opposite-pad
selectors are absent, Altium selectors do not require SMD type or opacity, and
the through-hole fill is still a fixed front-copper color.

---

### Task 2: Implement semantic side-aware palette behavior

**Files:**
- Modify: `src/core/ecad/EcadRendererService.mjs:588-592`
- Modify: `src/styles/25-kicad-pcb.css:1-125`

**Interfaces:**
- Consumes: KiCad physical layer ids `0` (`F.Cu`) and `31` (`B.Cu`), Altium physical layer ids `1` (Top Layer) and `32` (Bottom Layer), and existing SVG pad-type metadata.
- Produces: `pcb-svg--top` or `pcb-svg--bottom` on KiCad roots and matching side-aware palette selectors.

- [ ] **Step 1: Add the KiCad root side class**

Pass the active side marker to `#withPcbSvgClasses`:

```js
return EcadRendererService.#withPcbSvgClasses(
    markup,
    'pcb-svg--app-palette',
    'pcb-svg--kicad',
    side === 'bottom' ? 'pcb-svg--bottom' : 'pcb-svg--top'
)
```

- [ ] **Step 2: Make through-hole copper active-side aware**

Change the palette variable to:

```css
--pcb-through-hole-pad-fill: var(--pcb-surface-track-color);
```

Keep the Altium ring selector. Add a KiCad through-hole selector that sets
`fill`, `stroke`, and full opacity from `--pcb-surface-track-color`.

- [ ] **Step 3: Fade Altium opposite-side SMD pads**

Set Altium's opposite-pad opacity and narrow the existing selectors:

```css
.pcb-svg--altium {
    --pcb-opposite-pad-opacity: 0.45;
}

.pcb-svg--altium.pcb-svg--top
    .pcb-pad--smd[data-layer-id='32']
    .pcb-pad__ring,
.pcb-svg--altium.pcb-svg--bottom
    .pcb-pad--smd[data-layer-id='1']
    .pcb-pad__ring {
    fill: var(--pcb-subsurface-track-color);
    opacity: var(--pcb-opposite-pad-opacity);
}
```

- [ ] **Step 4: Fade KiCad opposite-side SMD pads and traces**

Set KiCad's existing opposite-trace opacity as the pad opacity, then add
side-aware selectors:

```css
.pcb-svg--kicad {
    --pcb-opposite-pad-opacity: 0.78;
}

.pcb-svg--kicad.pcb-svg--top
    .pcb-pad[data-pad-type='smd'][data-layer-id='31'],
.pcb-svg--kicad.pcb-svg--bottom
    .pcb-pad[data-pad-type='smd'][data-layer-id='0'] {
    fill: var(--pcb-subsurface-track-color);
    stroke: var(--pcb-subsurface-track-color);
    opacity: var(--pcb-opposite-pad-opacity);
}
```

Replace unconditional KiCad `B.Cu` zone, segment, arc, and copper-drawing
subsurface selectors with paired Top/`B.Cu` and Bottom/`F.Cu` selectors.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
node --test tests/core/ecad-renderer-pad-context.test.mjs tests/ui/viewer-layout.test.mjs tests/ui/pcb-through-hole-pad-palette.test.mjs
```

Expected: all focused tests pass with zero failures.

---

### Task 3: Bump metadata and run complete verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/toolkit-api-convergence.test.mjs`
- Modify: version-bearing `src/*.html` files through the repository sync script.

**Interfaces:**
- Consumes: completed palette behavior from Task 2.
- Produces: locally releasable ECAD Forge `1.13.20` state without publication.

- [ ] **Step 1: Bump the app version**

Run:

```bash
npm version patch --no-git-tag-version
```

Expected: package and lockfile versions become `1.13.20`.

- [ ] **Step 2: Update the version pin test and structured data**

Change the convergence assertion to:

```js
assert.equal(pkg.version, '1.13.20')
```

Run:

```bash
npm run sync:structured-data
```

- [ ] **Step 3: Run full local gates sequentially**

Run:

```bash
npm test
npm run check:structured-data
npm run build:static
git diff --check
```

Expected: 948 or more tests pass with zero failures; structured data is in
sync; static deployment builds for `1.13.20`; no whitespace errors exist.

- [ ] **Step 4: Verify both demo formats in a real browser**

Use the Playwright CLI against the local server and inspect:

```text
http://localhost:3000/?demo=altium&view=pcb&document=NODEMCU_ESP12.PcbDoc&panel=layers
http://localhost:3000/?demo=kicad&view=pcb&document=RP2040_minimal.kicad_pcb&panel=layers
```

For each demo, switch Top and Bottom, confirm opposite SMD pads visually match
opposite traces, confirm through-hole pads use orange on Top and teal on Bottom,
and capture screenshots under `output/playwright/`. Confirm no application
console errors.

- [ ] **Step 5: Commit the implementation locally**

```bash
git add package.json package-lock.json src tests
git commit -m "fix: fade opposite-side PCB pads"
```

Do not push the design, plan, or implementation commits.
