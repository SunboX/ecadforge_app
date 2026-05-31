/**
 * Applies scene-view mirror compensation to selected 3D detail nodes.
 */
export class PcbScene3dViewCompensation {
    /**
     * Applies the active view mirror compensation throughout one scene branch.
     * @param {any} root Root group or mesh.
     * @param {{ x?: number, y?: number, z?: number } | null | undefined} viewScale Active scene view scale.
     * @returns {void}
     */
    static apply(root, viewScale) {
        const pendingGroups = [root]

        while (pendingGroups.length) {
            const group = pendingGroups.pop()
            if (!group) {
                continue
            }

            if (group.userData?.scene3dViewCompensation) {
                PcbScene3dViewCompensation.applyToGroup(group, viewScale)
            }

            if (Array.isArray(group.children)) {
                group.children.forEach((child) => pendingGroups.push(child))
            }
        }
    }

    /**
     * Applies the active view mirror compensation to one marked object.
     * @param {any} group View compensation target.
     * @param {{ x?: number, y?: number, z?: number } | null | undefined} viewScale Active scene view scale.
     * @returns {void}
     */
    static applyToGroup(group, viewScale) {
        const axes = group?.userData?.scene3dViewCompensationAxes || {}
        const axisSources =
            group?.userData?.scene3dViewCompensationAxisSources || {}
        const sourceScale = group?.userData?.scene3dSourceFrameScale || {}

        group?.scale?.set?.(
            PcbScene3dViewCompensation.#resolveScaleMultiplier(
                sourceScale?.x
            ) *
                (axes.x === false
                    ? 1
                    : PcbScene3dViewCompensation.#resolveCompensationSign(
                          viewScale,
                          'x',
                          axisSources?.x
                      )),
            PcbScene3dViewCompensation.#resolveScaleMultiplier(
                sourceScale?.y
            ) *
                (axes.y === false
                    ? 1
                    : PcbScene3dViewCompensation.#resolveCompensationSign(
                          viewScale,
                          'y',
                          axisSources?.y
                      )),
            PcbScene3dViewCompensation.#resolveScaleMultiplier(
                sourceScale?.z
            ) *
                (axes.z === false
                    ? 1
                    : PcbScene3dViewCompensation.#resolveCompensationSign(
                          viewScale,
                          'z',
                          axisSources?.z
                      ))
        )
    }

    /**
     * Resolves a source-frame scale multiplier.
     * @param {number | string | undefined} value Source scale value.
     * @returns {number}
     */
    static #resolveScaleMultiplier(value) {
        const scale = Number(value)

        return Number.isFinite(scale) && scale !== 0 ? scale : 1
    }

    /**
     * Resolves the compensation sign for one view axis.
     * @param {{ x?: number, y?: number, z?: number } | null | undefined} viewScale Active scene view scale.
     * @param {'x' | 'y' | 'z'} axis Target scale axis.
     * @param {string | undefined} source Axis source mode.
     * @returns {number}
     */
    static #resolveCompensationSign(viewScale, axis, source) {
        if (source === 'board-mirror') {
            return (
                PcbScene3dViewCompensation.#resolveViewScaleSign(
                    viewScale?.x
                ) *
                PcbScene3dViewCompensation.#resolveViewScaleSign(viewScale?.y)
            )
        }

        return PcbScene3dViewCompensation.#resolveViewScaleSign(
            viewScale?.[axis]
        )
    }

    /**
     * Converts one view scale axis into the matching mirror compensation sign.
     * @param {number | string | undefined} value View scale axis.
     * @returns {1 | -1}
     */
    static #resolveViewScaleSign(value) {
        return Number(value) < 0 ? -1 : 1
    }
}
