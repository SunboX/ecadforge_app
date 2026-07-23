import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewPcbInteractionPreviewUpdater } from '../../src/ui/AppViewPcbInteractionPreviewUpdater.mjs'

/**
 * Minimal class list used by preview row fixtures.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens

    /**
     * @param {string[]} [tokens] Initial class tokens.
     */
    constructor(tokens = []) {
        this.#tokens = new Set(tokens)
    }

    /**
     * @param {...string} tokens Class tokens.
     * @returns {void}
     */
    add(...tokens) {
        tokens.forEach((token) => this.#tokens.add(token))
    }

    /**
     * @param {...string} tokens Class tokens.
     * @returns {void}
     */
    remove(...tokens) {
        tokens.forEach((token) => this.#tokens.delete(token))
    }

    /**
     * @param {string} token Class token.
     * @returns {boolean}
     */
    contains(token) {
        return this.#tokens.has(token)
    }
}

/**
 * Minimal preview row shell.
 */
class FakeRowShell {
    constructor() {
        this.classList = new FakeClassList()
    }
}

/**
 * Minimal preview row button.
 */
class FakeRowButton {
    /**
     * @param {string} attributeName Row key attribute.
     * @param {string} value Row key.
     */
    constructor(attributeName, value) {
        this.attributeName = attributeName
        this.value = value
        this.classList = new FakeClassList()
        this.shell = new FakeRowShell()
    }

    /**
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return name === this.attributeName ? this.value : null
    }

    /**
     * @param {string} selector Parent selector.
     * @returns {FakeRowShell | null}
     */
    closest(selector) {
        return selector === '.viewer-sidebar__component-row-shell'
            ? this.shell
            : null
    }
}

/**
 * Minimal interaction inspector.
 */
class FakeInspector {
    /**
     * @param {FakePanel} panel Parent panel.
     */
    constructor(panel) {
        this.panel = panel
    }

    /**
     * Removes the mounted inspector.
     * @returns {void}
     */
    remove() {
        this.panel.inspector = null
        this.panel.markup = ''
    }
}

/**
 * Minimal active sidebar panel.
 */
class FakePanel {
    constructor() {
        this.inspector = null
        this.markup = ''
        this.insertions = 0
    }

    /**
     * @param {string} selector Inspector selector.
     * @returns {FakeInspector | null}
     */
    querySelector(selector) {
        return selector === '[data-pcb-interaction-inspector]'
            ? this.inspector
            : null
    }

    /**
     * @param {InsertPosition} _position Insertion position.
     * @param {string} markup Inspector markup.
     * @returns {void}
     */
    insertAdjacentHTML(_position, markup) {
        this.markup = markup
        this.inspector = new FakeInspector(this)
        this.insertions += 1
    }
}

/**
 * Minimal mounted sidebar rail.
 */
class FakeRail {
    constructor() {
        this.root = {}
        this.panel = new FakePanel()
        this.componentRows = [
            new FakeRowButton('data-pcb-component-key', 'U1'),
            new FakeRowButton('data-pcb-component-key', 'R1')
        ]
        this.netRows = [new FakeRowButton('data-pcb-net-key', 'VBUS')]
        this.queryAllCalls = 0
        this.innerHTMLWrites = 1
    }

    /**
     * @param {string} selector Element selector.
     * @returns {object | FakePanel | null}
     */
    querySelector(selector) {
        if (selector === '.viewer-sidebar') return this.root
        if (selector === '.viewer-sidebar__panel') return this.panel
        return null
    }

    /**
     * @param {string} selector Row selector.
     * @returns {FakeRowButton[]}
     */
    querySelectorAll(selector) {
        this.queryAllCalls += 1
        if (selector === '[data-pcb-component-key]') {
            return this.componentRows
        }
        if (selector === '[data-pcb-net-key]') return this.netRows
        return []
    }
}

/**
 * Creates a PCB preview snapshot.
 * @param {object | null} selectedCandidate Selected interaction candidate.
 * @param {object[]} candidates Interaction candidates.
 * @returns {object}
 */
function createSnapshot(selectedCandidate, candidates) {
    return {
        activeDocumentId: 'doc-1',
        pcbInteractionPreview: {
            documentId: 'doc-1',
            source: 'hover',
            point: { x: 1.25, y: 2.5 },
            selectedCandidate,
            candidates
        }
    }
}

/**
 * Verifies transient PCB previews update only mounted preview nodes.
 */
test('PCB interaction previews avoid rebuilding and rescanning the sidebar', () => {
    const rail = new FakeRail()
    const updater = new AppViewPcbInteractionPreviewUpdater((key) =>
        key === 'sidebar.pcbInteraction' ? 'PCB interaction' : key
    )

    updater.update(
        rail,
        createSnapshot(null, [
            { kind: 'component', componentKey: 'U1', netName: 'VBUS' }
        ])
    )

    assert.equal(rail.innerHTMLWrites, 1)
    assert.equal(rail.queryAllCalls, 2)
    assert.equal(rail.componentRows[0].classList.contains('is-preview'), true)
    assert.equal(
        rail.componentRows[0].shell.classList.contains('is-preview'),
        true
    )
    assert.equal(rail.netRows[0].classList.contains('is-preview'), true)
    assert.match(rail.panel.markup, /data-pcb-interaction-inspector="true"/)

    updater.update(
        rail,
        createSnapshot({ kind: 'component', componentKey: 'R1' }, [
            { kind: 'component', componentKey: 'R1' }
        ])
    )

    assert.equal(rail.innerHTMLWrites, 1)
    assert.equal(rail.queryAllCalls, 2)
    assert.equal(rail.componentRows[0].classList.contains('is-preview'), false)
    assert.equal(rail.componentRows[1].classList.contains('is-preview'), true)
    assert.equal(rail.netRows[0].classList.contains('is-preview'), false)
    assert.equal(rail.panel.insertions, 2)
})
