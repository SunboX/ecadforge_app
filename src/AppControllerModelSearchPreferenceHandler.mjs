import { EcadModelSearchPreference } from './core/ecad/EcadModelSearchPreference.mjs'
import { AppControllerParserData } from './AppControllerParserData.mjs'

/**
 * Applies the 3D missing-model search preference from UI controls.
 */
export class AppControllerModelSearchPreferenceHandler {
    /**
     * Applies one preference value to storage and state.
     * @param {boolean} enabled Preference value.
     * @param {{ getSnapshot?: () => object, setValue: (key: string, value: any) => object }} state App state.
     * @param {{ resolveSessionAssets?: (documentModel: object, options: { enabled?: boolean, sessionAssets?: object[] }) => Promise<object[]> } | null} [modelSearchService] Optional model search service.
     * @returns {Promise<void>}
     */
    static async handle(enabled, state, modelSearchService = null) {
        const normalized = enabled === true
        EcadModelSearchPreference.write(
            AppControllerModelSearchPreferenceHandler.#resolveBrowserStorage(),
            normalized
        )
        state.setValue('autoSearchMissingModels', normalized)
        await AppControllerModelSearchPreferenceHandler.#resolveSessionAssets(
            state,
            modelSearchService,
            normalized
        )
    }

    /**
     * Filters and optionally resolves model assets for the active document.
     * @param {{ getSnapshot?: () => object, setValue?: (key: string, value: any) => object }} state App state.
     * @param {{ resolveSessionAssets?: (documentModel: object, options: { enabled?: boolean, sessionAssets?: object[] }) => Promise<object[]> } | null} modelSearchService Optional search service.
     * @param {boolean} enabled Current automatic-search preference.
     * @returns {Promise<void>}
     */
    static async #resolveSessionAssets(state, modelSearchService, enabled) {
        const resolver = modelSearchService?.resolveSessionAssets
        const snapshot = state.getSnapshot?.() || {}
        const documentModel = snapshot.documentModel
        const sessionAssets = Array.isArray(snapshot.sessionAssets)
            ? snapshot.sessionAssets
            : []
        if (!documentModel || typeof resolver !== 'function') return

        try {
            const resolvedAssets = await resolver.call(
                modelSearchService,
                documentModel,
                {
                    enabled,
                    sessionAssets
                }
            )
            const nextSnapshot = state.getSnapshot?.() || {}
            if (
                nextSnapshot.autoSearchMissingModels !== enabled ||
                nextSnapshot.documentModel !== documentModel
            ) {
                return
            }

            const currentAssets = Array.isArray(nextSnapshot.sessionAssets)
                ? nextSnapshot.sessionAssets
                : []
            const mergedAssets = enabled
                ? AppControllerParserData.mergeSessionAssets(
                      currentAssets,
                      Array.isArray(resolvedAssets) ? resolvedAssets : []
                  )
                : Array.isArray(resolvedAssets)
                  ? resolvedAssets
                  : []
            if (
                AppControllerModelSearchPreferenceHandler.#sessionAssetsChanged(
                    currentAssets,
                    mergedAssets
                )
            ) {
                state.setValue?.('sessionAssets', mergedAssets)
            }
        } catch (_error) {
            // Search is optional; failed lookup must not undo the stored opt-in.
        }
    }

    /**
     * Returns true when resolved assets change the stored session assets.
     * @param {object[]} currentAssets Current assets.
     * @param {object[]} resolvedAssets Resolved assets.
     * @returns {boolean}
     */
    static #sessionAssetsChanged(currentAssets, resolvedAssets) {
        if (currentAssets.length !== resolvedAssets.length) {
            return true
        }

        return resolvedAssets.some((asset, index) => {
            const current = currentAssets[index] || {}
            return (
                current.name !== asset.name ||
                current.relativePath !== asset.relativePath ||
                current.format !== asset.format ||
                current.file !== asset.file ||
                current.source !== asset.source ||
                current.sourceUrl !== asset.sourceUrl ||
                current.componentKey !== asset.componentKey ||
                JSON.stringify(current.aliases || []) !==
                    JSON.stringify(asset.aliases || [])
            )
        })
    }

    /**
     * Resolves browser local storage when available.
     * @returns {Storage | null}
     */
    static #resolveBrowserStorage() {
        try {
            return globalThis.localStorage || null
        } catch (_error) {
            return null
        }
    }
}
