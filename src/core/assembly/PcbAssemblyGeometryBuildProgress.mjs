/**
 * Tracks measured progress while PCB assembly meshes are built.
 */
export class PcbAssemblyGeometryBuildProgress {
    /** @type {((progress: { value: number, message: string }) => void) | null} */
    #onProgress

    /** @type {number} */
    #totalUnits

    /** @type {number} */
    #completedUnits

    /** @type {number} */
    #lastValue

    /** @type {number} */
    #startValue

    /** @type {number} */
    #endValue

    /**
     * @param {{ totalUnits?: number, onProgress?: (progress: { value: number, message: string }) => void, startValue?: number, endValue?: number }} options Progress options.
     */
    constructor(options = {}) {
        this.#onProgress =
            typeof options.onProgress === 'function' ? options.onProgress : null
        this.#totalUnits = Math.max(Number(options.totalUnits || 1), 1)
        this.#completedUnits = 0
        this.#lastValue = -1
        this.#startValue = PcbAssemblyGeometryBuildProgress.#clampPercent(
            options.startValue ?? 10
        )
        this.#endValue = Math.max(
            this.#startValue,
            PcbAssemblyGeometryBuildProgress.#clampPercent(
                options.endValue ?? 75
            )
        )
    }

    /**
     * Creates a progress tracker sized to the prepared scene detail.
     * @param {{ detail?: object, externalPlacements?: object[] }} sceneDescription Prepared scene description.
     * @param {((progress: { value: number, message: string }) => void) | undefined} onProgress Progress callback.
     * @param {{ startValue?: number, endValue?: number }} [options] Progress range options.
     * @returns {PcbAssemblyGeometryBuildProgress}
     */
    static create(sceneDescription, onProgress, options = {}) {
        return new PcbAssemblyGeometryBuildProgress({
            onProgress,
            startValue: options.startValue,
            endValue: options.endValue,
            totalUnits:
                1 +
                PcbAssemblyGeometryBuildProgress.#countCopperUnits(
                    sceneDescription?.detail || {}
                ) +
                PcbAssemblyGeometryBuildProgress.#countSilkscreenUnits(
                    sceneDescription?.detail?.silkscreen || {}
                ) +
                PcbAssemblyGeometryBuildProgress.#countComponentUnits(
                    sceneDescription
                )
        })
    }

    /**
     * Advances progress by measured build units.
     * @param {number} units Completed units.
     * @param {string} message Progress message.
     * @returns {Promise<void>}
     */
    async advance(units, message) {
        this.#completedUnits += Math.max(Number(units || 0), 0)
        await this.#emit(
            Math.min(
                this.#scaledValue(this.#completedUnits / this.#totalUnits),
                this.#endValue - 1
            ),
            message
        )
    }

    /**
     * Marks geometry building complete.
     * @param {string} message Completion message.
     * @returns {Promise<void>}
     */
    async finish(message) {
        this.#completedUnits = this.#totalUnits
        await this.#emit(this.#endValue, message)
    }

    /**
     * Emits progress when the visible integer value changes.
     * @param {number} value Progress value.
     * @param {string} message Progress message.
     * @returns {Promise<void>}
     */
    async #emit(value, message) {
        if (!this.#onProgress || value === this.#lastValue) {
            return
        }

        this.#lastValue = value
        this.#onProgress({
            value,
            message
        })
        await PcbAssemblyGeometryBuildProgress.#yieldToBrowser()
    }

    /**
     * Maps a unit completion ratio into the configured progress range.
     * @param {number} ratio Completion ratio.
     * @returns {number}
     */
    #scaledValue(ratio) {
        const clampedRatio = Math.max(Math.min(Number(ratio || 0), 1), 0)
        return Math.round(
            this.#startValue +
                clampedRatio * (this.#endValue - this.#startValue)
        )
    }

    /**
     * Counts measured copper work units.
     * @param {object} detail Scene detail.
     * @returns {number}
     */
    static #countCopperUnits(detail) {
        return (
            PcbAssemblyGeometryBuildProgress.#array(detail.tracks).length +
            PcbAssemblyGeometryBuildProgress.#array(detail.arcs).length +
            PcbAssemblyGeometryBuildProgress.#array(detail.fills).length +
            PcbAssemblyGeometryBuildProgress.#array(detail.polygons).length +
            PcbAssemblyGeometryBuildProgress.#array(detail.pads).length * 2 +
            PcbAssemblyGeometryBuildProgress.#array(detail.vias).length +
            PcbAssemblyGeometryBuildProgress.#array(detail.copperTexts).length
        )
    }

    /**
     * Counts measured silkscreen work units.
     * @param {object} silkscreen Scene silkscreen detail.
     * @returns {number}
     */
    static #countSilkscreenUnits(silkscreen) {
        return ['top', 'bottom'].reduce((total, side) => {
            const detail = silkscreen?.[side] || {}
            return (
                total +
                PcbAssemblyGeometryBuildProgress.#array(detail.tracks).length +
                PcbAssemblyGeometryBuildProgress.#array(detail.arcs).length +
                PcbAssemblyGeometryBuildProgress.#array(detail.fills).length +
                PcbAssemblyGeometryBuildProgress.#array(detail.texts).length
            )
        }, 0)
    }

    /**
     * Counts component model loading work units.
     * @param {{ externalPlacements?: object[] }} sceneDescription Prepared scene description.
     * @returns {number}
     */
    static #countComponentUnits(sceneDescription) {
        return PcbAssemblyGeometryBuildProgress.#array(
            sceneDescription?.externalPlacements
        ).filter((placement) => placement?.externalModel).length
    }

    /**
     * Normalizes a value to an array.
     * @param {unknown} value Candidate value.
     * @returns {any[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }

    /**
     * Clamps a progress percentage.
     * @param {number} value Candidate percentage.
     * @returns {number}
     */
    static #clampPercent(value) {
        return Math.max(Math.min(Number(value || 0), 100), 0)
    }

    /**
     * Yields control so browsers can paint the progress dialog.
     * @returns {Promise<void>}
     */
    static #yieldToBrowser() {
        return new Promise((resolve) => {
            globalThis.setTimeout?.(resolve, 0) || resolve()
        })
    }
}
