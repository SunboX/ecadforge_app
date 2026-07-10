# occt-import-js and OCCT source guidance

ECAD Forge ships the following browser runtime assets in this directory:

- `occt-import-js.js`
- `occt-import-js-worker.js`
- `occt-import-js.wasm`

These assets provide STEP, BREP, and IGES import support in the browser. The
vendored JavaScript and WebAssembly runtime was built from the SunboX
local fork version `0.0.28` of `occt-import-js` and Open CASCADE Technology
(OCCT).
The worker remains the ECAD Forge-owned wrapper based on the LGPL-licensed
upstream worker.

## Vendored runtime source

- fork repository: `https://github.com/SunboX/occt-import-js.git`
- fork commit used for the vendored JavaScript and WebAssembly:
  `a4837090efa592fab4dc28915b4be94c3f29b527`
- included local npm-pack archive:
  `../../../../occt-import-js-0.0.28.tgz`
- local archive npm shasum: `4013b029ef897cd66ed3fadd9b46ab6133e48653`
- local archive npm integrity:
  `sha512-4BKpv+chiukPV6pUnim4KK3BechvbabN6xZ0BrYSrNXKrU92tLzGyqskC5ghgLASVeZ9x4ZZfq2jUeX6vwRgpg==`
- local archive SHA-256:
  `9666b4ebbf995f2f947f9b528a3998274a37ccc4d8e9d0e4057f72259d8c75f4`

Version `0.0.28` is a local fork build and is not claimed to be published on
the npmjs registry. ECAD Forge's `package.json` and `package-lock.json` still
declare the separate registry dependency `@sunbox/occt-import-js@0.0.25`
(`^0.0.25` in `package.json`); that installed dependency is distinct from the
vendored browser runtime documented here.

The local-fork source records OCCT as a submodule:

- OCCT repository: `https://git.dev.opencascade.org/repos/occt.git`
- OCCT submodule commit: `d3056ef80c9668f395da40f5fd7be186cae4501f`

## Licenses

- `occt-import-js` is licensed under GNU LGPL 2.1. See
  `license.occt-import-js.txt`.
- OCCT is licensed under GNU LGPL 2.1 with the Open CASCADE exception. See
  `license.occt.txt` and `OCCT_LGPL_EXCEPTION.txt`.

## Vendored asset hashes

The ECAD Forge vendored assets currently have these SHA-256 hashes:

- `occt-import-js.js`: `56d7372f3b4a8b6251ff807a2c78450b196a8909494f2618e700e5ceec5b09bf`
- `occt-import-js-worker.js`: `d3acf79d58f3235b92faa4f69c4210aede38eeb9d856166f8e347eae52367756`
- `occt-import-js.wasm`: `0cc8b335b8e7429ce208d2f8a4c74e757023e2544d017b2ecb75316dd986fba7`

## Rebuild and replacement notes

To rebuild the importer, unpack the included source archive or check out the
fork at commit `a4837090efa592fab4dc28915b4be94c3f29b527`, then initialize the `occt`
submodule at commit `d3056ef80c9668f395da40f5fd7be186cae4501f`.

The runtime was produced with the source tree's Release configuration.
Release optimization is explicitly `-O3`. With Emscripten available on `PATH`, run
`npm run rebuild:dist`. The underlying cross-platform build script configures
CMake with `-DCMAKE_BUILD_TYPE=Release`, builds the WebAssembly target, runs the
source repository tests, and copies the generated assets into `dist/`.

The Windows helper scripts retained in that source tree are:

- `tools\setup_emscripten_win.bat`
- `tools\build_wasm_win_release.bat`
- `tools\build_wasm_win_dist.bat`

ECAD Forge loads these files as separate browser assets from
`/vendor/occt-import-js/dist/`. A distributor can rebuild compatible
`occt-import-js.js` and `occt-import-js.wasm` files and replace the vendored
files at the same paths. If `occt-import-js-worker.js` is changed, keep the
modified source available with the distribution because it is based on the
LGPL-licensed worker wrapper.
