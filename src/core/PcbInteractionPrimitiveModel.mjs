import { EcadFormatRegistry } from './ecad/EcadFormatRegistry.mjs'
import { CircuitJsonPcbPrimitiveBuilder } from './CircuitJsonPcbPrimitiveBuilder.mjs'

/**
 * Builds renderer-neutral PCB primitives for element-array board documents.
 */
export class PcbInteractionPrimitiveModel {
    /**
     * Builds a normalized primitive model from a parsed PCB document.
     * @param {object | object[]} documentModel Parsed document model.
     * @returns {{ bounds: object, layers: object[], virtualLayers: object[], components: object[], nets: object[], primitives: object[], anchors: object[], diagnostics: object[], airwires: object[], traceLengths: object[], groups: object[], anchorOffsets: object[] }}
     */
    static build(documentModel) {
        if (
            !PcbInteractionPrimitiveModel.#isElementArrayDocument(documentModel)
        ) {
            return PcbInteractionPrimitiveModel.#emptyModel()
        }

        return CircuitJsonPcbPrimitiveBuilder.build(documentModel)
    }

    /**
     * Resolves physical and virtual PCB interaction layers.
     * @param {object | object[]} documentModel Parsed document model.
     * @returns {{ physicalLayers: object[], virtualLayers: object[] }}
     */
    static resolveLayerGroups(documentModel) {
        if (
            !PcbInteractionPrimitiveModel.#isElementArrayDocument(documentModel)
        ) {
            return { physicalLayers: [], virtualLayers: [] }
        }

        const model = CircuitJsonPcbPrimitiveBuilder.build(documentModel)
        return {
            physicalLayers: model.layers,
            virtualLayers: model.virtualLayers || []
        }
    }

    /**
     * Snaps a board point to the nearest primitive anchor within tolerance.
     * @param {object | object[]} documentModel Parsed document model.
     * @param {{ x?: unknown, y?: unknown }} point Board-space point.
     * @param {{ tolerance?: number }} [options] Snap options.
     * @returns {{ snapped: boolean, point: { x: number, y: number } }}
     */
    static resolveSnapPoint(documentModel, point, options = {}) {
        const normalizedPoint = PcbInteractionPrimitiveModel.#point(point)
        if (!normalizedPoint) return { snapped: false, point: { x: 0, y: 0 } }

        const tolerance = Math.max(
            PcbInteractionPrimitiveModel.#number(options.tolerance, 0),
            0
        )
        let bestPoint = null
        let bestDistanceSq = Infinity

        for (const anchor of PcbInteractionPrimitiveModel.build(documentModel)
            .anchors) {
            const distanceSq = PcbInteractionPrimitiveModel.#distanceSquared(
                normalizedPoint,
                anchor.point
            )
            if (distanceSq < bestDistanceSq) {
                bestPoint = anchor.point
                bestDistanceSq = distanceSq
            }
        }

        if (!bestPoint || bestDistanceSq > tolerance * tolerance) {
            return { snapped: false, point: normalizedPoint }
        }

        return { snapped: true, point: { x: bestPoint.x, y: bestPoint.y } }
    }

    /**
     * Returns prioritized primitive hit candidates for one board point.
     * @param {object | object[]} documentModel Parsed document model.
     * @param {{ x?: unknown, y?: unknown }} point Board-space point.
     * @param {{ side?: 'top' | 'bottom', hiddenLayers?: string[], hiddenObjects?: string[], tolerance?: number }} [options] Hit-test options.
     * @returns {object[]}
     */
    static hitTest(documentModel, point, options = {}) {
        const normalizedPoint = PcbInteractionPrimitiveModel.#point(point)
        if (!normalizedPoint) return []

        const tolerance = PcbInteractionPrimitiveModel.#number(
            options.tolerance,
            0.2
        )
        const hits = []

        for (const primitive of PcbInteractionPrimitiveModel.build(
            documentModel
        ).primitives) {
            if (!PcbInteractionPrimitiveModel.#isVisible(primitive, options)) {
                continue
            }
            const distance = PcbInteractionPrimitiveModel.#hitDistance(
                primitive,
                normalizedPoint,
                tolerance
            )
            if (distance === null) continue

            hits.push({
                ...PcbInteractionPrimitiveModel.#candidate(primitive),
                distance
            })
        }

        return hits.sort(
            (left, right) =>
                PcbInteractionPrimitiveModel.#priority(left.kind) -
                    PcbInteractionPrimitiveModel.#priority(right.kind) ||
                left.distance - right.distance
        )
    }

    /**
     * Returns true when the document uses the element-array source format.
     * @param {object | object[]} documentModel Parsed document model.
     * @returns {boolean}
     */
    static #isElementArrayDocument(documentModel) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'circuitjson'
        )
    }

    /**
     * Builds an empty primitive model.
     * @returns {{ bounds: object, layers: object[], virtualLayers: object[], components: object[], nets: object[], primitives: object[], anchors: object[], diagnostics: object[], airwires: object[], traceLengths: object[], groups: object[], anchorOffsets: object[] }}
     */
    static #emptyModel() {
        return {
            bounds: PcbInteractionPrimitiveModel.#bounds(0, 0, 1, 1),
            layers: [],
            virtualLayers: [],
            components: [],
            nets: [],
            primitives: [],
            anchors: [],
            diagnostics: [],
            airwires: [],
            traceLengths: [],
            groups: [],
            anchorOffsets: []
        }
    }

    /**
     * Returns true when a primitive should participate in hit testing.
     * @param {object} primitive Primitive row.
     * @param {object} options Hit-test options.
     * @returns {boolean}
     */
    static #isVisible(primitive, options) {
        const hiddenLayers = new Set(
            (Array.isArray(options.hiddenLayers) ? options.hiddenLayers : [])
                .map(String)
                .filter(Boolean)
        )
        if (primitive.layer && hiddenLayers.has(String(primitive.layer))) {
            return false
        }

        const hiddenObjects = new Set(
            (Array.isArray(options.hiddenObjects) ? options.hiddenObjects : [])
                .map(String)
                .filter(Boolean)
        )
        if (
            hiddenObjects.has(
                PcbInteractionPrimitiveModel.#objectKey(primitive)
            )
        ) {
            return false
        }

        const side = String(options.side || '')
        return !side || !primitive.side || primitive.side === side
    }

    /**
     * Resolves the sidebar object key for a primitive.
     * @param {object} primitive Primitive row.
     * @returns {string}
     */
    static #objectKey(primitive) {
        return (
            {
                board: 'page',
                cutout: 'page',
                pad: 'pads',
                track: 'tracks',
                via: 'vias',
                zone: 'zones',
                'copper-text': 'footprint-text',
                copper_text: 'footprint-text',
                silkscreen: 'footprint-text',
                silkscreen_text: 'footprint-text',
                fabrication: 'footprint-text'
            }[primitive.kind] || primitive.kind
        )
    }

    /**
     * Resolves one primitive hit distance.
     * @param {object} primitive Primitive row.
     * @param {{ x: number, y: number }} point Board point.
     * @param {number} tolerance Hit tolerance.
     * @returns {number | null}
     */
    static #hitDistance(primitive, point, tolerance) {
        if (primitive.kind === 'track') {
            const distance = PcbInteractionPrimitiveModel.#distanceToSegment(
                point,
                { x: primitive.x1, y: primitive.y1 },
                { x: primitive.x2, y: primitive.y2 }
            )
            return distance <= primitive.width / 2 + tolerance ? distance : null
        }
        if (primitive.kind === 'via') {
            const distance = Math.sqrt(
                PcbInteractionPrimitiveModel.#distanceSquared(point, primitive)
            )
            return distance <= primitive.diameter / 2 + tolerance
                ? distance
                : null
        }
        if (
            ['pad', 'zone', 'keepout', 'cutout', 'courtyard'].includes(
                primitive.kind
            )
        ) {
            return PcbInteractionPrimitiveModel.#inside(
                point,
                primitive.bounds,
                tolerance
            )
                ? 0
                : null
        }
        if (primitive.kind === 'board') {
            return PcbInteractionPrimitiveModel.#inside(
                point,
                primitive.bounds,
                0
            )
                ? Number.MAX_SAFE_INTEGER
                : null
        }
        return null
    }

    /**
     * Builds a hit-test candidate from a primitive.
     * @param {object} primitive Primitive row.
     * @returns {object}
     */
    static #candidate(primitive) {
        return {
            role: primitive.kind,
            kind: primitive.kind,
            componentKey: String(primitive.componentKey || ''),
            componentId: String(
                primitive.componentId || primitive.componentKey || ''
            ),
            netName: String(primitive.netName || ''),
            net: String(primitive.netName || ''),
            layer: String(primitive.layer || ''),
            layerKey: String(primitive.layer || ''),
            source: primitive.source || primitive
        }
    }

    /**
     * Returns sorting priority for one hit kind.
     * @param {string} kind Primitive kind.
     * @returns {number}
     */
    static #priority(kind) {
        return { pad: 10, via: 20, track: 30, zone: 40, board: 100 }[kind] || 90
    }

    /**
     * Returns true when a point is inside bounds.
     * @param {{ x: number, y: number }} point Point.
     * @param {object} bounds Bounds.
     * @param {number} padding Padding.
     * @returns {boolean}
     */
    static #inside(point, bounds, padding) {
        return (
            point.x >= bounds.minX - padding &&
            point.x <= bounds.maxX + padding &&
            point.y >= bounds.minY - padding &&
            point.y <= bounds.maxY + padding
        )
    }

    /**
     * Resolves a point from common x/y fields.
     * @param {object | null | undefined} value Point candidate.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(value) {
        const x = PcbInteractionPrimitiveModel.#finite(value?.x)
        const y = PcbInteractionPrimitiveModel.#finite(value?.y)
        if (x === null || y === null) return null
        return { x, y }
    }

    /**
     * Builds a normalized bounds record.
     * @param {number} minX Minimum x.
     * @param {number} minY Minimum y.
     * @param {number} maxX Maximum x.
     * @param {number} maxY Maximum y.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
     */
    static #bounds(minX, minY, maxX, maxY) {
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
     * Resolves squared point distance.
     * @param {{ x: number, y: number }} left First point.
     * @param {{ x: number, y: number }} right Second point.
     * @returns {number}
     */
    static #distanceSquared(left, right) {
        return (left.x - right.x) ** 2 + (left.y - right.y) ** 2
    }

    /**
     * Resolves point-to-segment distance.
     * @param {{ x: number, y: number }} point Point.
     * @param {{ x: number, y: number }} start Segment start.
     * @param {{ x: number, y: number }} end Segment end.
     * @returns {number}
     */
    static #distanceToSegment(point, start, end) {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const lengthSq = dx * dx + dy * dy
        if (!lengthSq) {
            return Math.sqrt(
                PcbInteractionPrimitiveModel.#distanceSquared(point, start)
            )
        }
        const t = Math.max(
            0,
            Math.min(
                1,
                ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq
            )
        )
        return Math.sqrt(
            PcbInteractionPrimitiveModel.#distanceSquared(point, {
                x: start.x + t * dx,
                y: start.y + t * dy
            })
        )
    }

    /**
     * Converts a value to a finite number or null.
     * @param {unknown} value Numeric candidate.
     * @returns {number | null}
     */
    static #finite(value) {
        if (value === undefined || value === null || value === '') return null
        const number = Number(value)
        return Number.isFinite(number) ? number : null
    }

    /**
     * Converts a value to a finite number with fallback.
     * @param {unknown} value Numeric candidate.
     * @param {number} fallback Fallback number.
     * @returns {number}
     */
    static #number(value, fallback) {
        return PcbInteractionPrimitiveModel.#finite(value) ?? fallback
    }
}
