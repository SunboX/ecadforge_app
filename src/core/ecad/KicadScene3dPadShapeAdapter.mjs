const KICAD_PAD_SHAPE_RECT = 0
const KICAD_PAD_SHAPE_CIRCLE = 1
const KICAD_PAD_SHAPE_OVAL = 2
const KICAD_PAD_SHAPE_TRAPEZOID = 3
const KICAD_PAD_SHAPE_ROUNDRECT = 4
const KICAD_PAD_SHAPE_CUSTOM = 9
const RENDER_PAD_SHAPE_ROUND = 1
const RENDER_PAD_SHAPE_RECTANGULAR = 2
const DEFAULT_ROUNDRECT_CORNER_RADIUS_PERCENT = 25
const OVAL_CORNER_RADIUS_PERCENT = 50
const GEOMETRY_EPSILON = 0.001

const SIDE_FIELDS = [
    {
        shape: 'shapeTop',
        sourceShape: 'sourceShapeTop',
        sizeX: 'sizeTopX',
        sizeY: 'sizeTopY',
        roundedShape: 'roundedRectShapeTop',
        cornerRadius: 'cornerRadiusTop'
    },
    {
        shape: 'shapeMid',
        sourceShape: 'sourceShapeMid',
        sizeX: 'sizeMidX',
        sizeY: 'sizeMidY',
        roundedShape: null,
        cornerRadius: null
    },
    {
        shape: 'shapeBottom',
        sourceShape: 'sourceShapeBottom',
        sizeX: 'sizeBottomX',
        sizeY: 'sizeBottomY',
        roundedShape: 'roundedRectShapeBottom',
        cornerRadius: 'cornerRadiusBottom'
    }
]

/**
 * Maps KiCad pad shape codes to the shape contract used by the shared 3D view.
 */
export class KicadScene3dPadShapeAdapter {
    /**
     * Returns pads with renderer-compatible pad shape fields.
     * @param {object[] | undefined} pads Scene pad detail.
     * @returns {object[]}
     */
    static apply(pads) {
        return (Array.isArray(pads) ? pads : []).map((pad) =>
            KicadScene3dPadShapeAdapter.#mapPad(pad)
        )
    }

    /**
     * Maps one pad while preserving source KiCad shape codes.
     * @param {object} pad Scene pad detail.
     * @returns {object}
     */
    static #mapPad(pad) {
        const mapped = { ...(pad || {}) }

        for (const fields of SIDE_FIELDS) {
            KicadScene3dPadShapeAdapter.#mapPadSide(mapped, pad, fields)
        }

        return mapped
    }

    /**
     * Maps one side-specific shape field.
     * @param {object} mapped Mutable mapped pad.
     * @param {object} source Source pad.
     * @param {object} fields Side field names.
     * @returns {void}
     */
    static #mapPadSide(mapped, source, fields) {
        const sourceShape = KicadScene3dPadShapeAdapter.#resolveSourceShape(
            source,
            fields
        )

        if (!Number.isInteger(sourceShape)) {
            return
        }

        const size = KicadScene3dPadShapeAdapter.#resolveSideSize(
            source,
            fields
        )
        const rendererShape = KicadScene3dPadShapeAdapter.#rendererShape(
            sourceShape,
            size
        )
        const roundedSurface =
            KicadScene3dPadShapeAdapter.#isRoundedRendererSurface(
                sourceShape,
                size
            )

        mapped[fields.sourceShape] = sourceShape
        mapped[fields.shape] = rendererShape

        if (fields.roundedShape && (mapped.hasRoundedRect || roundedSurface)) {
            mapped[fields.roundedShape] = roundedSurface
                ? RENDER_PAD_SHAPE_RECTANGULAR
                : rendererShape
        }

        if (roundedSurface) {
            mapped.hasRoundedRect = true
            if (fields.cornerRadius) {
                mapped[fields.cornerRadius] =
                    KicadScene3dPadShapeAdapter.#resolveCornerRadiusPercent(
                        mapped,
                        sourceShape,
                        fields.cornerRadius
                    )
            }
        } else if (fields.cornerRadius && mapped.hasRoundedRect) {
            mapped[fields.cornerRadius] = 0
        }
    }

    /**
     * Resolves the original KiCad shape code for one side.
     * @param {object} pad Scene pad detail.
     * @param {object} fields Side field names.
     * @returns {number | null}
     */
    static #resolveSourceShape(pad, fields) {
        if (
            KicadScene3dPadShapeAdapter.#hasOwn(pad, fields.sourceShape) &&
            Number.isInteger(Number(pad?.[fields.sourceShape]))
        ) {
            return Number(pad[fields.sourceShape])
        }

        if (
            KicadScene3dPadShapeAdapter.#hasOwn(pad, fields.shape) &&
            Number.isInteger(Number(pad?.[fields.shape]))
        ) {
            return Number(pad[fields.shape])
        }

        const shapeName = KicadScene3dPadShapeAdapter.#resolveShapeName(pad)

        return shapeName
            ? KicadScene3dPadShapeAdapter.#shapeCodeForName(shapeName)
            : null
    }

    /**
     * Resolves a KiCad shape name when numeric fields are absent.
     * @param {object} pad Scene pad detail.
     * @returns {string}
     */
    static #resolveShapeName(pad) {
        return String(
            pad?.kicadPad?.shape ||
                pad?.shapeName ||
                (typeof pad?.shape === 'string' ? pad.shape : '')
        )
            .trim()
            .toLowerCase()
    }

    /**
     * Converts a KiCad shape name to its KiCad parser code.
     * @param {string} shapeName KiCad shape name.
     * @returns {number}
     */
    static #shapeCodeForName(shapeName) {
        if (shapeName === 'circle') {
            return KICAD_PAD_SHAPE_CIRCLE
        }

        if (shapeName === 'oval') {
            return KICAD_PAD_SHAPE_OVAL
        }

        if (shapeName === 'trapezoid') {
            return KICAD_PAD_SHAPE_TRAPEZOID
        }

        if (shapeName === 'roundrect') {
            return KICAD_PAD_SHAPE_ROUNDRECT
        }

        if (shapeName === 'custom') {
            return KICAD_PAD_SHAPE_CUSTOM
        }

        return KICAD_PAD_SHAPE_RECT
    }

    /**
     * Resolves visible side dimensions.
     * @param {object} pad Scene pad detail.
     * @param {object} fields Side field names.
     * @returns {{ width: number, height: number }}
     */
    static #resolveSideSize(pad, fields) {
        return {
            width: Number(pad?.[fields.sizeX] || 0),
            height: Number(pad?.[fields.sizeY] || 0)
        }
    }

    /**
     * Maps one KiCad shape code into the shared renderer shape code.
     * @param {number} sourceShape KiCad shape code.
     * @param {{ width: number, height: number }} size Side dimensions.
     * @returns {number}
     */
    static #rendererShape(sourceShape, size) {
        if (sourceShape === KICAD_PAD_SHAPE_CIRCLE) {
            return RENDER_PAD_SHAPE_ROUND
        }

        if (
            sourceShape === KICAD_PAD_SHAPE_OVAL &&
            KicadScene3dPadShapeAdapter.#isEqualSize(size)
        ) {
            return RENDER_PAD_SHAPE_ROUND
        }

        return RENDER_PAD_SHAPE_RECTANGULAR
    }

    /**
     * Checks whether a KiCad side should render through rounded-rect geometry.
     * @param {number} sourceShape KiCad shape code.
     * @param {{ width: number, height: number }} size Side dimensions.
     * @returns {boolean}
     */
    static #isRoundedRendererSurface(sourceShape, size) {
        return (
            sourceShape === KICAD_PAD_SHAPE_ROUNDRECT ||
            (sourceShape === KICAD_PAD_SHAPE_OVAL &&
                !KicadScene3dPadShapeAdapter.#isEqualSize(size))
        )
    }

    /**
     * Resolves an appropriate rounded-rect corner radius percentage.
     * @param {object} pad Mapped pad.
     * @param {number} sourceShape KiCad shape code.
     * @param {string} field Radius field name.
     * @returns {number}
     */
    static #resolveCornerRadiusPercent(pad, sourceShape, field) {
        if (sourceShape === KICAD_PAD_SHAPE_OVAL) {
            return OVAL_CORNER_RADIUS_PERCENT
        }

        const existing = Number(pad?.[field])
        if (Number.isFinite(existing) && existing > 0) {
            return existing
        }

        return DEFAULT_ROUNDRECT_CORNER_RADIUS_PERCENT
    }

    /**
     * Checks whether side dimensions are a positive square.
     * @param {{ width: number, height: number }} size Side dimensions.
     * @returns {boolean}
     */
    static #isEqualSize(size) {
        return (
            Number(size?.width || 0) > GEOMETRY_EPSILON &&
            Number(size?.height || 0) > GEOMETRY_EPSILON &&
            Math.abs(Number(size.width) - Number(size.height)) <
                GEOMETRY_EPSILON
        )
    }

    /**
     * Checks whether an object owns a field.
     * @param {object | undefined} value Source object.
     * @param {string} field Field name.
     * @returns {boolean}
     */
    static #hasOwn(value, field) {
        return Object.prototype.hasOwnProperty.call(value || {}, field)
    }
}
