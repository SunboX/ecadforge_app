# occt-import-js and OCCT source guidance

ECAD Forge ships the following browser runtime assets in this directory:

- `occt-import-js.js`
- `occt-import-js-worker.js`
- `occt-import-js.wasm`

These assets provide STEP, BREP, and IGES import support in the browser. They
are based on `@sunbox/occt-import-js@0.0.25` and Open CASCADE Technology
(OCCT).

## Upstream sources

- `occt-import-js` npm package: `@sunbox/occt-import-js@0.0.25`
- npm tarball: `https://registry.npmjs.org/@sunbox/occt-import-js/-/occt-import-js-0.0.25.tgz`
- npm integrity: `sha512-Vq+oRZXo6bXRk+ooa4zC9J+L8xqOSxuEEzswh4z8ydc13iZVAzEwlxdFYCFMPnIqKMFmxNm2mW0DxAArqyMyaw==`
- npm shasum: `bc2ef1fd2b193933d9daf068b7fc765ce7e3a7c9`
- repository metadata: `https://github.com/kovacsv/occt-import-js`
- package source commit used for the vendored runtime assets:
  `af7c78e33f3b85f8f84c0243c72b857aa3689ee7`
- included source archive in this repository: `../../../../occt-import-js-0.0.25.tgz`
- included source archive SHA-256:
  `26fc1c5c712fac1c35b98b985aeced6761f2ec8c589818031b1546ac6f27037e`

The `@sunbox/occt-import-js@0.0.25` package source records OCCT as a
submodule:

- OCCT repository: `https://git.dev.opencascade.org/repos/occt.git`
- OCCT submodule commit: `d3056ef80c9668f395da40f5fd7be186cae4501f`

## Licenses

- `occt-import-js` is licensed under GNU LGPL 2.1. See
  `license.occt-import-js.txt`.
- OCCT is licensed under GNU LGPL 2.1 with the Open CASCADE exception. See
  `license.occt.txt` and `OCCT_LGPL_EXCEPTION.txt`.

## Vendored asset hashes

The ECAD Forge vendored assets currently have these SHA-256 hashes:

- `occt-import-js.js`: `942df5f04d8253858ba559332afe45ea40e3fb1141998950b9d631f53def0f21`
- `occt-import-js-worker.js`: `d3acf79d58f3235b92faa4f69c4210aede38eeb9d856166f8e347eae52367756`
- `occt-import-js.wasm`: `e8fcc9e9ec4a45395611504ecf130d991a08d2a09504315206865aa18f015f2d`

## Rebuild and replacement notes

To rebuild the importer, unpack the included source archive or check out the
package source tree at commit
`af7c78e33f3b85f8f84c0243c72b857aa3689ee7`, initialize the `occt` submodule
at commit `d3056ef80c9668f395da40f5fd7be186cae4501f`, and follow the upstream
Emscripten/CMake build flow. The Windows helper scripts in that source tree
are:

- `tools\setup_emscripten_win.bat`
- `tools\build_wasm_win_release.bat`
- `tools\build_wasm_win_dist.bat`

ECAD Forge loads these files as separate browser assets from
`/vendor/occt-import-js/dist/`. A distributor can rebuild compatible
`occt-import-js.js` and `occt-import-js.wasm` files and replace the vendored
files at the same paths. If `occt-import-js-worker.js` is changed, keep the
modified source available with the distribution because it is based on the
LGPL-licensed worker wrapper.
