import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { I18nService } from '../src/I18n.mjs'

const root = new URL('../', import.meta.url)

/**
 * Minimal fake node for i18n DOM application tests.
 */
class FakeI18nNode {
    /** @type {Map<string, string>} */
    #attributes

    constructor(attributes = {}) {
        this.#attributes = new Map(Object.entries(attributes))
        this.textContent = ''
    }

    /**
     * Returns one attribute value.
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * Sets one attribute value.
     * @param {string} name
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
    }
}

/**
 * Minimal fake document that exposes i18n nodes by selector.
 */
class FakeI18nDocument {
    constructor() {
        this.documentElement = new FakeI18nNode()
        this.#textNodes = [new FakeI18nNode({ 'data-i18n': 'footer.title' })]
        this.#attributeNodes = [
            new FakeI18nNode({
                'data-i18n-attr':
                    'aria-label:footer.githubAria,title:footer.githubTitle'
            })
        ]
    }

    /** @type {FakeI18nNode[]} */
    #textNodes

    /** @type {FakeI18nNode[]} */
    #attributeNodes

    /**
     * Returns the nodes matching one simple i18n selector.
     * @param {string} selector
     * @returns {FakeI18nNode[]}
     */
    querySelectorAll(selector) {
        if (selector === '[data-i18n]') {
            return this.#textNodes
        }
        if (selector === '[data-i18n-attr]') {
            return this.#attributeNodes
        }
        return []
    }

    /**
     * Returns the first fake text node.
     * @returns {FakeI18nNode}
     */
    getTextNode() {
        return this.#textNodes[0]
    }

    /**
     * Returns the first fake attribute node.
     * @returns {FakeI18nNode}
     */
    getAttributeNode() {
        return this.#attributeNodes[0]
    }
}

/**
 * Verifies locale application updates text and translated attributes.
 */
test('I18nService applies translated text and attributes to the DOM', () => {
    const documentRef = new FakeI18nDocument()
    const service = new I18nService('de', {
        'footer.title': 'Impressum',
        'footer.githubAria': 'GitHub-Repository',
        'footer.githubTitle': 'GitHub'
    })

    service.applyToDom(documentRef)

    assert.equal(documentRef.documentElement.lang, 'de')
    assert.equal(documentRef.getTextNode().textContent, 'Impressum')
    assert.equal(
        documentRef.getAttributeNode().getAttribute('aria-label'),
        'GitHub-Repository'
    )
    assert.equal(documentRef.getAttributeNode().getAttribute('title'), 'GitHub')
})

/**
 * Verifies visible German app copy uses native umlauts instead of ASCII
 * transliterations.
 */
test('German locale uses native umlauts in visible app copy', async () => {
    const germanRaw = await readFile(new URL('src/i18n/de.json', root), 'utf8')
    const germanMessages = JSON.parse(germanRaw)

    assert.equal(
        germanMessages['app.subtitle'],
        'Privater ECAD-Viewer für Altium & KiCad.'
    )
    assert.equal(germanMessages['app.open'], 'Lokale Dateien öffnen')
    assert.equal(germanMessages['app.openFolder'], 'Ordner öffnen')
    assert.equal(
        germanMessages['app.dropCopy'],
        'Schaltpläne, PCB-Layouts, 3D-Boards, BOMs und Diagnosen direkt im Browser ansehen. Kein Upload, kein Account, keine serverseitige Vorverarbeitung.'
    )
    assert.match(germanMessages['status.loaded'], /für PCB/)
    assert.match(germanMessages['status.invalidFile'], /unterstützt/)
    assert.match(germanMessages['status.invalidFile'], /ausgewählte/)
    assert.match(germanMessages['status.invalidFile'], /öffne/)
    assert.match(germanMessages['status.assetsAdded'], /hinzugefügt/)
})
