import { EcadDocumentComponents } from './EcadDocumentComponents.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Searches for missing PCB 3D model assets through an injected source client.
 */
export class EcadMissingModelSearchService {
    #cache

    #client

    #concurrencyLimit

    /**
     * @param {{ client?: { searchComponents?: Function, fetchComponentBundle?: Function, fetchBinaryAsset?: Function, fetchComponentModel?: Function } | null, concurrencyLimit?: number }} [options] Service options.
     */
    constructor(options = {}) {
        this.#client = options.client || null
        this.#cache = new Map()
        this.#concurrencyLimit = Math.max(
            1,
            Math.min(12, Number(options.concurrencyLimit) || 6)
        )
    }

    /**
     * Resolves session assets, optionally adding downloaded model assets.
     * @param {object} documentModel PCB document model.
     * @param {{ enabled?: boolean, sessionAssets?: object[] }} [options] Lookup options.
     * @returns {Promise<object[]>}
     */
    async resolveSessionAssets(documentModel, options = {}) {
        const sessionAssets = Array.isArray(options.sessionAssets)
            ? options.sessionAssets
            : []
        if (!options.enabled || !this.#client) {
            return sessionAssets
        }

        const downloadedAssets = await this.#resolveComponentAssets(
            this.#findUnresolvedComponents(documentModel, sessionAssets)
        )

        return downloadedAssets.length
            ? [...sessionAssets, ...downloadedAssets]
            : sessionAssets
    }

    /**
     * Resolves missing assets with bounded parallelism.
     * @param {object[]} components Components to resolve.
     * @returns {Promise<object[]>}
     */
    async #resolveComponentAssets(components) {
        const uniqueComponents =
            EcadMissingModelSearchService.#uniqueComponentsBySearchTerm(
                components
            )
        const assets = []

        for (
            let index = 0;
            index < uniqueComponents.length;
            index += this.#concurrencyLimit
        ) {
            const batch = uniqueComponents.slice(
                index,
                index + this.#concurrencyLimit
            )
            const batchAssets = await Promise.all(
                batch.map((component) =>
                    this.#resolveComponentAssetWithoutThrowing(component)
                )
            )
            assets.push(...batchAssets.filter(Boolean))
        }

        return assets
    }

    /**
     * Finds components whose model is not already present in session assets.
     * @param {object} documentModel PCB document model.
     * @param {object[]} sessionAssets Existing session assets.
     * @returns {object[]}
     */
    #findUnresolvedComponents(documentModel, sessionAssets) {
        const components = EcadFormatRegistry.isCircuitJsonDocument(
            documentModel
        )
            ? EcadMissingModelSearchService.#canonicalComponents(documentModel)
            : Array.isArray(documentModel?.pcb?.components)
              ? documentModel.pcb.components
              : []

        return components.filter(
            (component) =>
                !EcadMissingModelSearchService.#isExcludedFromModelSearch(
                    component
                ) &&
                EcadMissingModelSearchService.#searchTermForComponent(
                    component
                ) &&
                !EcadMissingModelSearchService.#hasMatchingAsset(
                    component,
                    sessionAssets
                )
        )
    }

    /**
     * Projects canonical source, placement, and CAD elements into the existing
     * model-source client contract.
     * @param {object} documentModel Canonical CircuitJSON document.
     * @returns {object[]}
     */
    static #canonicalComponents(documentModel) {
        const elements =
            EcadFormatRegistry.circuitJsonElementsForDocument(documentModel)
        const sourceById = new Map(
            elements
                .filter((element) => element?.type === 'source_component')
                .map((source) => [source.source_component_id, source])
        )
        const pcbBySourceId = new Map(
            elements
                .filter((element) => element?.type === 'pcb_component')
                .map((pcb) => [pcb.source_component_id, pcb])
        )
        const cadByPcbId = new Map()
        for (const cad of elements.filter(
            (element) => element?.type === 'cad_component'
        )) {
            const pcbComponentId = String(cad.pcb_component_id || '')
            if (pcbComponentId && !cadByPcbId.has(pcbComponentId)) {
                cadByPcbId.set(pcbComponentId, cad)
            }
        }

        return EcadDocumentComponents.resolve(documentModel).map((row) => {
            const source = sourceById.get(row.sourceComponentId) || {}
            const pcb = pcbBySourceId.get(row.sourceComponentId) || {}
            const cad = cadByPcbId.get(row.pcbComponentId) || {}
            const modelPath =
                EcadMissingModelSearchService.#canonicalModelPath(cad)
            const excludeFromBom = Boolean(
                pcb?.metadata?.kicad_footprint?.attributes?.exclude_from_bom
            )
            return {
                ...row,
                modelName: modelPath.split('/').at(-1) || '',
                modelPath,
                doNotPopulate: pcb.do_not_place === true,
                includeInBom: !excludeFromBom,
                componentKind: source.ftype || '',
                description: source.description || row.description || ''
            }
        })
    }

    /**
     * Resolves the first authored model location from a CAD component.
     * @param {object} cad CAD component element.
     * @returns {string}
     */
    static #canonicalModelPath(cad) {
        const asset = cad?.model_asset || {}
        return String(
            asset.project_relative_path ||
                asset.url ||
                cad?.model_step_url ||
                cad?.model_wrl_url ||
                cad?.model_glb_url ||
                cad?.model_gltf_url ||
                cad?.model_stl_url ||
                cad?.model_obj_url ||
                cad?.model_3mf_url ||
                ''
        ).trim()
    }

    /**
     * Resolves one component asset and skips transient source failures.
     * @param {object} component PCB component.
     * @returns {Promise<object | null>}
     */
    async #resolveComponentAssetWithoutThrowing(component) {
        try {
            return await this.#resolveComponentAsset(component)
        } catch (_error) {
            return null
        }
    }

    /**
     * Resolves one component asset, using the in-memory cache when possible.
     * @param {object} component PCB component.
     * @returns {Promise<object | null>}
     */
    async #resolveComponentAsset(component) {
        const term =
            EcadMissingModelSearchService.#searchTermForComponent(component)
        if (!term) {
            return null
        }

        if (this.#cache.has(term)) {
            return this.#cache.get(term)
        }

        const asset = await this.#downloadComponentAsset(component, term)
        this.#cache.set(term, asset)
        return asset
    }

    /**
     * Downloads the first usable model for one component search term.
     * @param {object} component PCB component.
     * @param {string} term Search term.
     * @returns {Promise<object | null>}
     */
    async #downloadComponentAsset(component, term) {
        const directModel = await this.#fetchDirectComponentModel(
            component,
            term
        )
        if (directModel) {
            return EcadMissingModelSearchService.#assetForModel(
                component,
                directModel
            )
        }

        if (
            typeof this.#client.searchComponents !== 'function' ||
            typeof this.#client.fetchComponentBundle !== 'function'
        ) {
            return null
        }

        const rows = await this.#client.searchComponents(term, { limit: 1 })
        const firstId = String(rows?.[0]?.id || '')
        if (!firstId) {
            return null
        }

        const bundle = await this.#client.fetchComponentBundle(firstId)
        const model = Array.isArray(bundle?.models) ? bundle.models[0] : null
        if (!model) {
            return null
        }

        const bytes = await this.#resolveModelBytes(model)
        if (!bytes.byteLength) {
            return null
        }

        return EcadMissingModelSearchService.#assetForModel(component, {
            ...model,
            bytes
        })
    }

    /**
     * Fetches a model directly from component metadata when the client supports
     * it.
     * @param {object} component PCB component.
     * @param {string} term Search term.
     * @returns {Promise<object | null>}
     */
    async #fetchDirectComponentModel(component, term) {
        if (typeof this.#client.fetchComponentModel !== 'function') {
            return null
        }

        const model = await this.#client.fetchComponentModel(component, {
            term
        })
        return model && model.bytes instanceof Uint8Array ? model : null
    }

    /**
     * Builds a session asset descriptor for a downloaded model.
     * @param {object} component PCB component.
     * @param {object} model Downloaded model.
     * @returns {object}
     */
    static #assetForModel(component, model) {
        const fileName = EcadMissingModelSearchService.#assetNameForComponent(
            component,
            model
        )

        return {
            name: fileName,
            relativePath:
                String(model?.relativePath || '').trim() ||
                String(component?.modelPath || '').trim() ||
                fileName,
            file: EcadMissingModelSearchService.#createBlob(
                model.bytes,
                model.format
            ),
            format:
                EcadMissingModelSearchService.#normalizeFormat(model?.format) ||
                EcadMissingModelSearchService.#formatForName(fileName),
            source: 'model-search',
            componentKey: String(component?.designator || '')
        }
    }

    /**
     * Resolves model bytes, including deferred client asset downloads.
     * @param {object} model Model descriptor.
     * @returns {Promise<Uint8Array>}
     */
    async #resolveModelBytes(model) {
        if (model.bytes instanceof Uint8Array) {
            return model.bytes
        }

        if (
            model.sourceUrl &&
            typeof this.#client.fetchBinaryAsset === 'function'
        ) {
            return this.#client.fetchBinaryAsset(model.sourceUrl)
        }

        if (typeof model.text === 'string') {
            return new TextEncoder().encode(model.text)
        }

        return new Uint8Array(0)
    }

    /**
     * Resolves the model search term for one component.
     * @param {object} component PCB component.
     * @returns {string}
     */
    static #searchTermForComponent(component) {
        const modelBaseName = String(component?.modelPath || '')
            .replaceAll('\\', '/')
            .split('/')
            .filter(Boolean)
            .at(-1)
            ?.replace(/\.[^.]+$/u, '')

        return String(
            modelBaseName || component?.pattern || component?.source || ''
        ).trim()
    }

    /**
     * Returns true when a component is marked as not fitted in assembly.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #isDoNotPopulateComponent(component) {
        return (
            component?.doNotPopulate === true ||
            component?.dnp === true ||
            component?.dns === true
        )
    }

    /**
     * Returns true when a component should not trigger automatic model lookup.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #isExcludedFromModelSearch(component) {
        return (
            EcadMissingModelSearchService.#isDoNotPopulateComponent(
                component
            ) ||
            EcadMissingModelSearchService.#isNoBomComponent(component) ||
            EcadMissingModelSearchService.#isTestPointComponent(component) ||
            EcadMissingModelSearchService.#isBoardMarkerComponent(component)
        )
    }

    /**
     * Returns true when component metadata marks the row as excluded from BOM.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #isNoBomComponent(component) {
        if (
            component?.includeInBom === false ||
            component?.componentKind?.includeInBom === false
        ) {
            return true
        }

        return [
            component?.componentKind?.name,
            component?.componentKind?.displayName,
            component?.componentKind
        ].some((value) =>
            /\bno[\s_-]*bom\b|standard[\s_-]*no[\s_-]*bom/iu.test(
                String(value || '')
            )
        )
    }

    /**
     * Returns true for PCB test points that would resolve to unrelated parts.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #isTestPointComponent(component) {
        const designator = String(component?.designator || '').trim()
        if (!/^TP[0-9A-Z]*$/iu.test(designator)) {
            return false
        }

        const searchableText = [
            component?.pattern,
            component?.source,
            component?.description,
            component?.value,
            component?.comment
        ].join(' ')

        return /test[\s_-]*point|testpoint|\btp[\s_-]*pad\b/iu.test(
            searchableText
        )
    }

    /**
     * Returns true for board markers that are not physical assembled parts.
     * @param {object} component PCB component.
     * @returns {boolean}
     */
    static #isBoardMarkerComponent(component) {
        const searchableText = [
            component?.pattern,
            component?.source,
            component?.description,
            component?.value,
            component?.comment
        ].join(' ')

        return /(^|[^a-z0-9])fiducial([^a-z0-9]|$)/iu.test(searchableText)
    }

    /**
     * Returns true when session assets already match one component.
     * @param {object} component PCB component.
     * @param {object[]} sessionAssets Existing assets.
     * @returns {boolean}
     */
    static #hasMatchingAsset(component, sessionAssets) {
        const expected = EcadMissingModelSearchService.#normalizeToken(
            EcadMissingModelSearchService.#searchTermForComponent(component)
        )
        if (!expected) {
            return false
        }

        return sessionAssets.some((asset) => {
            const name = String(asset?.relativePath || asset?.name || '')
                .split('/')
                .pop()
                ?.replace(/\.[^.]+$/u, '')

            return (
                EcadMissingModelSearchService.#normalizeToken(name) === expected
            )
        })
    }

    /**
     * Keeps one representative component for each search term.
     * @param {object[]} components Components.
     * @returns {object[]}
     */
    static #uniqueComponentsBySearchTerm(components) {
        const seenTerms = new Set()
        const uniqueComponents = []
        for (const component of components) {
            const term =
                EcadMissingModelSearchService.#searchTermForComponent(component)
            if (!term || seenTerms.has(term)) {
                continue
            }
            seenTerms.add(term)
            uniqueComponents.push(component)
        }
        return uniqueComponents
    }

    /**
     * Resolves the downloaded file name used by the model registry.
     * @param {object} component PCB component.
     * @param {object} model Downloaded model.
     * @returns {string}
     */
    static #assetNameForComponent(component, model) {
        const explicitName = String(component?.modelPath || '')
            .replaceAll('\\', '/')
            .split('/')
            .filter(Boolean)
            .at(-1)
        if (explicitName) {
            return explicitName
        }

        const extension = EcadMissingModelSearchService.#extensionForFormat(
            model?.format
        )
        const baseName = String(component?.pattern || model?.name || 'model')
            .replace(/\.[^.]+$/u, '')
            .replace(/[\\/:\u0000-\u001f]/gu, '_')

        return baseName + extension
    }

    /**
     * Creates a browser Blob when available.
     * @param {Uint8Array} bytes Model bytes.
     * @param {string} format Model format.
     * @returns {Blob | Uint8Array}
     */
    static #createBlob(bytes, format) {
        if (typeof Blob === 'function') {
            return new Blob([bytes], {
                type: format === 'wrl' ? 'model/vrml' : 'model/step'
            })
        }

        return bytes
    }

    /**
     * Resolves a supported format from one file name.
     * @param {string} fileName File name.
     * @returns {string}
     */
    static #formatForName(fileName) {
        return String(fileName || '')
            .toLowerCase()
            .endsWith('.wrl')
            ? 'wrl'
            : 'step'
    }

    /**
     * Resolves an extension from one format id.
     * @param {string} format Format id.
     * @returns {string}
     */
    static #extensionForFormat(format) {
        return String(format || '').toLowerCase() === 'wrl' ? '.wrl' : '.step'
    }

    /**
     * Normalizes a supported model format id.
     * @param {string | undefined} format Format id.
     * @returns {string}
     */
    static #normalizeFormat(format) {
        const normalized = String(format || '').toLowerCase()
        if (normalized === 'wrl' || normalized === 'vrml') {
            return 'wrl'
        }
        if (normalized === 'step' || normalized === 'stp') {
            return 'step'
        }
        return ''
    }

    /**
     * Normalizes a lookup token.
     * @param {string | undefined} value Raw value.
     * @returns {string}
     */
    static #normalizeToken(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '')
    }
}
