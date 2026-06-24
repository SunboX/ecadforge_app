import { CircuitJsonIndexer, CircuitJsonUnits } from 'circuitjson-toolkit'
import { CircuitJsonPcbPrimitiveGeometry } from './CircuitJsonPcbPrimitiveGeometry.mjs'
import { CircuitJsonPcbTraceLengthModel } from './CircuitJsonPcbTraceLengthModel.mjs'

/**
 * Builds derived and documentation PCB primitives from CircuitJSON rows.
 */
export class CircuitJsonPcbPrimitiveArtwork {
    /**
     * Builds supplemental primitive rows.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static build(index, componentsByPcbId) {
        return [
            ...CircuitJsonPcbPrimitiveArtwork.#solderMaskPrimitives(
                index,
                componentsByPcbId
            ),
            ...CircuitJsonPcbPrimitiveArtwork.#solderPastePrimitives(
                index,
                componentsByPcbId
            ),
            ...CircuitJsonPcbPrimitiveArtwork.#notePrimitives(
                index,
                componentsByPcbId
            ),
            ...CircuitJsonPcbPrimitiveArtwork.#silkscreenShapePrimitives(
                index,
                componentsByPcbId
            ),
            ...CircuitJsonPcbPrimitiveArtwork.#thermalSpokePrimitives(index),
            ...CircuitJsonPcbPrimitiveArtwork.#routeHintPrimitives(index),
            ...CircuitJsonPcbPrimitiveArtwork.#breakoutPointPrimitives(index),
            ...CircuitJsonPcbPrimitiveArtwork.#panelPrimitives(index)
        ].filter(Boolean)
    }

    /**
     * Builds board detail primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {object[]}
     */
    static cutoutPrimitives(index) {
        return [
            ['pcb_cutout', 'cutout'],
            ['pcb_board_cutout', 'cutout'],
            ['pcb_keepout', 'keepout'],
            ['pcb_courtyard', 'courtyard']
        ]
            .flatMap(([type, kind]) =>
                CircuitJsonPcbPrimitiveArtwork.#all(index, type).map(
                    (element) =>
                        CircuitJsonPcbPrimitiveArtwork.#boardDetailPrimitive(
                            element,
                            kind
                        )
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds total routed trace length labels.
     * @param {object[]} primitives Primitive rows.
     * @param {{ elementsByType: Map<string, object[]> }} [index] Element index.
     * @returns {object[]}
     */
    static traceLengths(primitives, index = null) {
        return CircuitJsonPcbTraceLengthModel.build(primitives, index)
    }

    /**
     * Builds generated copper clearance diagnostics.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {object[]} primitives Primitive rows.
     * @returns {object[]}
     */
    static clearanceDiagnostics(index, primitives) {
        const board = CircuitJsonPcbPrimitiveArtwork.#all(index, 'pcb_board')[0]
        const minimum = CircuitJsonUnits.optionalLength(
            board?.min_trace_clearance
        )
        if (minimum === null || minimum <= 0) return []

        const copper = primitives.filter((primitive) =>
            ['pad', 'track', 'via', 'zone'].includes(primitive.kind)
        )
        const diagnostics = []
        for (let leftIndex = 0; leftIndex < copper.length; leftIndex += 1) {
            for (
                let rightIndex = leftIndex + 1;
                rightIndex < copper.length;
                rightIndex += 1
            ) {
                const left = copper[leftIndex]
                const right = copper[rightIndex]
                const actual = CircuitJsonPcbPrimitiveArtwork.#clearance(
                    left,
                    right
                )
                if (actual === null || actual >= minimum) continue
                diagnostics.push(
                    CircuitJsonPcbPrimitiveArtwork.#clearanceDiagnostic(
                        left,
                        right,
                        actual,
                        minimum,
                        diagnostics.length
                    )
                )
            }
        }

        return diagnostics
    }

    /**
     * Builds solder-mask opening primitives from pads with mask metadata.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #solderMaskPrimitives(index, componentsByPcbId) {
        return CircuitJsonPcbPrimitiveArtwork.#all(index, 'pcb_smtpad')
            .map((element) => {
                const margins =
                    CircuitJsonPcbPrimitiveArtwork.#solderMaskMargins(element)
                if (!margins) return null
                return CircuitJsonPcbPrimitiveArtwork.#expandedPadPrimitive(
                    element,
                    'solder-mask',
                    'soldermask',
                    margins,
                    componentsByPcbId
                )
            })
            .filter(Boolean)
    }

    /**
     * Builds explicit solder-paste primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #solderPastePrimitives(index, componentsByPcbId) {
        return CircuitJsonPcbPrimitiveArtwork.#all(index, 'pcb_solder_paste')
            .map((element) =>
                CircuitJsonPcbPrimitiveArtwork.#shapePrimitive(
                    element,
                    'solder-paste',
                    'paste',
                    componentsByPcbId
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds note and dimension documentation primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #notePrimitives(index, componentsByPcbId) {
        return [
            ...['pcb_note_text', 'pcb_note_line', 'pcb_note_rect'].flatMap(
                (type) =>
                    CircuitJsonPcbPrimitiveArtwork.#all(index, type).map(
                        (element) =>
                            CircuitJsonPcbPrimitiveArtwork.#documentationPrimitive(
                                element,
                                'note',
                                componentsByPcbId
                            )
                    )
            ),
            ...['pcb_note_dimension', 'pcb_fabrication_note_dimension'].flatMap(
                (type) =>
                    CircuitJsonPcbPrimitiveArtwork.#all(index, type).map(
                        (element) =>
                            CircuitJsonPcbPrimitiveArtwork.#dimensionPrimitive(
                                element
                            )
                    )
            ),
            ...CircuitJsonPcbPrimitiveArtwork.#all(
                index,
                'pcb_fabrication_note_rect'
            ).map((element) =>
                CircuitJsonPcbPrimitiveArtwork.#shapePrimitive(
                    element,
                    'fabrication',
                    'fabrication',
                    componentsByPcbId
                )
            )
        ].filter(Boolean)
    }

    /**
     * Builds silkscreen shape primitives not covered by text/line handling.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #silkscreenShapePrimitives(index, componentsByPcbId) {
        return [
            'pcb_silkscreen_circle',
            'pcb_silkscreen_oval',
            'pcb_silkscreen_pill',
            'pcb_silkscreen_rect'
        ]
            .flatMap((type) => CircuitJsonPcbPrimitiveArtwork.#all(index, type))
            .map((element) =>
                CircuitJsonPcbPrimitiveArtwork.#shapePrimitive(
                    element,
                    'silkscreen',
                    'silkscreen',
                    componentsByPcbId
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds thermal spoke primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {object[]}
     */
    static #thermalSpokePrimitives(index) {
        return CircuitJsonPcbPrimitiveArtwork.#all(index, 'pcb_thermal_spoke')
            .map((element) =>
                CircuitJsonPcbPrimitiveArtwork.#linePrimitive(
                    element,
                    'thermal-spoke'
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds route hint segment primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {object[]}
     */
    static #routeHintPrimitives(index) {
        return CircuitJsonPcbPrimitiveArtwork.#all(index, 'pcb_trace_hint')
            .flatMap((element) => {
                const points = (
                    Array.isArray(element.route) ? element.route : []
                )
                    .map((point) =>
                        CircuitJsonPcbPrimitiveArtwork.#point(point)
                    )
                    .filter(Boolean)
                const rows = []
                for (let index = 1; index < points.length; index += 1) {
                    rows.push(
                        CircuitJsonPcbPrimitiveArtwork.#linePrimitive(
                            {
                                ...element,
                                x1: points[index - 1].x,
                                y1: points[index - 1].y,
                                x2: points[index].x,
                                y2: points[index].y
                            },
                            'route-hint',
                            index - 1
                        )
                    )
                }
                return rows
            })
            .filter(Boolean)
    }

    /**
     * Builds breakout point markers.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {object[]}
     */
    static #breakoutPointPrimitives(index) {
        return CircuitJsonPcbPrimitiveArtwork.#all(index, 'pcb_breakout_point')
            .map((element) =>
                CircuitJsonPcbPrimitiveArtwork.#shapePrimitive(
                    {
                        ...element,
                        radius: element.radius ?? 0.16,
                        shape: 'circle'
                    },
                    'breakout-point',
                    'breakout',
                    new Map()
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds panel outline primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {object[]}
     */
    static #panelPrimitives(index) {
        return CircuitJsonPcbPrimitiveArtwork.#all(index, 'pcb_panel')
            .map((element) =>
                CircuitJsonPcbPrimitiveArtwork.#shapePrimitive(
                    element,
                    'panel',
                    'panel',
                    new Map()
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds one documentation primitive from common shape fields.
     * @param {object} element Element row.
     * @param {string} kind Primitive kind.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object | null}
     */
    static #documentationPrimitive(element, kind, componentsByPcbId) {
        if (element.text !== undefined) {
            return CircuitJsonPcbPrimitiveArtwork.#textPrimitive(
                element,
                kind,
                componentsByPcbId
            )
        }
        if (Number.isFinite(Number(element.x1 ?? element.start?.x))) {
            return CircuitJsonPcbPrimitiveArtwork.#linePrimitive(element, kind)
        }
        return CircuitJsonPcbPrimitiveArtwork.#shapePrimitive(
            element,
            kind,
            kind,
            componentsByPcbId
        )
    }

    /**
     * Builds one expanded rectangular pad-derived primitive.
     * @param {object} element Source pad.
     * @param {string} kind Primitive kind.
     * @param {string} layerSuffix Layer suffix.
     * @param {{ left: number, right: number, top: number, bottom: number }} margins Opening margins.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object | null}
     */
    static #expandedPadPrimitive(
        element,
        kind,
        layerSuffix,
        margins,
        componentsByPcbId
    ) {
        const center = CircuitJsonPcbPrimitiveArtwork.#center(element)
        const width = CircuitJsonUnits.optionalLength(element.width)
        const height = CircuitJsonUnits.optionalLength(element.height)
        if (!center || width === null || height === null) return null
        const nextWidth = Math.max(width + margins.left + margins.right, 0.01)
        const nextHeight = Math.max(
            height + margins.top + margins.bottom,
            0.01
        )
        const nextCenter = {
            x: center.x + (margins.right - margins.left) / 2,
            y: center.y + (margins.top - margins.bottom) / 2
        }

        return CircuitJsonPcbPrimitiveArtwork.#shapePrimitive(
            {
                ...element,
                x: nextCenter.x,
                y: nextCenter.y,
                center: nextCenter,
                width: nextWidth,
                height: nextHeight,
                radius:
                    CircuitJsonUnits.optionalLength(element.radius) ??
                    Math.min(nextWidth, nextHeight) / 2,
                rotation: CircuitJsonUnits.angle(
                    element.ccw_rotation ?? element.rotation,
                    0
                ),
                derived_id_suffix: kind,
                layer: CircuitJsonPcbPrimitiveArtwork.#surfaceLayer(
                    element.layer,
                    layerSuffix
                )
            },
            kind,
            layerSuffix,
            componentsByPcbId
        )
    }

    /**
     * Builds one generic center/size primitive.
     * @param {object} element Element row.
     * @param {string} kind Primitive kind.
     * @param {string} layerSuffix Layer suffix.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object | null}
     */
    static #shapePrimitive(element, kind, layerSuffix, componentsByPcbId) {
        const points = CircuitJsonPcbPrimitiveArtwork.#points(element)
        const center =
            CircuitJsonPcbPrimitiveArtwork.#center(element) ||
            CircuitJsonPcbPrimitiveArtwork.#pointsCenter(points)
        if (!center && points.length < 3) return null

        const radius = CircuitJsonUnits.optionalLength(element.radius)
        const width =
            CircuitJsonUnits.optionalLength(element.width) ??
            (radius === null ? null : radius * 2)
        const height =
            CircuitJsonUnits.optionalLength(element.height) ??
            (radius === null ? null : radius * 2)
        const bounds = points.length
            ? CircuitJsonPcbPrimitiveGeometry.pointsBounds(points)
            : CircuitJsonPcbPrimitiveGeometry.centerBounds(
                  center,
                  width ?? 0.5,
                  height ?? 0.5
              )

        return CircuitJsonPcbPrimitiveArtwork.#primitive({
            id: CircuitJsonPcbPrimitiveArtwork.#derivedId(element),
            kind,
            shape: String(
                element.shape || (points.length ? 'polygon' : 'rect')
            ),
            x: center?.x ?? bounds.minX + bounds.width / 2,
            y: center?.y ?? bounds.minY + bounds.height / 2,
            width: width ?? bounds.width,
            height: height ?? bounds.height,
            radius: radius ?? 0,
            rotation: CircuitJsonUnits.angle(
                element.ccw_rotation ?? element.rotation,
                0
            ),
            points,
            bounds,
            layer: CircuitJsonPcbPrimitiveArtwork.#detailLayer(
                element,
                layerSuffix
            ),
            component: componentsByPcbId.get(
                String(element.pcb_component_id || '').trim()
            ),
            netName: CircuitJsonPcbPrimitiveArtwork.#netName(element),
            anchors: points.length
                ? points.map((point) => ({ point }))
                : CircuitJsonPcbPrimitiveGeometry.cornerAnchors(bounds),
            source: element
        })
    }

    /**
     * Builds one text primitive.
     * @param {object} element Element row.
     * @param {string} kind Primitive kind.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object | null}
     */
    static #textPrimitive(element, kind, componentsByPcbId) {
        const center = CircuitJsonPcbPrimitiveArtwork.#center(element)
        if (!center) return null
        const fontSize = CircuitJsonUnits.length(
            element.font_size ?? element.height,
            1
        )
        const bounds = CircuitJsonPcbPrimitiveGeometry.centerBounds(
            center,
            Math.max(
                String(element.text || '').length * fontSize * 0.6,
                fontSize
            ),
            fontSize
        )
        return CircuitJsonPcbPrimitiveArtwork.#primitive({
            id: CircuitJsonIndexer.getElementId(element),
            kind,
            text: String(element.text || ''),
            x: center.x,
            y: center.y,
            fontSize,
            bounds,
            layer: CircuitJsonPcbPrimitiveArtwork.#detailLayer(element, kind),
            component: componentsByPcbId.get(
                String(element.pcb_component_id || '').trim()
            ),
            anchors: [{ point: center }],
            source: element
        })
    }

    /**
     * Builds one line primitive.
     * @param {object} element Element row.
     * @param {string} kind Primitive kind.
     * @param {number} [index] Segment index.
     * @returns {object | null}
     */
    static #linePrimitive(element, kind, index = 0) {
        const start = CircuitJsonPcbPrimitiveArtwork.#point({
            x: element.x1 ?? element.start?.x,
            y: element.y1 ?? element.start?.y
        })
        const end = CircuitJsonPcbPrimitiveArtwork.#point({
            x: element.x2 ?? element.end?.x,
            y: element.y2 ?? element.end?.y
        })
        if (!start || !end) return null
        const width = CircuitJsonUnits.length(element.width, 0.08)
        return CircuitJsonPcbPrimitiveArtwork.#primitive({
            id: CircuitJsonIndexer.getElementId(element) + ':' + index,
            kind,
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            width,
            bounds: CircuitJsonPcbPrimitiveGeometry.segmentBounds(
                start,
                end,
                width
            ),
            layer: CircuitJsonPcbPrimitiveArtwork.#detailLayer(element, kind),
            netName: CircuitJsonPcbPrimitiveArtwork.#netName(element),
            anchors: [{ point: start }, { point: end }],
            source: element
        })
    }

    /**
     * Builds one dimension primitive.
     * @param {object} element Element row.
     * @returns {object | null}
     */
    static #dimensionPrimitive(element) {
        const line = CircuitJsonPcbPrimitiveArtwork.#linePrimitive(
            element,
            'dimension'
        )
        return line
            ? {
                  ...line,
                  text: String(element.text || '')
              }
            : null
    }

    /**
     * Builds one board detail shape primitive.
     * @param {object} element Element row.
     * @param {string} kind Primitive kind.
     * @returns {object | null}
     */
    static #boardDetailPrimitive(element, kind) {
        const points = CircuitJsonPcbPrimitiveArtwork.#points(element)
        const center =
            CircuitJsonPcbPrimitiveArtwork.#center(element) ||
            CircuitJsonPcbPrimitiveArtwork.#pointsCenter(points)
        if (!center && points.length < 3) return null

        const width = CircuitJsonUnits.optionalLength(element.width)
        const height = CircuitJsonUnits.optionalLength(element.height)
        const radius = CircuitJsonUnits.optionalLength(element.radius)
        const bounds = points.length
            ? CircuitJsonPcbPrimitiveGeometry.pointsBounds(points)
            : CircuitJsonPcbPrimitiveGeometry.centerBounds(
                  center,
                  width ?? (radius ?? 0.5) * 2,
                  height ?? (radius ?? 0.5) * 2
              )

        return {
            id: CircuitJsonIndexer.getElementId(element),
            kind,
            shape: String(
                element.shape || (points.length ? 'polygon' : 'rect')
            ),
            x: center?.x ?? bounds.minX + bounds.width / 2,
            y: center?.y ?? bounds.minY + bounds.height / 2,
            width: width ?? bounds.width,
            height: height ?? bounds.height,
            radius: radius ?? 0,
            points,
            bounds,
            layer: CircuitJsonPcbPrimitiveArtwork.#boardDetailLayer(
                element,
                kind
            ),
            side: '',
            componentKey: '',
            componentId: '',
            footprintId: '',
            netName: '',
            anchors: points.length
                ? points.map((point) => ({ point }))
                : CircuitJsonPcbPrimitiveGeometry.cornerAnchors(bounds),
            source: element
        }
    }

    /**
     * Adds common primitive metadata.
     * @param {object} primitive Primitive row.
     * @returns {object}
     */
    static #primitive(primitive) {
        const component = primitive.component || {}
        const layer = CircuitJsonPcbPrimitiveArtwork.#layer(primitive.layer)
        return {
            ...primitive,
            layer,
            side: primitive.side ?? CircuitJsonPcbPrimitiveArtwork.#side(layer),
            componentKey: String(component.componentKey || ''),
            componentId: String(component.pcbComponentId || ''),
            footprintId: component.componentKey
                ? 'footprint:' + component.componentKey + ':' + primitive.kind
                : '',
            netName: String(primitive.netName || '').trim()
        }
    }

    /**
     * Resolves indexed element rows.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {string} type Element type.
     * @returns {object[]}
     */
    static #all(index, type) {
        return index.elementsByType.get(type) || []
    }

    /**
     * Resolves first valid length from candidates.
     * @param {unknown[]} values Candidate values.
     * @returns {number | null}
     */
    static #optionalLength(values) {
        for (const value of values) {
            const length = CircuitJsonUnits.optionalLength(value)
            if (length !== null) return length
        }
        return null
    }

    /**
     * Resolves an id for original or derived shape primitives.
     * @param {object} element Element row.
     * @returns {string}
     */
    static #derivedId(element) {
        const id = CircuitJsonIndexer.getElementId(element)
        const suffix = String(element.derived_id_suffix || '').trim()
        return id && suffix ? id + ':' + suffix : id
    }

    /**
     * Resolves solder-mask margins for one pad.
     * @param {object} element Pad row.
     * @returns {{ left: number, right: number, top: number, bottom: number } | null}
     */
    static #solderMaskMargins(element) {
        const left = CircuitJsonUnits.optionalLength(
            element.soldermask_margin_left ?? element.solderMaskMarginLeft
        )
        const right = CircuitJsonUnits.optionalLength(
            element.soldermask_margin_right ?? element.solderMaskMarginRight
        )
        const top = CircuitJsonUnits.optionalLength(
            element.soldermask_margin_top ?? element.solderMaskMarginTop
        )
        const bottom = CircuitJsonUnits.optionalLength(
            element.soldermask_margin_bottom ?? element.solderMaskMarginBottom
        )
        if ([left, right, top, bottom].some((value) => value !== null)) {
            return {
                left: left ?? 0,
                right: right ?? 0,
                top: top ?? 0,
                bottom: bottom ?? 0
            }
        }

        const expansion = CircuitJsonPcbPrimitiveArtwork.#optionalLength([
            element.solderMaskExpansion,
            element.solder_mask_expansion,
            element.solderMaskMargin,
            element.solder_mask_margin
        ])
        return expansion === null
            ? null
            : {
                  left: expansion,
                  right: expansion,
                  top: expansion,
                  bottom: expansion
              }
    }

    /**
     * Resolves a center point.
     * @param {object} element Element row.
     * @returns {{ x: number, y: number } | null}
     */
    static #center(element) {
        return CircuitJsonPcbPrimitiveArtwork.#point(element?.center || element)
    }

    /**
     * Resolves one point.
     * @param {object | null | undefined} value Point candidate.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(value) {
        return CircuitJsonUnits.optionalPoint(value)
    }

    /**
     * Resolves polygon points from common fields.
     * @param {object} element Element row.
     * @returns {{ x: number, y: number }[]}
     */
    static #points(element) {
        return (
            (Array.isArray(element?.points) && element.points) ||
            (Array.isArray(element?.outline) && element.outline) ||
            (Array.isArray(element?.vertices) && element.vertices) ||
            (Array.isArray(element?.shape?.points) && element.shape.points) ||
            []
        )
            .map((point) => CircuitJsonPcbPrimitiveArtwork.#point(point))
            .filter(Boolean)
    }

    /**
     * Resolves a point-list center.
     * @param {{ x: number, y: number }[]} points Points.
     * @returns {{ x: number, y: number } | null}
     */
    static #pointsCenter(points) {
        const bounds = CircuitJsonPcbPrimitiveGeometry.pointsBounds(points)
        return bounds
            ? {
                  x: bounds.minX + bounds.width / 2,
                  y: bounds.minY + bounds.height / 2
              }
            : null
    }

    /**
     * Resolves a drawing layer for a primitive.
     * @param {object} element Element row.
     * @param {string} suffix Layer suffix.
     * @returns {string}
     */
    static #detailLayer(element, suffix) {
        if (['paste', 'soldermask'].includes(suffix)) {
            return CircuitJsonPcbPrimitiveArtwork.#surfaceLayer(
                element.layer,
                suffix
            )
        }
        if (suffix === 'panel') return 'panel'
        if (suffix === 'breakout') return 'breakout_points'
        return CircuitJsonPcbPrimitiveArtwork.#layer(
            element.layer || 'top_fabrication'
        )
    }

    /**
     * Builds a top/bottom-specific fabrication layer key.
     * @param {unknown} layer Layer candidate.
     * @param {string} suffix Layer suffix.
     * @returns {string}
     */
    static #surfaceLayer(layer, suffix) {
        return (
            (CircuitJsonPcbPrimitiveArtwork.#side(
                CircuitJsonPcbPrimitiveArtwork.#layer(layer)
            ) || 'top') +
            '_' +
            suffix
        )
    }

    /**
     * Resolves a board detail layer key.
     * @param {object} element Element row.
     * @param {string} kind Primitive kind.
     * @returns {string}
     */
    static #boardDetailLayer(element, kind) {
        if (kind === 'cutout') return 'cutouts'
        if (kind === 'keepout') return 'keepouts'
        if (kind === 'courtyard') {
            return CircuitJsonPcbPrimitiveArtwork.#layer(
                element.layer || 'top_courtyard'
            )
        }
        return CircuitJsonPcbPrimitiveArtwork.#layer(element.layer || 'board')
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
     * Resolves the side from a layer key.
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
     * Resolves a net name.
     * @param {object} element Element row.
     * @returns {string}
     */
    static #netName(element) {
        return String(
            element.netName ?? element.net ?? element.net_name ?? ''
        ).trim()
    }

    /**
     * Computes bounds-based clearance between two copper primitives.
     * @param {object} left Left primitive.
     * @param {object} right Right primitive.
     * @returns {number | null}
     */
    static #clearance(left, right) {
        if (!left.bounds || !right.bounds) return null
        if (!left.netName || !right.netName || left.netName === right.netName) {
            return null
        }
        if (left.layer && right.layer && left.layer !== right.layer) return null

        const dx = Math.max(
            right.bounds.minX - left.bounds.maxX,
            left.bounds.minX - right.bounds.maxX,
            0
        )
        const dy = Math.max(
            right.bounds.minY - left.bounds.maxY,
            left.bounds.minY - right.bounds.maxY,
            0
        )
        return Math.hypot(dx, dy)
    }

    /**
     * Builds one generated copper clearance diagnostic.
     * @param {object} left Left primitive.
     * @param {object} right Right primitive.
     * @param {number} actual Actual clearance.
     * @param {number} minimum Minimum clearance.
     * @param {number} index Diagnostic index.
     * @returns {object}
     */
    static #clearanceDiagnostic(left, right, actual, minimum, index) {
        return {
            id: 'clearance:' + index,
            kind: 'error',
            severity: 'error',
            category: 'clearance',
            code: 'pcb_copper_clearance',
            message: 'Copper clearance is below the configured rule.',
            point: {
                x: CircuitJsonPcbPrimitiveArtwork.#rounded(
                    (left.bounds.minX +
                        left.bounds.maxX +
                        right.bounds.minX +
                        right.bounds.maxX) /
                        4
                ),
                y: CircuitJsonPcbPrimitiveArtwork.#rounded(
                    (left.bounds.minY +
                        left.bounds.maxY +
                        right.bounds.minY +
                        right.bounds.maxY) /
                        4
                )
            },
            componentKey: String(left.componentKey || right.componentKey || ''),
            netName:
                String(left.netName || '') +
                ' / ' +
                String(right.netName || ''),
            clearance: {
                minimum: CircuitJsonPcbPrimitiveArtwork.#rounded(minimum),
                actual: CircuitJsonPcbPrimitiveArtwork.#rounded(actual)
            }
        }
    }

    /**
     * Rounds a numeric value for deterministic model rows.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #rounded(value) {
        return Number(Number(value).toFixed(6))
    }
}
