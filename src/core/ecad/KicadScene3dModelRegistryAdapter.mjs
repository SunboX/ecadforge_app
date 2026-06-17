import { PcbScene3dModelRegistry as KicadScene3dModelRegistry } from 'kicad-toolkit/scene3d'

/**
 * Resolves KiCad model assets with exact path and extension priority.
 */
export class KicadScene3dModelRegistryAdapter extends KicadScene3dModelRegistry {
    /** @type {object[]} */
    #assets

    /**
     * @param {object[]} sessionAssets Session model assets.
     */
    constructor(sessionAssets = []) {
        super({ sessionAssets })
        this.#assets = Array.from(sessionAssets || [])
    }

    /**
     * Returns registered session assets.
     * @returns {object[]}
     */
    get assets() {
        return [...this.#assets]
    }

    /**
     * Finds a companion asset for a component.
     * @param {object} component Component placement.
     * @returns {object | null}
     */
    resolveForComponent(component) {
        return (
            KicadScene3dModelRegistryAdapter.#findExactAsset(
                this.#assets,
                component
            ) ||
            KicadScene3dModelRegistryAdapter.#findFallbackAsset(
                this.#assets,
                component
            )
        )
    }

    /**
     * Resolves a component model using the shared viewer method name.
     * @param {object} component Component placement.
     * @returns {object | null}
     */
    resolveComponentModel(component) {
        return this.resolveForComponent(component)
    }

    /**
     * Resolves a body model when the viewer asks through Altium-style APIs.
     * @returns {null}
     */
    resolveComponentBodyModel() {
        return null
    }

    /**
     * Finds an asset whose path or basename exactly matches the KiCad model reference.
     * @param {object[]} assets Session assets.
     * @param {object} component Component placement.
     * @returns {object | null}
     */
    static #findExactAsset(assets, component) {
        const references =
            KicadScene3dModelRegistryAdapter.#exactReferences(component)

        for (const reference of references) {
            const matchedAsset = (assets || []).find((asset) =>
                KicadScene3dModelRegistryAdapter.#assetMatchesReference(
                    asset,
                    reference
                )
            )
            if (matchedAsset) {
                return matchedAsset
            }
        }

        return null
    }

    /**
     * Finds a same-stem fallback asset using the dependency registry behavior.
     * @param {object[]} assets Session assets.
     * @param {object} component Component placement.
     * @returns {object | null}
     */
    static #findFallbackAsset(assets, component) {
        const keys = [
            component?.modelName,
            component?.modelPath,
            component?.pattern,
            component?.source,
            component?.description
        ]
            .filter(Boolean)
            .map((value) => KicadScene3dModelRegistryAdapter.#modelStem(value))
            .filter(Boolean)

        if (!keys.length) {
            return null
        }

        return (
            (assets || []).find((asset) => {
                const assetStems =
                    KicadScene3dModelRegistryAdapter.#assetStems(asset)
                return keys.some((key) => assetStems.includes(key))
            }) || null
        )
    }

    /**
     * Builds exact file references from explicit KiCad model fields.
     * @param {object} component Component placement.
     * @returns {string[]}
     */
    static #exactReferences(component) {
        const references = [component?.modelPath, component?.modelName]
            .filter(Boolean)
            .map((value) =>
                KicadScene3dModelRegistryAdapter.#normalizePath(value)
            )
            .filter((value) =>
                KicadScene3dModelRegistryAdapter.#hasModelExtension(value)
            )

        return [...new Set(references)]
    }

    /**
     * Checks whether one asset matches an exact normalized reference.
     * @param {object} asset Session asset.
     * @param {string} reference Normalized model reference.
     * @returns {boolean}
     */
    static #assetMatchesReference(asset, reference) {
        const referenceBase =
            KicadScene3dModelRegistryAdapter.#baseName(reference)
        return KicadScene3dModelRegistryAdapter.#assetPaths(asset).some(
            (assetPath) => {
                const assetBase =
                    KicadScene3dModelRegistryAdapter.#baseName(assetPath)
                return (
                    assetPath === reference ||
                    assetPath.endsWith('/' + reference) ||
                    assetBase === referenceBase
                )
            }
        )
    }

    /**
     * Returns normalized asset path candidates.
     * @param {object} asset Session asset.
     * @returns {string[]}
     */
    static #assetPaths(asset) {
        return [asset?.relativePath, asset?.path, asset?.name, asset?.sourceUrl]
            .filter(Boolean)
            .map((value) =>
                KicadScene3dModelRegistryAdapter.#normalizePath(value)
            )
            .filter(Boolean)
    }

    /**
     * Returns normalized stem candidates for one asset.
     * @param {object} asset Session asset.
     * @returns {string[]}
     */
    static #assetStems(asset) {
        return [asset?.name, asset?.path, asset?.relativePath, asset?.sourceUrl]
            .filter(Boolean)
            .map((value) => KicadScene3dModelRegistryAdapter.#modelStem(value))
            .filter(Boolean)
    }

    /**
     * Normalizes one model reference or path.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #normalizePath(value) {
        return String(value || '')
            .replace(/\\/gu, '/')
            .replace(/\$\{KIPRJMOD\}\//giu, '')
            .replace(/\$\{[^}]+\}\//gu, '')
            .replace(/^\.\/+/u, '')
            .replace(/\/+/gu, '/')
            .toLowerCase()
    }

    /**
     * Returns the basename of a slash-normalized path.
     * @param {string} value Path value.
     * @returns {string}
     */
    static #baseName(value) {
        return KicadScene3dModelRegistryAdapter.#normalizePath(value)
            .split('/')
            .pop()
    }

    /**
     * Returns the lowercase model stem from a reference or path.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #modelStem(value) {
        return KicadScene3dModelRegistryAdapter.#baseName(value).replace(
            /\.(?:step|stp|wrl|vrml)$/iu,
            ''
        )
    }

    /**
     * Returns true when a normalized path has a supported 3D model extension.
     * @param {string} value Normalized path.
     * @returns {boolean}
     */
    static #hasModelExtension(value) {
        return /\.(?:step|stp|wrl|vrml)$/iu.test(String(value || ''))
    }
}
