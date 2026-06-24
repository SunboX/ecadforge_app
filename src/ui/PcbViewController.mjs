import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'
import { PcbDiagnosticFocusModel } from '../core/PcbDiagnosticFocusModel.mjs'
import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'
import { PcbBoardClickGuard } from './PcbBoardClickGuard.mjs'
import { PcbDiagnosticNavigationController } from './PcbDiagnosticNavigationController.mjs'
import { PcbGerberRenderSelectionModel } from './PcbGerberRenderSelectionModel.mjs'
import { PcbHitTestPointResolver } from './PcbHitTestPointResolver.mjs'
import { PcbMeasurementInteractionController } from './PcbMeasurementInteractionController.mjs'
import { PcbSelectionMarkerBoundsResolver } from './PcbSelectionMarkerBoundsResolver.mjs'
import { PcbTraceLengthToggleController } from './PcbTraceLengthToggleController.mjs'
import { PcbViewRenderer } from './PcbViewRenderer.mjs'
import { SchematicViewportController } from './SchematicViewportController.mjs'
import { SvgClientBoundsGuard } from './SvgClientBoundsGuard.mjs'
import { PcbSvgPointResolver } from './PcbSvgPointResolver.mjs'
import { TouchTapSelectionGuard } from './TouchTapSelectionGuard.mjs'

const PRESERVED_VIEWPORT_KEY = '__ecadForgePreservedPcbViewport'

/**
 * Handles board-side selection and pan/zoom wiring for the 2D PCB view.
 */
export class PcbViewController {
    #contentNode
    #documentModel
    #documentId
    #side
    #translate
    #hiddenLayers
    #hiddenObjects
    #objectOpacities
    #selectedComponentKey
    #selectedNetName
    #hoveredNetName
    #traceLengthToggle
    #gerberRenderMode
    #gerberLayerId
    #gerberLayerIds
    #measurement
    #diagnosticNavigation
    #onComponentSelectionChange
    #onNetSelectionChange
    #onInteractionCandidatesChange
    #svgViewportController
    #boardClickGuard
    #touchTapGuard
    #renderGeneration
    #fontRefreshCompleted
    #handleClick
    #handleChange
    #handlePointerMove
    #handlePointerLeave
    #handleTouchStart
    #handleTouchMove
    #handleTouchEnd
    /**
     * @param {HTMLElement} contentNode PCB panel mount node.
     * @param {object} documentModel Document model.
     * @param {{ documentId?: string, side?: 'top' | 'bottom', hiddenLayers?: string[], hiddenObjects?: string[], objectOpacities?: { [objectKey: string]: number }, selectedComponentKey?: string, selectedNetName?: string, showTraceLengths?: boolean, gerberRenderMode?: string, gerberLayerId?: string, gerberLayerIds?: string[], onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, onNetSelectionChange?: ((change: { documentId: string, netName: string, source?: string }) => void) | null, onInteractionCandidatesChange?: ((change: { documentId: string, point: { x: number, y: number }, candidates: object[], selectedCandidate: object | null }) => void) | null, translate?: ((key: string) => string) | null }} [options] Initial options.
     */
    constructor(contentNode, documentModel, options = {}) {
        this.#contentNode = contentNode
        this.#documentModel = documentModel
        this.#documentId = String(options.documentId || '')
        this.#selectedComponentKey = String(options.selectedComponentKey || '')
        this.#selectedNetName = String(options.selectedNetName || '')
        this.#hoveredNetName = ''
        this.#traceLengthToggle = new PcbTraceLengthToggleController({
            visible: options.showTraceLengths,
            render: () =>
                this.#renderSide(this.#side, {
                    refreshFonts: false,
                    preserveViewport: true
                })
        })
        this.#gerberLayerIds = PcbGerberRenderSelectionModel.resolveLayerIds(
            documentModel,
            options.gerberLayerIds,
            options.gerberLayerId
        )
        this.#gerberLayerId = this.#gerberLayerIds[0] || ''
        this.#gerberRenderMode =
            PcbGerberRenderSelectionModel.resolveRenderMode(
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
        this.#boardClickGuard = new PcbBoardClickGuard((target) =>
            this.#resolvePcbSvgNode(target)
        )
        this.#touchTapGuard = new TouchTapSelectionGuard({
            readState: () => this.#readActiveSvgViewBox()
        })
        this.#measurement = new PcbMeasurementInteractionController({
            documentModel: this.#documentModel,
            render: () => this.#renderSide(this.#side, { preserveViewport: true }),
            resolvePcbSvgNode: (target) => this.#resolvePcbSvgNode(target),
            resolveSvgPoint: (svgNode, event) =>
                this.#resolveSvgPoint(svgNode, event),
            resolveHitTestPoint: (svgNode, point) =>
                this.#resolveHitTestPoint(svgNode, point)
        })
        this.#diagnosticNavigation = new PcbDiagnosticNavigationController(
            this.#contentNode,
            {
                onFocus: (diagnosticId) => this.#focusDiagnostic(diagnosticId)
            }
        )
        this.#renderGeneration = 0
        this.#fontRefreshCompleted = false
        this.#handleClick = (event) => this.#handleClickEvent(event)
        this.#handleChange = (event) => this.#handleChangeEvent(event)
        this.#handlePointerMove = (event) => this.#handlePointerMoveEvent(event)
        this.#handlePointerLeave = () => this.#handlePointerLeaveEvent()
        this.#handleTouchStart = (event) => this.#handleTouchStartEvent(event)
        this.#handleTouchMove = (event) => this.#touchTapGuard.move(event)
        this.#handleTouchEnd = (event) => this.#handleTouchEndEvent(event)

        this.#contentNode.addEventListener('click', this.#handleClick)
        this.#contentNode.addEventListener('change', this.#handleChange)
        this.#contentNode.addEventListener(
            'mousedown',
            this.#boardClickGuard.handleMouseDown
        )
        this.#contentNode.addEventListener('mousemove', this.#handlePointerMove)
        this.#contentNode.addEventListener(
            'mouseleave',
            this.#handlePointerLeave
        )
        this.#contentNode.addEventListener('touchstart', this.#handleTouchStart)
        this.#contentNode.addEventListener('touchmove', this.#handleTouchMove)
        this.#contentNode.addEventListener('touchend', this.#handleTouchEnd)
        this.#contentNode.addEventListener('touchcancel', this.#handleTouchEnd)
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
        if (
            !PcbGerberRenderSelectionModel.isGerberDocument(this.#documentModel)
        ) {
            return
        }

        const requestedLayerIds =
            selection.layerIds === undefined && selection.layerId === undefined
                ? this.#gerberLayerIds
                : selection.layerIds
        const nextLayerIds = PcbGerberRenderSelectionModel.resolveLayerIds(
            this.#documentModel,
            requestedLayerIds,
            selection.layerId
        )
        const nextLayerId = nextLayerIds[0] || ''
        const nextRenderMode = PcbGerberRenderSelectionModel.resolveRenderMode(
            selection.renderMode,
            nextLayerIds
        )
        if (
            nextRenderMode === this.#gerberRenderMode &&
            PcbGerberRenderSelectionModel.sameStringList(
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
            'mousedown',
            this.#boardClickGuard.handleMouseDown
        )
        this.#contentNode.removeEventListener(
            'mousemove',
            this.#handlePointerMove
        )
        this.#contentNode.removeEventListener(
            'mouseleave',
            this.#handlePointerLeave
        )
        this.#contentNode.removeEventListener(
            'touchstart',
            this.#handleTouchStart
        )
        this.#contentNode.removeEventListener(
            'touchmove',
            this.#handleTouchMove
        )
        this.#contentNode.removeEventListener('touchend', this.#handleTouchEnd)
        this.#contentNode.removeEventListener(
            'touchcancel',
            this.#handleTouchEnd
        )
        this.#clearClickableCursor()
        this.#boardClickGuard.reset()
        this.#touchTapGuard.reset()
        this.#diagnosticNavigation.dispose()
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

        if (this.#traceLengthToggle.handleClick(event)) {
            return
        }

        if (this.#measurement.handleCopy(event)) {
            return
        }

        if (this.#measurement.handleToolSelection(event)) {
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
        if (this.#boardClickGuard.shouldSuppressClick(event)) {
            return
        }

        if (this.#measurement.handleBoardClick(event)) {
            return
        }

        this.#selectBoardHit(event)
    }
    /**
     * Starts tracking a possible mobile board tap.
     * @param {Event} event Touch event.
     * @returns {void}
     */
    #handleTouchStartEvent(event) {
        if (!this.#resolvePcbSvgNode(event.target)) {
            this.#touchTapGuard.reset()
            return
        }

        this.#touchTapGuard.start(event)
    }
    /**
     * Selects board content from a completed stationary mobile tap.
     * @param {Event} event Touch event.
     * @returns {void}
     */
    #handleTouchEndEvent(event) {
        if (event.type === 'touchcancel') {
            this.#touchTapGuard.reset()
            return
        }

        const tap = this.#touchTapGuard.end(event)
        if (!tap) {
            return
        }

        if (this.#measurement.handleBoardClick(tap)) {
            return
        }

        this.#selectBoardHit(tap)
    }
    /**
     * Selects the highest-priority PCB hit candidate for one event point.
     * @param {Event | { target?: unknown, clientX?: number, clientY?: number }} event Selection event.
     * @returns {void}
     */
    #selectBoardHit(event) {
        const hit = this.#resolveBoardHit(event)
        if (!hit) {
            if (PcbViewController.#isInteractiveSvg(event.target)) {
                this.#emitComponentSelection(null)
                this.#emitNetSelection(null)
            }
            return
        }

        const componentCandidate = PcbViewController.#componentCandidate(
            hit.candidates
        )
        const netCandidate = PcbViewController.#netCandidate(hit.candidates)
        const selectedCandidate =
            componentCandidate || netCandidate || hit.candidates[0] || null
        this.#emitInteractionCandidates(
            hit.point,
            hit.candidates,
            selectedCandidate
        )
        this.#emitComponentSelection(componentCandidate)
        this.#emitNetSelection(componentCandidate ? null : netCandidate)
    }
    /**
     * Handles pointer movement over the PCB view.
     * @param {Event} event Pointer event.
     * @returns {void}
     */
    #handlePointerMoveEvent(event) {
        if (this.#measurement.isActive()) {
            this.#setHoveredNetName('')
            this.#setMeasurementCursor(true)
            return
        }
        const svgNode = this.#resolvePcbSvgNode(event.target)
        if (SvgClientBoundsGuard.isOutside(svgNode, event)) {
            this.#setClickableCursor(false)
            this.#setHoveredNetName('')
            return
        }
        const hit = this.#resolveBoardHit(event)
        const componentCandidate = hit
            ? PcbViewController.#componentCandidate(hit.candidates)
            : null
        const netCandidate = hit
            ? PcbViewController.#netCandidate(hit.candidates)
            : null
        const clickable = Boolean(componentCandidate || netCandidate)

        if (
            EcadFormatRegistry.sourceFormatForDocument(this.#documentModel) ===
            'circuitjson'
        ) {
            this.#setHoveredNetName(
                PcbViewController.#candidateNetName(netCandidate)
            )
        }
        this.#setClickableCursor(clickable)
    }
    /** Handles pointer exit from the PCB view. @returns {void} */
    #handlePointerLeaveEvent() {
        this.#clearClickableCursor()
        this.#setHoveredNetName('')
    }
    /**
     * Resolves one board-space hit test from a pointer event.
     * @param {Event} event Pointer event.
     * @returns {{ svgNode: SVGSVGElement | HTMLElement, point: { x: number, y: number }, candidates: object[] } | null}
     */
    #resolveBoardHit(event) {
        const svgNode = this.#resolvePcbSvgNode(event.target)
        if (!svgNode) return null

        const point = this.#resolveSvgPoint(svgNode, event)
        if (!point) return null
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
        return PcbHitTestPointResolver.resolve(
            this.#documentModel,
            svgNode,
            point,
            this.#side
        )
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
     * Sets the measurement cursor on the active PCB SVG.
     * @param {boolean} active Whether measurement is active.
     * @returns {void}
     */
    #setMeasurementCursor(active) {
        const svgNode = this.#contentNode.querySelector('.pcb-svg')
        if (!svgNode?.style) {
            return
        }

        svgNode.style.cursor = active ? 'crosshair' : ''
    }
    /**
     * Clears the clickable cursor from the active PCB SVG.
     * @returns {void}
     */
    #clearClickableCursor() {
        this.#setMeasurementCursor(false)
        this.#setClickableCursor(false)
    }
    /**
     * Stores the hovered net name and re-renders the view when it changes.
     * @param {string} netName Hovered net name.
     * @returns {void}
     */
    #setHoveredNetName(netName) {
        const nextNetName = String(netName || '').trim()
        if (nextNetName === this.#hoveredNetName) return

        this.#hoveredNetName = nextNetName
        this.#renderSide(this.#side, {
            refreshFonts: false,
            preserveViewport: true
        })
    }
    /**
     * Reads the active PCB SVG viewBox for tap invalidation.
     * @returns {string}
     */
    #readActiveSvgViewBox() {
        const svgNode = this.#contentNode.querySelector('.pcb-svg')
        return String(svgNode?.getAttribute?.('viewBox') || '')
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
        this.#selectedComponentKey = componentKey
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
        return PcbSvgPointResolver.resolve(svgNode, event)
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
                gerberLayerIds: this.#gerberLayerIds,
                measurement: this.#measurement.snapshot(),
                hoveredNetName: this.#hoveredNetName,
                showTraceLengths: this.#traceLengthToggle.visible
            }
        )
        const renderedDefaultViewBox = this.#readCurrentViewBox()
        const restoredViewport = this.#restorePreservedViewport()
        if (!restoredViewport.restored) {
            this.#applyViewBox(preservedViewBox)
        }
        this.#attachSvgViewportController(renderedDefaultViewBox)
        this.#centerSelectedComponent(restoredViewport.selectedComponentKey)

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
    #attachSvgViewportController(defaultViewBox = '') {
        const svgNode = this.#contentNode.querySelector('.pcb-svg')
        if (!PcbViewController.#isInteractiveSvg(svgNode)) {
            return
        }

        this.#svgViewportController = new SchematicViewportController(svgNode, {
            defaultViewBox
        })
    }
    /**
     * Centers the active PCB viewport on a newly selected component marker.
     * @param {string} previousSelectedComponentKey Component key from the preserved viewport.
     * @returns {void}
     */
    #centerSelectedComponent(previousSelectedComponentKey) {
        const selectedKey = String(this.#selectedComponentKey || '').trim()
        if (
            !selectedKey ||
            selectedKey === String(previousSelectedComponentKey || '').trim()
        ) {
            return
        }

        this.#svgViewportController?.centerBounds(
            PcbSelectionMarkerBoundsResolver.resolve(
                this.#contentNode.innerHTML,
                selectedKey
            )
        )
    }
    /**
     * Focuses the active PCB viewport around one diagnostic target.
     * @param {string} diagnosticId Diagnostic id.
     * @returns {void}
     */
    #focusDiagnostic(diagnosticId) {
        const focus = PcbDiagnosticFocusModel.build(this.#documentModel).get(
            String(diagnosticId || '').trim()
        )
        if (!focus) return

        this.#svgViewportController?.focusBounds(
            PcbDiagnosticFocusModel.viewportBounds(focus)
        )
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
            selectedComponentKey: this.#selectedComponentKey,
            viewBox
        }
    }
    /**
     * Restores a previously stored viewBox when remounting the same PCB side.
     * @returns {{ restored: boolean, selectedComponentKey: string }}
     */
    #restorePreservedViewport() {
        const preserved = this.#contentNode[PRESERVED_VIEWPORT_KEY]
        delete this.#contentNode[PRESERVED_VIEWPORT_KEY]
        if (
            !preserved ||
            preserved.documentModel !== this.#documentModel ||
            preserved.side !== this.#side
        ) {
            return { restored: false, selectedComponentKey: '' }
        }

        return {
            restored: this.#applyViewBox(preserved.viewBox),
            selectedComponentKey: String(preserved.selectedComponentKey || '')
        }
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
}
