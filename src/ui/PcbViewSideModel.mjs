import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'

/**
 * Resolves the active side used by the PCB view controller.
 */
export class PcbViewSideModel {
    /**
     * Resolves the first rendered side for a selected component.
     * @param {object} documentModel PCB document model.
     * @param {unknown} requestedSide Caller-requested side.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {'top' | 'bottom'}
     */
    static initialSide(documentModel, requestedSide, selectedComponentKey) {
        return (
            PcbComponentSelectionModel.resolveSelectedComponentSide(
                documentModel,
                selectedComponentKey
            ) || PcbViewSideModel.normalize(requestedSide)
        )
    }

    /**
     * Normalizes untrusted side input to the supported board-side names.
     * @param {unknown} side Requested side.
     * @returns {'top' | 'bottom'}
     */
    static normalize(side) {
        return side === 'bottom' ? 'bottom' : 'top'
    }
}
