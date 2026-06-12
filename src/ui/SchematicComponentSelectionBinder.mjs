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

        svgNode.addEventListener('click', (event) => {
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
                        netNode?.getAttribute?.('data-schematic-net-name') ||
                        '',
                    source: 'schematic'
                })
            }
        })
    }
}
