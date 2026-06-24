import { CircuitJsonIndexer, CircuitJsonUnits } from 'circuitjson-toolkit'
import { CircuitJsonPcbPrimitiveGeometry } from './CircuitJsonPcbPrimitiveGeometry.mjs'
import { CircuitJsonPcbPrimitiveOverlays } from './CircuitJsonPcbPrimitiveOverlays.mjs'
import { CircuitJsonPcbPrimitiveArtwork } from './CircuitJsonPcbPrimitiveArtwork.mjs'
import { CircuitJsonPcbPrimitiveGroups } from './CircuitJsonPcbPrimitiveGroups.mjs'
import { CircuitJsonPcbZonePrimitiveBuilder } from './CircuitJsonPcbZonePrimitiveBuilder.mjs'

/**
 * Builds renderer-neutral PCB primitives from standards-native element arrays.
 */
export class CircuitJsonPcbPrimitiveBuilder {
    /**
     * Builds a normalized PCB primitive model.
     * @param {object | object[]} documentModel Parsed document model.
     * @returns {{ bounds: object, layers: object[], virtualLayers: object[], components: object[], nets: object[], primitives: object[], anchors: object[], diagnostics: object[], airwires: object[], traceLengths: object[], groups: object[], anchorOffsets: object[] }}
     */
    static build(documentModel) {
        const elements = CircuitJsonPcbPrimitiveBuilder.#elements(documentModel)
        const index = CircuitJsonIndexer.index(elements)
        const boards = CircuitJsonPcbPrimitiveBuilder.#all(index, 'pcb_board')
        const board = boards[0] || null
        const components =
            CircuitJsonPcbPrimitiveBuilder.#componentLookups(index)
        const areaModel = CircuitJsonPcbZonePrimitiveBuilder.build(
            index,
            components.byPcbId
        )
        const primitiveRows = [
            ...CircuitJsonPcbPrimitiveBuilder.#boardPrimitives(boards),
            ...CircuitJsonPcbPrimitiveBuilder.#padPrimitives(
                index,
                components.byPcbId
            ),
            ...CircuitJsonPcbPrimitiveBuilder.#tracePrimitives(
                index,
                components.byPcbId
            ),
            ...CircuitJsonPcbPrimitiveBuilder.#viaPrimitives(
                index,
                components.byPcbId
            ),
            ...areaModel.primitives,
            ...CircuitJsonPcbPrimitiveBuilder.#silkscreenPrimitives(
                index,
                components.byPcbId
            ),
            ...CircuitJsonPcbPrimitiveArtwork.cutoutPrimitives(index),
            ...CircuitJsonPcbPrimitiveArtwork.build(index, components.byPcbId)
        ].filter(Boolean)
        const groupModel = CircuitJsonPcbPrimitiveGroups.build(
            index,
            primitiveRows,
            components.rows
        )
        const primitives = groupModel.primitives
        const bounds =
            CircuitJsonPcbPrimitiveBuilder.#mergedBoardBounds(boards) ||
            CircuitJsonPcbPrimitiveGeometry.mergedPrimitiveBounds(primitives) ||
            CircuitJsonPcbPrimitiveGeometry.bounds(0, 0, 1, 1)
        const overlays = CircuitJsonPcbPrimitiveOverlays.build(
            index,
            components.byPcbId,
            primitives,
            bounds,
            groupModel,
            areaModel.diagnostics
        )

        return {
            bounds,
            layers: CircuitJsonPcbPrimitiveBuilder.#layers(board),
            virtualLayers: overlays.virtualLayers,
            components: components.rows,
            nets: CircuitJsonPcbPrimitiveBuilder.#nets(primitives, index),
            primitives,
            anchors: primitives.flatMap((primitive) =>
                primitive.anchors.map((anchor) => ({ ...anchor, primitive }))
            ),
            diagnostics: overlays.diagnostics,
            airwires: overlays.airwires,
            traceLengths: CircuitJsonPcbPrimitiveArtwork.traceLengths(
                primitives,
                index
            ),
            groups: groupModel.groups,
            anchorOffsets: groupModel.anchorOffsets
        }
    }

    /**
     * Returns element rows from an array or wrapper object.
     * @param {object | object[]} documentModel Parsed document model.
     * @returns {object[]}
     */
    static #elements(documentModel) {
        if (Array.isArray(documentModel)) return documentModel
        if (Array.isArray(documentModel?.elements))
            return documentModel.elements
        if (Array.isArray(documentModel?.circuitJson))
            return documentModel.circuitJson
        return []
    }

    /**
     * Returns indexed element rows by type.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {string} type Element type.
     * @returns {object[]}
     */
    static #all(index, type) {
        return index.elementsByType.get(type) || []
    }

    /**
     * Builds component rows and PCB component lookup maps.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {{ rows: object[], byPcbId: Map<string, object> }}
     */
    static #componentLookups(index) {
        const sourceRows = CircuitJsonPcbPrimitiveBuilder.#all(
            index,
            'source_component'
        )
        const sourceNames = new Map(
            sourceRows.map((element) => [
                String(element.source_component_id || '').trim(),
                String(
                    element.name ||
                        element.reference ||
                        element.designator ||
                        element.source_component_id ||
                        ''
                ).trim()
            ])
        )
        const sourceMetadata = new Map(
            sourceRows.map((element) => [
                String(element.source_component_id || '').trim(),
                {
                    groupId: String(element.source_group_id || '').trim(),
                    subcircuitIds:
                        CircuitJsonPcbPrimitiveBuilder.#uniqueStrings([
                            element.subcircuit_id,
                            element.subcircuitId
                        ])
                }
            ])
        )
        const rows = []
        const byPcbId = new Map()

        for (const element of CircuitJsonPcbPrimitiveBuilder.#all(
            index,
            'pcb_component'
        )) {
            const sourceId = String(element.source_component_id || '').trim()
            const pcbId = String(element.pcb_component_id || '').trim()
            const center = CircuitJsonPcbPrimitiveBuilder.#center(element) || {
                x: 0,
                y: 0
            }
            const componentKey = String(
                sourceNames.get(sourceId) ||
                    element.name ||
                    element.reference ||
                    element.designator ||
                    pcbId ||
                    'Component ' + (rows.length + 1)
            ).trim()
            const source = sourceMetadata.get(sourceId) || {}
            const component = {
                ...element,
                componentKey,
                designator: componentKey,
                key: componentKey,
                pcbComponentId: pcbId,
                sourceComponentId: sourceId,
                sourceGroupId: String(
                    element.source_group_id || source.groupId || ''
                ).trim(),
                x: center.x,
                y: center.y,
                layer: CircuitJsonPcbPrimitiveBuilder.#layer(element.layer),
                rotation: CircuitJsonUnits.angle(element.rotation, 0),
                groupIds: CircuitJsonPcbPrimitiveBuilder.#uniqueStrings([
                    element.pcb_group_id,
                    element.positioned_relative_to_pcb_group_id,
                    element.source_group_id,
                    source.groupId
                ]),
                subcircuitIds: CircuitJsonPcbPrimitiveBuilder.#uniqueStrings([
                    element.subcircuit_id,
                    element.subcircuitId,
                    ...(source.subcircuitIds || [])
                ])
            }
            rows.push(component)
            if (pcbId) byPcbId.set(pcbId, component)
        }

        return { rows, byPcbId }
    }

    /**
     * Builds board primitives.
     * @param {object[]} boards Board elements.
     * @returns {object[]}
     */
    static #boardPrimitives(boards) {
        return boards
            .map((board) =>
                CircuitJsonPcbPrimitiveBuilder.#boardPrimitive(board)
            )
            .filter(Boolean)
    }

    /**
     * Builds a board primitive.
     * @param {object | null} board Board element.
     * @returns {object | null}
     */
    static #boardPrimitive(board) {
        const bounds = CircuitJsonPcbPrimitiveBuilder.#boardBounds(board)
        if (!bounds) return null

        return {
            id: String(board?.pcb_board_id || 'board'),
            kind: 'board',
            layer: 'board',
            side: '',
            points: CircuitJsonPcbPrimitiveBuilder.#points(board),
            bounds,
            anchors: CircuitJsonPcbPrimitiveGeometry.cornerAnchors(bounds),
            source: board || {}
        }
    }

    /**
     * Builds SMT pad primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #padPrimitives(index, componentsByPcbId) {
        return CircuitJsonPcbPrimitiveBuilder.#all(index, 'pcb_smtpad')
            .map((element) =>
                CircuitJsonPcbPrimitiveBuilder.#padPrimitive(
                    element,
                    componentsByPcbId
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds one SMT pad primitive.
     * @param {object} element Pad element.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object | null}
     */
    static #padPrimitive(element, componentsByPcbId) {
        const shape = String(element.shape || 'rect')
        const points =
            shape === 'polygon'
                ? CircuitJsonPcbPrimitiveBuilder.#points(element)
                : []
        const center =
            CircuitJsonPcbPrimitiveBuilder.#center(element) ||
            CircuitJsonPcbPrimitiveBuilder.#pointsCenter(points)
        if (!center) return null

        const radius = CircuitJsonUnits.optionalLength(element.radius)
        const diameter =
            CircuitJsonUnits.optionalLength(element.diameter) ??
            (radius === null ? null : radius * 2)
        const width = CircuitJsonUnits.optionalLength(element.width) ?? diameter
        const height =
            CircuitJsonUnits.optionalLength(element.height) ?? diameter ?? width
        if (!points.length && (width === null || height === null)) return null

        const component = componentsByPcbId.get(
            String(element.pcb_component_id || '').trim()
        )
        const layer = CircuitJsonPcbPrimitiveBuilder.#layer(element.layer)
        const bounds = points.length
            ? CircuitJsonPcbPrimitiveGeometry.pointsBounds(points)
            : CircuitJsonPcbPrimitiveGeometry.centerBounds(
                  center,
                  width,
                  height
              )

        return CircuitJsonPcbPrimitiveBuilder.#primitive({
            id: String(element.pcb_smtpad_id || ''),
            kind: 'pad',
            shape,
            x: center.x,
            y: center.y,
            width: width ?? bounds.width,
            height: height ?? bounds.height,
            radius: radius ?? Math.min(width ?? 0, height ?? 0) / 2,
            rotation: CircuitJsonUnits.angle(
                element.ccw_rotation ?? element.rotation,
                0
            ),
            points,
            bounds,
            layer,
            component,
            netName: CircuitJsonPcbPrimitiveBuilder.#netName(element, null),
            anchors: [
                { point: center },
                ...(points.length
                    ? points.map((point) => ({ point }))
                    : CircuitJsonPcbPrimitiveGeometry.cornerAnchors(bounds))
            ],
            source: element
        })
    }

    /**
     * Builds trace segment and route-via primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #tracePrimitives(index, componentsByPcbId) {
        return CircuitJsonPcbPrimitiveBuilder.#all(index, 'pcb_trace').flatMap(
            (trace) =>
                CircuitJsonPcbPrimitiveBuilder.#tracePrimitiveRows(
                    trace,
                    componentsByPcbId
                )
        )
    }

    /**
     * Builds rows for one routed trace.
     * @param {object} trace Trace element.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #tracePrimitiveRows(trace, componentsByPcbId) {
        const route = Array.isArray(trace.route) ? trace.route : []
        const component = componentsByPcbId.get(
            String(trace.pcb_component_id || '').trim()
        )
        const rows = []
        let previous = null

        for (const entry of route) {
            if (entry?.route_type === 'through_pad') {
                rows.push(
                    CircuitJsonPcbPrimitiveBuilder.#throughPadSegment(
                        trace,
                        entry,
                        component,
                        rows.length
                    )
                )
                previous = null
                continue
            }

            const current = CircuitJsonPcbPrimitiveBuilder.#center(entry)
            if (!current) continue
            if (entry?.route_type === 'via') {
                rows.push(
                    CircuitJsonPcbPrimitiveBuilder.#routeViaPrimitive(
                        trace,
                        entry,
                        current,
                        rows.length
                    )
                )
            }
            if (previous) {
                rows.push(
                    CircuitJsonPcbPrimitiveBuilder.#segmentPrimitive(
                        trace,
                        previous,
                        current,
                        entry,
                        component,
                        rows.length
                    )
                )
            }
            previous = { ...entry, x: current.x, y: current.y }
        }

        return rows.filter(Boolean)
    }

    /**
     * Builds one routed wire segment.
     * @param {object} trace Trace element.
     * @param {object} previous Previous route point.
     * @param {{ x: number, y: number }} current Current point.
     * @param {object} entry Current route entry.
     * @param {object | undefined} component Component row.
     * @param {number} index Segment index.
     * @returns {object}
     */
    static #segmentPrimitive(
        trace,
        previous,
        current,
        entry,
        component,
        index
    ) {
        const width = CircuitJsonUnits.length(
            entry.width ?? previous.width ?? trace.width,
            0.15
        )
        const layer = CircuitJsonPcbPrimitiveBuilder.#layer(
            entry.layer || previous.layer || trace.layer
        )

        return CircuitJsonPcbPrimitiveBuilder.#primitive({
            id: String(trace.pcb_trace_id || '') + ':segment:' + index,
            kind: 'track',
            x1: previous.x,
            y1: previous.y,
            x2: current.x,
            y2: current.y,
            width,
            bounds: CircuitJsonPcbPrimitiveGeometry.segmentBounds(
                previous,
                current,
                width
            ),
            layer,
            component,
            netName: CircuitJsonPcbPrimitiveBuilder.#netName(trace, null),
            anchors: [{ point: previous }, { point: current }],
            source: trace,
            sourceTraceId: String(trace.source_trace_id || '')
        })
    }

    /**
     * Builds one through-pad trace segment.
     * @param {object} trace Trace element.
     * @param {object} entry Route entry.
     * @param {object | undefined} component Component row.
     * @param {number} index Segment index.
     * @returns {object | null}
     */
    static #throughPadSegment(trace, entry, component, index) {
        const start = CircuitJsonPcbPrimitiveBuilder.#point(entry.start)
        const end = CircuitJsonPcbPrimitiveBuilder.#point(entry.end)
        if (!start || !end) return null
        return CircuitJsonPcbPrimitiveBuilder.#segmentPrimitive(
            trace,
            start,
            end,
            {
                width: entry.width,
                layer: entry.start_layer || entry.end_layer
            },
            component,
            index
        )
    }

    /**
     * Builds one route via primitive.
     * @param {object} trace Trace element.
     * @param {object} entry Route via entry.
     * @param {{ x: number, y: number }} center Via center.
     * @param {number} index Via index.
     * @returns {object}
     */
    static #routeViaPrimitive(trace, entry, center, index) {
        const diameter = CircuitJsonUnits.length(entry.outer_diameter, 0.6)
        return {
            ...CircuitJsonPcbPrimitiveBuilder.#viaRow(
                {
                    ...entry,
                    pcb_via_id:
                        String(trace.pcb_trace_id || '') + ':via:' + index
                },
                center,
                diameter,
                CircuitJsonPcbPrimitiveBuilder.#netName(trace, null)
            ),
            source: trace,
            sourceRoute: entry
        }
    }

    /**
     * Builds standalone via, plated-hole, and hole primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #viaPrimitives(index, componentsByPcbId) {
        return ['pcb_via', 'pcb_plated_hole', 'pcb_hole']
            .flatMap((type) => CircuitJsonPcbPrimitiveBuilder.#all(index, type))
            .map((element) => {
                const center = CircuitJsonPcbPrimitiveBuilder.#center(element)
                if (!center) return null
                const diameter = CircuitJsonUnits.length(
                    element.diameter ?? element.outer_diameter ?? element.width,
                    0.6
                )
                const component = componentsByPcbId.get(
                    String(element.pcb_component_id || '').trim()
                )
                return CircuitJsonPcbPrimitiveBuilder.#primitive({
                    ...CircuitJsonPcbPrimitiveBuilder.#viaRow(
                        element,
                        center,
                        diameter,
                        CircuitJsonPcbPrimitiveBuilder.#netName(element, null)
                    ),
                    component
                })
            })
            .filter(Boolean)
    }

    /**
     * Builds one via-like primitive row.
     * @param {object} element Via-like element.
     * @param {{ x: number, y: number }} center Center point.
     * @param {number} diameter Outer diameter.
     * @param {string} netName Net name.
     * @returns {object}
     */
    static #viaRow(element, center, diameter, netName) {
        const layer = CircuitJsonPcbPrimitiveBuilder.#layer(
            element.layer || element.from_layer || element.to_layer
        )
        return {
            id: String(
                element.pcb_via_id ||
                    element.pcb_plated_hole_id ||
                    element.pcb_hole_id ||
                    ''
            ),
            kind: 'via',
            x: center.x,
            y: center.y,
            diameter,
            holeDiameter: CircuitJsonUnits.length(
                element.hole_diameter ?? element.holeDiameter,
                diameter * 0.45
            ),
            bounds: CircuitJsonPcbPrimitiveGeometry.centerBounds(
                center,
                diameter,
                diameter
            ),
            layer,
            side: '',
            netName,
            anchors: [{ point: center }],
            source: element
        }
    }

    /**
     * Builds silkscreen and text primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #silkscreenPrimitives(index, componentsByPcbId) {
        return [
            ...CircuitJsonPcbPrimitiveBuilder.#textPrimitives(
                index,
                componentsByPcbId
            ),
            ...CircuitJsonPcbPrimitiveBuilder.#linePrimitives(
                index,
                componentsByPcbId
            )
        ]
    }

    /**
     * Builds text primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #textPrimitives(index, componentsByPcbId) {
        return [
            'pcb_silkscreen_text',
            'pcb_text',
            'pcb_copper_text',
            'pcb_fabrication_note_text'
        ]
            .flatMap((type) => CircuitJsonPcbPrimitiveBuilder.#all(index, type))
            .flatMap((element) => {
                const center =
                    CircuitJsonPcbPrimitiveBuilder.#center(element) ||
                    CircuitJsonPcbPrimitiveBuilder.#point(
                        element.anchor_position
                    )
                if (!center) return []
                const size = CircuitJsonUnits.length(
                    element.font_size ?? element.fontSize ?? element.height,
                    1
                )
                const component = componentsByPcbId.get(
                    String(element.pcb_component_id || '').trim()
                )
                const bounds = CircuitJsonPcbPrimitiveGeometry.centerBounds(
                    center,
                    Math.max(
                        String(element.text || '').length * size * 0.6,
                        size
                    ),
                    size
                )
                const primitive = CircuitJsonPcbPrimitiveBuilder.#primitive({
                    id: CircuitJsonIndexer.getElementId(element),
                    kind: CircuitJsonPcbPrimitiveBuilder.#textKind(element),
                    text: String(element.text || ''),
                    x: center.x,
                    y: center.y,
                    fontSize: size,
                    rotation: CircuitJsonUnits.angle(element.ccw_rotation, 0),
                    bounds,
                    layer: CircuitJsonPcbPrimitiveBuilder.#layer(element.layer),
                    component,
                    netName: CircuitJsonPcbPrimitiveBuilder.#netName(
                        element,
                        null
                    ),
                    anchors: [{ point: center }],
                    source: element
                })
                if (element.type !== 'pcb_silkscreen_text') return [primitive]

                return [
                    primitive,
                    {
                        ...primitive,
                        id: primitive.id + ':silkscreen',
                        kind: 'silkscreen',
                        footprintId: primitive.componentKey
                            ? 'footprint:' +
                              primitive.componentKey +
                              ':silkscreen'
                            : ''
                    }
                ]
            })
            .filter(Boolean)
    }

    /**
     * Builds line primitives.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @returns {object[]}
     */
    static #linePrimitives(index, componentsByPcbId) {
        return ['pcb_silkscreen_line', 'pcb_fabrication_note_path']
            .flatMap((type) => CircuitJsonPcbPrimitiveBuilder.#all(index, type))
            .map((element) => {
                const start = CircuitJsonPcbPrimitiveBuilder.#point({
                    x: element.x1 ?? element.start?.x,
                    y: element.y1 ?? element.start?.y
                })
                const end = CircuitJsonPcbPrimitiveBuilder.#point({
                    x: element.x2 ?? element.end?.x,
                    y: element.y2 ?? element.end?.y
                })
                if (!start || !end) return null
                const width = CircuitJsonUnits.length(element.width, 0.12)
                const component = componentsByPcbId.get(
                    String(element.pcb_component_id || '').trim()
                )
                return CircuitJsonPcbPrimitiveBuilder.#primitive({
                    id: CircuitJsonIndexer.getElementId(element),
                    kind:
                        element.type === 'pcb_fabrication_note_path'
                            ? 'fabrication'
                            : 'silkscreen',
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
                    layer: CircuitJsonPcbPrimitiveBuilder.#layer(element.layer),
                    component,
                    anchors: [{ point: start }, { point: end }],
                    source: element
                })
            })
            .filter(Boolean)
    }

    /**
     * Resolves a normalized text primitive kind.
     * @param {object} element Text element.
     * @returns {string}
     */
    static #textKind(element) {
        if (element.type === 'pcb_copper_text') return 'copper-text'
        if (element.type === 'pcb_fabrication_note_text') return 'fabrication'
        return 'silkscreen_text'
    }

    /**
     * Adds common primitive metadata.
     * @param {object} primitive Primitive data.
     * @returns {object}
     */
    static #primitive(primitive) {
        const component = primitive.component || {}
        const layer = CircuitJsonPcbPrimitiveBuilder.#layer(primitive.layer)
        const source = primitive.source || {}
        return {
            ...primitive,
            layer,
            side: primitive.side ?? CircuitJsonPcbPrimitiveBuilder.#side(layer),
            componentKey: String(component.componentKey || ''),
            componentId: String(component.pcbComponentId || ''),
            footprintId: component.componentKey
                ? 'footprint:' + component.componentKey + ':' + primitive.kind
                : '',
            netName: String(primitive.netName || '').trim(),
            groupIds: CircuitJsonPcbPrimitiveBuilder.#uniqueStrings([
                source.pcb_group_id,
                source.source_group_id,
                component.pcb_group_id,
                component.positioned_relative_to_pcb_group_id,
                component.sourceGroupId
            ]),
            subcircuitIds: CircuitJsonPcbPrimitiveBuilder.#uniqueStrings([
                source.subcircuit_id,
                source.subcircuitId,
                ...(component.subcircuitIds || [])
            ])
        }
    }

    /**
     * Builds copper layer rows from board metadata.
     * @param {object | null} board Board element.
     * @returns {object[]}
     */
    static #layers(board) {
        const count = Math.max(
            1,
            Math.round(CircuitJsonUnits.length(board?.num_layers, 2))
        )
        const keys =
            count === 1
                ? ['top']
                : [
                      'top',
                      ...Array.from(
                          { length: Math.max(count - 2, 0) },
                          (_entry, index) => 'inner' + (index + 1)
                      ),
                      'bottom'
                  ]

        return keys.map((key, index) => ({
            key,
            id: key,
            layer: key,
            name: key,
            number: index + 1,
            side: key === 'top' ? 'top' : key === 'bottom' ? 'bottom' : 'inner',
            type: 'copper',
            sourceFormat: 'circuitjson'
        }))
    }

    /**
     * Builds unique net rows.
     * @param {object[]} primitives Primitive rows.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {object[]}
     */
    static #nets(primitives, index) {
        const names = []
        for (const net of CircuitJsonPcbPrimitiveBuilder.#all(
            index,
            'source_net'
        )) {
            const name = String(net.name || net.source_net_id || '').trim()
            if (name && !names.includes(name)) names.push(name)
        }
        for (const primitive of primitives) {
            const name = String(primitive.netName || '').trim()
            if (name && !names.includes(name)) names.push(name)
        }
        return names.map((name) => ({ name }))
    }

    /**
     * Resolves board bounds from outline or size metadata.
     * @param {object | null} board Board element.
     * @returns {object | null}
     */
    static #boardBounds(board) {
        const outline = CircuitJsonPcbPrimitiveBuilder.#points(board)
        if (outline.length >= 3) {
            return CircuitJsonPcbPrimitiveGeometry.pointsBounds(outline)
        }

        const width = CircuitJsonUnits.optionalLength(board?.width)
        const height = CircuitJsonUnits.optionalLength(board?.height)
        if (width === null || height === null || width <= 0 || height <= 0) {
            return null
        }

        return CircuitJsonPcbPrimitiveGeometry.centerBounds(
            CircuitJsonPcbPrimitiveBuilder.#center(board) || { x: 0, y: 0 },
            width,
            height
        )
    }

    /**
     * Resolves merged bounds for all board rows.
     * @param {object[]} boards Board rows.
     * @returns {object | null}
     */
    static #mergedBoardBounds(boards) {
        return CircuitJsonPcbPrimitiveGeometry.mergedPrimitiveBounds(
            boards
                .map((board) => ({
                    bounds: CircuitJsonPcbPrimitiveBuilder.#boardBounds(board)
                }))
                .filter((row) => row.bounds)
        )
    }

    /**
     * Resolves a center point.
     * @param {object} element Element.
     * @returns {{ x: number, y: number } | null}
     */
    static #center(element) {
        return CircuitJsonPcbPrimitiveBuilder.#point(element?.center || element)
    }

    /**
     * Resolves a point.
     * @param {object | null | undefined} value Point candidate.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(value) {
        return CircuitJsonUnits.optionalPoint(value)
    }

    /**
     * Resolves polygon points from common fields.
     * @param {object} element Element.
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
            .map((point) => CircuitJsonPcbPrimitiveBuilder.#point(point))
            .filter(Boolean)
    }

    /**
     * Resolves the center of a point list.
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
     * @param {object} element Element.
     * @param {string | null} fallback Fallback net name.
     * @returns {string}
     */
    static #netName(element, fallback) {
        return String(
            element?.netName ??
                element?.net ??
                element?.net_name ??
                element?.source_net_id ??
                fallback ??
                ''
        ).trim()
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
