const PCB_STYLER_TIP_DISMISSED_STORAGE_KEY = 'ecadforge.pcbStylerTipDismissed'

/**
 * Manages the contextual PCB Styler crosslink and dismissal state.
 */
export class AppViewPcbStylerTipController {
    /** @type {HTMLElement | null} */
    #ctaNode

    /** @type {HTMLAnchorElement | null} */
    #linkNode

    /** @type {HTMLElement | null} */
    #dismissNode

    /** @type {HTMLElement | null} */
    #viewerStageNode

    /** @type {Storage | null} */
    #storage

    /** @type {(key: string) => string} */
    #translate

    /**
     * @param {Document} documentRef Browser document.
     * @param {{ viewerStageNode?: HTMLElement | null, storage?: Storage | null, translate: (key: string) => string }} options Controller options.
     */
    constructor(documentRef, options) {
        this.#ctaNode = documentRef.querySelector('#pcbStylerCta')
        this.#linkNode = documentRef.querySelector('#pcbStylerLink')
        this.#dismissNode = documentRef.querySelector('#pcbStylerDismiss')
        this.#viewerStageNode = options.viewerStageNode || null
        this.#storage = options.storage || null
        this.#translate = options.translate
    }

    /**
     * Binds the persistent PCB Styler tip dismissal button.
     * @returns {void}
     */
    bindDismiss() {
        this.#dismissNode?.addEventListener('click', () => {
            this.#dismissTip()
        })
    }

    /**
     * Binds PCB Styler crosslink clicks.
     * @param {() => void} callback Click callback.
     * @returns {void}
     */
    bindClick(callback) {
        this.#linkNode?.addEventListener('click', () => {
            callback()
        })
    }

    /**
     * Updates the contextual PCB Styler crosslink.
     * @param {string} url Link URL.
     * @param {string} mode Link mode.
     * @returns {void}
     */
    setLink(url, mode) {
        if (!this.#ctaNode || !this.#linkNode) return

        this.#linkNode.href = url || 'https://pcb-styler.app/'
        this.#linkNode.textContent =
            mode === 'github'
                ? this.#translate('pcbStyler.open')
                : this.#translate('pcbStyler.export')
        this.#setHidden(this.#isDismissed())
    }

    /**
     * Hides the PCB Styler crosslink when returning to landing mode.
     * @returns {void}
     */
    clearLink() {
        if (!this.#ctaNode || !this.#linkNode) return

        this.#linkNode.href = 'https://pcb-styler.app/'
        this.#linkNode.textContent = this.#translate('pcbStyler.open')
        this.#setHidden(true)
    }

    /**
     * Hides the PCB Styler tip and stores the user preference.
     * @returns {void}
     */
    #dismissTip() {
        this.#storeDismissed()
        this.#setHidden(true)
    }

    /**
     * Toggles the PCB Styler CTA and collapses the unused grid row with it.
     * @param {boolean} hidden Whether the CTA should be hidden.
     * @returns {void}
     */
    #setHidden(hidden) {
        if (hidden) {
            this.#ctaNode?.setAttribute('hidden', 'hidden')
            this.#viewerStageNode?.classList.add('is-pcb-styler-cta-hidden')
            return
        }

        this.#ctaNode?.removeAttribute('hidden')
        this.#viewerStageNode?.classList.remove('is-pcb-styler-cta-hidden')
    }

    /**
     * Returns true when the PCB Styler tip was dismissed in this browser.
     * @returns {boolean}
     */
    #isDismissed() {
        try {
            return (
                this.#storage?.getItem(PCB_STYLER_TIP_DISMISSED_STORAGE_KEY) ===
                'true'
            )
        } catch (_error) {
            return false
        }
    }

    /**
     * Persists the PCB Styler tip dismissal preference when storage is usable.
     * @returns {void}
     */
    #storeDismissed() {
        try {
            this.#storage?.setItem(PCB_STYLER_TIP_DISMISSED_STORAGE_KEY, 'true')
        } catch (_error) {
            // The current click still hides the tip when browser storage fails.
        }
    }
}
