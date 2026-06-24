import { SvgDragClickGuard } from './SvgDragClickGuard.mjs'
import { TouchTapSelectionGuard } from './TouchTapSelectionGuard.mjs'

/**
 * Binds schematic SVG component and net selection clicks.
 */
export class SchematicComponentSelectionBinder {
    /**
     * Emits component and net selections for schematic hits, or empty values
     * for schematic background hits.
     * @param {SVGElement | null} svgNode Rendered schematic SVG.
     * @param {string} documentId Active document id.
     * @param {((change: { documentId: string, componentKey: string, source: string }) => void) | null} componentCallback Component selection callback.
     * @param {((change: { documentId: string, netName: string, source: string }) => void) | null} [netCallback] Net selection callback.
     * @returns {() => void} Function that removes the bound listeners.
     */
    static bind(svgNode, documentId, componentCallback, netCallback = null) {
        if (!svgNode || (!componentCallback && !netCallback) || !documentId) {
            return () => {}
        }

        const touchTapGuard = new TouchTapSelectionGuard({
            readState: () => String(svgNode.getAttribute?.('viewBox') || '')
        })
        const dragClickGuard = new SvgDragClickGuard(() => svgNode)
        const handleMouseDown = dragClickGuard.handleMouseDown
        const handleClick = (event) => {
            if (dragClickGuard.shouldSuppressClick(event)) {
                return
            }

            SchematicComponentSelectionBinder.#emitSelection(
                event,
                documentId,
                componentCallback,
                netCallback
            )
        }
        const handleTouchStart = (event) => {
            touchTapGuard.start(event)
        }
        const handleTouchMove = (event) => {
            touchTapGuard.move(event)
        }
        const handleTouchEnd = (event) => {
            const tap = touchTapGuard.end(event)
            if (!tap) {
                return
            }

            SchematicComponentSelectionBinder.#emitSelection(
                tap,
                documentId,
                componentCallback,
                netCallback
            )
        }
        const handleTouchCancel = () => {
            touchTapGuard.reset()
        }

        svgNode.addEventListener('mousedown', handleMouseDown)
        svgNode.addEventListener('click', handleClick)
        svgNode.addEventListener('touchstart', handleTouchStart)
        svgNode.addEventListener('touchmove', handleTouchMove)
        svgNode.addEventListener('touchend', handleTouchEnd)
        svgNode.addEventListener('touchcancel', handleTouchCancel)

        return () => {
            svgNode.removeEventListener('mousedown', handleMouseDown)
            svgNode.removeEventListener('click', handleClick)
            svgNode.removeEventListener('touchstart', handleTouchStart)
            svgNode.removeEventListener('touchmove', handleTouchMove)
            svgNode.removeEventListener('touchend', handleTouchEnd)
            svgNode.removeEventListener('touchcancel', handleTouchCancel)
            dragClickGuard.reset()
            touchTapGuard.reset()
        }
    }

    /**
     * Emits schematic component and net selection changes from one hit target.
     * @param {{ target?: any }} event Selection event.
     * @param {string} documentId Active document id.
     * @param {((change: { documentId: string, componentKey: string, source: string }) => void) | null} componentCallback Component selection callback.
     * @param {((change: { documentId: string, netName: string, source: string }) => void) | null} netCallback Net selection callback.
     * @returns {void}
     */
    static #emitSelection(event, documentId, componentCallback, netCallback) {
        const netNode = event.target?.closest?.('[data-schematic-net-name]')
        const componentNode = event.target?.closest?.(
            '[data-schematic-component-key]'
        )
        if (typeof componentCallback === 'function') {
            componentCallback({
                documentId,
                componentKey:
                    componentNode?.getAttribute?.(
                        'data-schematic-component-key'
                    ) || '',
                source: 'schematic'
            })
        }
        if (typeof netCallback === 'function') {
            netCallback({
                documentId,
                netName:
                    netNode?.getAttribute?.('data-schematic-net-name') || '',
                source: 'schematic'
            })
        }
    }
}
