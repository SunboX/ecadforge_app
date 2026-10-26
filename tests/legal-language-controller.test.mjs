import assert from 'node:assert/strict'
import test from 'node:test'
import { LegalLanguageController } from '../src/legal/LegalLanguageController.mjs'

/** Small visible-language nodes, shared by body text and footer navigation. */
class LanguageNode {
    dataset = {}
    hidden = false
    attributes = new Map()
    listeners = new Map()
    /** Assign only the authored data contract needed by the language selector. */
    constructor(dataset = {}) {
        this.dataset = dataset
    }
    /** Store accessible pressed state and updated link targets. */
    setAttribute(name, value) {
        this.attributes.set(name, value)
    }
    /** Read a normal link URL. */
    getAttribute(name) {
        return this.attributes.get(name)
    }
    /** Bind the explicit language-button action. */
    addEventListener(name, callback) {
        this.listeners.set(name, callback)
    }
}

/** The standalone and embedded variants differ only in their preferred language. */
class LanguageBrowser {
    sections = ['de', 'en', 'de', 'en'].map(
        (locale) => new LanguageNode({ legalLanguageCopy: locale })
    )
    buttons = ['de', 'en'].map(
        (locale) => new LanguageNode({ legalLanguage: locale })
    )
    heading = new LanguageNode({
        titleDe: 'Vertragsbedingungen',
        titleEn: 'Terms and conditions'
    })
    link = new LanguageNode()
    controls = new LanguageNode()
    /** Prepare an authored document with no hidden text until enhancement runs. */
    constructor(hash = '', preferred = '') {
        this.controls.hidden = true
        this.controls.querySelectorAll = () => this.buttons
        this.link.setAttribute('href', '/refunds.html')
        this.document = {
            documentElement: { lang: 'de' },
            querySelector: (selector) =>
                selector === '[data-legal-title]'
                    ? this.heading
                    : this.controls,
            querySelectorAll: (selector) =>
                selector === 'a[data-legal-document]'
                    ? [this.link]
                    : this.sections
        }
        this.window = {
            location: {
                href: 'https://viewer.example.test/terms.html' + hash,
                hash
            },
            frameElement: preferred
                ? { dataset: { legalLanguage: preferred } }
                : null
        }
        this.controller = new LegalLanguageController(
            this.document,
            this.window
        )
    }
}

test('German and English buttons show only the chosen text and accessible selection state', () => {
    const browser = new LanguageBrowser()
    browser.controller.initialize()
    assert.equal(browser.controls.hidden, false)
    assert.deepEqual(
        browser.sections.map((node) => node.hidden),
        [false, true, false, true]
    )
    assert.equal(browser.buttons[0].attributes.get('aria-pressed'), 'true')
    browser.buttons[1].listeners.get('click')()
    assert.deepEqual(
        browser.sections.map((node) => node.hidden),
        [true, false, true, false]
    )
    assert.equal(browser.buttons[1].attributes.get('aria-pressed'), 'true')
    assert.equal(browser.buttons[0].attributes.get('aria-pressed'), 'false')
    assert.equal(browser.document.documentElement.lang, 'en')
    assert.equal(browser.heading.textContent, 'Terms and conditions')
    assert.equal(browser.link.getAttribute('href'), '/refunds.html#en')
    assert.equal(
        browser.window.location.href,
        'https://viewer.example.test/terms.html'
    )
})

test('explicit cross-document language wins over the viewer preference', () => {
    const english = new LanguageBrowser('#en', 'de')
    english.controller.initialize()
    assert.equal(english.document.documentElement.lang, 'en')
    const german = new LanguageBrowser('#de', 'en')
    german.controller.initialize()
    assert.equal(german.document.documentElement.lang, 'de')
    const preferred = new LanguageBrowser('', 'en')
    preferred.controller.initialize()
    assert.equal(preferred.document.documentElement.lang, 'en')
})

test('both authored texts remain readable when JavaScript enhancement does not run', () => {
    const browser = new LanguageBrowser()
    assert.equal(browser.controls.hidden, true)
    assert.ok(browser.sections.every((section) => !section.hidden))
})
