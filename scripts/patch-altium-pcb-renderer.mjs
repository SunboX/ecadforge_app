import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Applies local Altium PCB parser and renderer patches until upstream
 * altium-toolkit includes them.
 */
class AltiumPcbPatcher {
    static #viaPayloadOriginal = '    static #VIA_PAYLOAD_MIN_BYTE_LENGTH = 321'

    static #viaPayloadPatched = '    static #VIA_PAYLOAD_MIN_BYTE_LENGTH = 209'

    static #rawViaDescriptorOriginal =
        '                fixedRecordByteLength: 326,\n' +
        '                minimumPayloadByteLength: 321,\n' +
        "                lengthPrefixedView: 'record',"

    static #rawViaDescriptorPatched =
        '                fixedRecordByteLength: 326,\n' +
        '                minimumPayloadByteLength: 209,\n' +
        "                lengthPrefixedView: 'record',"

    static #libViaDescriptorOriginal =
        "            collection: 'vias',\n" +
        '            minimumSubrecordCount: 1,\n' +
        '            minimumPayloadByteLength: 321,\n' +
        "            parser: 'parseViaStream'"

    static #libViaDescriptorPatched =
        "            collection: 'vias',\n" +
        '            minimumSubrecordCount: 1,\n' +
        '            minimumPayloadByteLength: 209,\n' +
        "            parser: 'parseViaStream'"

    static #modelLayerCountOriginal =
        '                layerCount: layers.length,'

    static #modelLayerCountPatched =
        '                layerCount: layers.length || primitiveLayers.length,'

    static #textComponentIndexOriginal =
        '    static #textComponentIndex(text) {\n' +
        '        const componentIndex = Number(text?.componentIndex)\n' +
        '        if (Number.isInteger(componentIndex)) {\n' +
        '            return componentIndex\n' +
        '        }\n' +
        '\n' +
        '        const ownerIndex = Number(text?.ownerIndex)\n' +
        '        return Number.isInteger(ownerIndex) ? ownerIndex : null\n' +
        '    }'

    static #textComponentIndexPatched =
        '    static #textComponentIndex(text) {\n' +
        '        if (text?.componentIndex !== null && text?.componentIndex !== undefined) {\n' +
        '            const componentIndex = Number(text.componentIndex)\n' +
        '            if (Number.isInteger(componentIndex)) {\n' +
        '                return componentIndex\n' +
        '            }\n' +
        '        }\n' +
        '\n' +
        '        if (text?.ownerIndex === null || text?.ownerIndex === undefined) {\n' +
        '            return null\n' +
        '        }\n' +
        '\n' +
        '        const ownerIndex = Number(text.ownerIndex)\n' +
        '        return Number.isInteger(ownerIndex) ? ownerIndex : null\n' +
        '    }'

    static #rendererLayerSetupOriginal =
        '        const components = pcb.components.slice(0, 260)\n' +
        '        const texts = PcbTextPrimitiveRenderer.select(\n' +
        '            pcb.primitiveLayers || [],\n' +
        '            pcb.texts || [],\n' +
        "            'top'\n" +
        '        )'

    static #rendererLayerSetupPatched =
        '        const components = pcb.components.slice(0, 260)\n' +
        '        const stackLayers = Array.isArray(pcb.layers) ? pcb.layers : []\n' +
        '        const primitiveLayers = pcb.primitiveLayers || []\n' +
        '        const displayLayers = stackLayers.length ? stackLayers : primitiveLayers\n' +
        '        const texts = PcbTextPrimitiveRenderer.select(\n' +
        '            primitiveLayers,\n' +
        '            pcb.texts || [],\n' +
        "            'top'\n" +
        '        )'

    static #rendererFootprintLayersOriginal =
        '            PcbFootprintPrimitiveSelector.select(\n' +
        '                pcb.primitiveLayers || [],'

    static #rendererFootprintLayersPatched =
        '            PcbFootprintPrimitiveSelector.select(\n' +
        '                primitiveLayers,'

    static #rendererLayerMarkupOriginal =
        '        const layerMarkup = pcb.layers'

    static #rendererLayerMarkupPatched =
        '        const layerMarkup = displayLayers'

    static #rendererLayerCountOriginal = '            pcb.layers.length +'

    static #rendererLayerCountPatched = '            displayLayers.length +'

    /**
     * Applies local Altium PCB dependency patches.
     * @returns {Promise<void>}
     */
    static async run() {
        if (await AltiumPcbPatcher.#usesUpstreamPatch()) {
            return
        }

        await AltiumPcbPatcher.#patchFile(
            AltiumPcbPatcher.#resolveSourcePath(
                'src',
                'core',
                'altium',
                'PcbViaPrimitiveParser.mjs'
            ),
            [
                {
                    original: AltiumPcbPatcher.#viaPayloadOriginal,
                    patched: AltiumPcbPatcher.#viaPayloadPatched,
                    label: 'compact via payload minimum'
                }
            ]
        )
        await AltiumPcbPatcher.#patchFile(
            AltiumPcbPatcher.#resolveSourcePath(
                'src',
                'core',
                'altium',
                'PcbRawRecordRegistry.mjs'
            ),
            [
                {
                    original: AltiumPcbPatcher.#rawViaDescriptorOriginal,
                    patched: AltiumPcbPatcher.#rawViaDescriptorPatched,
                    label: 'raw compact via descriptor'
                }
            ]
        )
        await AltiumPcbPatcher.#patchFile(
            AltiumPcbPatcher.#resolveSourcePath(
                'src',
                'core',
                'altium',
                'PcbLibStreamExtractor.mjs'
            ),
            [
                {
                    original: AltiumPcbPatcher.#libViaDescriptorOriginal,
                    patched: AltiumPcbPatcher.#libViaDescriptorPatched,
                    label: 'library compact via descriptor'
                }
            ]
        )
        await AltiumPcbPatcher.#patchFile(
            AltiumPcbPatcher.#resolveSourcePath(
                'src',
                'core',
                'altium',
                'PcbModelParser.mjs'
            ),
            [
                {
                    original: AltiumPcbPatcher.#modelLayerCountOriginal,
                    patched: AltiumPcbPatcher.#modelLayerCountPatched,
                    label: 'primitive layer summary fallback'
                }
            ]
        )
        await AltiumPcbPatcher.#patchFile(
            AltiumPcbPatcher.#resolveSourcePath(
                'src',
                'core',
                'altium',
                'PcbComponentAnnotationNormalizer.mjs'
            ),
            [
                {
                    original: AltiumPcbPatcher.#textComponentIndexOriginal,
                    patched: AltiumPcbPatcher.#textComponentIndexPatched,
                    label: 'unowned PCB text visibility'
                }
            ]
        )
        await AltiumPcbPatcher.#patchFile(
            AltiumPcbPatcher.#resolveSourcePath(
                'src',
                'ui',
                'PcbSvgRenderer.mjs'
            ),
            [
                {
                    original: AltiumPcbPatcher.#rendererLayerSetupOriginal,
                    patched: AltiumPcbPatcher.#rendererLayerSetupPatched,
                    label: 'PCB renderer layer fallback setup'
                },
                {
                    original: AltiumPcbPatcher.#rendererFootprintLayersOriginal,
                    patched: AltiumPcbPatcher.#rendererFootprintLayersPatched,
                    label: 'PCB renderer footprint layer fallback'
                },
                {
                    original: AltiumPcbPatcher.#rendererLayerMarkupOriginal,
                    patched: AltiumPcbPatcher.#rendererLayerMarkupPatched,
                    label: 'PCB renderer layer legend fallback'
                },
                {
                    original: AltiumPcbPatcher.#rendererLayerCountOriginal,
                    patched: AltiumPcbPatcher.#rendererLayerCountPatched,
                    label: 'PCB renderer layer count fallback'
                }
            ]
        )
    }

    /**
     * Applies a list of required source replacements to one file.
     * @param {string} sourcePath File path to patch.
     * @param {{ original: string, patched: string, label: string }[]} replacements
     * Patch descriptors.
     * @returns {Promise<void>}
     */
    static async #patchFile(sourcePath, replacements) {
        const originalSource = await readFile(sourcePath, 'utf8')
        let source = originalSource

        for (const replacement of replacements) {
            source = AltiumPcbPatcher.#replaceOnceIfMissing({
                source,
                ...replacement
            })
        }

        if (source !== originalSource) {
            await writeFile(sourcePath, source)
        }
    }

    /**
     * Replaces one source block unless the patched block already exists.
     * @param {{ source: string, original: string, patched: string, label: string }} options
     * Replacement options.
     * @returns {string}
     */
    static #replaceOnceIfMissing(options) {
        if (options.source.includes(options.patched)) {
            return options.source
        }

        if (!options.source.includes(options.original)) {
            throw new Error(
                'Unable to patch altium-toolkit: expected ' +
                    options.label +
                    ' block was not found.'
            )
        }

        return options.source.replace(options.original, options.patched)
    }

    /**
     * Returns true when installed altium-toolkit already includes these fixes.
     * @returns {Promise<boolean>}
     */
    static async #usesUpstreamPatch() {
        const packageJson = JSON.parse(
            await readFile(
                AltiumPcbPatcher.#resolveSourcePath('package.json'),
                'utf8'
            )
        )

        return AltiumPcbPatcher.#isAtLeastVersion(
            String(packageJson.version || ''),
            '0.1.19'
        )
    }

    /**
     * Compares semantic versions by major, minor, and patch.
     * @param {string} version Current version.
     * @param {string} minimum Required minimum.
     * @returns {boolean}
     */
    static #isAtLeastVersion(version, minimum) {
        const currentParts = AltiumPcbPatcher.#versionParts(version)
        const minimumParts = AltiumPcbPatcher.#versionParts(minimum)

        for (let index = 0; index < minimumParts.length; index += 1) {
            if (currentParts[index] > minimumParts[index]) return true
            if (currentParts[index] < minimumParts[index]) return false
        }

        return true
    }

    /**
     * Extracts comparable semver number parts.
     * @param {string} version Version string.
     * @returns {number[]}
     */
    static #versionParts(version) {
        return String(version)
            .split(/[.-]/u)
            .slice(0, 3)
            .map((part) => Number(part) || 0)
    }

    /**
     * Resolves an installed altium-toolkit path.
     * @param {...string} parts Path parts below the package root.
     * @returns {string}
     */
    static #resolveSourcePath(...parts) {
        return path.resolve(
            AltiumPcbPatcher.#rootDirectory(),
            'node_modules',
            'altium-toolkit',
            ...parts
        )
    }

    /**
     * Resolves the repository root from this script location.
     * @returns {string}
     */
    static #rootDirectory() {
        return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    }
}

await AltiumPcbPatcher.run()
