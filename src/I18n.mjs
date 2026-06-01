/**
 * @typedef {'en' | 'de' | 'zh-CN' | 'vi' | 'fr' | 'es'} AppLocale
 */

/**
 * Browser storage key for the selected locale.
 * @type {string}
 */
const BROWSER_LOCALE_STORAGE_KEY = 'ecadforge.locale'

/**
 * Runtime translation service backed by JSON bundles.
 */
export class I18nService {
    /** @type {AppLocale} */
    #locale

    /** @type {Record<string, string>} */
    #dictionary

    /** @type {{ getItem?: (key: string) => string | null, setItem?: (key: string, value: string) => void } | null} */
    #storage

    /**
     * @param {AppLocale} locale
     * @param {Record<string, string>} dictionary
     * @param {{ getItem?: (key: string) => string | null, setItem?: (key: string, value: string) => void } | null} [storage]
     */
    constructor(
        locale,
        dictionary,
        storage = I18nService.#resolveBrowserStorage()
    ) {
        this.#locale = locale
        this.#dictionary = dictionary
        this.#storage = storage
    }

    /**
     * Creates a service with fetched dictionaries.
     * @param {string} preferredLocale
     * @returns {Promise<I18nService>}
     */
    static async create(preferredLocale = 'en') {
        return I18nService.#createWithStorage(
            preferredLocale,
            I18nService.#resolveBrowserStorage()
        )
    }

    /**
     * Creates a service using the browser-stored locale when available.
     * @param {{ getItem?: (key: string) => string | null, setItem?: (key: string, value: string) => void } | null} [storage]
     * @returns {Promise<I18nService>}
     */
    static async createFromBrowserStorage(
        storage = I18nService.#resolveBrowserStorage()
    ) {
        const preferredLocale = I18nService.#readStoredLocale(storage)
        return I18nService.#createWithStorage(preferredLocale, storage)
    }

    /**
     * Creates a service using an explicit storage backend.
     * @param {string} preferredLocale
     * @param {{ getItem?: (key: string) => string | null, setItem?: (key: string, value: string) => void } | null} storage
     * @returns {Promise<I18nService>}
     */
    static async #createWithStorage(preferredLocale, storage) {
        const locale = I18nService.#normalizeLocale(preferredLocale)
        const dictionary = await I18nService.#fetchDictionary(locale)
        return new I18nService(locale, dictionary, storage)
    }

    /**
     * Returns active locale.
     * @returns {AppLocale}
     */
    getLocale() {
        return this.#locale
    }

    /**
     * Updates locale and dictionary.
     * @param {string} nextLocale
     */
    async setLocale(nextLocale) {
        const locale = I18nService.#normalizeLocale(nextLocale)
        this.#locale = locale
        this.#dictionary = await I18nService.#fetchDictionary(locale)
        this.#writeStoredLocale(locale)

        if (typeof document !== 'undefined') {
            this.applyToDom(document)
        }
    }

    /**
     * Translates a key.
     * @param {string} key
     * @returns {string}
     */
    translate(key) {
        return this.#dictionary[key] || key
    }

    /**
     * Applies translations for [data-i18n] elements.
     * @param {Document} documentRef
     */
    applyToDom(documentRef) {
        if (!documentRef) return

        documentRef.documentElement.lang = this.#locale
        documentRef.title = this.translate('app.pageTitle')
        this.#applyTextTranslations(documentRef)
        this.#applyAttributeTranslations(documentRef)
    }

    /**
     * Applies translations to text content nodes.
     * @param {Document} documentRef
     * @returns {void}
     */
    #applyTextTranslations(documentRef) {
        const nodes = documentRef.querySelectorAll('[data-i18n]')
        nodes.forEach((node) => {
            const key = node.getAttribute('data-i18n')
            if (!key) return
            node.textContent = this.translate(key)
        })
    }

    /**
     * Applies translations to declared element attributes.
     * @param {Document} documentRef
     * @returns {void}
     */
    #applyAttributeTranslations(documentRef) {
        const nodes = documentRef.querySelectorAll('[data-i18n-attr]')
        nodes.forEach((node) => {
            const attributeMap = node.getAttribute('data-i18n-attr')
            if (!attributeMap) return
            this.#applyNodeAttributeTranslations(node, attributeMap)
        })
    }

    /**
     * Applies one comma-separated attribute translation map to a node.
     * @param {{ setAttribute: (name: string, value: string) => void }} node
     * @param {string} attributeMap
     * @returns {void}
     */
    #applyNodeAttributeTranslations(node, attributeMap) {
        attributeMap.split(',').forEach((entry) => {
            const [attributeName, key] = entry
                .split(':')
                .map((value) => value.trim())
            if (!attributeName || !key) return
            node.setAttribute(attributeName, this.translate(key))
        })
    }

    /**
     * Fetches one locale dictionary file.
     * @param {AppLocale} locale
     * @returns {Promise<Record<string, string>>}
     */
    static async #fetchDictionary(locale) {
        try {
            const response = await fetch('/i18n/' + locale + '.json', {
                cache: 'no-store'
            })
            if (!response.ok) {
                return {}
            }
            const payload = await response.json()
            if (!payload || typeof payload !== 'object') {
                return {}
            }
            return payload
        } catch (_error) {
            return {}
        }
    }

    /**
     * Resolves browser local storage when the runtime exposes it.
     * @returns {{ getItem?: (key: string) => string | null, setItem?: (key: string, value: string) => void } | null}
     */
    static #resolveBrowserStorage() {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
                return globalThis.localStorage
            }
        } catch (_error) {
            return null
        }

        return null
    }

    /**
     * Reads the stored locale from a browser storage-like object.
     * @param {{ getItem?: (key: string) => string | null } | null} storage
     * @returns {AppLocale}
     */
    static #readStoredLocale(storage) {
        try {
            if (!storage || typeof storage.getItem !== 'function') {
                return 'en'
            }

            return I18nService.#normalizeLocale(
                storage.getItem(BROWSER_LOCALE_STORAGE_KEY) || 'en'
            )
        } catch (_error) {
            return 'en'
        }
    }

    /**
     * Writes the active locale to browser storage when available.
     * @param {AppLocale} locale
     * @returns {void}
     */
    #writeStoredLocale(locale) {
        try {
            if (!this.#storage || typeof this.#storage.setItem !== 'function') {
                return
            }

            this.#storage.setItem(BROWSER_LOCALE_STORAGE_KEY, locale)
        } catch (_error) {
            // Some privacy modes expose storage but reject writes.
        }
    }

    /**
     * Normalizes user-facing locale identifiers to supported bundles.
     * @param {string} locale
     * @returns {AppLocale}
     */
    static #normalizeLocale(locale) {
        if (locale === 'de') {
            return 'de'
        }

        if (locale === 'zh-CN') {
            return 'zh-CN'
        }

        if (locale === 'vi') {
            return 'vi'
        }

        if (locale === 'fr') {
            return 'fr'
        }

        if (locale === 'es') {
            return 'es'
        }

        return 'en'
    }
}
