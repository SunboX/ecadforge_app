# Attribution and notices

Original project by André Fiedler / SunboX.

Original source: https://github.com/SunboX/ecadforge_app

Copyright (C) 2026 André Fiedler.

When redistributing this project, modified versions, binaries, packaged
applications, or larger works based on this project, preserve the following as
required by the applicable license:

- copyright notices;
- license notices;
- SPDX license identifiers;
- source-origin notices;
- this attribution/notice file, where applicable.

For applications with an "About", "Licenses", or "Legal Notices" screen,
include a reasonable reference to this project and its original author there.

Third-party package dependencies retain their own notices and license terms.
The installed `@sunbox/occt-import-js` package is based on Open CASCADE
Technology. Its published package preserves the LGPL notices and OCCT exception
in:

- `node_modules/@sunbox/occt-import-js/dist/license.occt-import-js.txt`;
- `node_modules/@sunbox/occt-import-js/dist/license.occt.txt`;
- `node_modules/@sunbox/occt-import-js/dist/OCCT_LGPL_EXCEPTION.txt`.

The deployed importer corresponds to
`@sunbox/occt-import-js` tag `0.0.28` and commit
`2b4fe0d9ff0b2ffffb361475a869f0de51547f10`:
https://github.com/SunboX/occt-import-js/tree/0.0.28. That source tree pins its
OCCT submodule to commit `d3056ef80c9668f395da40f5fd7be186cae4501f`:
https://github.com/SunboX/OCCT/commit/d3056ef80c9668f395da40f5fd7be186cae4501f.
The reproducible WASM rebuild instructions and release script are documented at
https://github.com/SunboX/occt-import-js/blob/0.0.28/README.md#how-to-build-on-windows.
The repository also preserves the OCCT exception at
`LICENSES/LicenseRef-OCCT-exception-1.0.txt`.

Package-manager dependencies retain their own licenses.
