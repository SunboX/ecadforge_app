/**
 * Persists the optional missing model search preference.
 */
export class EcadModelSearchPreference {
    /**
     * @returns {string}
     */
    static get STORAGE_KEY() {
        return 'ecadforge.autoSearchMissingModels'
    }

    /**
     * Reads the stored preference.
     * @param {{ getItem?: Function } | null} storage Storage adapter.
     * @returns {boolean}
     */
    static read(storage) {
        try {
            return (
                storage?.getItem?.(EcadModelSearchPreference.STORAGE_KEY) ===
                'true'
            )
        } catch (_error) {
            return false
        }
    }

    /**
     * Writes the stored preference.
     * @param {{ setItem?: Function } | null} storage Storage adapter.
     * @param {boolean} enabled Preference value.
     * @returns {void}
     */
    static write(storage, enabled) {
        try {
            storage?.setItem?.(
                EcadModelSearchPreference.STORAGE_KEY,
                enabled ? 'true' : 'false'
            )
        } catch (_error) {
            // Storage may be unavailable in restricted browser contexts.
        }
    }
}
