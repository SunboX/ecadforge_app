import { PcbScene3dFallbackVisibility } from './PcbScene3dFallbackVisibility.mjs'

/**
 * Applies visibility toggles to the PCB 3D runtime render groups.
 */
export class PcbScene3dRenderGroupVisibility {
    /** @type {number} */
    static #BOARD_ASSEMBLY_DETAIL_RENDER_ORDER = 40

    /**
     * Applies the active 3D detail visibility state.
     * @param {{ groups: Map<string, any>, toggles: { 'external-models': boolean, 'fallback-bodies': boolean, copper: boolean }, fallbackBodyRoots: Map<string, Set<any>>, loadedExternalModelDesignators: Set<string>, hasLoadedBoardAssemblyModel?: boolean }} state Visibility state.
     * @returns {void}
     */
    static apply(state) {
        const boardAssemblyActive =
            Boolean(state?.hasLoadedBoardAssemblyModel) &&
            Boolean(state?.toggles?.['external-models'])

        PcbScene3dRenderGroupVisibility.#setVisible(
            state?.groups?.get('board'),
            true
        )
        PcbScene3dRenderGroupVisibility.#setVisible(
            state?.groups?.get('silkscreen'),
            true
        )
        PcbScene3dRenderGroupVisibility.#setVisible(
            state?.groups?.get('copper'),
            Boolean(state?.toggles?.copper)
        )
        PcbScene3dRenderGroupVisibility.#applyDetailOverlayPresentation(
            state?.groups?.get('silkscreen'),
            boardAssemblyActive
        )
        PcbScene3dRenderGroupVisibility.#applyDetailOverlayPresentation(
            state?.groups?.get('copper'),
            boardAssemblyActive
        )
        PcbScene3dRenderGroupVisibility.#setVisible(
            state?.groups?.get('fallback-bodies'),
            Boolean(state?.toggles?.['fallback-bodies']) &&
                !boardAssemblyActive
        )

        PcbScene3dFallbackVisibility.applyVisibility(
            state?.fallbackBodyRoots,
            state?.loadedExternalModelDesignators,
            state?.toggles
        )
        PcbScene3dRenderGroupVisibility.#setVisible(
            state?.groups?.get('external-models'),
            Boolean(state?.toggles?.['external-models'])
        )
    }

    /**
     * Sets group visibility when a group is available.
     * @param {{ visible?: boolean } | undefined} group Render group.
     * @param {boolean} visible Visibility value.
     * @returns {void}
     */
    static #setVisible(group, visible) {
        if (group) {
            group.visible = visible
        }
    }

    /**
     * Draws PCB-derived detail above a board assembly substrate.
     * @param {any} group Detail render group.
     * @param {boolean} active Whether overlay rendering is active.
     * @returns {void}
     */
    static #applyDetailOverlayPresentation(group, active) {
        PcbScene3dRenderGroupVisibility.#traverseGroup(group, (object) => {
            PcbScene3dRenderGroupVisibility.#applyObjectRenderOrder(
                object,
                active
            )
        })
    }

    /**
     * Applies or restores render ordering for one render object.
     * @param {any} object Render object.
     * @param {boolean} active Whether overlay rendering is active.
     * @returns {void}
     */
    static #applyObjectRenderOrder(object, active) {
        if (!object) {
            return
        }

        object.userData = object.userData || {}
        if (active) {
            if (object.userData.scene3dOriginalRenderOrder === undefined) {
                object.userData.scene3dOriginalRenderOrder = Number(
                    object.renderOrder || 0
                )
            }
            object.renderOrder =
                PcbScene3dRenderGroupVisibility.#BOARD_ASSEMBLY_DETAIL_RENDER_ORDER
            return
        }

        if (object.userData.scene3dOriginalRenderOrder !== undefined) {
            object.renderOrder = object.userData.scene3dOriginalRenderOrder
            delete object.userData.scene3dOriginalRenderOrder
        }
    }

    /**
     * Traverses a group tree, including simple test doubles.
     * @param {any} group Render group.
     * @param {(object: any) => void} visitor Visitor callback.
     * @returns {void}
     */
    static #traverseGroup(group, visitor) {
        if (!group) {
            return
        }

        if (typeof group.traverse === 'function') {
            group.traverse(visitor)
            return
        }

        visitor(group)
        ;(Array.isArray(group.children) ? group.children : []).forEach(
            (child) =>
                PcbScene3dRenderGroupVisibility.#traverseGroup(child, visitor)
        )
    }
}
