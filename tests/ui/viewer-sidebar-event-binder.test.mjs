import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewerSidebarEventBinder } from '../../src/ui/ViewerSidebarEventBinder.mjs'

/**
 * Minimal delegated-click mount for sidebar event tests.
 */
class FakeMount {
    /** @type {Map<string, ((event: any) => void)[]>} */
    #listeners = new Map()

    /** @type {FakeClipboardDocument | null} */
    ownerDocument

    /**
     * @param {FakeClipboardDocument | null} [ownerDocument] Owner document.
     */
    constructor(ownerDocument = null) {
        this.ownerDocument = ownerDocument
    }

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Event listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, [])
        }
        this.#listeners.get(type)?.push(listener)
    }

    /**
     * Dispatches one click event and stops later listeners when requested.
     * @param {FakeButton} target Event target.
     * @returns {{ defaultPrevented: boolean, propagationStopped: boolean, immediateStopped: boolean }}
     */
    click(target) {
        const event = {
            target,
            defaultPrevented: false,
            propagationStopped: false,
            immediateStopped: false,
            preventDefault() {
                this.defaultPrevented = true
            },
            stopPropagation() {
                this.propagationStopped = true
            },
            stopImmediatePropagation() {
                this.immediateStopped = true
            }
        }

        for (const listener of this.#listeners.get('click') || []) {
            listener(event)
            if (event.immediateStopped) break
        }

        return event
    }

    /**
     * Dispatches one input event.
     * @param {any} target Event target.
     * @returns {void}
     */
    input(target) {
        const event = { target }

        for (const listener of this.#listeners.get('input') || []) {
            listener(event)
        }
    }
}

/**
 * Minimal button-like target with selector-aware closest lookup.
 */
class FakeButton {
    /** @type {Map<string, string>} */
    #attributes

    /**
     * @param {Record<string, string>} attributes Button attributes.
     */
    constructor(attributes) {
        this.#attributes = new Map(Object.entries(attributes))
    }

    /**
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * @param {string} selector Closest selector.
     * @returns {FakeButton | null}
     */
    closest(selector) {
        if (
            selector === '[data-component-detail-copy]' &&
            this.getAttribute('data-component-detail-copy')
        ) {
            return this
        }
        if (
            selector === '[data-pcb-component-key]' &&
            this.getAttribute('data-pcb-component-key')
        ) {
            return this
        }
        if (
            selector === '[data-pcb-net-key]' &&
            this.getAttribute('data-pcb-net-key')
        ) {
            return this
        }
        if (
            selector === '[data-selected-part-export-format]' &&
            this.getAttribute('data-selected-part-export-format')
        ) {
            return this
        }
        if (
            selector === '[data-gerber-render-mode]' &&
            this.getAttribute('data-gerber-render-mode')
        ) {
            return this
        }
        return null
    }
}

/**
 * Minimal input target with selector-aware closest lookup.
 */
class FakeFilterInput {
    /**
     * @param {string} value Input value.
     */
    constructor(value) {
        this.value = value
    }

    /**
     * @param {string} selector Closest selector.
     * @returns {FakeFilterInput | null}
     */
    closest(selector) {
        return selector === '[data-layer-filter]' ? this : null
    }
}

/**
 * Minimal filter row.
 */
class FakeFilterRow {
    hidden = false
    #search

    /**
     * @param {string} search Search text.
     */
    constructor(search) {
        this.#search = search
    }

    /**
     * @param {string} name Attribute name.
     * @returns {string}
     */
    getAttribute(name) {
        return name === 'data-layer-search' ? this.#search : ''
    }

    /**
     * @param {string} name Attribute name.
     * @param {boolean} enabled Whether the attribute is enabled.
     * @returns {void}
     */
    toggleAttribute(name, enabled) {
        if (name === 'hidden') {
            this.hidden = Boolean(enabled)
        }
    }
}

/**
 * Minimal filter group.
 */
class FakeFilterGroup {
    hidden = false
    #rows

    /**
     * @param {FakeFilterRow[]} rows Group rows.
     */
    constructor(rows) {
        this.#rows = rows
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeFilterRow[]}
     */
    querySelectorAll(selector) {
        return selector === '[data-layer-search]' ? this.#rows : []
    }

    /**
     * @param {string} name Attribute name.
     * @param {boolean} enabled Whether the attribute is enabled.
     * @returns {void}
     */
    toggleAttribute(name, enabled) {
        if (name === 'hidden') {
            this.hidden = Boolean(enabled)
        }
    }
}

/**
 * Minimal mount with layer groups.
 */
class FakeFilterMount extends FakeMount {
    #groups

    /**
     * @param {FakeFilterGroup[]} groups Layer groups.
     */
    constructor(groups) {
        super()
        this.#groups = groups
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeFilterGroup[]}
     */
    querySelectorAll(selector) {
        return selector === '[data-layer-group]' ? this.#groups : []
    }
}

/**
 * Minimal textarea for fallback copy tests.
 */
class FakeTextarea {
    attributes = new Map()
    selected = false
    style = {}
    value = ''

    /**
     * @param {string} name Attribute name.
     * @param {string} value Attribute value.
     * @returns {void}
     */
    setAttribute(name, value) {
        this.attributes.set(name, String(value))
    }

    /**
     * @returns {void}
     */
    select() {
        this.selected = true
    }
}

/**
 * Minimal document that supports execCommand copy fallback.
 */
class FakeClipboardDocument {
    commands = []
    createdTextareas = []
    body = {
        appended: [],
        removed: [],
        appendChild: (node) => {
            this.body.appended.push(node)
        },
        removeChild: (node) => {
            this.body.removed.push(node)
        }
    }

    /**
     * @param {string} tagName Element tag name.
     * @returns {FakeTextarea}
     */
    createElement(tagName) {
        assert.equal(tagName, 'textarea')
        const node = new FakeTextarea()
        this.createdTextareas.push(node)
        return node
    }

    /**
     * @param {string} command Copy command.
     * @returns {boolean}
     */
    execCommand(command) {
        this.commands.push(command)
        return true
    }
}

/**
 * Verifies copy buttons write only the full detail/name text without selecting
 * the component row.
 */
test('ViewerSidebarEventBinder copies component detail text without selection', async () => {
    const mount = new FakeMount()
    const copied = []
    const selections = []
    const button = new FakeButton({
        'data-component-detail-copy': 'true',
        'data-component-copy-text': 'RP2040_minimal:USB_Micro-B_A'
    })

    ViewerSidebarEventBinder.bindComponentDetailCopy(mount, {
        async writeText(value) {
            copied.push(value)
        }
    })
    ViewerSidebarEventBinder.bindPcbComponentSelectionChange(mount, (change) =>
        selections.push(change)
    )

    const event = mount.click(button)
    await Promise.resolve()

    assert.deepEqual(copied, ['RP2040_minimal:USB_Micro-B_A'])
    assert.deepEqual(selections, [])
    assert.equal(event.defaultPrevented, true)
    assert.equal(event.propagationStopped, true)
    assert.equal(event.immediateStopped, true)
})

/**
 * Verifies copy buttons fall back to a temporary selection when the Clipboard
 * API is unavailable.
 */
test('ViewerSidebarEventBinder falls back to selection copy', () => {
    const documentRef = new FakeClipboardDocument()
    const mount = new FakeMount(documentRef)
    const button = new FakeButton({
        'data-component-detail-copy': 'true',
        'data-component-copy-text': 'Package_SO:SOIC-8_5.23x5.23mm_P1.27mm'
    })

    ViewerSidebarEventBinder.bindComponentDetailCopy(mount)

    mount.click(button)

    assert.deepEqual(documentRef.commands, ['copy'])
    assert.equal(documentRef.createdTextareas.length, 1)
    assert.equal(
        documentRef.createdTextareas[0].value,
        'Package_SO:SOIC-8_5.23x5.23mm_P1.27mm'
    )
    assert.equal(documentRef.createdTextareas[0].selected, true)
    assert.deepEqual(documentRef.body.appended, documentRef.createdTextareas)
    assert.deepEqual(documentRef.body.removed, documentRef.createdTextareas)
})

/**
 * Verifies selected-part export buttons emit target format details.
 */
test('ViewerSidebarEventBinder binds selected part export buttons', () => {
    const mount = new FakeMount()
    const exports = []
    const button = new FakeButton({
        'data-document-id': 'doc-1',
        'data-pcb-component-key': 'U1',
        'data-selected-part-export-format': 'kicad'
    })

    ViewerSidebarEventBinder.bindSelectedPartExport(mount, (change) =>
        exports.push(change)
    )

    const event = mount.click(button)

    assert.deepEqual(exports, [
        {
            documentId: 'doc-1',
            componentKey: 'U1',
            format: 'kicad'
        }
    ])
    assert.equal(event.defaultPrevented, true)
})

/**
 * Verifies Gerber file rows emit render mode and source-layer details.
 */
test('ViewerSidebarEventBinder binds Gerber render file rows', () => {
    const mount = new FakeMount()
    const selections = []
    const button = new FakeButton({
        'data-gerber-document-id': 'doc-1',
        'data-gerber-render-mode': 'separated',
        'data-gerber-layer-id': 'layer-bottom'
    })

    ViewerSidebarEventBinder.bindGerberRenderSelection(mount, (change) =>
        selections.push(change)
    )

    const event = mount.click(button)

    assert.deepEqual(selections, [
        {
            documentId: 'doc-1',
            renderMode: 'separated',
            layerId: 'layer-bottom'
        }
    ])
    assert.equal(event.defaultPrevented, true)
})

/**
 * Verifies net rows emit selected net details.
 */
test('ViewerSidebarEventBinder binds PCB net selection buttons', () => {
    const mount = new FakeMount()
    const selections = []
    const button = new FakeButton({
        'data-document-id': 'doc-1',
        'data-pcb-net-key': 'SENSE_A'
    })

    ViewerSidebarEventBinder.bindPcbNetSelectionChange(mount, (change) =>
        selections.push(change)
    )

    const event = mount.click(button)

    assert.deepEqual(selections, [
        {
            documentId: 'doc-1',
            netName: 'SENSE_A'
        }
    ])
    assert.equal(event.defaultPrevented, true)
})

/**
 * Verifies copy buttons do not also toggle net selection.
 */
test('ViewerSidebarEventBinder keeps copy clicks out of net selection', async () => {
    const mount = new FakeMount()
    const copied = []
    const selections = []
    const button = new FakeButton({
        'data-component-detail-copy': 'true',
        'data-component-copy-text': 'SENSE_A'
    })

    ViewerSidebarEventBinder.bindComponentDetailCopy(mount, {
        async writeText(value) {
            copied.push(value)
        }
    })
    ViewerSidebarEventBinder.bindPcbNetSelectionChange(mount, (change) =>
        selections.push(change)
    )

    mount.click(button)
    await Promise.resolve()

    assert.deepEqual(copied, ['SENSE_A'])
    assert.deepEqual(selections, [])
})

/**
 * Verifies selected-part export buttons do not also toggle component selection.
 */
test('ViewerSidebarEventBinder keeps export clicks out of component selection', () => {
    const mount = new FakeMount()
    const selections = []
    const exports = []
    const button = new FakeButton({
        'data-document-id': 'doc-1',
        'data-pcb-component-key': 'U1',
        'data-selected-part-export-format': 'kicad'
    })

    ViewerSidebarEventBinder.bindPcbComponentSelectionChange(mount, (change) =>
        selections.push(change)
    )
    ViewerSidebarEventBinder.bindSelectedPartExport(mount, (change) =>
        exports.push(change)
    )

    const event = mount.click(button)

    assert.deepEqual(selections, [])
    assert.deepEqual(exports, [
        {
            documentId: 'doc-1',
            componentKey: 'U1',
            format: 'kicad'
        }
    ])
    assert.equal(event.defaultPrevented, true)
})

/**
 * Verifies layer search filters rows and hides empty layer groups.
 */
test('ViewerSidebarEventBinder filters layer rows by search text', () => {
    const topLayer = new FakeFilterRow('top layer f.cu copper')
    const overlayLayer = new FakeFilterRow('top overlay f.silks')
    const bottomLayer = new FakeFilterRow('bottom layer b.cu copper')
    const frontGroup = new FakeFilterGroup([topLayer, overlayLayer])
    const backGroup = new FakeFilterGroup([bottomLayer])
    const mount = new FakeFilterMount([frontGroup, backGroup])

    ViewerSidebarEventBinder.bindLayerFilter(mount)

    mount.input(new FakeFilterInput('bottom'))

    assert.equal(topLayer.hidden, true)
    assert.equal(overlayLayer.hidden, true)
    assert.equal(frontGroup.hidden, true)
    assert.equal(bottomLayer.hidden, false)
    assert.equal(backGroup.hidden, false)
})
