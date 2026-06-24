/**
 * Builds KiCad footprint model references for selected-part exports.
 */
export class SelectedPartKicadModelNodeBuilder {
    /** @type {number} */
    static #PCB_MIL_TO_MM = 0.0254

    /**
     * Returns a footprint node with ZIP-local model references attached.
     * Existing model nodes are replaced only when packaged models are present.
     * @param {Array} footprintNode Source footprint node.
     * @param {object[]} models Packaged 3D model assets.
     * @param {object} [component] Selected footprint component origin.
     * @returns {Array}
     */
    static attachToFootprintNode(footprintNode, models, component = {}) {
        const modelNodes = SelectedPartKicadModelNodeBuilder.buildMany(
            models,
            component
        )
        if (!modelNodes.length) {
            return footprintNode
        }

        return [
            ...footprintNode.filter(
                (entry) =>
                    !(
                        Array.isArray(entry) &&
                        String(entry[0] || '') === 'model'
                    )
            ),
            ...modelNodes
        ]
    }

    /**
     * Builds KiCad footprint model nodes for packaged model files.
     * @param {object[]} models Packaged 3D model assets.
     * @param {object} [component] Selected footprint component origin.
     * @returns {Array[]}
     */
    static buildMany(models, component = {}) {
        return SelectedPartKicadModelNodeBuilder.#array(models)
            .map((model) =>
                SelectedPartKicadModelNodeBuilder.#modelNode(model, component)
            )
            .filter(Boolean)
    }

    /**
     * Builds one KiCad model node.
     * @param {object} model Packaged 3D model asset.
     * @param {object} component Selected footprint component origin.
     * @returns {Array | null}
     */
    static #modelNode(model, component) {
        const modelFileName =
            SelectedPartKicadModelNodeBuilder.#modelFileName(model)
        if (!modelFileName) {
            return null
        }

        return [
            'model',
            '../models/' + modelFileName,
            [
                'offset',
                [
                    'xyz',
                    ...SelectedPartKicadModelNodeBuilder.#modelOffset(model)
                ]
            ],
            [
                'scale',
                ['xyz', ...SelectedPartKicadModelNodeBuilder.#modelScale(model)]
            ],
            [
                'rotate',
                [
                    'xyz',
                    ...SelectedPartKicadModelNodeBuilder.#modelRotation(
                        model,
                        component
                    )
                ]
            ]
        ]
    }

    /**
     * Resolves the packaged model file name.
     * @param {object} model Model asset.
     * @returns {string}
     */
    static #modelFileName(model) {
        return (
            String(model?.name || '')
                .replace(/\\/gu, '/')
                .split('/')
                .filter(Boolean)
                .at(-1) || ''
        )
    }

    /**
     * Resolves KiCad model offset in millimeters.
     * @param {object} model Model asset.
     * @returns {number[]}
     */
    static #modelOffset(model) {
        const transform = model?.transform || {}
        const offsetMil = transform.offsetMil || {}

        return ['x', 'y', 'z'].map((axis) =>
            SelectedPartKicadModelNodeBuilder.#pcbLength(
                offsetMil[axis] ?? transform['d' + axis + 'Mil'],
                0
            )
        )
    }

    /**
     * Resolves KiCad model scale.
     * @param {object} model Model asset.
     * @returns {number[]}
     */
    static #modelScale(model) {
        const scale = model?.transform?.scale || {}
        return ['x', 'y', 'z'].map((axis) =>
            SelectedPartKicadModelNodeBuilder.#number(scale[axis], 1)
        )
    }

    /**
     * Resolves KiCad model rotation in degrees.
     * @param {object} model Model asset.
     * @param {object} component Selected footprint component origin.
     * @returns {number[]}
     */
    static #modelRotation(model, component) {
        const rotation = model?.transform?.rotationDeg || {}
        const generatedRotation =
            SelectedPartKicadModelNodeBuilder.#generatedFrameRotation(
                model,
                component
            )
        return ['x', 'y', 'z'].map((axis) =>
            SelectedPartKicadModelNodeBuilder.#round(
                SelectedPartKicadModelNodeBuilder.#number(rotation[axis], 0) +
                    generatedRotation[axis]
            )
        )
    }

    /**
     * Resolves the KiCad correction for generated stitched STEP files.
     * @param {object} model Model asset.
     * @param {object} component Selected footprint component origin.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #generatedFrameRotation(model, component) {
        if (model?.generated !== true) {
            return { x: 0, y: 0, z: 0 }
        }

        return {
            x: -90,
            y: 0,
            z: SelectedPartKicadModelNodeBuilder.#normalizeAngle(
                -SelectedPartKicadModelNodeBuilder.#number(
                    component?.rotation,
                    0
                )
            )
        }
    }

    /**
     * Converts PCB mils to KiCad millimeters.
     * @param {unknown} value Source value in mils.
     * @param {number} fallback Fallback millimeter value.
     * @returns {number}
     */
    static #pcbLength(value, fallback) {
        const number = SelectedPartKicadModelNodeBuilder.#number(value, NaN)
        if (!Number.isFinite(number)) return fallback
        return SelectedPartKicadModelNodeBuilder.#round(
            number * SelectedPartKicadModelNodeBuilder.#PCB_MIL_TO_MM
        )
    }

    /**
     * Reads a finite number with fallback.
     * @param {unknown} value Candidate value.
     * @param {number} fallback Fallback value.
     * @returns {number}
     */
    static #number(value, fallback) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    /**
     * Rounds a generated numeric value for compact KiCad source.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        const rounded = Number(Number(value || 0).toFixed(6))
        return Object.is(rounded, -0) ? 0 : rounded
    }

    /**
     * Normalizes an angle to the KiCad 0-360 range.
     * @param {number} angle Angle in degrees.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        return ((angle % 360) + 360) % 360
    }

    /**
     * Normalizes a possible array.
     * @param {unknown} value Candidate value.
     * @returns {object[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }
}
