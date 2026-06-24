import { CircuitJsonIndexer, CircuitJsonUnits } from 'circuitjson-toolkit'
import { CircuitJsonPcbPrimitiveGeometry } from './CircuitJsonPcbPrimitiveGeometry.mjs'

const MIN_RING_AREA = 1e-8

/**
 * Builds copper area primitives from CircuitJSON PCB area records.
 */
export class CircuitJsonPcbZonePrimitiveBuilder {
    /**
     * Builds copper area primitives and geometry diagnostics.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {{ primitives: object[], diagnostics: object[] }}
     */
    static build(index, componentsByPcbId) {
        const rows = CircuitJsonPcbZonePrimitiveBuilder.#areaElements(
            index
        ).map((element) =>
            CircuitJsonPcbZonePrimitiveBuilder.#zonePrimitive(
                element,
                componentsByPcbId
            )
        )

        return {
            primitives: rows.map((row) => row.primitive).filter(Boolean),
            diagnostics: rows.flatMap((row) => row.diagnostics)
        }
    }

    /**
     * Builds one copper area primitive.
     * @param {object} element Source element.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {{ primitive: object | null, diagnostics: object[] }}
     */
    static #zonePrimitive(element, componentsByPcbId) {
        if (CircuitJsonPcbZonePrimitiveBuilder.#isBRepElement(element)) {
            return CircuitJsonPcbZonePrimitiveBuilder.#brepPrimitive(
                element,
                componentsByPcbId
            )
        }
        return CircuitJsonPcbZonePrimitiveBuilder.#polygonPrimitive(
            element,
            componentsByPcbId
        )
    }

    /**
     * Builds one B-Rep copper area primitive.
     * @param {object} element Source element.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {{ primitive: object | null, diagnostics: object[] }}
     */
    static #brepPrimitive(element, componentsByPcbId) {
        const geometry =
            CircuitJsonPcbZonePrimitiveBuilder.#brepGeometry(element)
        const component = CircuitJsonPcbZonePrimitiveBuilder.#component(
            element,
            componentsByPcbId
        )
        const bounds = CircuitJsonPcbZonePrimitiveBuilder.#mergedRingBounds(
            geometry.rings
        )
        const firstOuter = geometry.rings.find((ring) => ring.role === 'outer')
        const primitive = bounds
            ? CircuitJsonPcbZonePrimitiveBuilder.#primitive({
                  id: CircuitJsonIndexer.getElementId(element),
                  kind: 'zone',
                  shape: 'brep',
                  points: firstOuter?.points || [],
                  rings: geometry.rings,
                  bounds,
                  layer: CircuitJsonPcbZonePrimitiveBuilder.#layer(
                      element.layer
                  ),
                  component,
                  netName: CircuitJsonPcbZonePrimitiveBuilder.#netName(
                      element,
                      null
                  ),
                  sourceNetId:
                      CircuitJsonPcbZonePrimitiveBuilder.#sourceNetId(element),
                  coveredWithSolderMask:
                      CircuitJsonPcbZonePrimitiveBuilder.#coveredWithSolderMask(
                          element
                      ),
                  anchors: geometry.rings.flatMap((ring) =>
                      ring.points.map((point) => ({ point }))
                  ),
                  source: element
              })
            : null

        return {
            primitive,
            diagnostics: geometry.diagnostics.map((diagnostic) =>
                CircuitJsonPcbZonePrimitiveBuilder.#diagnostic(
                    diagnostic,
                    element,
                    primitive
                )
            )
        }
    }

    /**
     * Builds one polygonal copper area primitive.
     * @param {object} element Source element.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {{ primitive: object | null, diagnostics: object[] }}
     */
    static #polygonPrimitive(element, componentsByPcbId) {
        const points = CircuitJsonPcbZonePrimitiveBuilder.#points(element)
        if (points.length < 3) return { primitive: null, diagnostics: [] }
        const component = CircuitJsonPcbZonePrimitiveBuilder.#component(
            element,
            componentsByPcbId
        )

        return {
            primitive: CircuitJsonPcbZonePrimitiveBuilder.#primitive({
                id: CircuitJsonIndexer.getElementId(element),
                kind: 'zone',
                shape: String(element.shape || 'polygon'),
                points,
                bounds: CircuitJsonPcbPrimitiveGeometry.pointsBounds(points),
                layer: CircuitJsonPcbZonePrimitiveBuilder.#layer(element.layer),
                component,
                netName: CircuitJsonPcbZonePrimitiveBuilder.#netName(
                    element,
                    null
                ),
                sourceNetId:
                    CircuitJsonPcbZonePrimitiveBuilder.#sourceNetId(element),
                coveredWithSolderMask:
                    CircuitJsonPcbZonePrimitiveBuilder.#coveredWithSolderMask(
                        element
                    ),
                anchors: points.map((point) => ({ point })),
                source: element
            }),
            diagnostics: []
        }
    }

    /**
     * Normalizes B-Rep geometry into renderable rings.
     * @param {object} element Source element.
     * @returns {{ rings: object[], diagnostics: object[] }}
     */
    static #brepGeometry(element) {
        const rings = []
        const diagnostics = []
        const shapes = CircuitJsonPcbZonePrimitiveBuilder.#brepShapes(element)

        shapes.forEach((shape, shapeIndex) => {
            const outer = CircuitJsonPcbZonePrimitiveBuilder.#normalizeRing(
                CircuitJsonPcbZonePrimitiveBuilder.#outerRing(shape)
            )
            if (!outer.points) {
                diagnostics.push({
                    ...outer,
                    code: 'pcb_zone_brep_island_dropped',
                    role: 'outer',
                    shapeIndex
                })
                return
            }

            rings.push({
                role: 'outer',
                shapeIndex,
                points: outer.points,
                bounds: outer.bounds
            })

            CircuitJsonPcbZonePrimitiveBuilder.#innerRings(shape).forEach(
                (ring, ringIndex) => {
                    const hole =
                        CircuitJsonPcbZonePrimitiveBuilder.#normalizeRing(ring)
                    if (!hole.points) {
                        diagnostics.push({
                            ...hole,
                            code: 'pcb_zone_brep_ring_dropped',
                            role: 'hole',
                            shapeIndex,
                            ringIndex
                        })
                        return
                    }
                    rings.push({
                        role: 'hole',
                        shapeIndex,
                        ringIndex,
                        points: hole.points,
                        bounds: hole.bounds
                    })
                }
            )
        })

        return { rings, diagnostics }
    }

    /**
     * Normalizes one ring into valid points.
     * @param {object | object[]} ring Ring candidate.
     * @returns {{ points?: object[], bounds?: object, reason?: string }}
     */
    static #normalizeRing(ring) {
        const rawPoints = CircuitJsonPcbZonePrimitiveBuilder.#ringVertices(ring)
        const points = rawPoints
            .map((point) => CircuitJsonPcbZonePrimitiveBuilder.#point(point))
            .filter(Boolean)
            .map((point) => ({
                x: CircuitJsonPcbZonePrimitiveBuilder.#round(point.x),
                y: CircuitJsonPcbZonePrimitiveBuilder.#round(point.y)
            }))
        const normalized =
            CircuitJsonPcbZonePrimitiveBuilder.#dropDuplicateClosure(
                CircuitJsonPcbZonePrimitiveBuilder.#dropConsecutiveDuplicates(
                    points
                )
            )
        const bounds =
            normalized.length > 0
                ? CircuitJsonPcbPrimitiveGeometry.pointsBounds(normalized)
                : null

        if (
            CircuitJsonPcbZonePrimitiveBuilder.#uniquePointCount(normalized) < 3
        ) {
            return { bounds, reason: 'too-few-points' }
        }

        if (
            Math.abs(
                CircuitJsonPcbZonePrimitiveBuilder.#signedArea(normalized)
            ) <= MIN_RING_AREA
        ) {
            return { bounds, reason: 'tiny-area' }
        }

        return { points: normalized, bounds }
    }

    /**
     * Builds one geometry diagnostic row.
     * @param {object} diagnostic Normalization diagnostic.
     * @param {object} element Source element.
     * @param {object | null} primitive Built primitive.
     * @returns {object}
     */
    static #diagnostic(diagnostic, element, primitive) {
        const bounds = diagnostic.bounds || primitive?.bounds || null
        const point = bounds
            ? CircuitJsonPcbZonePrimitiveBuilder.#boundsCenter(bounds)
            : { x: 0, y: 0 }
        const sourceId =
            CircuitJsonIndexer.getElementId(element) || 'copper-area'
        const role = diagnostic.role === 'outer' ? 'island' : 'ring'

        return {
            id:
                sourceId +
                ':brep:' +
                diagnostic.shapeIndex +
                ':' +
                (diagnostic.ringIndex ?? 0) +
                ':' +
                diagnostic.code,
            kind: 'warning',
            severity: 'warning',
            category: 'geometry',
            code: diagnostic.code,
            message:
                'Copper area ' +
                role +
                ' was ignored because ' +
                CircuitJsonPcbZonePrimitiveBuilder.#reasonMessage(
                    diagnostic.reason
                ) +
                '.',
            point,
            bounds,
            relatedPrimitiveIds: primitive?.id ? [primitive.id] : [],
            netName: CircuitJsonPcbZonePrimitiveBuilder.#netName(element, null)
        }
    }

    /**
     * Returns all copper area elements.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {object[]}
     */
    static #areaElements(index) {
        return [
            'pcb_copper_pour',
            'pcb_ground_plane',
            'pcb_ground_plane_region'
        ].flatMap((type) => index.elementsByType.get(type) || [])
    }

    /**
     * Returns true when an element carries B-Rep geometry.
     * @param {object} element Source element.
     * @returns {boolean}
     */
    static #isBRepElement(element) {
        return (
            String(element?.shape || '').toLowerCase() === 'brep' ||
            Boolean(element?.brep_shape) ||
            Boolean(element?.brepShape) ||
            Array.isArray(element?.brep_shapes)
        )
    }

    /**
     * Resolves B-Rep shape rows from common field aliases.
     * @param {object} element Source element.
     * @returns {object[]}
     */
    static #brepShapes(element) {
        return [
            ...(Array.isArray(element?.brep_shapes) ? element.brep_shapes : []),
            ...(Array.isArray(element?.brepShapes) ? element.brepShapes : []),
            element?.brep_shape,
            element?.brepShape
        ].filter(Boolean)
    }

    /**
     * Resolves the outer ring from a B-Rep shape.
     * @param {object} shape B-Rep shape.
     * @returns {object | object[] | null}
     */
    static #outerRing(shape) {
        return (
            shape?.outerRing ||
            shape?.outer_ring ||
            shape?.outer ||
            shape?.ring ||
            null
        )
    }

    /**
     * Resolves inner rings from a B-Rep shape.
     * @param {object} shape B-Rep shape.
     * @returns {object[]}
     */
    static #innerRings(shape) {
        const rings =
            shape?.innerRings ||
            shape?.inner_rings ||
            shape?.holes ||
            shape?.inner ||
            []
        return Array.isArray(rings) ? rings : []
    }

    /**
     * Resolves vertices from a ring candidate.
     * @param {object | object[] | null} ring Ring candidate.
     * @returns {object[]}
     */
    static #ringVertices(ring) {
        if (Array.isArray(ring)) return ring
        return (
            ring?.cwVertices ||
            ring?.ccwVertices ||
            ring?.vertices ||
            ring?.points ||
            []
        )
    }

    /**
     * Resolves polygon points from common fields.
     * @param {object} element Element row.
     * @returns {{ x: number, y: number }[]}
     */
    static #points(element) {
        const points =
            (Array.isArray(element?.points) && element.points) ||
            (Array.isArray(element?.outline) && element.outline) ||
            (Array.isArray(element?.vertices) && element.vertices) ||
            (Array.isArray(element?.shape?.points) && element.shape.points) ||
            []

        return points
            .map((point) => CircuitJsonPcbZonePrimitiveBuilder.#point(point))
            .filter(Boolean)
    }

    /**
     * Resolves a component from the source element.
     * @param {object} element Source element.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object | undefined}
     */
    static #component(element, componentsByPcbId) {
        return componentsByPcbId.get(
            String(element.pcb_component_id || '').trim()
        )
    }

    /**
     * Adds common primitive metadata.
     * @param {object} primitive Primitive data.
     * @returns {object}
     */
    static #primitive(primitive) {
        const component = primitive.component || {}
        const layer = CircuitJsonPcbZonePrimitiveBuilder.#layer(primitive.layer)
        const source = primitive.source || {}
        return {
            ...primitive,
            layer,
            side:
                primitive.side ??
                CircuitJsonPcbZonePrimitiveBuilder.#side(layer),
            componentKey: String(component.componentKey || ''),
            componentId: String(component.pcbComponentId || ''),
            footprintId: component.componentKey
                ? 'footprint:' + component.componentKey + ':' + primitive.kind
                : '',
            netName: String(primitive.netName || '').trim(),
            groupIds: CircuitJsonPcbZonePrimitiveBuilder.#uniqueStrings([
                source.pcb_group_id,
                source.source_group_id,
                component.pcb_group_id,
                component.positioned_relative_to_pcb_group_id,
                component.sourceGroupId
            ]),
            subcircuitIds: CircuitJsonPcbZonePrimitiveBuilder.#uniqueStrings([
                source.subcircuit_id,
                source.subcircuitId,
                ...(component.subcircuitIds || [])
            ])
        }
    }

    /**
     * Merges ring bounds.
     * @param {{ bounds?: object }[]} rings Ring rows.
     * @returns {object | null}
     */
    static #mergedRingBounds(rings) {
        const boundsRows = rings.map((ring) => ring.bounds).filter(Boolean)
        if (!boundsRows.length) return null
        return boundsRows.reduce((bounds, row) =>
            bounds
                ? CircuitJsonPcbPrimitiveGeometry.bounds(
                      Math.min(bounds.minX, row.minX),
                      Math.min(bounds.minY, row.minY),
                      Math.max(bounds.maxX, row.maxX),
                      Math.max(bounds.maxY, row.maxY)
                  )
                : row
        )
    }

    /**
     * Drops consecutive duplicate points.
     * @param {{ x: number, y: number }[]} points Ring points.
     * @returns {{ x: number, y: number }[]}
     */
    static #dropConsecutiveDuplicates(points) {
        return points.filter(
            (point, index) =>
                index === 0 ||
                !CircuitJsonPcbZonePrimitiveBuilder.#samePoint(
                    point,
                    points[index - 1]
                )
        )
    }

    /**
     * Drops a duplicate closing point.
     * @param {{ x: number, y: number }[]} points Ring points.
     * @returns {{ x: number, y: number }[]}
     */
    static #dropDuplicateClosure(points) {
        if (
            points.length > 1 &&
            CircuitJsonPcbZonePrimitiveBuilder.#samePoint(
                points[0],
                points[points.length - 1]
            )
        ) {
            return points.slice(0, -1)
        }
        return points
    }

    /**
     * Counts unique point coordinates.
     * @param {{ x: number, y: number }[]} points Ring points.
     * @returns {number}
     */
    static #uniquePointCount(points) {
        return new Set(points.map((point) => point.x + ',' + point.y)).size
    }

    /**
     * Computes signed polygon area.
     * @param {{ x: number, y: number }[]} points Ring points.
     * @returns {number}
     */
    static #signedArea(points) {
        return (
            points.reduce((sum, point, index) => {
                const next = points[(index + 1) % points.length]
                return sum + point.x * next.y - next.x * point.y
            }, 0) / 2
        )
    }

    /**
     * Resolves the center of bounds.
     * @param {object} bounds Bounds record.
     * @returns {{ x: number, y: number }}
     */
    static #boundsCenter(bounds) {
        return {
            x: bounds.minX + bounds.width / 2,
            y: bounds.minY + bounds.height / 2
        }
    }

    /**
     * Returns true when two points have equal coordinates.
     * @param {{ x: number, y: number }} left First point.
     * @param {{ x: number, y: number }} right Second point.
     * @returns {boolean}
     */
    static #samePoint(left, right) {
        return left.x === right.x && left.y === right.y
    }

    /**
     * Resolves a point candidate.
     * @param {object | null | undefined} value Point candidate.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(value) {
        return CircuitJsonUnits.optionalPoint(value)
    }

    /**
     * Resolves a normalized layer key.
     * @param {unknown} value Layer candidate.
     * @returns {string}
     */
    static #layer(value) {
        const raw =
            typeof value === 'object' && value !== null ? value.name : value
        const text = String(raw ?? '').trim()
        const lowered = text.toLowerCase()
        if (['top', 'front', 'f.cu', '1'].includes(lowered)) return 'top'
        if (['bottom', 'back', 'b.cu', '32'].includes(lowered)) return 'bottom'
        return text
    }

    /**
     * Resolves a side from a layer key.
     * @param {string} layer Layer key.
     * @returns {'top' | 'bottom' | ''}
     */
    static #side(layer) {
        const text = String(layer || '').toLowerCase()
        if (/\b(bottom|back)\b|\bb[._-]/u.test(text)) return 'bottom'
        if (/\b(top|front)\b|\bf[._-]/u.test(text)) return 'top'
        return ''
    }

    /**
     * Resolves a net name from common fields.
     * @param {object} element Element row.
     * @param {string | null} fallback Fallback net name.
     * @returns {string}
     */
    static #netName(element, fallback) {
        return String(
            element?.netName ??
                element?.net ??
                element?.net_name ??
                element?.source_net_name ??
                element?.source_net_id ??
                fallback ??
                ''
        ).trim()
    }

    /**
     * Resolves a source net id.
     * @param {object} element Element row.
     * @returns {string}
     */
    static #sourceNetId(element) {
        return String(
            element?.source_net_id || element?.sourceNetId || ''
        ).trim()
    }

    /**
     * Resolves optional mask-coverage metadata.
     * @param {object} element Element row.
     * @returns {boolean | undefined}
     */
    static #coveredWithSolderMask(element) {
        if (Object.hasOwn(element, 'covered_with_solder_mask')) {
            return Boolean(element.covered_with_solder_mask)
        }
        if (Object.hasOwn(element, 'coveredWithSolderMask')) {
            return Boolean(element.coveredWithSolderMask)
        }
        return element?.type === 'pcb_copper_pour' ? true : undefined
    }

    /**
     * Explains one dropped-ring reason.
     * @param {string} reason Reason code.
     * @returns {string}
     */
    static #reasonMessage(reason) {
        if (reason === 'tiny-area') return 'its area is too small'
        return 'it does not contain three usable points'
    }

    /**
     * Rounds computed geometry values to stable precision.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        return Math.round(Number(value || 0) * 1_000_000) / 1_000_000
    }

    /**
     * Resolves unique non-empty string values.
     * @param {unknown[]} values Candidate values.
     * @returns {string[]}
     */
    static #uniqueStrings(values) {
        return [...new Set(values.map((value) => String(value || '').trim()))]
            .filter(Boolean)
            .sort()
    }
}
