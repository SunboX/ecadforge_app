let importerPromise = null
let occtPromise = null
let wasmBinaryPromise = null

/**
 * Resolves one sibling OCCT runtime asset with the worker cache key.
 * @param {string} fileName Asset file name.
 * @returns {URL}
 */
function ResolveAssetUrl(fileName) {
    const workerUrl = new URL(self.location.href)
    const assetUrl = new URL(fileName, workerUrl)
    assetUrl.search = new URL(self.location.href).search
    return assetUrl
}

/**
 * Loads the ESM-shaped importer module once.
 * @returns {Promise<any>}
 */
function LoadImporterModule() {
    if (importerPromise === null) {
        const importerUrl = ResolveAssetUrl('occt-import-js.js')
        importerPromise = import(importerUrl.href)
    }

    return importerPromise
}

/**
 * Loads the wasm binary once so repeated imports reuse the same bytes.
 * @returns {Promise<ArrayBuffer>}
 */
function GetWasmBinary() {
    if (wasmBinaryPromise === null) {
        const wasmUrl = ResolveAssetUrl('occt-import-js.wasm')
        wasmBinaryPromise = fetch(wasmUrl.href, {
            credentials: 'same-origin'
        }).then(function (response) {
            if (!response.ok) {
                throw new Error(
                    'Failed to load wasm: ' +
                        response.status +
                        ' ' +
                        response.url
                )
            }

            return response.arrayBuffer()
        })
    }

    return wasmBinaryPromise
}

/**
 * Instantiates OCCT wasm using the cached binary.
 * @param {WebAssembly.Imports} imports WebAssembly import object.
 * @param {(instance: WebAssembly.Instance, module: WebAssembly.Module) => void} successCallback Emscripten callback.
 * @returns {object}
 */
function InstantiateWasm(imports, successCallback) {
    GetWasmBinary()
        .then(function (wasmBinary) {
            return WebAssembly.instantiate(wasmBinary, imports)
        })
        .then(function (result) {
            successCallback(result.instance, result.module)
        })
    return {}
}

/**
 * Creates the OCCT importer instance once per worker.
 * @returns {Promise<any>}
 */
function LoadOcct() {
    if (occtPromise === null) {
        occtPromise = LoadImporterModule().then(function (module) {
            const occtFactory = module?.default || module?.occtimportjs
            if (typeof occtFactory !== 'function') {
                throw new Error('occt-import-js did not export a factory.')
            }

            return occtFactory({
                locateFile: function (path) {
                    return ResolveAssetUrl(path).href
                },
                instantiateWasm: InstantiateWasm
            })
        })
    }

    return occtPromise
}

/**
 * Handles one STEP importer worker request.
 * @param {MessageEvent} ev Worker message event.
 * @returns {Promise<void>}
 */
async function HandleMessage(ev) {
    const occt = await LoadOcct()
    const result = occt.ReadFile(ev.data.format, ev.data.buffer, ev.data.params)
    postMessage(result)
}

onmessage = HandleMessage
