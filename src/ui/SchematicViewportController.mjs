const ZOOM_IN_FACTOR = 0.97
const ZOOM_OUT_FACTOR = 1 / ZOOM_IN_FACTOR
const MIN_SCALE_RATIO = 0.05
const MAX_SCALE_RATIO = 4

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

    /** @type {{ startClientX: number, startClientY: number, originViewBox: { x: number, y: number, width: number, height: number } } | null} */
    #dragState

    /** @type {(event: any) => void} */
    #boundWheel

    /** @type {(event: any) => void} */
    #boundMouseDown

    /** @type {(event: any) => void} */
    #boundMouseMove

    /** @type {(event: any) => void} */
    #boundMouseUp

    /**
     * @param {{ getAttribute: (name: string) => string | null, setAttribute: (name: string, value: string) => void, getBoundingClientRect: () => { left: number, top: number, width: number, height: number }, addEventListener: (type: string, listener: (event: any) => void, options?: any) => void, removeEventListener: (type: string, listener: (event: any) => void, options?: any) => void, classList?: { add: (...tokens: string[]) => void, remove: (...tokens: string[]) => void }, ownerDocument?: { addEventListener: (type: string, listener: (event: any) => void) => void, removeEventListener: (type: string, listener: (event: any) => void) => void, documentElement?: { classList?: { add: (...tokens: string[]) => void, remove: (...tokens: string[]) => void } } } }} svgElement
     */
    constructor(svgElement) {
        this.#svg = svgElement
        this.#defaultViewBox = this.#readViewBox()
        this.#viewBox = { ...this.#defaultViewBox }
        this.#dragState = null
        this.#boundWheel = (event) => this.#handleWheel(event)
        this.#boundMouseDown = (event) => this.#handleMouseDown(event)
        this.#boundMouseMove = (event) => this.#handleMouseMove(event)
        this.#boundMouseUp = (event) => this.#handleMouseUp(event)
        this.#bindEvents()
        this.#applyViewBox()
    }

    /**
     * Removes listeners and clears active drag state.
     * @returns {void}
     */
    dispose() {
        this.#unbindEvents()
        this.#stopDragging()
    }

    /**
     * Binds the viewport interaction listeners.
     * @returns {void}
     */
    #bindEvents() {
        this.#svg.addEventListener('wheel', this.#boundWheel, { passive: false })
        this.#svg.addEventListener('mousedown', this.#boundMouseDown)
        this.#getOwnerDocument().addEventListener('mousemove', this.#boundMouseMove)
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
        this.#getOwnerDocument().removeEventListener(
            'mousemove',
            this.#boundMouseMove
        )
        this.#getOwnerDocument().removeEventListener('mouseup', this.#boundMouseUp)
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
        const relativeX = (anchorPoint.x - this.#viewBox.x) / this.#viewBox.width
        const relativeY = (anchorPoint.y - this.#viewBox.y) / this.#viewBox.height

        this.#viewBox = {
            x: anchorPoint.x - relativeX * nextWidth,
            y: anchorPoint.y - relativeY * nextHeight,
            width: nextWidth,
            height: nextHeight
        }

        this.#applyViewBox()
    }

    /**
     * Starts a drag pan on primary-button press.
     * @param {{ button?: number, clientX?: number, clientY?: number, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleMouseDown(event) {
        if (Number(event?.button) !== 0) return

        event?.preventDefault?.()
        this.#lockDocumentScroll()
        this.#dragState = {
            startClientX: Number(event?.clientX || 0),
            startClientY: Number(event?.clientY || 0),
            originViewBox: { ...this.#viewBox }
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

        const rect = this.#svg.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return

        event?.preventDefault?.()

        const deltaX =
            ((Number(event?.clientX || 0) - this.#dragState.startClientX) /
                rect.width) *
            this.#dragState.originViewBox.width
        const deltaY =
            ((Number(event?.clientY || 0) - this.#dragState.startClientY) /
                rect.height) *
            this.#dragState.originViewBox.height

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
     * Clears drag state and cursor class.
     * @returns {void}
     */
    #stopDragging() {
        this.#dragState = null
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
        const rawValue = String(this.#svg.getAttribute('viewBox') || '')
        const [x, y, width, height] = rawValue
            .trim()
            .split(/\s+/)
            .map((value) => Number(value))

        return {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            width: Number.isFinite(width) && width > 0 ? width : 100,
            height: Number.isFinite(height) && height > 0 ? height : 100
        }
    }

    /**
     * Projects a client point into document-space coordinates.
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{ x: number, y: number } | null}
     */
    #projectClientPointToDocument(clientX, clientY) {
        const rect = this.#svg.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) {
            return null
        }

        const relativeX = (clientX - rect.left) / rect.width
        const relativeY = (clientY - rect.top) / rect.height

        return {
            x: this.#viewBox.x + relativeX * this.#viewBox.width,
            y: this.#viewBox.y + relativeY * this.#viewBox.height
        }
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
}
