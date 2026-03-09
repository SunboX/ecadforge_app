/**
 * Runtime translation service backed by JSON bundles.
 */
export class I18nService {
    /** @type {'en' | 'de'} */
    #locale

    /** @type {Record<string, string>} */
    #dictionary

    /**
     * @param {'en' | 'de'} locale
     * @param {Record<string, string>} dictionary
     */
    constructor(locale, dictionary) {
        this.#locale = locale
        this.#dictionary = dictionary
    }

    /**
     * Creates a service with fetched dictionaries.
     * @param {'en' | 'de'} preferredLocale
     * @returns {Promise<I18nService>}
     */
    static async create(preferredLocale = 'en') {
        const locale = preferredLocale === 'de' ? 'de' : 'en'
        const dictionary = await I18nService.#fetchDictionary(locale)
        return new I18nService(locale, dictionary)
    }

    /**
     * Returns active locale.
     * @returns {'en' | 'de'}
     */
    getLocale() {
        return this.#locale
    }

    /**
     * Updates locale and dictionary.
     * @param {string} nextLocale
     */
    async setLocale(nextLocale) {
        const locale = nextLocale === 'de' ? 'de' : 'en'
        this.#locale = locale
        this.#dictionary = await I18nService.#fetchDictionary(locale)
        this.applyToDom(document)
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
        const nodes = documentRef.querySelectorAll('[data-i18n]')
        nodes.forEach((node) => {
            const key = node.getAttribute('data-i18n')
            if (!key) return
            node.textContent = this.translate(key)
        })
    }

    /**
     * Fetches one locale dictionary file.
     * @param {'en' | 'de'} locale
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
}
