/** Switches the public legal text between German and English without a page load. */
export class LegalLanguageController {
    #document
    #window
    #sections = []
    #buttons = []

    /** Use the same controller in a standalone document and in its overlay frame. */
    constructor(documentObject = document, windowObject = window) {
        this.#document = documentObject
        this.#window = windowObject
    }

    /** Reveal working controls only after their event handlers are available. */
    initialize() {
        const controls = this.#document.querySelector(
            '[data-legal-language-controls]'
        )
        if (!controls) return
        this.#sections = [
            ...this.#document.querySelectorAll('[data-legal-language-copy]')
        ]
        this.#buttons = [...controls.querySelectorAll('[data-legal-language]')]
        for (const button of this.#buttons) {
            button.addEventListener('click', () =>
                this.select(button.dataset.legalLanguage)
            )
        }
        const explicit = this.#window.location.hash.slice(1)
        const preferred =
            this.#window.frameElement?.dataset.legalLanguage ||
            this.#document.documentElement.lang
        this.select(['de', 'en'].includes(explicit) ? explicit : preferred)
        controls.hidden = false
    }

    /** Show one language, update button state and keep cross-document links in that language. */
    select(language) {
        const locale = language === 'en' ? 'en' : 'de'
        for (const section of this.#sections)
            section.hidden = section.dataset.legalLanguageCopy !== locale
        for (const button of this.#buttons)
            button.setAttribute(
                'aria-pressed',
                String(button.dataset.legalLanguage === locale)
            )
        this.#document.documentElement.lang = locale
        const heading = this.#document.querySelector('[data-legal-title]')
        if (heading) {
            heading.textContent =
                locale === 'en'
                    ? heading.dataset.titleEn
                    : heading.dataset.titleDe
            this.#document.title = `${heading.textContent} | ECAD Forge`
        }
        for (const link of this.#document.querySelectorAll(
            'a[data-legal-document]'
        )) {
            const url = new URL(
                link.getAttribute('href'),
                this.#window.location.href
            )
            url.hash = locale
            link.setAttribute('href', url.pathname + url.search + url.hash)
        }
    }
}
