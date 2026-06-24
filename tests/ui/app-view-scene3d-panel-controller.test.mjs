import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewScene3dPanelController } from '../../src/ui/AppViewScene3dPanelController.mjs'

/**
 * Minimal DOM node used by the 3D panel lifecycle tests.
 */
class FakeNode {
    /** @type {Map<string, string>} */
    #attributes

    constructor() {
        this.#attributes = new Map()
        this.hidden = false
    }

    /**
     * @param {string} name Attribute name.
     * @param {string} value Attribute value.
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
        if (name === 'hidden') {
            this.hidden = true
        }
    }

    /**
     * @param {string} name Attribute name.
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(name)
        if (name === 'hidden') {
            this.hidden = false
        }
    }
}

/**
 * Minimal checkbox node for the app-owned model-search toggle.
 */
class FakeCheckboxNode extends FakeNode {
    constructor() {
        super()
        this.checked = false
    }
}

/**
 * Minimal content node that exposes the selectors used by the 3D binder.
 */
class FakeContentNode {
    constructor() {
        this.childNodes = []
        this._innerHTML = ''
        this.nodes = new Map()
    }

    /**
     * @param {string} markup Rendered panel markup.
     */
    set innerHTML(markup) {
        this._innerHTML = String(markup || '')
        this.nodes = new Map([
            ['[data-scene-3d-viewport]', new FakeNode()],
            ['[data-scene-3d-loading]', new FakeNode()],
            ['[data-scene-3d-model-search]', new FakeCheckboxNode()],
            ['[data-scene-3d-export="models-zip"]', new FakeNode()]
        ])
        this.childNodes = [new FakeNode()]
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML
    }

    /**
     * @param {string} selector CSS selector.
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.nodes.get(selector) || null
    }

    /**
     * @param {...FakeNode} nodes Replacement child nodes.
     * @returns {void}
     */
    replaceChildren(...nodes) {
        this.childNodes = nodes
    }
}

test('AppViewScene3dPanelController remounts the scene when session assets change', () => {
    const panelController = new AppViewScene3dPanelController()
    const contentNode = new FakeContentNode()
    const documentModel = {
        kind: 'pcb',
        pcb: {
            boardOutline: {},
            components: []
        }
    }
    const createdControllers = []
    const onSessionAssetsResolved = () => {}

    class FakeScene3dController {
        /**
         * @param {FakeNode} viewportNode Viewport mount.
         * @param {object} nextDocumentModel Mounted document model.
         * @param {{ sessionAssets?: object[] }} options Controller options.
         */
        constructor(viewportNode, nextDocumentModel, options = {}) {
            this.viewportNode = viewportNode
            this.documentModel = nextDocumentModel
            this.options = options
            this.isDisposed = false
            this.autoSearchUpdates = []
            createdControllers.push(this)
        }

        /**
         * @returns {void}
         */
        setSelectedComponent() {}

        /**
         * @param {boolean} enabled Next preference.
         * @returns {void}
         */
        setAutoSearchMissingModels(enabled) {
            this.autoSearchUpdates.push(enabled)
        }

        /**
         * @returns {void}
         */
        dispose() {
            this.isDisposed = true
        }
    }

    const baseOptions = {
        contentNode,
        documentId: 'board',
        documentModel,
        sessionAssets: [],
        autoSearchMissingModels: false,
        onSessionAssetsResolved,
        selectedComponentKey: '',
        onComponentSelectionChange: null,
        translate: (key) => key,
        createScene3dController: (viewportNode, nextDocumentModel, options) =>
            new FakeScene3dController(
                viewportNode,
                nextDocumentModel,
                options
            )
    }

    panelController.render(baseOptions)
    panelController.render({
        ...baseOptions,
        autoSearchMissingModels: true
    })
    panelController.render({
        ...baseOptions,
        autoSearchMissingModels: true,
        sessionAssets: [
            {
                name: 'U1.step',
                relativePath: 'Package_FAKE.3dshapes/U1.step',
                file: new Uint8Array([1, 2, 3]),
                format: 'step'
            }
        ]
    })
    panelController.render({
        ...baseOptions,
        autoSearchMissingModels: true,
        sessionAssets: [
            {
                name: 'U1.step',
                relativePath: 'Package_FAKE.3dshapes/U1.step',
                file: new Uint8Array([1, 2, 3]),
                format: 'step'
            }
        ]
    })

    assert.equal(createdControllers.length, 2)
    assert.equal(createdControllers[0].isDisposed, true)
    assert.deepEqual(createdControllers[0].autoSearchUpdates, [true])
    assert.deepEqual(createdControllers[1].autoSearchUpdates, [])
    assert.equal(createdControllers[1].options.sessionAssets.length, 1)
    assert.equal(
        createdControllers[1].options.onSessionAssetsResolved,
        onSessionAssetsResolved
    )
    assert.equal(
        createdControllers[1].options.sessionAssets[0].relativePath,
        'Package_FAKE.3dshapes/U1.step'
    )
})
