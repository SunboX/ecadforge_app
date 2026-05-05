const assetVersion = '?v=20260323-1'

importScripts(`occt-import-js.js${assetVersion}`)

let wasmBinaryPromise = null

function GetWasmBinary() {
    if (wasmBinaryPromise === null) {
        wasmBinaryPromise = fetch(`occt-import-js.wasm${assetVersion}`, {
            credentials: 'same-origin'
        }).then(function (response) {
            if (!response.ok) {
                throw new Error(`Failed to load wasm: ${response.status} ${response.url}`)
            }
            return response.arrayBuffer()
        })
    }
    return wasmBinaryPromise
}

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

onmessage = async function (ev) {
    let modulOverrides = {
        locateFile: function (path) {
            return path
        },
        instantiateWasm: InstantiateWasm
    }
    let occt = await occtimportjs(modulOverrides)
    let result = occt.ReadFile(ev.data.format, ev.data.buffer, ev.data.params)
    postMessage(result)
}
