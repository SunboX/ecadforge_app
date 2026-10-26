import assert from 'node:assert/strict'
import test from 'node:test'
import { LegalDialogController } from '../src/legal/LegalDialogController.mjs'

/** Minimal DOM with native-dialog behavior and event boundaries visible to callers. */
class FakeNode {
    attributes = new Map()
    listeners = new Map()
    children = []
    style = { overflow: '' }
    dataset = {}
    open = false
    textContent = ''
    /** Associate created elements with their owning document. */
    constructor(tagName, ownerDocument) {
        this.tagName = tagName
        this.ownerDocument = ownerDocument
    }
    /** Retain attributes used to distinguish authored legal links and the modal frame. */
    setAttribute(name, value) {
        this.attributes.set(name, value)
    }
    /** Return one authored attribute value. */
    getAttribute(name) {
        return this.attributes.get(name) ?? null
    }
    /** Check one semantic navigation marker. */
    hasAttribute(name) {
        return this.attributes.has(name)
    }
    /** Match a clicked anchor without depending on source order. */
    closest() {
        return this.tagName === 'a' ? this : null
    }
    /** Capture listeners with DOM-like multiple-handler behavior. */
    addEventListener(name, listener) {
        const listeners = this.listeners.get(name) || []
        listeners.push(listener)
        this.listeners.set(name, listeners)
    }
    /** Dispatch a simulated user interaction. */
    fire(name, event = {}) {
        for (const listener of this.listeners.get(name) || []) listener(event)
    }
    /** Preserve child order for accessible modal controls. */
    append(...nodes) {
        this.children.push(...nodes)
    }
    /** Native dialog opening leaves the app document in place. */
    showModal() {
        this.open = true
    }
    /** Simulate a native dialog closing. */
    close() {
        this.open = false
    }
    /** Restore the original opener when the modal is dismissed. */
    focus() {
        this.ownerDocument.activeElement = this
    }
}

/** Fake browser fixture containing an existing loaded-design URL and focus state. */
class LegalBrowser {
    nodes = []
    signals = []
    /** Create host objects independently from the actual application state. */
    constructor() {
        this.document = new FakeNode('document')
        this.document.documentElement = new FakeNode('html')
        this.document.documentElement.style.overflow = 'clip'
        this.document.documentElement.dataset.theme = 'dark'
        this.document.body = new FakeNode('body')
        this.document.createElement = (tag) => {
            const node = new FakeNode(tag, this.document)
            this.nodes.push(node)
            return node
        }
        this.window = {
            location: {
                href: 'https://viewer.example.test/pcb?document=board&net=power',
                origin: 'https://viewer.example.test'
            },
            Event,
            dispatchEvent: (event) => this.signals.push(event.type)
        }
        this.controller = new LegalDialogController(this.document, this.window)
    }
    /** Find the persistent native modal. */
    get dialog() {
        return this.nodes.find((node) => node.tagName === 'dialog')
    }
    /** Find the one shared document frame. */
    get frame() {
        return this.nodes.find((node) => node.tagName === 'iframe')
    }
    /** Create a normal authored legal anchor, never an imported design fixture. */
    link(href, label = 'Terms') {
        const anchor = new FakeNode('a', this.document)
        anchor.setAttribute('href', href)
        anchor.setAttribute('data-legal-document', '')
        anchor.textContent = label
        return anchor
    }
    /** Dispatch clicks and retain their default-navigation outcome for assertions. */
    click(anchor, context = this.document, modifiers = {}) {
        const event = {
            target: anchor,
            button: 0,
            defaultPrevented: false,
            preventDefault() {
                this.defaultPrevented = true
            },
            ...modifiers
        }
        context.fire('click', event)
        return event
    }
    /** Load a fresh embedded document, as a real iframe navigation would. */
    loadFrame() {
        this.frame.contentDocument = new FakeNode('document')
        this.frame.contentDocument.documentElement = new FakeNode('html')
        this.frame.fire('load')
        return this.frame.contentDocument
    }
}

test('legal links open a modal without changing the loaded-design URL and restore focus', () => {
    const browser = new LegalBrowser()
    browser.controller.initialize()
    const opener = browser.link('/terms.html')
    assert.equal(browser.click(opener).defaultPrevented, true)
    assert.equal(browser.dialog.open, true)
    assert.equal(browser.frame.src, 'https://viewer.example.test/terms.html')
    assert.equal(
        browser.window.location.href,
        'https://viewer.example.test/pcb?document=board&net=power'
    )
    assert.equal(browser.document.documentElement.style.overflow, 'hidden')
    browser.controller.close()
    assert.equal(browser.dialog.open, false)
    assert.equal(browser.frame.src, 'about:blank')
    assert.equal(browser.document.documentElement.style.overflow, 'clip')
    assert.equal(browser.document.activeElement, opener)
})

test('cross-document references stay in one overlay and Escape works from its content', () => {
    const browser = new LegalBrowser()
    browser.controller.initialize()
    const opener = browser.link('/terms.html')
    browser.click(opener)
    const content = browser.loadFrame()
    assert.equal(content.documentElement.dataset.theme, 'dark')
    browser.click(browser.link('/refunds.html#en', 'Refunds'), content)
    assert.equal(
        browser.frame.src,
        'https://viewer.example.test/refunds.html#en'
    )
    assert.equal(
        browser.nodes.filter((node) => node.tagName === 'dialog').length,
        1
    )
    const nextContent = browser.loadFrame()
    nextContent.fire('keydown', { key: 'Escape', preventDefault() {} })
    assert.equal(browser.dialog.open, false)
    assert.equal(browser.document.activeElement, opener)
})

test('close button, native Escape and backdrop all release scroll locking', () => {
    const browser = new LegalBrowser()
    browser.controller.open('/privacy.html', 'Privacy')
    browser.nodes.find((node) => node.tagName === 'button').fire('click')
    assert.equal(browser.dialog.open, false)
    browser.controller.open('/terms.html', 'Terms')
    browser.dialog.fire('cancel', { preventDefault() {} })
    assert.equal(browser.dialog.open, false)
    browser.controller.open('/refunds.html', 'Refunds')
    browser.dialog.fire('click', { target: browser.dialog })
    assert.equal(browser.dialog.open, false)
    assert.equal(browser.document.documentElement.style.overflow, 'clip')
})

test('embedded analytics settings return to the existing viewer instead of loading another app', () => {
    const browser = new LegalBrowser()
    browser.controller.open('/privacy.html', 'Privacy')
    const content = browser.loadFrame()
    const event = browser.click(browser.link('/?privacy=analytics'), content)
    assert.equal(event.defaultPrevented, true)
    assert.equal(browser.dialog.open, false)
    assert.deepEqual(browser.signals, ['ecadforge:analytics-settings'])
    assert.equal(
        browser.window.location.href,
        'https://viewer.example.test/pcb?document=board&net=power'
    )
})

test('unrelated links, foreign URLs and modified clicks retain ordinary browser behavior', () => {
    const browser = new LegalBrowser()
    browser.controller.initialize()
    const ordinary = browser.link('/other.html')
    ordinary.attributes.delete('data-legal-document')
    assert.equal(browser.click(ordinary).defaultPrevented, false)
    assert.equal(
        browser.click(browser.link('https://external.example.test/privacy'))
            .defaultPrevented,
        false
    )
    assert.equal(
        browser.click(browser.link('/terms.html'), undefined, { ctrlKey: true })
            .defaultPrevented,
        false
    )
    assert.equal(browser.dialog, undefined)
})

test('embedded document bootstrap does not create nested overlays', () => {
    const browser = new LegalBrowser()
    browser.window.frameElement = { hasAttribute: () => true }
    browser.controller.initialize()
    assert.equal(browser.document.listeners.size, 0)
})

test('the overlay title follows the visible document language', () => {
    const browser = new LegalBrowser()
    browser.controller.open('/terms.html', 'AGB')
    const content = browser.loadFrame()
    content.querySelector = () => ({ textContent: 'Terms and conditions' })
    content.fire('click', {
        target: new FakeNode('button', content),
        button: 0
    })
    assert.equal(browser.frame.title, 'Terms and conditions')
    assert.equal(
        browser.nodes.find((node) => node.tagName === 'h2').textContent,
        'Terms and conditions'
    )
    assert.equal(browser.dialog.open, true)
})
