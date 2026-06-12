import { EcadModelSearchPreference } from './core/ecad/EcadModelSearchPreference.mjs'

/**
 * Applies the 3D missing-model search preference from UI controls.
 */
export class AppControllerModelSearchPreferenceHandler {
    /**
     * Applies one preference value to storage and state.
     * @param {boolean} enabled Preference value.
     * @param {{ setValue: (key: string, value: any) => object }} state App state.
     * @returns {void}
     */
    static handle(enabled, state) {
        const normalized = enabled === true
        EcadModelSearchPreference.write(
            AppControllerModelSearchPreferenceHandler.#resolveBrowserStorage(),
            normalized
        )
        state.setValue('autoSearchMissingModels', normalized)
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
