import { KicadStrokeFont } from 'kicad-toolkit/renderers'

/**
 * Builds KiCad copper text as widened stroke meshes for the 3D PCB scene.
 */
export class PcbScene3dCopperTextFactory {
    static #DEFAULT_MATERIAL_COLOR = 0xd9a61d
    static #TEXT_LINE_SPACING_RATIO = 1.61
    static #FIRST_LINE_HEIGHT_RATIO = 1.17
    static #STROKE_BASELINE_FUDGE_RATIO = 0.052

    /**
     * Builds one side-specific copper text group.
     * @param {any} THREE
     * @param {any[]} texts
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {{ side?: 'top' | 'bottom', mirrorY?: boolean, materialColor?: number, filterSide?: boolean, glyphYUp?: boolean }} [options]
     * @returns {any}
     */
    static buildGroup(THREE, texts, z, normalizeBoardPoint, options = {}) {
        const group = new THREE.Group()
        const positions = []
        const side = PcbScene3dCopperTextFactory.#normalizeSide(options?.side)
        const mirrorY = Boolean(options?.mirrorY)
        const glyphYUp = Boolean(options?.glyphYUp)
        const shouldFilterSide = options?.filterSide !== false
        group.name = 'copper-texts'
        ;(texts || [])
            .filter((text) =>
                shouldFilterSide
                    ? PcbScene3dCopperTextFactory.#matchesSide(text, side)
                    : true
            )
            .forEach((text) => {
                PcbScene3dCopperTextFactory.#appendTextTriangles(
                    positions,
                    text,
                    z,
                    normalizeBoardPoint,
                    mirrorY,
                    glyphYUp
                )
            })

        if (!positions.length) {
            return group
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        )
        geometry.computeVertexNormals?.()

        const mesh = new THREE.Mesh(
            geometry,
            PcbScene3dCopperTextFactory.#buildMaterial(
                THREE,
                PcbScene3dCopperTextFactory.#resolveMaterialColor(
                    options?.materialColor
                )
            )
        )
        mesh.name = 'copper-text'
        group.add(mesh)
        return group
    }

    /**
     * Appends all widened stroke segments for one text primitive.
     * @param {number[]} positions
     * @param {object} text
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @param {boolean} glyphYUp
     * @returns {void}
     */
    static #appendTextTriangles(
        positions,
        text,
        z,
        normalizeBoardPoint,
        mirrorY,
        glyphYUp
    ) {
        const width = PcbScene3dCopperTextFactory.#textStrokeWidth(text)

        PcbScene3dCopperTextFactory.#textStrokes(text, glyphYUp).forEach(
            (stroke) => {
                for (let index = 1; index < stroke.length; index += 1) {
                    const start = PcbScene3dCopperTextFactory.#normalizePoint(
                        normalizeBoardPoint,
                        stroke[index - 1],
                        mirrorY
                    )
                    const end = PcbScene3dCopperTextFactory.#normalizePoint(
                        normalizeBoardPoint,
                        stroke[index],
                        mirrorY
                    )

                    PcbScene3dCopperTextFactory.#appendTrackTriangles(
                        positions,
                        start,
                        end,
                        width,
                        z
                    )
                }
            }
        )
    }

    /**
     * Builds all KiCad stroke-font point lists for one text primitive.
     * @param {object} text
     * @param {boolean} glyphYUp
     * @returns {{ x: number, y: number }[][]}
     */
    static #textStrokes(text, glyphYUp) {
        const lines = String(text?.value ?? text?.text ?? '').split('\n')
        const lineSpacing = PcbScene3dCopperTextFactory.#textLineSpacing(text)

        return lines.flatMap((line, index) =>
            PcbScene3dCopperTextFactory.#textLineStrokes(
                text,
                line,
                index,
                lines.length,
                lineSpacing,
                glyphYUp
            )
        )
    }

    /**
     * Builds transformed stroke point lists for one line.
     * @param {object} text
     * @param {string} line
     * @param {number} index
     * @param {number} lineCount
     * @param {number} lineSpacing
     * @param {boolean} glyphYUp
     * @returns {{ x: number, y: number }[][]}
     */
    static #textLineStrokes(
        text,
        line,
        index,
        lineCount,
        lineSpacing,
        glyphYUp
    ) {
        const sizeX = PcbScene3dCopperTextFactory.#textWidth(text)
        const sizeY = PcbScene3dCopperTextFactory.#textHeight(text)
        const lineWidth = KicadStrokeFont.measureLine(line, sizeX)
        const x = PcbScene3dCopperTextFactory.#textLineX(text, lineWidth)
        const y = PcbScene3dCopperTextFactory.#textLineY(
            text,
            index,
            lineCount,
            lineSpacing
        )

        return KicadStrokeFont.strokeLine(line, { x, y, sizeX, sizeY }).map(
            (stroke) =>
                stroke.map((point) =>
                    PcbScene3dCopperTextFactory.#transformTextPoint(
                        text,
                        point,
                        glyphYUp
                    )
                )
        )
    }

    /**
     * Resolves KiCad-like baseline spacing for multiline text.
     * @param {object} text
     * @returns {number}
     */
    static #textLineSpacing(text) {
        return (
            PcbScene3dCopperTextFactory.#textHeight(text) *
            PcbScene3dCopperTextFactory.#TEXT_LINE_SPACING_RATIO
        )
    }

    /**
     * Resolves vertical text size.
     * @param {object} text
     * @returns {number}
     */
    static #textHeight(text) {
        return PcbScene3dCopperTextFactory.#positiveTextSize(
            text?.sizeX,
            text?.sizeY,
            text?.height
        )
    }

    /**
     * Resolves horizontal text size.
     * @param {object} text
     * @returns {number}
     */
    static #textWidth(text) {
        return PcbScene3dCopperTextFactory.#positiveTextSize(
            text?.sizeY,
            text?.sizeX,
            text?.height
        )
    }

    /**
     * Resolves a positive text metric.
     * @param {number | undefined} primary
     * @param {number | undefined} secondary
     * @param {number | undefined} tertiary
     * @returns {number}
     */
    static #positiveTextSize(primary, secondary, tertiary) {
        return Math.max(
            Number(primary) ||
                Number(secondary) ||
                Number(tertiary) ||
                39.37007874,
            0.001
        )
    }

    /**
     * Resolves line origin from KiCad horizontal justification.
     * @param {object} text
     * @param {number} lineWidth
     * @returns {number}
     */
    static #textLineX(text, lineWidth) {
        const fudge =
            PcbScene3dCopperTextFactory.#textStrokeHorizontalFudge(text)

        if (text?.hAlign === 'left') {
            return Number(text?.x || 0) + fudge
        }

        if (text?.hAlign === 'right') {
            return Number(text?.x || 0) - lineWidth - fudge
        }

        return Number(text?.x || 0) - lineWidth / 2
    }

    /**
     * Resolves one line baseline from KiCad vertical justification.
     * @param {object} text
     * @param {number} index
     * @param {number} lineCount
     * @param {number} lineSpacing
     * @returns {number}
     */
    static #textLineY(text, index, lineCount, lineSpacing) {
        const height = PcbScene3dCopperTextFactory.#textHeight(text)
        const blockHeight =
            height * PcbScene3dCopperTextFactory.#FIRST_LINE_HEIGHT_RATIO +
            lineSpacing * (lineCount - 1)
        let baseline =
            Number(text?.y || 0) +
            height -
            PcbScene3dCopperTextFactory.#textStrokeBaselineFudge(text)

        if (text?.vAlign === 'bottom') {
            baseline -= blockHeight
        } else if (text?.vAlign === 'center') {
            baseline -= blockHeight / 2
        }

        return baseline + lineSpacing * index
    }

    /**
     * Resolves KiCad text stroke width.
     * @param {object} text
     * @returns {number}
     */
    static #textStrokeWidth(text) {
        return Math.max(
            Number(text?.thickness) ||
                Number(text?.strokeWidth) ||
                4.7244094488,
            0.01
        )
    }

    /**
     * Resolves KiCad's small horizontal text adjustment.
     * @param {object} text
     * @returns {number}
     */
    static #textStrokeHorizontalFudge(text) {
        return PcbScene3dCopperTextFactory.#textStrokeWidth(text) / 1.52
    }

    /**
     * Resolves KiCad's small baseline text adjustment.
     * @param {object} text
     * @returns {number}
     */
    static #textStrokeBaselineFudge(text) {
        return (
            PcbScene3dCopperTextFactory.#textStrokeWidth(text) *
            PcbScene3dCopperTextFactory.#STROKE_BASELINE_FUDGE_RATIO
        )
    }

    /**
     * Applies KiCad text rotation and mirrored text transforms.
     * @param {object} text
     * @param {{ x: number, y: number }} point
     * @param {boolean} glyphYUp
     * @returns {{ x: number, y: number }}
     */
    static #transformTextPoint(text, point, glyphYUp) {
        const origin = {
            x: Number(text?.x || 0),
            y: Number(text?.y || 0)
        }
        const sourcePoint = glyphYUp
            ? PcbScene3dCopperTextFactory.#mirrorPointY(point, origin)
            : point

        if (text?.mirrored) {
            const rotated = PcbScene3dCopperTextFactory.#rotatePoint(
                sourcePoint,
                origin,
                Number(text?.rotation || 0)
            )
            return {
                x: origin.x - (rotated.x - origin.x),
                y: rotated.y
            }
        }

        return PcbScene3dCopperTextFactory.#rotatePoint(
            sourcePoint,
            origin,
            -Number(text?.rotation || 0)
        )
    }

    /**
     * Mirrors one stroke-font point across the text anchor's local X axis.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }} origin
     * @returns {{ x: number, y: number }}
     */
    static #mirrorPointY(point, origin) {
        return {
            x: Number(point?.x || 0),
            y: origin.y - (Number(point?.y || 0) - origin.y)
        }
    }

    /**
     * Rotates one point around an origin.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }} origin
     * @param {number} angleDeg
     * @returns {{ x: number, y: number }}
     */
    static #rotatePoint(point, origin, angleDeg) {
        const angle = (Number(angleDeg || 0) * Math.PI) / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const dx = Number(point?.x || 0) - origin.x
        const dy = Number(point?.y || 0) - origin.y

        return {
            x: origin.x + dx * cos - dy * sin,
            y: origin.y + dx * sin + dy * cos
        }
    }

    /**
     * Normalizes one board point and optionally mirrors it for underside use.
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {{ x: number, y: number }} point
     * @param {boolean} mirrorY
     * @returns {{ x: number, y: number }}
     */
    static #normalizePoint(normalizeBoardPoint, point, mirrorY) {
        const normalizedPoint = normalizeBoardPoint(point.x, point.y)

        return {
            x: normalizedPoint.x,
            y: mirrorY ? -normalizedPoint.y : normalizedPoint.y
        }
    }

    /**
     * Appends one widened stroke segment as two triangles.
     * @param {number[]} positions
     * @param {{ x: number, y: number }} start
     * @param {{ x: number, y: number }} end
     * @param {number} width
     * @param {number} z
     * @returns {void}
     */
    static #appendTrackTriangles(positions, start, end, width, z) {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        const halfWidth = Math.max(Number(width || 0), 1) / 2

        if (length <= 0.001) {
            return
        }

        const normalX = (-dy / length) * halfWidth
        const normalY = (dx / length) * halfWidth

        PcbScene3dCopperTextFactory.#appendQuadTriangles(
            positions,
            { x: start.x + normalX, y: start.y + normalY },
            { x: end.x + normalX, y: end.y + normalY },
            { x: end.x - normalX, y: end.y - normalY },
            { x: start.x - normalX, y: start.y - normalY },
            z
        )
    }

    /**
     * Appends one rectangle as two triangles.
     * @param {number[]} positions
     * @param {{ x: number, y: number }} a
     * @param {{ x: number, y: number }} b
     * @param {{ x: number, y: number }} c
     * @param {{ x: number, y: number }} d
     * @param {number} z
     * @returns {void}
     */
    static #appendQuadTriangles(positions, a, b, c, d, z) {
        PcbScene3dCopperTextFactory.#appendTriangle(positions, a, b, c, z)
        PcbScene3dCopperTextFactory.#appendTriangle(positions, a, c, d, z)
    }

    /**
     * Appends one triangle into the position buffer.
     * @param {number[]} positions
     * @param {{ x: number, y: number }} a
     * @param {{ x: number, y: number }} b
     * @param {{ x: number, y: number }} c
     * @param {number} z
     * @returns {void}
     */
    static #appendTriangle(positions, a, b, c, z) {
        positions.push(a.x, a.y, z, b.x, b.y, z, c.x, c.y, z)
    }

    /**
     * Builds the shared copper text material.
     * @param {any} THREE
     * @param {number} color
     * @returns {any}
     */
    static #buildMaterial(THREE, color) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness: 0.38,
            metalness: 0.55,
            side: THREE.DoubleSide
        })
    }

    /**
     * Resolves a safe RGB material color.
     * @param {unknown} color
     * @returns {number}
     */
    static #resolveMaterialColor(color) {
        const numericColor = Number(color)

        return Number.isInteger(numericColor) &&
            numericColor >= 0 &&
            numericColor <= 0xffffff
            ? numericColor
            : PcbScene3dCopperTextFactory.#DEFAULT_MATERIAL_COLOR
    }

    /**
     * Normalizes a side option.
     * @param {string | undefined} side
     * @returns {'top' | 'bottom'}
     */
    static #normalizeSide(side) {
        return String(side || '').toLowerCase() === 'bottom' ? 'bottom' : 'top'
    }

    /**
     * Checks whether one text belongs to the requested copper side.
     * @param {object} text
     * @param {'top' | 'bottom'} side
     * @returns {boolean}
     */
    static #matchesSide(text, side) {
        const layer = String(text?.layer || '').toUpperCase()
        const layerId = Number(text?.layerId ?? NaN)
        const textSide = String(text?.side || '').toLowerCase()

        if (layer) {
            return side === 'bottom' ? layer === 'B.CU' : layer === 'F.CU'
        }

        if (Number.isFinite(layerId)) {
            return side === 'bottom' ? layerId === 32 : layerId === 1
        }

        if (side === 'bottom') {
            return textSide === 'back' || textSide === 'bottom'
        }

        return textSide === 'front' || textSide === 'top'
    }
}
