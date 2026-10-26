/** Controls optional analytics without blocking local viewing or requiring an account. */
export class AnalyticsConsent {
    static STORAGE_KEY = 'ecadforge.analytics-consent.v1'
    #document
    #window
    #storage
    #onGrant
    #choice = null

    /** Read only the consent preference; restricted storage leaves the default disabled. */
    constructor({ documentObject, windowObject, onGrant }) {
        this.#document = documentObject
        this.#window = windowObject
        this.#onGrant = onGrant
        try {
            this.#storage = windowObject.localStorage
            this.#choice = this.#storage?.getItem(AnalyticsConsent.STORAGE_KEY)
        } catch {
            /* The in-memory choice still works for this tab. */
        }
    }

    /** Whether this tab currently has explicit permission for optional analytics. */
    get granted() {
        return this.#choice === 'granted'
    }

    /** Bind equal-choice controls and honour choices changed in another tab. */
    initialize() {
        this.#document
            .querySelector('[data-analytics-accept]')
            ?.addEventListener('click', () => this.choose(true))
        this.#document
            .querySelector('[data-analytics-decline]')
            ?.addEventListener('click', () => this.choose(false))
        this.#document
            .querySelector('[data-analytics-settings]')
            ?.addEventListener('click', () => this.show())
        this.#window.addEventListener('ecadforge:analytics-settings', () =>
            this.show()
        )
        this.#window.addEventListener('storage', (event) => {
            if (
                event.key !== null &&
                event.key !== AnalyticsConsent.STORAGE_KEY
            )
                return
            if (event.storageArea && event.storageArea !== this.#storage) return
            const previous = this.granted
            this.#choice = event.newValue
            if (!this.granted) this.#stop()
            else if (!previous) this.#onGrant()
            this.#setVisible(!['granted', 'denied'].includes(this.#choice))
        })
        if (this.granted) this.#onGrant()
        this.#setVisible(
            !['granted', 'denied'].includes(this.#choice) ||
                new URL(this.#window.location.href).searchParams.get(
                    'privacy'
                ) === 'analytics'
        )
    }

    /** Apply one explicit choice without replaying activity from before permission. */
    choose(allow) {
        const previouslyGranted = this.granted
        this.#choice = allow ? 'granted' : 'denied'
        try {
            this.#storage?.setItem(AnalyticsConsent.STORAGE_KEY, this.#choice)
        } catch {
            /* Session-only choice. */
        }
        if (!allow) this.#stop()
        else if (!previouslyGranted) this.#onGrant()
        this.#setVisible(false)
        const settings = this.#document.querySelector(
            '[data-analytics-settings]'
        )
        settings?.focus?.({ preventScroll: true })
    }

    /** Reopen the settings from the persistent footer control. */
    show() {
        this.#setVisible(true)
        this.#document
            .querySelector('[data-analytics-decline]')
            ?.focus?.({ preventScroll: true })
    }

    /** Stop the central tracker's current and in-flight transmissions after withdrawal. */
    #stop() {
        this.#window.AnalyticsTracker?.stop?.()
    }

    /** Keep the panel nonmodal so viewing remains available without a decision. */
    #setVisible(visible) {
        const panel = this.#document.querySelector('[data-analytics-consent]')
        if (panel) panel.hidden = !visible
    }
}
