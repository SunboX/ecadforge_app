/**
 * Builds sidebar download action definitions for manufacturing metadata.
 */
export class ViewerSidebarManufacturingActions {
    /**
     * Builds available manufacturing download actions.
     * @param {object} documentModel Parsed document model.
     * @returns {{ attribute: string, label: string }[]}
     */
    static build(documentModel) {
        const manufacturing = documentModel?.manufacturing || {}
        const actions = []

        if (Array.isArray(manufacturing.pickAndPlaceRows)) {
            if (manufacturing.pickAndPlaceRows.length) {
                actions.push({
                    attribute:
                        'data-pcb-assembly-export-format="pick-place-csv"',
                    label: 'Pick-and-place CSV'
                })
            }
        }

        if (String(manufacturing.routingDsn || '').trim()) {
            actions.push({
                attribute: 'data-pcb-assembly-export-format="routing-dsn"',
                label: 'Routing DSN'
            })
        }

        if (
            Array.isArray(manufacturing.fabricationNotes) &&
            manufacturing.fabricationNotes.length
        ) {
            actions.push({
                attribute:
                    'data-pcb-assembly-export-format="fabrication-notes-json"',
                label: 'Fabrication notes JSON'
            })
        }

        return actions
    }
}
