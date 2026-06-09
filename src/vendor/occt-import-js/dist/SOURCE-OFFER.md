# occt-import-js and OCCT source guidance

ECAD Forge ships the following browser runtime assets in this directory:

- `occt-import-js.js`
- `occt-import-js-worker.js`
- `occt-import-js.wasm`

These assets provide STEP, BREP, and IGES import support in the browser. They
are based on `occt-import-js@0.0.23` and Open CASCADE Technology (OCCT).

## Upstream sources

- `occt-import-js` npm package: `occt-import-js@0.0.23`
- npm tarball: `https://registry.npmjs.org/occt-import-js/-/occt-import-js-0.0.23.tgz`
- npm integrity: `sha512-RFfYQXYFX5C1mB1Aywm0ShcUKzXOr/VzTnlzhBSDJOR6YCAPt1HYCzeXWg1vwwjn/cUxwqRNhhtf1dlewoZYCQ==`
- npm shasum: `1916aacd5b228e92da5de631ae048ca152281778`
- repository: `https://github.com/kovacsv/occt-import-js`
- release tag: `0.0.23`
- release commit: `c2148e54b456b571238d35cac037d304053d64b2`
- included source archive in this repository: `../../../../occt-import-js-0.0.23.tgz`

The `occt-import-js@0.0.23` release records OCCT as a submodule:

- OCCT repository: `https://git.dev.opencascade.org/repos/occt.git`
- OCCT submodule commit: `d2abb6d844231cb8f29be6894440874a4700e4a5`

## Licenses

- `occt-import-js` is licensed under GNU LGPL 2.1. See
  `license.occt-import-js.txt`.
- OCCT is licensed under GNU LGPL 2.1 with the Open CASCADE exception. See
  `license.occt.txt` and `OCCT_LGPL_EXCEPTION.txt`.

## Vendored asset hashes

The ECAD Forge vendored assets currently have these SHA-256 hashes:

- `occt-import-js.js`: `0e9aa28199ebf6a839d1c8fabc953d611dc38d1ed9552ffce844af15dda33d5f`
- `occt-import-js-worker.js`: `267f441d18b7a19307298d14936f4ac7ef99b7e66a1cec7c407e69753108633b`
- `occt-import-js.wasm`: `17ba02892034c843a66c448732be49dae95a29d3c08fc5f5805c792f84de1f27`

## Rebuild and replacement notes

To rebuild the upstream importer, check out `occt-import-js` commit
`c2148e54b456b571238d35cac037d304053d64b2`, initialize the `occt` submodule
at commit `d2abb6d844231cb8f29be6894440874a4700e4a5`, and follow the upstream
Emscripten/CMake build flow. The Windows helper scripts in that release are:

- `tools\setup_emscripten_win.bat`
- `tools\build_wasm_win_release.bat`
- `tools\build_wasm_win_dist.bat`

ECAD Forge loads these files as separate browser assets from
`/vendor/occt-import-js/dist/`. A distributor can rebuild compatible
`occt-import-js.js` and `occt-import-js.wasm` files and replace the vendored
files at the same paths. If `occt-import-js-worker.js` is changed, keep the
modified source available with the distribution because it is based on the
LGPL-licensed worker wrapper.
