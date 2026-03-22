/**
 * Tracks the last requested 3D camera preset while the scene runtime starts.
 */
export class PcbScene3dPresetState {
    /** @type {string} */
    #preset

    constructor() {
        this.#preset = 'isometric'
    }

    /**
     * Stores one normalized preset name.
     * @param {string} preset
     * @returns {string}
     */
    set(preset) {
        this.#preset = PcbScene3dPresetState.#normalize(preset)
        return this.#preset
    }

    /**
     * Returns the last normalized preset name.
     * @returns {string}
     */
    get() {
        return this.#preset
    }

    /**
     * Normalizes one preset name to a supported camera preset.
     * @param {string} preset
     * @returns {string}
     */
    static #normalize(preset) {
        const normalized = String(preset || 'isometric').toLowerCase()
        if (
            normalized === 'top' ||
            normalized === 'bottom' ||
            normalized === 'isometric' ||
            normalized === 'reset'
        ) {
            return normalized
        }

        return 'isometric'
    }
}
