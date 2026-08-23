import { EcadRendererService } from './ecad/EcadRendererService.mjs'

const TECHNICAL_DRAWING_ENVELOPE_RATIO = 1.2
const DRAWING_COLLECTIONS = [
    'tracks',
    'arcs',
    'fills',
    'regions',
    'shapeBasedRegions',
    'polygons',
    'texts',
    'dimensions'
]

/**
 * Detects separate PCB technical-drawing artwork from native geometry.
 */
export class PcbTechnicalDrawingContent {
    /**
     * Resolves populated drawing-layer keys when their combined artwork
     * materially expands beyond the physical board envelope.
     * @param {any} documentModel Active PCB document model.
     * @param {{ layer: any, key: string, aliases: string[] }[]} drawingLayers Drawing layers.
     * @returns {string[]}
     */
    static resolveLayerKeys(documentModel, drawingLayers) {
        if (!Array.isArray(drawingLayers) || !drawingLayers.length) return []

        const nativeModel =
            EcadRendererService.resolvePcbNativeModel(documentModel)
        const pcb = nativeModel?.pcb || {}
        const keysByAlias =
            PcbTechnicalDrawingContent.#keysByAlias(drawingLayers)
        const matched = PcbTechnicalDrawingContent.#matchedPrimitives(
            pcb,
            keysByAlias
        )
        if (!matched.length) return []

        const populatedKeys = new Set(matched.map(({ key }) => key))
        const orderedKeys = drawingLayers
            .map(({ key }) => key)
            .filter((key) => populatedKeys.has(key))
        const boardBounds = PcbTechnicalDrawingContent.#boardBounds(
            pcb.boardOutline
        )
        if (!boardBounds) return orderedKeys

        const artworkBounds = PcbTechnicalDrawingContent.#boundsFromPoints(
            matched.flatMap(({ primitive }) =>
                PcbTechnicalDrawingContent.#primitivePoints(primitive)
            )
        )
        if (!artworkBounds) return []

        const combinedBounds = PcbTechnicalDrawingContent.#combineBounds(
            boardBounds,
            artworkBounds
        )
        const expandsWidth =
            combinedBounds.width >
            boardBounds.width * TECHNICAL_DRAWING_ENVELOPE_RATIO
        const expandsHeight =
            combinedBounds.height >
            boardBounds.height * TECHNICAL_DRAWING_ENVELOPE_RATIO

        return expandsWidth || expandsHeight ? orderedKeys : []
    }

    /**
     * Maps normalized layer aliases to stable layer keys.
     * @param {{ key: string, aliases: string[] }[]} drawingLayers Drawing layers.
     * @returns {Map<string, string>}
     */
    static #keysByAlias(drawingLayers) {
        const result = new Map()
        for (const { key, aliases } of drawingLayers) {
            for (const alias of aliases || []) {
                result.set(PcbTechnicalDrawingContent.#normalize(alias), key)
            }
        }
        return result
    }

    /**
     * Collects renderable primitives assigned to drawing layers.
     * @param {any} pcb Native PCB model.
     * @param {Map<string, string>} keysByAlias Drawing aliases.
     * @returns {{ primitive: any, key: string }[]}
     */
    static #matchedPrimitives(pcb, keysByAlias) {
        const result = []
        for (const collection of DRAWING_COLLECTIONS) {
            const primitives = Array.isArray(pcb?.[collection])
                ? pcb[collection]
                : []
            for (const primitive of primitives) {
                const key = PcbTechnicalDrawingContent.#primitiveLayerAliases(
                    primitive
                )
                    .map((alias) => keysByAlias.get(alias))
                    .find(Boolean)
                if (key) result.push({ primitive, key })
            }
        }
        return result
    }

    /**
     * Resolves normalized layer aliases carried by one primitive.
     * @param {any} primitive PCB primitive.
     * @returns {string[]}
     */
    static #primitiveLayerAliases(primitive) {
        return [
            primitive?.layerKey,
            primitive?.layer,
            primitive?.layerName,
            primitive?.layerId,
            primitive?.layerCode,
            primitive?.legacyLayerId
        ]
            .filter((value) => value !== undefined && value !== null)
            .map(PcbTechnicalDrawingContent.#normalize)
            .filter(Boolean)
    }

    /**
     * Resolves the physical board envelope.
     * @param {any} outline Native board outline.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number } | null}
     */
    static #boardBounds(outline) {
        const minX = Number(outline?.minX)
        const minY = Number(outline?.minY)
        const width = Number(outline?.widthMil ?? outline?.width)
        const height = Number(outline?.heightMil ?? outline?.height)
        if (
            Number.isFinite(minX) &&
            Number.isFinite(minY) &&
            Number.isFinite(width) &&
            Number.isFinite(height) &&
            width > 0 &&
            height > 0
        ) {
            return {
                minX,
                minY,
                maxX: minX + width,
                maxY: minY + height,
                width,
                height
            }
        }

        return PcbTechnicalDrawingContent.#boundsFromPoints(
            PcbTechnicalDrawingContent.#geometryPoints(outline?.segments, 0)
        )
    }

    /**
     * Collects geometry points from one primitive and its path collections.
     * @param {any} primitive PCB primitive.
     * @returns {{ x: number, y: number }[]}
     */
    static #primitivePoints(primitive) {
        const points = PcbTechnicalDrawingContent.#geometryPoints(primitive, 0)
        const centerX = Number(primitive?.x ?? primitive?.cx)
        const centerY = Number(primitive?.y ?? primitive?.cy)
        const radius = Math.abs(Number(primitive?.radius))
        if (
            Number.isFinite(centerX) &&
            Number.isFinite(centerY) &&
            Number.isFinite(radius) &&
            radius > 0
        ) {
            points.push(
                { x: centerX - radius, y: centerY - radius },
                { x: centerX + radius, y: centerY + radius }
            )
        }
        return points
    }

    /**
     * Recursively collects recognized coordinate pairs from geometry objects.
     * @param {any} value Geometry value.
     * @param {number} depth Current recursion depth.
     * @returns {{ x: number, y: number }[]}
     */
    static #geometryPoints(value, depth) {
        if (!value || depth > 5) return []
        if (Array.isArray(value)) {
            return value.flatMap((entry) =>
                PcbTechnicalDrawingContent.#geometryPoints(entry, depth + 1)
            )
        }
        if (typeof value !== 'object') return []

        const result = []
        const coordinatePairs = [
            ['x', 'y'],
            ['x1', 'y1'],
            ['x2', 'y2'],
            ['cx', 'cy'],
            ['centerX', 'centerY'],
            ['startX', 'startY'],
            ['endX', 'endY']
        ]
        for (const [xKey, yKey] of coordinatePairs) {
            const x = Number(value[xKey])
            const y = Number(value[yKey])
            if (Number.isFinite(x) && Number.isFinite(y)) {
                result.push({ x, y })
            }
        }
        for (const key of [
            'points',
            'vertices',
            'segments',
            'outline',
            'contours',
            'holes'
        ]) {
            result.push(
                ...PcbTechnicalDrawingContent.#geometryPoints(
                    value[key],
                    depth + 1
                )
            )
        }
        return result
    }

    /**
     * Calculates a finite envelope from points.
     * @param {{ x: number, y: number }[]} points Geometry points.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number } | null}
     */
    static #boundsFromPoints(points) {
        const valid = (points || []).filter(
            ({ x, y }) => Number.isFinite(x) && Number.isFinite(y)
        )
        if (!valid.length) return null

        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY
        for (const { x, y } of valid) {
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
        }
        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        }
    }

    /**
     * Returns the union of two finite envelopes.
     * @param {any} left First bounds.
     * @param {any} right Second bounds.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
     */
    static #combineBounds(left, right) {
        const minX = Math.min(left.minX, right.minX)
        const minY = Math.min(left.minY, right.minY)
        const maxX = Math.max(left.maxX, right.maxX)
        const maxY = Math.max(left.maxY, right.maxY)
        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        }
    }

    /**
     * Normalizes one layer identifier for matching.
     * @param {unknown} value Raw identifier.
     * @returns {string}
     */
    static #normalize(value) {
        return String(value ?? '')
            .trim()
            .toUpperCase()
    }
}
