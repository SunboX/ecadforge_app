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
     * @returns {void}
     */
    static bind(svgNode, documentId, componentCallback, netCallback = null) {
        if (!svgNode || (!componentCallback && !netCallback) || !documentId) {
            return
        }

        const touchTapGuard = new TouchTapSelectionGuard({
            readState: () => String(svgNode.getAttribute?.('viewBox') || '')
        })

        svgNode.addEventListener('click', (event) => {
            SchematicComponentSelectionBinder.#emitSelection(
                event,
                documentId,
                componentCallback,
                netCallback
            )
        })
        svgNode.addEventListener('touchstart', (event) => {
            touchTapGuard.start(event)
        })
        svgNode.addEventListener('touchmove', (event) => {
            touchTapGuard.move(event)
        })
        svgNode.addEventListener('touchend', (event) => {
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
        })
        svgNode.addEventListener('touchcancel', () => {
            touchTapGuard.reset()
        })
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
