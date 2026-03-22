/**
 * Applies shared highlight state to all rendered roots for one selected
 * component designator.
 */
export class PcbScene3dSelectionStyler {
    /**
     * Registers one rendered root object under a component designator.
     * @param {Map<string, Set<any>>} selectionRoots
     * @param {string} designator
     * @param {any} rootObject
     * @returns {void}
     */
    static registerSelectionRoot(selectionRoots, designator, rootObject) {
        if (!(selectionRoots instanceof Map) || !rootObject) {
            return
        }

        const normalizedDesignator = String(designator || '').trim()
        if (!normalizedDesignator) {
            return
        }

        if (!selectionRoots.has(normalizedDesignator)) {
            selectionRoots.set(normalizedDesignator, new Set())
        }

        selectionRoots.get(normalizedDesignator)?.add(rootObject)
    }

    /**
     * Applies the current highlighted designator, restoring the previous one.
     * @param {Map<string, Set<any>>} selectionRoots
     * @param {string} previousDesignator
     * @param {string} nextDesignator
     * @param {number} highlightColor
     * @returns {void}
     */
    static applySelection(
        selectionRoots,
        previousDesignator,
        nextDesignator,
        highlightColor
    ) {
        PcbScene3dSelectionStyler.#setDesignatorHighlighted(
            selectionRoots,
            previousDesignator,
            false,
            highlightColor
        )
        PcbScene3dSelectionStyler.#setDesignatorHighlighted(
            selectionRoots,
            nextDesignator,
            true,
            highlightColor
        )
    }

    /**
     * Highlights or restores every root registered for one designator.
     * @param {Map<string, Set<any>>} selectionRoots
     * @param {string} designator
     * @param {boolean} highlighted
     * @param {number} highlightColor
     * @returns {void}
     */
    static #setDesignatorHighlighted(
        selectionRoots,
        designator,
        highlighted,
        highlightColor
    ) {
        if (!(selectionRoots instanceof Map)) {
            return
        }

        const normalizedDesignator = String(designator || '').trim()
        if (!normalizedDesignator) {
            return
        }

        const roots = selectionRoots.get(normalizedDesignator)
        if (!roots) {
            return
        }

        roots.forEach((rootObject) => {
            PcbScene3dSelectionStyler.#visitMaterialNodes(rootObject, (material) =>
                PcbScene3dSelectionStyler.#setMaterialHighlighted(
                    material,
                    highlighted,
                    highlightColor
                )
            )
        })
    }

    /**
     * Visits every material-bearing node in one rendered object tree.
     * @param {any} rootObject
     * @param {(material: any) => void} visitor
     * @returns {void}
     */
    static #visitMaterialNodes(rootObject, visitor) {
        if (!rootObject) {
            return
        }

        PcbScene3dSelectionStyler.#normalizeMaterials(rootObject.material).forEach(
            (material) => visitor(material)
        )

        const children = Array.isArray(rootObject.children)
            ? rootObject.children
            : []
        children.forEach((child) =>
            PcbScene3dSelectionStyler.#visitMaterialNodes(child, visitor)
        )
    }

    /**
     * Applies or restores one material's highlight state.
     * @param {any} material
     * @param {boolean} highlighted
     * @param {number} highlightColor
     * @returns {void}
     */
    static #setMaterialHighlighted(material, highlighted, highlightColor) {
        if (!material) {
            return
        }

        const baseState =
            PcbScene3dSelectionStyler.#ensureMaterialBaseState(material)

        if (PcbScene3dSelectionStyler.#canWriteColor(material.emissive)) {
            if (PcbScene3dSelectionStyler.#canWriteColor(material.color)) {
                PcbScene3dSelectionStyler.#writeColor(
                    material.color,
                    highlighted ? 0x000000 : baseState.colorHex
                )
            }
            PcbScene3dSelectionStyler.#writeColor(
                material.emissive,
                highlighted ? highlightColor : baseState.emissiveHex
            )
            material.emissiveIntensity = highlighted ? 1 : baseState.emissiveIntensity
            material.needsUpdate = true
            return
        }

        if (PcbScene3dSelectionStyler.#canWriteColor(material.color)) {
            PcbScene3dSelectionStyler.#writeColor(
                material.color,
                highlighted ? highlightColor : baseState.colorHex
            )
            material.needsUpdate = true
        }
    }

    /**
     * Stores the original material state the first time a material is seen.
     * @param {any} material
     * @returns {{ colorHex: number | null, emissiveHex: number | null, emissiveIntensity: number }}
     */
    static #ensureMaterialBaseState(material) {
        if (!material.userData) {
            material.userData = {}
        }

        if (!material.userData.scene3dHighlightBase) {
            material.userData.scene3dHighlightBase = {
                colorHex: PcbScene3dSelectionStyler.#readColor(material.color),
                emissiveHex: PcbScene3dSelectionStyler.#readColor(
                    material.emissive
                ),
                emissiveIntensity: Number(material.emissiveIntensity || 0)
            }
        }

        return material.userData.scene3dHighlightBase
    }

    /**
     * Normalizes a Three material field into an array.
     * @param {any} materials
     * @returns {any[]}
     */
    static #normalizeMaterials(materials) {
        if (Array.isArray(materials)) {
            return materials.filter(Boolean)
        }

        return materials ? [materials] : []
    }

    /**
     * Reads one color-like object into a hex value.
     * @param {any} color
     * @returns {number | null}
     */
    static #readColor(color) {
        if (!color) {
            return null
        }

        if (typeof color.getHex === 'function') {
            return color.getHex()
        }

        if (Number.isFinite(Number(color.hex))) {
            return Number(color.hex)
        }

        return null
    }

    /**
     * Writes one hex value into a color-like object.
     * @param {any} color
     * @param {number | null} hex
     * @returns {void}
     */
    static #writeColor(color, hex) {
        if (!color || !Number.isFinite(Number(hex))) {
            return
        }

        if (typeof color.setHex === 'function') {
            color.setHex(Number(hex))
            return
        }

        if ('hex' in color) {
            color.hex = Number(hex)
        }
    }

    /**
     * Returns true when the color-like object supports hex writes.
     * @param {any} color
     * @returns {boolean}
     */
    static #canWriteColor(color) {
        return Boolean(
            color &&
                (typeof color.setHex === 'function' || 'hex' in color)
        )
    }
}
