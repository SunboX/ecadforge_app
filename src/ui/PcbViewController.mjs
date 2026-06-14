import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'
import { PcbViewRenderer } from './PcbViewRenderer.mjs'
import { SchematicViewportController } from './SchematicViewportController.mjs'

const PRESERVED_VIEWPORT_KEY = '__ecadForgePreservedPcbViewport'

/**
 * Handles board-side selection and pan/zoom wiring for the 2D PCB view.
 */
export class PcbViewController {
    /** @type {HTMLElement} */
    #contentNode

    /** @type {object} */
    #documentModel

    /** @type {string} */
    #documentId

    /** @type {'top' | 'bottom'} */
    #side

    /** @type {((key: string) => string) | null} */
    #translate

    /** @type {string[]} */
    #hiddenLayers

    /** @type {string[]} */
    #hiddenObjects

    /** @type {{ [objectKey: string]: number }} */
    #objectOpacities

    /** @type {string} */
    #selectedComponentKey

    /** @type {string} */
    #selectedNetName

    /** @type {'composite' | 'separated'} */
    #gerberRenderMode

    /** @type {string} */
    #gerberLayerId

    /** @type {string[]} */
    #gerberLayerIds

    /** @type {((change: { documentId: string, componentKey: string, source?: string }) => void) | null} */
    #onComponentSelectionChange

    /** @type {((change: { documentId: string, netName: string, source?: string }) => void) | null} */
    #onNetSelectionChange

    /** @type {((change: { documentId: string, point: { x: number, y: number }, candidates: object[], selectedCandidate: object | null }) => void) | null} */
    #onInteractionCandidatesChange

    /** @type {SchematicViewportController | null} */
    #svgViewportController

    /** @type {number} */
    #renderGeneration

    /** @type {boolean} */
    #fontRefreshCompleted

    /** @type {(event: Event) => void} */
    #handleClick

    /** @type {(event: Event) => void} */
    #handleChange

    /** @type {(event: Event) => void} */
    #handlePointerMove

    /** @type {() => void} */
    #handlePointerLeave

    /**
     * @param {HTMLElement} contentNode PCB panel mount node.
     * @param {object} documentModel Document model.
     * @param {{ documentId?: string, side?: 'top' | 'bottom', hiddenLayers?: string[], hiddenObjects?: string[], objectOpacities?: { [objectKey: string]: number }, selectedComponentKey?: string, selectedNetName?: string, gerberRenderMode?: string, gerberLayerId?: string, gerberLayerIds?: string[], onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, onNetSelectionChange?: ((change: { documentId: string, netName: string, source?: string }) => void) | null, onInteractionCandidatesChange?: ((change: { documentId: string, point: { x: number, y: number }, candidates: object[], selectedCandidate: object | null }) => void) | null, translate?: ((key: string) => string) | null }} [options] Initial options.
     */
    constructor(contentNode, documentModel, options = {}) {
        this.#contentNode = contentNode
        this.#documentModel = documentModel
        this.#documentId = String(options.documentId || '')
        this.#selectedComponentKey = String(options.selectedComponentKey || '')
        this.#selectedNetName = String(options.selectedNetName || '')
        this.#gerberLayerIds = PcbViewController.#resolveGerberLayerIds(
            documentModel,
            options.gerberLayerIds,
            options.gerberLayerId
        )
        this.#gerberLayerId = this.#gerberLayerIds[0] || ''
        this.#gerberRenderMode = PcbViewController.#resolveGerberRenderMode(
            options.gerberRenderMode,
            this.#gerberLayerIds
        )
        this.#side = PcbViewController.#resolveInitialSide(
            documentModel,
            options.side,
            this.#selectedComponentKey
        )
        this.#hiddenLayers = Array.isArray(options.hiddenLayers)
            ? options.hiddenLayers.map(String)
            : []
        this.#hiddenObjects = Array.isArray(options.hiddenObjects)
            ? options.hiddenObjects.map(String)
            : []
        this.#objectOpacities =
            options.objectOpacities &&
            typeof options.objectOpacities === 'object' &&
            !Array.isArray(options.objectOpacities)
                ? { ...options.objectOpacities }
                : {}
        this.#onComponentSelectionChange =
            typeof options.onComponentSelectionChange === 'function'
                ? options.onComponentSelectionChange
                : null
        this.#onNetSelectionChange =
            typeof options.onNetSelectionChange === 'function'
                ? options.onNetSelectionChange
                : null
        this.#onInteractionCandidatesChange =
            typeof options.onInteractionCandidatesChange === 'function'
                ? options.onInteractionCandidatesChange
                : null
        this.#translate = options.translate || null
        this.#svgViewportController = null
        this.#renderGeneration = 0
        this.#fontRefreshCompleted = false
        this.#handleClick = (event) => this.#handleClickEvent(event)
        this.#handleChange = (event) => this.#handleChangeEvent(event)
        this.#handlePointerMove = (event) => this.#handlePointerMoveEvent(event)
        this.#handlePointerLeave = () => this.#clearClickableCursor()

        this.#contentNode.addEventListener('click', this.#handleClick)
        this.#contentNode.addEventListener('change', this.#handleChange)
        this.#contentNode.addEventListener('mousemove', this.#handlePointerMove)
        this.#contentNode.addEventListener(
            'mouseleave',
            this.#handlePointerLeave
        )
        this.#renderSide(this.#side)
    }

    /**
     * Returns the currently rendered PCB side.
     * @returns {'top' | 'bottom'}
     */
    get side() {
        return this.#side
    }

    /**
     * Applies Gerber stack/file selection from external viewer chrome.
     * @param {{ renderMode?: string, layerId?: string, layerIds?: string[] }} selection Selection details.
     * @returns {void}
     */
    setGerberRenderSelection(selection = {}) {
        if (!PcbViewController.#isGerberDocument(this.#documentModel)) {
            return
        }

        const requestedLayerIds =
            selection.layerIds === undefined && selection.layerId === undefined
                ? this.#gerberLayerIds
                : selection.layerIds
        const nextLayerIds = PcbViewController.#resolveGerberLayerIds(
            this.#documentModel,
            requestedLayerIds,
            selection.layerId
        )
        const nextLayerId = nextLayerIds[0] || ''
        const nextRenderMode = PcbViewController.#resolveGerberRenderMode(
            selection.renderMode,
            nextLayerIds
        )
        if (
            nextRenderMode === this.#gerberRenderMode &&
            PcbViewController.#sameStringList(
                nextLayerIds,
                this.#gerberLayerIds
            )
        ) {
            return
        }

        this.#gerberLayerId = nextLayerId
        this.#gerberLayerIds = nextLayerIds
        this.#gerberRenderMode = nextRenderMode
        this.#renderSide(this.#side, { preserveViewport: true })
    }

    /**
     * Disposes current event and SVG viewport bindings.
     * @returns {void}
     */
    dispose() {
        this.#preserveCurrentViewport()
        this.#contentNode.removeEventListener('click', this.#handleClick)
        this.#contentNode.removeEventListener('change', this.#handleChange)
        this.#contentNode.removeEventListener(
            'mousemove',
            this.#handlePointerMove
        )
        this.#contentNode.removeEventListener(
            'mouseleave',
            this.#handlePointerLeave
        )
        this.#clearClickableCursor()
        this.#renderGeneration += 1
        this.#disposeSvgViewportController()
    }

    /**
     * Handles PCB panel clicks.
     * @param {Event} event Click event.
     * @returns {void}
     */
    #handleClickEvent(event) {
        if (this.#handleSideSelection(event)) {
            return
        }

        if (this.#handleGerberCompositeSelection(event)) {
            return
        }

        this.#handleBoardClick(event)
    }

    /**
     * Handles PCB panel change events.
     * @param {Event} event Change event.
     * @returns {void}
     */
    #handleChangeEvent(event) {
        this.#handleGerberLayerSelection(event)
    }

    /**
     * Handles Top/Bottom toolbar clicks.
     * @param {Event} event Click event.
     * @returns {boolean}
     */
    #handleSideSelection(event) {
        const target = event.target
        const button =
            target &&
            typeof target === 'object' &&
            typeof target.closest === 'function'
                ? target.closest('[data-pcb-view-side]')
                : null

        if (!button || typeof button.getAttribute !== 'function') {
            return false
        }

        event.preventDefault?.()
        const nextSide = PcbViewController.#normalizeSide(
            button.getAttribute('data-pcb-view-side')
        )
        if (nextSide === this.#side) {
            return true
        }

        this.#renderSide(nextSide)
        return true
    }

    /**
     * Handles Gerber composite toggle clicks.
     * @param {Event} event Click event.
     * @returns {boolean}
     */
    #handleGerberCompositeSelection(event) {
        const target = event.target
        const button =
            target &&
            typeof target === 'object' &&
            typeof target.closest === 'function'
                ? target.closest('[data-pcb-view-gerber-composite]')
                : null

        if (!button || typeof button.getAttribute !== 'function') {
            return false
        }

        event.preventDefault?.()
        this.setGerberRenderSelection({
            renderMode:
                this.#gerberRenderMode === 'separated'
                    ? 'composite'
                    : 'separated'
        })
        return true
    }

    /**
     * Handles Gerber source-layer select changes.
     * @param {Event} event Change event.
     * @returns {boolean}
     */
    #handleGerberLayerSelection(event) {
        const target = event.target
        const select =
            target &&
            typeof target === 'object' &&
            typeof target.closest === 'function'
                ? target.closest('[data-pcb-view-gerber-layer-select]')
                : null

        if (!select || typeof select.value !== 'string') {
            return false
        }

        event.preventDefault?.()
        this.setGerberRenderSelection({
            renderMode: 'separated',
            layerId: select.value
        })
        return true
    }

    /**
     * Handles clicks inside the active PCB SVG.
     * @param {Event} event Click event.
     * @returns {void}
     */
    #handleBoardClick(event) {
        const hit = this.#resolveBoardHit(event)
        if (!hit) {
            return
        }

        const selectedCandidate = hit.candidates[0] || null
        this.#emitInteractionCandidates(
            hit.point,
            hit.candidates,
            selectedCandidate
        )
        this.#emitComponentSelection(
            PcbViewController.#componentCandidate(hit.candidates)
        )
        this.#emitNetSelection(PcbViewController.#netCandidate(hit.candidates))
    }

    /**
     * Handles pointer movement over the PCB view.
     * @param {Event} event Pointer event.
     * @returns {void}
     */
    #handlePointerMoveEvent(event) {
        const hit = this.#resolveBoardHit(event)
        const componentCandidate = hit
            ? PcbViewController.#componentCandidate(hit.candidates)
            : null
        const netCandidate = hit
            ? PcbViewController.#netCandidate(hit.candidates)
            : null

        this.#setClickableCursor(Boolean(componentCandidate || netCandidate))
    }

    /**
     * Resolves one board-space hit test from a pointer event.
     * @param {Event} event Pointer event.
     * @returns {{ svgNode: SVGSVGElement | HTMLElement, point: { x: number, y: number }, candidates: object[] } | null}
     */
    #resolveBoardHit(event) {
        const svgNode = this.#resolvePcbSvgNode(event.target)
        if (!svgNode) {
            return null
        }

        const point = this.#resolveSvgPoint(svgNode, event)
        if (!point) {
            return null
        }
        const hitPoint = this.#resolveHitTestPoint(svgNode, point)

        return {
            svgNode,
            point: hitPoint,
            candidates: EcadRendererService.hitTestPcb(
                this.#documentModel,
                hitPoint,
                {
                    side: this.#side,
                    hiddenLayers: this.#hiddenLayers,
                    hiddenObjects: this.#hiddenObjects,
                    renderMode: this.#gerberRenderMode,
                    layerId: this.#gerberLayerId,
                    layerIds: this.#gerberLayerIds
                }
            )
        }
    }

    /**
     * Converts rendered SVG coordinates to the document's hit-test space.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @param {{ x: number, y: number }} point SVG root coordinate.
     * @returns {{ x: number, y: number }}
     */
    #resolveHitTestPoint(svgNode, point) {
        if (this.#documentModel?.sourceFormat !== 'gerber') {
            return point
        }
        const viewBox = PcbViewController.#parseViewBox(
            svgNode.getAttribute?.('viewBox')
        )
        const bounds = viewBox || this.#documentModel?.pcb?.bounds || {}
        const minY = Number(bounds.minY)
        const minX = Number(bounds.minX)
        const maxX = Number(
            viewBox ? viewBox.minX + viewBox.width : bounds.maxX
        )
        const maxY = Number(
            viewBox ? viewBox.minY + viewBox.height : bounds.maxY
        )
        if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
            return point
        }

        const x =
            this.#side === 'bottom' &&
            Number.isFinite(minX) &&
            Number.isFinite(maxX)
                ? minX + maxX - point.x
                : point.x

        return { x, y: minY + maxY - point.y }
    }

    /**
     * Sets the clickable cursor on the active PCB SVG.
     * @param {boolean} clickable Whether a component-backed hit is present.
     * @returns {void}
     */
    #setClickableCursor(clickable) {
        const svgNode = this.#contentNode.querySelector('.pcb-svg')
        if (!svgNode?.style) {
            return
        }

        svgNode.style.cursor = clickable ? 'pointer' : ''
    }

    /**
     * Clears the clickable cursor from the active PCB SVG.
     * @returns {void}
     */
    #clearClickableCursor() {
        this.#setClickableCursor(false)
    }

    /**
     * Emits overlap candidate data when a listener is configured.
     * @param {{ x: number, y: number }} point Board-space point.
     * @param {object[]} candidates Hit-test candidates.
     * @param {object | null} selectedCandidate Highest-priority candidate.
     * @returns {void}
     */
    #emitInteractionCandidates(point, candidates, selectedCandidate) {
        if (!this.#onInteractionCandidatesChange) {
            return
        }

        this.#onInteractionCandidatesChange({
            documentId: this.#documentId,
            point,
            candidates,
            selectedCandidate
        })
    }

    /**
     * Emits component selection or an empty key when no component is available.
     * @param {object | null} selectedCandidate Component-backed candidate.
     * @returns {void}
     */
    #emitComponentSelection(selectedCandidate) {
        const componentKey = String(
            selectedCandidate?.componentKey || ''
        ).trim()
        if (!this.#onComponentSelectionChange) {
            return
        }

        this.#onComponentSelectionChange({
            documentId: this.#documentId,
            componentKey,
            source: 'pcb-board'
        })
    }

    /**
     * Emits net selection or an empty name when no net is available.
     * @param {object | null} selectedCandidate Net-backed candidate.
     * @returns {void}
     */
    #emitNetSelection(selectedCandidate) {
        const netName = PcbViewController.#candidateNetName(selectedCandidate)
        if (!this.#onNetSelectionChange) {
            return
        }

        this.#onNetSelectionChange({
            documentId: this.#documentId,
            netName,
            source: 'pcb-board'
        })
    }

    /**
     * Resolves the SVG node associated with a click target.
     * @param {unknown} target Event target.
     * @returns {SVGSVGElement | HTMLElement | null}
     */
    #resolvePcbSvgNode(target) {
        const svgNode = this.#contentNode.querySelector('.pcb-svg')
        if (!PcbViewController.#isInteractiveSvg(svgNode)) {
            return null
        }

        if (target === svgNode) {
            return svgNode
        }

        if (
            target &&
            typeof target === 'object' &&
            typeof target.closest === 'function' &&
            target.closest('svg.pcb-svg') === svgNode
        ) {
            return svgNode
        }

        if (
            target &&
            typeof target === 'object' &&
            target.ownerSVGElement === svgNode
        ) {
            return svgNode
        }

        return null
    }

    /**
     * Resolves a click event into SVG viewBox coordinates.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @param {Event} event Click event.
     * @returns {{ x: number, y: number } | null}
     */
    #resolveSvgPoint(svgNode, event) {
        const matrixPoint = PcbViewController.#resolveSvgMatrixPoint(
            svgNode,
            event
        )
        if (matrixPoint) {
            return matrixPoint
        }

        return PcbViewController.#resolveViewBoxPoint(svgNode, event)
    }

    /**
     * Resolves an SVG point with native matrix APIs when available.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @param {Event} event Click event.
     * @returns {{ x: number, y: number } | null}
     */
    static #resolveSvgMatrixPoint(svgNode, event) {
        if (
            typeof svgNode.createSVGPoint !== 'function' ||
            typeof svgNode.getScreenCTM !== 'function'
        ) {
            return null
        }

        const matrix = svgNode.getScreenCTM()
        if (!matrix || typeof matrix.inverse !== 'function') {
            return null
        }

        const point = svgNode.createSVGPoint()
        point.x = Number(event.clientX) || 0
        point.y = Number(event.clientY) || 0
        const transformed = point.matrixTransform(matrix.inverse())

        return {
            x: Number(transformed.x) || 0,
            y: Number(transformed.y) || 0
        }
    }

    /**
     * Resolves an SVG point from the viewBox and client rectangle.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @param {Event} event Click event.
     * @returns {{ x: number, y: number } | null}
     */
    static #resolveViewBoxPoint(svgNode, event) {
        if (typeof svgNode.getBoundingClientRect !== 'function') {
            return null
        }

        const rect = svgNode.getBoundingClientRect()
        const viewBox = PcbViewController.#parseViewBox(
            svgNode.getAttribute?.('viewBox')
        )
        if (!viewBox || !rect.width || !rect.height) {
            return null
        }

        return {
            x:
                viewBox.minX +
                ((Number(event.clientX) || 0) - rect.left) *
                    (viewBox.width / rect.width),
            y:
                viewBox.minY +
                ((Number(event.clientY) || 0) - rect.top) *
                    (viewBox.height / rect.height)
        }
    }

    /**
     * Parses an SVG viewBox string.
     * @param {unknown} value Raw viewBox value.
     * @returns {{ minX: number, minY: number, width: number, height: number } | null}
     */
    static #parseViewBox(value) {
        const parts = String(value || '')
            .trim()
            .split(/[\s,]+/)
            .map(Number)
        if (
            parts.length !== 4 ||
            parts.some((part) => !Number.isFinite(part))
        ) {
            return null
        }

        return {
            minX: parts[0],
            minY: parts[1],
            width: parts[2],
            height: parts[3]
        }
    }

    /**
     * Returns the first component-backed candidate from a hit-test result.
     * @param {object[]} candidates Hit-test candidates.
     * @returns {object | null}
     */
    static #componentCandidate(candidates) {
        return (
            (Array.isArray(candidates) ? candidates : []).find((candidate) =>
                String(candidate?.componentKey || '').trim()
            ) || null
        )
    }

    /**
     * Returns the first net-backed candidate from a hit-test result.
     * @param {object[]} candidates Hit-test candidates.
     * @returns {object | null}
     */
    static #netCandidate(candidates) {
        return (
            (Array.isArray(candidates) ? candidates : []).find((candidate) =>
                PcbViewController.#candidateNetName(candidate)
            ) || null
        )
    }

    /**
     * Returns one candidate's net name.
     * @param {object | null} candidate Hit-test candidate.
     * @returns {string}
     */
    static #candidateNetName(candidate) {
        return String(
            candidate?.netName ?? candidate?.net ?? candidate?.net_name ?? ''
        ).trim()
    }

    /**
     * Replaces the PCB view with the selected board side.
     * @param {'top' | 'bottom'} side Requested side.
     * @param {{ refreshFonts?: boolean, preserveViewport?: boolean }} [options] Render options.
     * @returns {void}
     */
    #renderSide(side, options = {}) {
        this.#side = PcbViewController.#normalizeSide(side)
        const preservedViewBox = options.preserveViewport
            ? this.#readCurrentViewBox()
            : ''
        const generation = this.#renderGeneration + 1
        this.#renderGeneration = generation
        this.#disposeSvgViewportController()
        this.#contentNode.innerHTML = PcbViewRenderer.render(
            this.#documentModel,
            this.#side,
            this.#translate,
            this.#hiddenLayers,
            this.#hiddenObjects,
            this.#selectedComponentKey,
            this.#objectOpacities,
            this.#selectedNetName,
            {
                gerberRenderMode: this.#gerberRenderMode,
                gerberLayerId: this.#gerberLayerId,
                gerberLayerIds: this.#gerberLayerIds
            }
        )
        if (!this.#restorePreservedViewport()) {
            this.#applyViewBox(preservedViewBox)
        }
        this.#attachSvgViewportController()

        if (options.refreshFonts !== false && !this.#fontRefreshCompleted) {
            this.#refreshAfterFontsReady(generation)
        }
    }

    /**
     * Refreshes the current side once embedded SVG fonts are measurable.
     * @param {number} generation Render generation that scheduled the refresh.
     * @returns {void}
     */
    #refreshAfterFontsReady(generation) {
        if (!this.#hasEmbeddedPcbFonts()) {
            return
        }

        this.#waitForFontsReady()
            .then(() => {
                if (generation !== this.#renderGeneration) {
                    return
                }

                this.#fontRefreshCompleted = true
                this.#renderSide(this.#side, {
                    refreshFonts: false,
                    preserveViewport: true
                })
            })
            .catch(() => {})
    }

    /**
     * Waits until the browser has had a chance to register inline SVG fonts.
     * @returns {Promise<void>}
     */
    async #waitForFontsReady() {
        await Promise.resolve()
        const ready = globalThis.document?.fonts?.ready
        if (ready && typeof ready.then === 'function') {
            await ready
        }
    }

    /**
     * Checks whether the active PCB model has embedded font faces.
     * @returns {boolean}
     */
    #hasEmbeddedPcbFonts() {
        return Boolean(
            Array.isArray(this.#documentModel?.pcb?.embeddedFonts) &&
            this.#documentModel.pcb.embeddedFonts.length
        )
    }

    /**
     * Attaches pan and zoom to the active PCB SVG.
     * @returns {void}
     */
    #attachSvgViewportController() {
        const svgNode = this.#contentNode.querySelector('.pcb-svg')
        if (!PcbViewController.#isInteractiveSvg(svgNode)) {
            return
        }

        this.#svgViewportController = new SchematicViewportController(svgNode)
    }

    /**
     * Stores the active PCB viewBox so an AppView remount can keep pan/zoom.
     * @returns {void}
     */
    #preserveCurrentViewport() {
        const viewBox = this.#readCurrentViewBox()
        if (!viewBox) return

        this.#contentNode[PRESERVED_VIEWPORT_KEY] = {
            documentModel: this.#documentModel,
            side: this.#side,
            viewBox
        }
    }

    /**
     * Restores a previously stored viewBox when remounting the same PCB side.
     * @returns {boolean}
     */
    #restorePreservedViewport() {
        const preserved = this.#contentNode[PRESERVED_VIEWPORT_KEY]
        delete this.#contentNode[PRESERVED_VIEWPORT_KEY]
        if (
            !preserved ||
            preserved.documentModel !== this.#documentModel ||
            preserved.side !== this.#side
        ) {
            return false
        }

        return this.#applyViewBox(preserved.viewBox)
    }

    /**
     * Reads the active SVG viewBox.
     * @returns {string}
     */
    #readCurrentViewBox() {
        const svgNode = this.#contentNode.querySelector('.pcb-svg')
        return String(svgNode?.getAttribute?.('viewBox') || '')
    }

    /**
     * Applies a viewBox to the active PCB SVG when a value is available.
     * @param {string} viewBox SVG viewBox value.
     * @returns {boolean}
     */
    #applyViewBox(viewBox) {
        const value = String(viewBox || '').trim()
        if (!value) return false

        const svgNode = this.#contentNode.querySelector('.pcb-svg')
        if (typeof svgNode?.setAttribute !== 'function') return false

        svgNode.setAttribute('viewBox', value)
        return true
    }

    /**
     * Disposes the active SVG viewport controller.
     * @returns {void}
     */
    #disposeSvgViewportController() {
        this.#svgViewportController?.dispose()
        this.#svgViewportController = null
    }

    /**
     * Returns true when the queried node supports SVG viewport controls.
     * @param {unknown} node Queried node.
     * @returns {boolean}
     */
    static #isInteractiveSvg(node) {
        return Boolean(
            node &&
            typeof node === 'object' &&
            typeof node.getAttribute === 'function' &&
            typeof node.setAttribute === 'function' &&
            typeof node.getBoundingClientRect === 'function' &&
            typeof node.addEventListener === 'function' &&
            typeof node.removeEventListener === 'function'
        )
    }

    /**
     * Resolves the first rendered side for a selected component.
     * @param {object} documentModel PCB document model.
     * @param {unknown} requestedSide Caller-requested side.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {'top' | 'bottom'}
     */
    static #resolveInitialSide(
        documentModel,
        requestedSide,
        selectedComponentKey
    ) {
        return (
            PcbComponentSelectionModel.resolveSelectedComponentSide(
                documentModel,
                selectedComponentKey
            ) || PcbViewController.#normalizeSide(requestedSide)
        )
    }

    /**
     * Normalizes untrusted side input to the supported board-side names.
     * @param {unknown} side Requested side.
     * @returns {'top' | 'bottom'}
     */
    static #normalizeSide(side) {
        return side === 'bottom' ? 'bottom' : 'top'
    }

    /**
     * Resolves the first source-layer id from a Gerber document.
     * @param {object} documentModel PCB document model.
     * @returns {string}
     */
    static #firstGerberLayerId(documentModel) {
        const layers = Array.isArray(documentModel?.pcb?.fabrication?.layers)
            ? documentModel.pcb.fabrication.layers
            : []

        return String(layers[0]?.id || '')
    }

    /**
     * Returns true when the document carries fabrication source layers.
     * @param {object} documentModel PCB document model.
     * @returns {boolean}
     */
    static #isGerberDocument(documentModel) {
        return (
            documentModel?.sourceFormat === 'gerber' ||
            Array.isArray(documentModel?.pcb?.fabrication?.layers)
        )
    }

    /**
     * Resolves a safe source-layer id for Gerber single-file rendering.
     * @param {object} documentModel PCB document model.
     * @param {unknown} requestedLayerId Requested layer id.
     * @returns {string}
     */
    static #resolveGerberLayerIds(
        documentModel,
        requestedLayerIds,
        fallbackLayerId = ''
    ) {
        const requested = Array.isArray(requestedLayerIds)
            ? requestedLayerIds.map(String).filter(Boolean)
            : []
        const fallback = String(fallbackLayerId || '')
        if (!requested.length && fallback) {
            requested.push(fallback)
        }
        const layers = Array.isArray(documentModel?.pcb?.fabrication?.layers)
            ? documentModel.pcb.fabrication.layers
            : []
        const availableIds = new Set(
            layers.map((layer) => String(layer?.id || '')).filter(Boolean)
        )
        const selectedIds = requested.filter((id) => availableIds.has(id))
        return selectedIds.length
            ? selectedIds
            : [PcbViewController.#firstGerberLayerId(documentModel)].filter(
                  Boolean
              )
    }

    /**
     * Resolves whether Gerber rendering should show the full stack or one file.
     * @param {unknown} requestedRenderMode Requested render mode.
     * @param {string[]} layerIds Resolved source-layer ids.
     * @returns {'composite' | 'separated'}
     */
    static #resolveGerberRenderMode(requestedRenderMode, layerIds) {
        return requestedRenderMode === 'separated' && layerIds.length
            ? 'separated'
            : 'composite'
    }

    /**
     * Compares two string lists by ordered value.
     * @param {string[]} left First list.
     * @param {string[]} right Second list.
     * @returns {boolean}
     */
    static #sameStringList(left, right) {
        return (
            left.length === right.length &&
            left.every((value, index) => value === right[index])
        )
    }
}
