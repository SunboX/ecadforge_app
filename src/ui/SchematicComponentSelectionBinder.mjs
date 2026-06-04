/**
 * Binds schematic SVG component selection clicks.
 */
export class SchematicComponentSelectionBinder {
    /**
     * Emits a component key for schematic component hits, or an empty key for
     * schematic background hits.
     * @param {SVGElement | null} svgNode Rendered schematic SVG.
     * @param {string} documentId Active document id.
     * @param {((change: { documentId: string, componentKey: string }) => void) | null} callback Selection callback.
     * @returns {void}
     */
    static bind(svgNode, documentId, callback) {
        if (!svgNode || typeof callback !== 'function' || !documentId) {
            return
        }

        svgNode.addEventListener('click', (event) => {
            const componentNode = event.target?.closest?.(
                '[data-schematic-component-key]'
            )
            callback({
                documentId,
                componentKey:
                    componentNode?.getAttribute?.(
                        'data-schematic-component-key'
                    ) || ''
            })
        })
    }
}
