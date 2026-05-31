/**
 * Runtime translation service backed by JSON bundles.
 * @typedef {'en' | 'de' | 'zh-CN' | 'vi' | 'fr' | 'es'} AppLocale
 */
export class I18nService {
    /** @type {AppLocale} */
    #locale

    /** @type {Record<string, string>} */
    #dictionary

    /**
     * @param {AppLocale} locale
     * @param {Record<string, string>} dictionary
     */
    constructor(locale, dictionary) {
        this.#locale = locale
        this.#dictionary = dictionary
    }

    /**
     * Creates a service with fetched dictionaries.
     * @param {string} preferredLocale
     * @returns {Promise<I18nService>}
     */
    static async create(preferredLocale = 'en') {
        const locale = I18nService.#normalizeLocale(preferredLocale)
        const dictionary = await I18nService.#fetchDictionary(locale)
        return new I18nService(locale, dictionary)
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
