import { AppControllerParserData } from './AppControllerParserData.mjs'

/**
 * Stores session model assets resolved after a scene starts rendering.
 */
export class AppControllerSessionAssetHandler {
    /**
     * Merges resolved session assets into app state for later reuse.
     * @param {{ documentModel?: object, sessionAssets?: object[] }} change Resolved assets change.
     * @param {{ getSnapshot: () => object, setValue: (key: string, value: any) => object }} state App state.
     * @returns {void}
     */
    static handle(change, state) {
        const snapshot = state.getSnapshot()
        const documentModel = change?.documentModel || null
        if (
            documentModel &&
            !snapshot.documents.some(
                (entry) => entry?.documentModel === documentModel
            )
        ) {
            return
        }

        const sessionAssets = Array.isArray(snapshot.sessionAssets)
            ? snapshot.sessionAssets
            : []
        const resolvedAssets = Array.isArray(change?.sessionAssets)
            ? change.sessionAssets
            : []
        const mergedAssets = AppControllerParserData.mergeSessionAssets(
            sessionAssets,
            resolvedAssets
        )

        if (
            AppControllerSessionAssetHandler.#sessionAssetsChanged(
                sessionAssets,
                mergedAssets
            )
        ) {
            state.setValue('sessionAssets', mergedAssets)
        }
    }

    /**
     * Returns true when resolved assets add or replace session entries.
     * @param {object[]} currentAssets Existing state assets.
     * @param {object[]} resolvedAssets Merged resolved assets.
     * @returns {boolean}
     */
    static #sessionAssetsChanged(currentAssets, resolvedAssets) {
        if (currentAssets.length !== resolvedAssets.length) {
            return true
        }

        return resolvedAssets.some((asset, index) => {
            const current = currentAssets[index] || {}
            return (
                AppControllerSessionAssetHandler.#assetSignature(current) !==
                AppControllerSessionAssetHandler.#assetSignature(asset)
            )
        })
    }

    /**
     * Builds the semantic identity used for scene-resolved model assets.
     * @param {object} asset Session asset.
     * @returns {string}
     */
    static #assetSignature(asset) {
        const file = asset?.file || null
        return JSON.stringify([
            String(asset?.name || ''),
            String(asset?.relativePath || ''),
            String(asset?.format || ''),
            String(asset?.source || ''),
            String(asset?.sourceUrl || ''),
            String(asset?.componentKey || ''),
            Number(file?.size || file?.byteLength || 0)
        ])
    }
}
