const ZOOM_IN_FACTOR = 0.97
const ZOOM_OUT_FACTOR = 1 / ZOOM_IN_FACTOR
const MIN_SCALE_RATIO = 0.05
const MAX_SCALE_RATIO = 4
const FOCUS_BOUNDS_PADDING_FACTOR = 8

/**
 * Controls schematic SVG pan and zoom through direct viewBox updates.
 */
export class SchematicViewportController {
    /** @type {{ getAttribute: (name: string) => string | null, setAttribute: (name: string, value: string) => void, getBoundingClientRect: () => { left: number, top: number, width: number, height: number }, addEventListener: (type: string, listener: (event: any) => void, options?: any) => void, removeEventListener: (type: string, listener: (event: any) => void, options?: any) => void, classList?: { add: (...tokens: string[]) => void, remove: (...tokens: string[]) => void }, ownerDocument?: { addEventListener: (type: string, listener: (event: any) => void) => void, removeEventListener: (type: string, listener: (event: any) => void) => void, documentElement?: { classList?: { add: (...tokens: string[]) => void, remove: (...tokens: string[]) => void } } } }} */
    #svg

    /** @type {{ x: number, y: number, width: number, height: number }} */
    #defaultViewBox

    /** @type {{ x: number, y: number, width: number, height: number }} */
    #viewBox

    /** @type {{ startClientX: number, startClientY: number, originViewBox: { x: number, y: number, width: number, height: number }, viewport: { left: number, top: number, scaleX: number, scaleY: number } } | null} */
    #dragState

    /** @type {{ mode: 'pan', startClientX: number, startClientY: number, originViewBox: { x: number, y: number, width: number, height: number } } | { mode: 'pinch', startDistance: number, anchorPoint: { x: number, y: number }, originViewBox: { x: number, y: number, width: number, height: number } } | null} */
    #touchState

    /** @type {number | null} */
    #animationFrame

    /** @type {(event: any) => void} */
    #boundWheel

    /** @type {(event: any) => void} */
    #boundMouseDown

    /** @type {(event: any) => void} */
    #boundMouseMove

    /** @type {(event: any) => void} */
    #boundMouseUp

    /** @type {(event: any) => void} */
    #boundTouchStart

    /** @type {(event: any) => void} */
    #boundTouchMove

    /** @type {(event: any) => void} */
    #boundTouchEnd

    /**
     * @param {{ getAttribute: (name: string) => string | null, setAttribute: (name: string, value: string) => void, getBoundingClientRect: () => { left: number, top: number, width: number, height: number }, addEventListener: (type: string, listener: (event: any) => void, options?: any) => void, removeEventListener: (type: string, listener: (event: any) => void, options?: any) => void, classList?: { add: (...tokens: string[]) => void, remove: (...tokens: string[]) => void }, ownerDocument?: { addEventListener: (type: string, listener: (event: any) => void) => void, removeEventListener: (type: string, listener: (event: any) => void) => void, documentElement?: { classList?: { add: (...tokens: string[]) => void, remove: (...tokens: string[]) => void } } } }} svgElement
     * @param {{ defaultViewBox?: string }} [options] Viewport options.
     */
    constructor(svgElement, options = {}) {
        this.#svg = svgElement
        const initialViewBox = this.#readViewBox()
        this.#defaultViewBox =
            SchematicViewportController.#parseViewBox(options.defaultViewBox) ||
            initialViewBox
        this.#viewBox = { ...initialViewBox }
        this.#dragState = null
        this.#touchState = null
        this.#animationFrame = null
        this.#boundWheel = (event) => this.#handleWheel(event)
        this.#boundMouseDown = (event) => this.#handleMouseDown(event)
        this.#boundMouseMove = (event) => this.#handleMouseMove(event)
        this.#boundMouseUp = (event) => this.#handleMouseUp(event)
        this.#boundTouchStart = (event) => this.#handleTouchStart(event)
        this.#boundTouchMove = (event) => this.#handleTouchMove(event)
        this.#boundTouchEnd = (event) => this.#handleTouchEnd(event)
        this.#bindEvents()
        this.#applyViewBox()
    }

    /**
     * Removes listeners and clears active drag state.
     * @returns {void}
     */
    dispose() {
        this.#unbindEvents()
        this.#cancelAnimation()
        this.#stopDragging()
        this.#stopTouchGesture()
    }

    /**
     * Restores the viewport to its default fitted viewBox.
     * @returns {void}
     */
    resetViewBox() {
        this.#cancelAnimation()
        this.#viewBox = { ...this.#defaultViewBox }
        this.#applyViewBox()
    }

    /**
     * Centers the current viewport on document-space bounds without changing
     * the current zoom level.
     * @param {{ x?: number, y?: number, width?: number, height?: number } | null} bounds Bounds to center.
     * @returns {boolean}
     */
    centerBounds(bounds) {
        const normalizedBounds =
            SchematicViewportController.#normalizeBounds(bounds)
        if (!normalizedBounds) {
            return false
        }

        this.#centerBoundsWithSize(
            normalizedBounds,
            this.#viewBox.width,
            this.#viewBox.height
        )

        return true
    }

    /**
     * Centers document-space bounds and zooms to a readable detail scale.
     * @param {{ x?: number, y?: number, width?: number, height?: number } | null} bounds Bounds to focus.
     * @param {{ paddingFactor?: number, animate?: boolean, animationDurationMs?: number }} [options] Focus options.
     * @returns {boolean}
     */
    focusBounds(bounds, options = {}) {
        const normalizedBounds =
            SchematicViewportController.#normalizeBounds(bounds)
        if (!normalizedBounds) {
            return false
        }

        const aspectRatio = this.#viewBox.width / this.#viewBox.height
        const paddingFactor =
            SchematicViewportController.#positiveNumber(
                options.paddingFactor
            ) || FOCUS_BOUNDS_PADDING_FACTOR
        const paddedWidth = Math.max(
            normalizedBounds.width * paddingFactor,
            normalizedBounds.height * paddingFactor * aspectRatio,
            this.#defaultViewBox.width * MIN_SCALE_RATIO
        )
        const nextWidth = this.#clampWidth(paddedWidth)
        const nextHeight = this.#clampHeight(nextWidth / aspectRatio)

        this.#centerBoundsWithSize(normalizedBounds, nextWidth, nextHeight, {
            animate: options.animate === true,
            durationMs: options.animationDurationMs
        })

        return true
    }

    /**
     * Centers document-space bounds only when they are outside the current
     * viewport.
     * @param {{ x?: number, y?: number, width?: number, height?: number } | null} bounds Bounds to reveal.
     * @returns {boolean}
     */
    centerBoundsIfOutsideViewport(bounds) {
        const normalizedBounds =
            SchematicViewportController.#normalizeBounds(bounds)
        if (!normalizedBounds) {
            return false
        }

        if (this.#containsBounds(normalizedBounds)) {
            return false
        }

        return this.centerBounds(normalizedBounds)
    }

    /**
     * Binds the viewport interaction listeners.
     * @returns {void}
     */
    #bindEvents() {
        this.#svg.addEventListener('wheel', this.#boundWheel, {
            passive: false
        })
        this.#svg.addEventListener('mousedown', this.#boundMouseDown)
        this.#svg.addEventListener('touchstart', this.#boundTouchStart, {
            passive: false
        })
        this.#svg.addEventListener('touchmove', this.#boundTouchMove, {
            passive: false
        })
        this.#svg.addEventListener('touchend', this.#boundTouchEnd)
        this.#svg.addEventListener('touchcancel', this.#boundTouchEnd)
        this.#getOwnerDocument().addEventListener(
            'mousemove',
            this.#boundMouseMove
        )
        this.#getOwnerDocument().addEventListener('mouseup', this.#boundMouseUp)
    }

    /**
     * Removes the viewport interaction listeners.
     * @returns {void}
     */
    #unbindEvents() {
        this.#svg.removeEventListener('wheel', this.#boundWheel, {
            passive: false
        })
        this.#svg.removeEventListener('mousedown', this.#boundMouseDown)
        this.#svg.removeEventListener('touchstart', this.#boundTouchStart, {
            passive: false
        })
        this.#svg.removeEventListener('touchmove', this.#boundTouchMove, {
            passive: false
        })
        this.#svg.removeEventListener('touchend', this.#boundTouchEnd)
        this.#svg.removeEventListener('touchcancel', this.#boundTouchEnd)
        this.#getOwnerDocument().removeEventListener(
            'mousemove',
            this.#boundMouseMove
        )
        this.#getOwnerDocument().removeEventListener(
            'mouseup',
            this.#boundMouseUp
        )
    }

    /**
     * Applies one wheel zoom step around the cursor anchor point.
     * @param {{ deltaY?: number, clientX?: number, clientY?: number, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleWheel(event) {
        const deltaY = Number(event?.deltaY || 0)
        if (deltaY === 0) return

        const anchorPoint = this.#projectClientPointToDocument(
            Number(event?.clientX || 0),
            Number(event?.clientY || 0)
        )
        if (!anchorPoint) return

        event?.preventDefault?.()

        const zoomFactor = deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR
        const nextWidth = this.#clampWidth(this.#viewBox.width * zoomFactor)
        const nextHeight = this.#clampHeight(this.#viewBox.height * zoomFactor)

        this.#applyZoomAtClientPoint(
            anchorPoint,
            Number(event?.clientX || 0),
            Number(event?.clientY || 0),
            nextWidth,
            nextHeight
        )
    }

    /**
     * Starts a drag pan on primary-button press.
     * @param {{ button?: number, clientX?: number, clientY?: number, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleMouseDown(event) {
        if (Number(event?.button) !== 0) return

        const originViewBox = { ...this.#viewBox }
        const viewport = this.#resolveViewportGeometry(originViewBox)
        if (!viewport) return

        event?.preventDefault?.()
        this.#lockDocumentScroll()
        this.#dragState = {
            startClientX: Number(event?.clientX || 0),
            startClientY: Number(event?.clientY || 0),
            originViewBox,
            viewport
        }
        this.#svg.classList?.add('is-panning')
    }

    /**
     * Updates the current viewBox while dragging.
     * @param {{ buttons?: number, clientX?: number, clientY?: number, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleMouseMove(event) {
        if (!this.#dragState) return

        if (Number(event?.buttons || 0) === 0) {
            this.#stopDragging()
            return
        }

        event?.preventDefault?.()

        const deltaX =
            (Number(event?.clientX || 0) - this.#dragState.startClientX) /
            this.#dragState.viewport.scaleX
        const deltaY =
            (Number(event?.clientY || 0) - this.#dragState.startClientY) /
            this.#dragState.viewport.scaleY

        this.#viewBox = {
            x: this.#dragState.originViewBox.x - deltaX,
            y: this.#dragState.originViewBox.y - deltaY,
            width: this.#dragState.originViewBox.width,
            height: this.#dragState.originViewBox.height
        }

        this.#applyViewBox()
    }

    /**
     * Stops an active drag pan on mouse release.
     * @param {{ button?: number }} event
     * @returns {void}
     */
    #handleMouseUp(event) {
        if (Number(event?.button) !== 0) return
        this.#stopDragging()
    }

    /**
     * Starts a touch pan or pinch gesture from the active contact set.
     * @param {{ touches?: ArrayLike<{ clientX?: number, clientY?: number }>, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleTouchStart(event) {
        const touches = SchematicViewportController.#getTouchPoints(event)
        if (touches.length >= 2) {
            this.#startTouchPinch(touches, event)
            return
        }

        if (touches.length === 1) {
            this.#startTouchPan(touches[0], event)
        }
    }

    /**
     * Applies a touch pan or pinch move to the current viewBox.
     * @param {{ touches?: ArrayLike<{ clientX?: number, clientY?: number }>, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleTouchMove(event) {
        const touches = SchematicViewportController.#getTouchPoints(event)
        if (!this.#touchState || touches.length === 0) return

        if (touches.length >= 2 && this.#touchState.mode !== 'pinch') {
            this.#startTouchPinch(touches, event)
            return
        }

        if (this.#touchState.mode === 'pinch') {
            this.#moveTouchPinch(touches, event)
            return
        }

        this.#moveTouchPan(touches[0], event)
    }

    /**
     * Keeps or clears touch state when mobile contacts change.
     * @param {{ touches?: ArrayLike<{ clientX?: number, clientY?: number }>, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleTouchEnd(event) {
        const touches = SchematicViewportController.#getTouchPoints(event)
        if (touches.length >= 2) {
            this.#startTouchPinch(touches, event)
            return
        }

        if (touches.length === 1) {
            this.#startTouchPan(touches[0], event)
            return
        }

        this.#stopTouchGesture()
    }

    /**
     * Starts a one-finger touch pan from the current viewport.
     * @param {{ clientX: number, clientY: number }} touch
     * @param {{ preventDefault?: () => void }} event
     * @returns {void}
     */
    #startTouchPan(touch, event) {
        event?.preventDefault?.()
        this.#lockDocumentScroll()
        this.#touchState = {
            mode: 'pan',
            startClientX: touch.clientX,
            startClientY: touch.clientY,
            originViewBox: { ...this.#viewBox }
        }
        this.#svg.classList?.add('is-panning')
    }

    /**
     * Starts a two-finger pinch zoom from the current viewport.
     * @param {{ clientX: number, clientY: number }[]} touches
     * @param {{ preventDefault?: () => void }} event
     * @returns {void}
     */
    #startTouchPinch(touches, event) {
        const [firstTouch, secondTouch] = touches
        const startDistance = SchematicViewportController.#getTouchDistance(
            firstTouch,
            secondTouch
        )
        if (startDistance <= 0) return

        const midpoint = SchematicViewportController.#getTouchMidpoint(
            firstTouch,
            secondTouch
        )
        const anchorPoint = this.#projectClientPointToDocument(
            midpoint.clientX,
            midpoint.clientY
        )
        if (!anchorPoint) return

        event?.preventDefault?.()
        this.#lockDocumentScroll()
        this.#touchState = {
            mode: 'pinch',
            startDistance,
            anchorPoint,
            originViewBox: { ...this.#viewBox }
        }
        this.#svg.classList?.add('is-panning')
    }

    /**
     * Applies a one-finger touch pan move.
     * @param {{ clientX: number, clientY: number }} touch
     * @param {{ preventDefault?: () => void }} event
     * @returns {void}
     */
    #moveTouchPan(touch, event) {
        if (!this.#touchState || this.#touchState.mode !== 'pan') return

        const viewport = this.#resolveViewportGeometry(
            this.#touchState.originViewBox
        )
        if (!viewport) return

        event?.preventDefault?.()

        const deltaX =
            (touch.clientX - this.#touchState.startClientX) / viewport.scaleX
        const deltaY =
            (touch.clientY - this.#touchState.startClientY) / viewport.scaleY

        this.#viewBox = {
            x: this.#touchState.originViewBox.x - deltaX,
            y: this.#touchState.originViewBox.y - deltaY,
            width: this.#touchState.originViewBox.width,
            height: this.#touchState.originViewBox.height
        }

        this.#applyViewBox()
    }

    /**
     * Applies a two-finger pinch zoom move.
     * @param {{ clientX: number, clientY: number }[]} touches
     * @param {{ preventDefault?: () => void }} event
     * @returns {void}
     */
    #moveTouchPinch(touches, event) {
        if (
            !this.#touchState ||
            this.#touchState.mode !== 'pinch' ||
            touches.length < 2
        ) {
            return
        }

        const [firstTouch, secondTouch] = touches
        const distance = SchematicViewportController.#getTouchDistance(
            firstTouch,
            secondTouch
        )
        if (distance <= 0) return

        event?.preventDefault?.()

        const scaleRatio = distance / this.#touchState.startDistance
        const nextWidth = this.#clampWidth(
            this.#touchState.originViewBox.width / scaleRatio
        )
        const nextHeight = this.#clampHeight(
            this.#touchState.originViewBox.height / scaleRatio
        )
        const midpoint = SchematicViewportController.#getTouchMidpoint(
            firstTouch,
            secondTouch
        )

        this.#applyZoomAtClientPoint(
            this.#touchState.anchorPoint,
            midpoint.clientX,
            midpoint.clientY,
            nextWidth,
            nextHeight
        )
    }

    /**
     * Clears drag state and cursor class.
     * @returns {void}
     */
    #stopDragging() {
        this.#dragState = null
        this.#svg.classList?.remove('is-panning')
        this.#unlockDocumentScroll()
    }

    /**
     * Clears touch gesture state and releases the document scroll lock.
     * @returns {void}
     */
    #stopTouchGesture() {
        this.#touchState = null
        this.#svg.classList?.remove('is-panning')
        this.#unlockDocumentScroll()
    }

    /**
     * Returns the owning document-like event target.
     * @returns {{ addEventListener: (type: string, listener: (event: any) => void) => void, removeEventListener: (type: string, listener: (event: any) => void) => void }}
     */
    #getOwnerDocument() {
        return this.#svg.ownerDocument || this.#svg
    }

    /**
     * Adds a temporary document-level class while panning so browser scrolling
     * cannot compete with schematic dragging.
     * @returns {void}
     */
    #lockDocumentScroll() {
        this.#getOwnerDocument().documentElement?.classList?.add(
            'is-schematic-panning'
        )
    }

    /**
     * Removes the temporary document-level scroll lock class.
     * @returns {void}
     */
    #unlockDocumentScroll() {
        this.#getOwnerDocument().documentElement?.classList?.remove(
            'is-schematic-panning'
        )
    }

    /**
     * Reads and parses the current SVG viewBox.
     * @returns {{ x: number, y: number, width: number, height: number }}
     */
    #readViewBox() {
        return (
            SchematicViewportController.#parseViewBox(
                this.#svg.getAttribute('viewBox')
            ) || { x: 0, y: 0, width: 100, height: 100 }
        )
    }

    /**
     * Parses one SVG viewBox string.
     * @param {unknown} value Raw viewBox value.
     * @returns {{ x: number, y: number, width: number, height: number } | null}
     */
    static #parseViewBox(value) {
        const rawValue = String(value || '')
        const [x, y, width, height] = rawValue
            .trim()
            .split(/\s+/)
            .map((value) => Number(value))
        if (!Number.isFinite(width) || width <= 0) return null
        if (!Number.isFinite(height) || height <= 0) return null

        return {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            width,
            height
        }
    }

    /**
     * Normalizes candidate document-space bounds.
     * @param {{ x?: number, y?: number, width?: number, height?: number } | null} bounds Bounds to normalize.
     * @returns {{ x: number, y: number, width: number, height: number } | null}
     */
    static #normalizeBounds(bounds) {
        const x = Number(bounds?.x)
        const y = Number(bounds?.y)
        const width = Number(bounds?.width)
        const height = Number(bounds?.height)
        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width < 0 ||
            height < 0
        ) {
            return null
        }

        return { x, y, width, height }
    }

    /**
     * Returns whether bounds are fully inside the current viewBox.
     * @param {{ x: number, y: number, width: number, height: number }} bounds Bounds to test.
     * @returns {boolean}
     */
    #containsBounds(bounds) {
        return (
            bounds.x >= this.#viewBox.x &&
            bounds.y >= this.#viewBox.y &&
            bounds.x + bounds.width <= this.#viewBox.x + this.#viewBox.width &&
            bounds.y + bounds.height <= this.#viewBox.y + this.#viewBox.height
        )
    }

    /**
     * Centers bounds with a caller-supplied viewport size.
     * @param {{ x: number, y: number, width: number, height: number }} bounds Bounds to center.
     * @param {number} width Viewport width.
     * @param {number} height Viewport height.
     * @param {{ animate?: boolean, durationMs?: number }} [options] Apply options.
     * @returns {void}
     */
    #centerBoundsWithSize(bounds, width, height, options = {}) {
        this.#applyViewBoxChange(
            {
                x: bounds.x + bounds.width / 2 - width / 2,
                y: bounds.y + bounds.height / 2 - height / 2,
                width,
                height
            },
            options
        )
    }

    /**
     * Applies a target viewBox immediately or with animation.
     * @param {{ x: number, y: number, width: number, height: number }} nextViewBox Target viewBox.
     * @param {{ animate?: boolean, durationMs?: number }} options Apply options.
     * @returns {void}
     */
    #applyViewBoxChange(nextViewBox, options = {}) {
        this.#cancelAnimation()
        if (
            options.animate &&
            typeof globalThis.requestAnimationFrame === 'function'
        ) {
            this.#animateViewBox(nextViewBox, options.durationMs)
            return
        }

        this.#viewBox = { ...nextViewBox }
        this.#applyViewBox()
    }

    /**
     * Animates the current viewBox to a target viewBox.
     * @param {{ x: number, y: number, width: number, height: number }} nextViewBox Target viewBox.
     * @param {unknown} durationMs Requested duration in milliseconds.
     * @returns {void}
     */
    #animateViewBox(nextViewBox, durationMs) {
        const startViewBox = { ...this.#viewBox }
        const duration =
            SchematicViewportController.#positiveNumber(durationMs) || 160
        const startTime = Number(globalThis.performance?.now?.() || 0)
        const step = (time) => {
            const progress = Math.min(
                Math.max((Number(time || 0) - startTime) / duration, 0),
                1
            )
            const eased = 1 - (1 - progress) ** 3
            this.#viewBox = SchematicViewportController.#interpolateViewBox(
                startViewBox,
                nextViewBox,
                eased
            )
            this.#applyViewBox()
            if (progress < 1) {
                this.#animationFrame = globalThis.requestAnimationFrame(step)
                return
            }
            this.#animationFrame = null
        }
        this.#animationFrame = globalThis.requestAnimationFrame(step)
    }

    /**
     * Cancels a pending viewBox animation.
     * @returns {void}
     */
    #cancelAnimation() {
        if (this.#animationFrame === null) return
        globalThis.cancelAnimationFrame?.(this.#animationFrame)
        this.#animationFrame = null
    }

    /**
     * Projects a client point into document-space coordinates.
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{ x: number, y: number } | null}
     */
    #projectClientPointToDocument(clientX, clientY) {
        const viewport = this.#resolveViewportGeometry()
        if (!viewport) {
            return null
        }

        return {
            x: this.#viewBox.x + (clientX - viewport.left) / viewport.scaleX,
            y: this.#viewBox.y + (clientY - viewport.top) / viewport.scaleY
        }
    }

    /**
     * Applies a zoom size while pinning one document point under a client
     * coordinate.
     * @param {{ x: number, y: number }} anchorPoint
     * @param {number} clientX
     * @param {number} clientY
     * @param {number} nextWidth
     * @param {number} nextHeight
     * @returns {void}
     */
    #applyZoomAtClientPoint(
        anchorPoint,
        clientX,
        clientY,
        nextWidth,
        nextHeight
    ) {
        const viewport = this.#resolveViewportGeometry({
            ...this.#viewBox,
            width: nextWidth,
            height: nextHeight
        })
        if (!viewport) return

        this.#viewBox = {
            x: anchorPoint.x - (clientX - viewport.left) / viewport.scaleX,
            y: anchorPoint.y - (clientY - viewport.top) / viewport.scaleY,
            width: nextWidth,
            height: nextHeight
        }

        this.#applyViewBox()
    }

    /**
     * Clamps a candidate width against the default camera limits.
     * @param {number} width
     * @returns {number}
     */
    #clampWidth(width) {
        const minimumWidth = this.#defaultViewBox.width * MIN_SCALE_RATIO
        const maximumWidth = this.#defaultViewBox.width * MAX_SCALE_RATIO
        return Math.min(Math.max(width, minimumWidth), maximumWidth)
    }

    /**
     * Clamps a candidate height against the default camera limits.
     * @param {number} height
     * @returns {number}
     */
    #clampHeight(height) {
        const minimumHeight = this.#defaultViewBox.height * MIN_SCALE_RATIO
        const maximumHeight = this.#defaultViewBox.height * MAX_SCALE_RATIO
        return Math.min(Math.max(height, minimumHeight), maximumHeight)
    }

    /**
     * Resolves the client-space geometry of the rendered SVG viewBox.
     * @param {{ x: number, y: number, width: number, height: number }} [viewBox] ViewBox to measure.
     * @returns {{ left: number, top: number, scaleX: number, scaleY: number } | null}
     */
    #resolveViewportGeometry(viewBox = this.#viewBox) {
        const rect = this.#svg.getBoundingClientRect()
        if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            viewBox.width <= 0 ||
            viewBox.height <= 0
        ) {
            return null
        }

        const preserveAspectRatio =
            SchematicViewportController.#parsePreserveAspectRatio(
                this.#svg.getAttribute('preserveAspectRatio')
            )
        const scaleX = rect.width / viewBox.width
        const scaleY = rect.height / viewBox.height

        if (preserveAspectRatio.align === 'none') {
            return {
                left: rect.left,
                top: rect.top,
                scaleX,
                scaleY
            }
        }

        const scale =
            preserveAspectRatio.meetOrSlice === 'slice'
                ? Math.max(scaleX, scaleY)
                : Math.min(scaleX, scaleY)
        const renderedWidth = viewBox.width * scale
        const renderedHeight = viewBox.height * scale

        return {
            left:
                rect.left +
                SchematicViewportController.#resolveAlignmentOffset(
                    preserveAspectRatio.align,
                    'x',
                    rect.width,
                    renderedWidth
                ),
            top:
                rect.top +
                SchematicViewportController.#resolveAlignmentOffset(
                    preserveAspectRatio.align,
                    'y',
                    rect.height,
                    renderedHeight
                ),
            scaleX: scale,
            scaleY: scale
        }
    }

    /**
     * Writes the current viewBox back to the SVG element.
     * @returns {void}
     */
    #applyViewBox() {
        this.#svg.setAttribute(
            'viewBox',
            [
                SchematicViewportController.#formatNumber(this.#viewBox.x),
                SchematicViewportController.#formatNumber(this.#viewBox.y),
                SchematicViewportController.#formatNumber(this.#viewBox.width),
                SchematicViewportController.#formatNumber(this.#viewBox.height)
            ].join(' ')
        )
    }

    /**
     * Formats one viewBox number without noisy floating-point tails.
     * @param {number} value
     * @returns {string}
     */
    static #formatNumber(value) {
        return String(Number(value.toFixed(4)))
    }

    /**
     * Interpolates between two viewBox values.
     * @param {{ x: number, y: number, width: number, height: number }} start Start viewBox.
     * @param {{ x: number, y: number, width: number, height: number }} end End viewBox.
     * @param {number} progress Interpolation progress from 0 to 1.
     * @returns {{ x: number, y: number, width: number, height: number }}
     */
    static #interpolateViewBox(start, end, progress) {
        return {
            x: start.x + (end.x - start.x) * progress,
            y: start.y + (end.y - start.y) * progress,
            width: start.width + (end.width - start.width) * progress,
            height: start.height + (end.height - start.height) * progress
        }
    }

    /**
     * Returns a positive finite number or null.
     * @param {unknown} value Numeric candidate.
     * @returns {number | null}
     */
    static #positiveNumber(value) {
        const number = Number(value)
        return Number.isFinite(number) && number > 0 ? number : null
    }

    /**
     * Parses SVG preserveAspectRatio values used for client-space projection.
     * @param {unknown} value Attribute value.
     * @returns {{ align: string, meetOrSlice: 'meet' | 'slice' }}
     */
    static #parsePreserveAspectRatio(value) {
        const tokens = String(value || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .filter((token) => token !== 'defer')
        const align = tokens.find((token) =>
            /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max))$/.test(token)
        )
        const meetOrSlice = tokens.includes('slice') ? 'slice' : 'meet'

        return {
            align: align || 'xMidYMid',
            meetOrSlice
        }
    }

    /**
     * Resolves one axis offset from an SVG alignment keyword.
     * @param {string} align SVG preserveAspectRatio alignment.
     * @param {'x' | 'y'} axis Axis to resolve.
     * @param {number} viewportSize SVG element client span.
     * @param {number} renderedSize Rendered viewBox span.
     * @returns {number}
     */
    static #resolveAlignmentOffset(align, axis, viewportSize, renderedSize) {
        const maxSuffix = axis === 'x' ? 'xMax' : 'YMax'
        const midSuffix = axis === 'x' ? 'xMid' : 'YMid'

        if (align.includes(maxSuffix)) {
            return viewportSize - renderedSize
        }

        if (align.includes(midSuffix)) {
            return (viewportSize - renderedSize) / 2
        }

        return 0
    }

    /**
     * Copies active event touches into plain client-coordinate records.
     * @param {{ touches?: ArrayLike<{ clientX?: number, clientY?: number }> }} event
     * @returns {{ clientX: number, clientY: number }[]}
     */
    static #getTouchPoints(event) {
        return Array.from(event?.touches || []).map((touch) => ({
            clientX: Number(touch?.clientX || 0),
            clientY: Number(touch?.clientY || 0)
        }))
    }

    /**
     * Measures the distance between two touch points.
     * @param {{ clientX: number, clientY: number }} firstTouch
     * @param {{ clientX: number, clientY: number }} secondTouch
     * @returns {number}
     */
    static #getTouchDistance(firstTouch, secondTouch) {
        return Math.hypot(
            secondTouch.clientX - firstTouch.clientX,
            secondTouch.clientY - firstTouch.clientY
        )
    }

    /**
     * Finds the client-space midpoint between two touch points.
     * @param {{ clientX: number, clientY: number }} firstTouch
     * @param {{ clientX: number, clientY: number }} secondTouch
     * @returns {{ clientX: number, clientY: number }}
     */
    static #getTouchMidpoint(firstTouch, secondTouch) {
        return {
            clientX: (firstTouch.clientX + secondTouch.clientX) / 2,
            clientY: (firstTouch.clientY + secondTouch.clientY) / 2
        }
    }
}
