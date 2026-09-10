/**
 * Resolves and applies the theme before first paint, then binds the header switch.
 * Loaded as a classic script so theme resolution cannot wait on module imports.
 */
class ThemeController {
    static #storageKey = 'ecadforge.theme'
    #document
    #media = null
    #storage = null
    #preference = null
    #toggle = null

    /**
     * Starts automatic theming and retains manual preferences across visits.
     * @param {Document} documentRef Page document.
     * @param {Window} windowRef Browser window.
     */
    constructor(documentRef, windowRef) {
        this.#document = documentRef
        try {
            this.#storage = windowRef.localStorage
            this.#preference = this.#normalize(
                this.#storage?.getItem(ThemeController.#storageKey)
            )
        } catch (_error) {
            // Restricted storage must not prevent automatic or manual theming.
        }
        try {
            this.#media = windowRef.matchMedia?.('(prefers-color-scheme: dark)')
        } catch (_error) {
            // Browsers without color preference support use the light palette.
        }
        this.#apply()
        const updateSystem = () => this.#apply()
        if (this.#media?.addEventListener) {
            this.#media.addEventListener('change', updateSystem)
        } else {
            this.#media?.addListener?.(updateSystem)
        }
        windowRef.addEventListener('storage', (event) => {
            if (
                event.storageArea !== this.#storage ||
                (event.key !== null &&
                    event.key !== ThemeController.#storageKey)
            )
                return
            this.#preference = this.#normalize(event.newValue)
            this.#apply()
        })
        if (documentRef.readyState === 'loading') {
            documentRef.addEventListener(
                'DOMContentLoaded',
                () => this.#bind(),
                { once: true }
            )
        } else {
            this.#bind()
        }
    }

    /**
     * Accepts only explicitly saved light/dark choices.
     * @param {unknown} value Stored preference.
     * @returns {'light' | 'dark' | null}
     */
    #normalize(value) {
        return value === 'dark' || value === 'light' ? value : null
    }

    /** Updates the document and switch without changing document/viewer state. */
    #apply() {
        const theme =
            this.#preference ?? (this.#media?.matches ? 'dark' : 'light')
        this.#document.documentElement.dataset.theme = theme
        this.#document.documentElement.style.colorScheme = theme
        if (this.#toggle) this.#toggle.checked = theme === 'dark'
    }

    /** Binds the accessible switch after the toolbar exists. */
    #bind() {
        this.#toggle = this.#document.getElementById('themeToggle')
        if (!this.#toggle) return
        this.#apply()
        this.#toggle.addEventListener('change', () => {
            this.#preference = this.#toggle.checked ? 'dark' : 'light'
            this.#apply()
            try {
                this.#storage?.setItem(
                    ThemeController.#storageKey,
                    this.#preference
                )
            } catch (_error) {
                // Keep the manual preference in memory when storage is unavailable.
            }
        })
    }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    new ThemeController(document, window)
}
