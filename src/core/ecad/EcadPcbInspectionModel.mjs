import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'
import { EcadCircuitJsonContext } from './EcadCircuitJsonContext.mjs'
import { EcadDocumentComponents } from './EcadDocumentComponents.mjs'
import { EcadDocumentConnectivity } from './EcadDocumentConnectivity.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

const MIL_PER_MM = 1000 / 25.4

/**
 * Projects canonical CircuitJSON PCB data into the stable inspection shape
 * shared by WebMCP and other read-only app consumers.
 */
export class EcadPcbInspectionModel {
    /**
     * Returns a cached inspection model, preserving native models unchanged.
     * @param {object} documentModel Loaded document model.
     * @returns {object}
     */
    static resolve(documentModel) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            return documentModel?.pcb || {}
        }
        const context = EcadCircuitJsonContext.prepare(documentModel)
        return context.getOrCreateDerived('document', 'pcb-inspection-v1', () =>
            EcadPcbInspectionModel.#canonical(context)
        )
    }

    /**
     * Builds the canonical projection from common connectivity and geometry.
     * @param {import('circuitjson-toolkit').CircuitJsonDocumentContext} context Prepared context.
     * @returns {object}
     */
    static #canonical(context) {
        const elements = context.model
        const interaction = PcbInteractionPrimitiveModel.build(elements)
        const connectivity = EcadDocumentConnectivity.resolve(context.document)
        const componentRows = EcadDocumentComponents.resolve(context.document)
        const netNameById = new Map(
            connectivity.nets.map((net) => [String(net.id || ''), net.name])
        )
        const traceNetNameById = EcadPcbInspectionModel.#traceNetNames(
            connectivity,
            netNameById
        )
        const pinNetNameByKey =
            EcadPcbInspectionModel.#pinNetNames(connectivity)
        const cadByPcbId = EcadPcbInspectionModel.#cadByPcbId(elements)
        const pads = interaction.primitives
            .filter((primitive) => primitive.kind === 'pad')
            .map((primitive) =>
                EcadPcbInspectionModel.#pad(primitive, pinNetNameByKey)
            )
        const tracks = interaction.primitives
            .filter((primitive) => primitive.kind === 'track')
            .map((primitive) =>
                EcadPcbInspectionModel.#track(primitive, traceNetNameById)
            )
        const vias = interaction.primitives
            .filter((primitive) => primitive.kind === 'via')
            .map((primitive) =>
                EcadPcbInspectionModel.#via(primitive, traceNetNameById)
            )
        const zones = interaction.primitives
            .filter((primitive) =>
                ['zone', 'copper-pour', 'copper'].includes(primitive.kind)
            )
            .map((primitive) =>
                EcadPcbInspectionModel.#zone(primitive, netNameById)
            )
        const components = interaction.components.map((component) =>
            EcadPcbInspectionModel.#component(
                component,
                componentRows,
                cadByPcbId,
                pads
            )
        )
        const board = elements.find((element) => element?.type === 'pcb_board')

        return {
            boardOutline: EcadPcbInspectionModel.#boardOutline(
                board,
                interaction
            ),
            layers: interaction.layers.map((layer) => ({
                ...layer,
                displayName: String(layer.name || layer.layer || ''),
                canonicalName: String(layer.layer || layer.name || ''),
                role: layer.type || ''
            })),
            components,
            pads,
            nets: connectivity.nets.map((net) => ({
                name: net.name || net.id,
                pads: (net.pins || []).map((pin) => ({
                    refdes: pin.refdes || '',
                    designator: String(pin.pinNumber ?? pin.name ?? ''),
                    pinNumber: String(pin.pinNumber ?? pin.name ?? '')
                }))
            })),
            tracks,
            vias,
            zones,
            fills: [],
            texts: EcadPcbInspectionModel.#texts(elements),
            rules: EcadPcbInspectionModel.#rules(board)
        }
    }

    /**
     * Indexes trace ids to their first named source net.
     * @param {object} connectivity Shared connectivity model.
     * @param {Map<string, string>} netNameById Net names by id.
     * @returns {Map<string, string>}
     */
    static #traceNetNames(connectivity, netNameById) {
        return new Map(
            connectivity.traces.map((trace) => [
                String(trace.id || ''),
                String(
                    (trace.sourceNetIds || [])
                        .map((id) => netNameById.get(String(id)))
                        .find(Boolean) || ''
                )
            ])
        )
    }

    /**
     * Indexes component/pin pairs to canonical net names.
     * @param {object} connectivity Shared connectivity model.
     * @returns {Map<string, string>}
     */
    static #pinNetNames(connectivity) {
        const result = new Map()
        for (const net of connectivity.nets) {
            for (const pin of net.pins || []) {
                const key = EcadPcbInspectionModel.#pinKey(
                    pin.refdes,
                    pin.pinNumber ?? pin.name
                )
                if (key && !result.has(key)) result.set(key, net.name || net.id)
            }
        }
        return result
    }

    /**
     * Indexes canonical CAD placements by owning PCB component.
     * @param {object[]} elements CircuitJSON elements.
     * @returns {Map<string, object>}
     */
    static #cadByPcbId(elements) {
        const result = new Map()
        for (const cad of elements.filter(
            (element) => element?.type === 'cad_component'
        )) {
            const id = String(cad.pcb_component_id || '')
            if (id && !result.has(id)) result.set(id, cad)
        }
        return result
    }

    /**
     * Projects one prepared pad primitive.
     * @param {object} primitive Prepared primitive.
     * @param {Map<string, string>} pinNetNameByKey Net names by component pin.
     * @returns {object}
     */
    static #pad(primitive, pinNetNameByKey) {
        const pin = String(
            primitive.source?.port_hints?.[0] || primitive.source?.name || ''
        )
        const refdes = String(primitive.componentKey || '')
        const net =
            primitive.netName ||
            pinNetNameByKey.get(EcadPcbInspectionModel.#pinKey(refdes, pin)) ||
            ''
        return {
            ...primitive,
            refdes,
            designator: pin,
            pinNumber: pin,
            net,
            x: EcadPcbInspectionModel.#mil(primitive.x),
            y: EcadPcbInspectionModel.#mil(primitive.y),
            width: EcadPcbInspectionModel.#mil(primitive.width),
            height: EcadPcbInspectionModel.#mil(primitive.height),
            holeDiameter: EcadPcbInspectionModel.#mil(primitive.holeDiameter)
        }
    }

    /**
     * Projects one prepared track primitive.
     * @param {object} primitive Prepared primitive.
     * @param {Map<string, string>} traceNetNameById Net names by trace id.
     * @returns {object}
     */
    static #track(primitive, traceNetNameById) {
        return {
            ...primitive,
            net: EcadPcbInspectionModel.#primitiveNetName(
                primitive,
                traceNetNameById
            ),
            width: EcadPcbInspectionModel.#mil(primitive.width)
        }
    }

    /**
     * Projects one prepared via primitive.
     * @param {object} primitive Prepared primitive.
     * @param {Map<string, string>} traceNetNameById Net names by trace id.
     * @returns {object}
     */
    static #via(primitive, traceNetNameById) {
        return {
            ...primitive,
            net: EcadPcbInspectionModel.#primitiveNetName(
                primitive,
                traceNetNameById
            ),
            x: EcadPcbInspectionModel.#mil(primitive.x),
            y: EcadPcbInspectionModel.#mil(primitive.y),
            diameter: EcadPcbInspectionModel.#mil(
                primitive.diameter ?? primitive.width
            ),
            holeDiameter: EcadPcbInspectionModel.#mil(primitive.holeDiameter)
        }
    }

    /**
     * Projects one copper zone primitive.
     * @param {object} primitive Prepared primitive.
     * @param {Map<string, string>} netNameById Net names by id.
     * @returns {object}
     */
    static #zone(primitive, netNameById) {
        const sourceNetId = String(primitive.source?.source_net_id || '')
        return {
            ...primitive,
            net: primitive.netName || netNameById.get(sourceNetId) || ''
        }
    }

    /**
     * Projects one canonical component placement and its owned pads/model.
     * @param {object} component Prepared component.
     * @param {object[]} rows Canonical display rows.
     * @param {Map<string, object>} cadByPcbId CAD placements by PCB id.
     * @param {object[]} pads Prepared pads.
     * @returns {object}
     */
    static #component(component, rows, cadByPcbId, pads) {
        const row =
            rows.find(
                (candidate) =>
                    candidate.pcbComponentId === component.pcbComponentId
            ) || {}
        const cad = cadByPcbId.get(component.pcbComponentId) || {}
        const modelPath = EcadPcbInspectionModel.#modelPath(cad)
        return {
            ...row,
            ...component,
            x: EcadPcbInspectionModel.#mil(component.x),
            y: EcadPcbInspectionModel.#mil(component.y),
            position: {
                x: EcadPcbInspectionModel.#mil(component.x),
                y: EcadPcbInspectionModel.#mil(component.y)
            },
            side: component.side || component.layer || row.side || '',
            modelName: modelPath.split('/').at(-1) || '',
            modelPath,
            pads: pads.filter(
                (pad) => pad.componentId === component.pcbComponentId
            )
        }
    }

    /**
     * Builds a native-compatible board outline in mil units.
     * @param {object | undefined} board Canonical board element.
     * @param {object} interaction Prepared interaction model.
     * @returns {object}
     */
    static #boardOutline(board, interaction) {
        const points = Array.isArray(board?.outline) ? board.outline : []
        const segmentCount = points.length || (board ? 4 : 0)
        return {
            minX: EcadPcbInspectionModel.#mil(interaction.bounds?.minX),
            minY: EcadPcbInspectionModel.#mil(interaction.bounds?.minY),
            widthMil: EcadPcbInspectionModel.#mil(
                board?.width ?? interaction.bounds?.width
            ),
            heightMil: EcadPcbInspectionModel.#mil(
                board?.height ?? interaction.bounds?.height
            ),
            segments: Array.from({ length: segmentCount }, () => ({})),
            cutouts: interaction.primitives.filter(
                (primitive) => primitive.kind === 'cutout'
            )
        }
    }

    /**
     * Projects canonical PCB text rows.
     * @param {object[]} elements CircuitJSON elements.
     * @returns {object[]}
     */
    static #texts(elements) {
        return elements
            .filter((element) =>
                ['pcb_silkscreen_text', 'pcb_copper_text'].includes(
                    element?.type
                )
            )
            .map((element) => ({
                text: String(element.text || ''),
                layer:
                    typeof element.layer === 'object'
                        ? element.layer.name || ''
                        : String(element.layer || '')
            }))
    }

    /**
     * Projects board-level canonical constraints into compact rule rows.
     * @param {object | undefined} board Canonical board element.
     * @returns {object[]}
     */
    static #rules(board) {
        if (!board) return []
        const definitions = [
            ['Minimum trace width', 'width', board.min_trace_width],
            [
                'Trace to pad clearance',
                'clearance',
                board.min_trace_to_pad_edge_clearance
            ],
            [
                'Pad to pad clearance',
                'clearance',
                board.min_pad_edge_to_pad_edge_clearance
            ]
        ]
        return definitions
            .filter((definition) => Number.isFinite(Number(definition[2])))
            .map(([name, kind, value], index) => ({
                name,
                kind,
                category: kind === 'width' ? 'routing' : 'electrical',
                enabled: true,
                priority: index + 1,
                scope: 'All',
                constraints: {
                    minimum: {
                        value: EcadPcbInspectionModel.#mil(value),
                        unit: 'mil'
                    }
                }
            }))
    }

    /**
     * Resolves a prepared primitive net name through its source trace.
     * @param {object} primitive Prepared primitive.
     * @param {Map<string, string>} traceNetNameById Net names by trace id.
     * @returns {string}
     */
    static #primitiveNetName(primitive, traceNetNameById) {
        const sourceTraceId = String(
            primitive.sourceTraceId || primitive.source?.source_trace_id || ''
        )
        return primitive.netName || traceNetNameById.get(sourceTraceId) || ''
    }

    /**
     * Resolves the first public model path from a CAD component.
     * @param {object} cad CAD component.
     * @returns {string}
     */
    static #modelPath(cad) {
        return String(
            cad?.model_asset?.project_relative_path ||
                cad?.model_asset?.url ||
                cad?.model_step_url ||
                cad?.model_wrl_url ||
                cad?.model_glb_url ||
                cad?.model_gltf_url ||
                cad?.model_stl_url ||
                cad?.model_obj_url ||
                cad?.model_3mf_url ||
                ''
        ).trim()
    }

    /**
     * Builds a stable case-insensitive component/pin lookup key.
     * @param {unknown} refdes Component designator.
     * @param {unknown} pin Pin number or name.
     * @returns {string}
     */
    static #pinKey(refdes, pin) {
        const component = String(refdes || '')
            .trim()
            .toUpperCase()
        const number = String(pin ?? '')
            .trim()
            .toUpperCase()
        return component && number ? component + ':' + number : ''
    }

    /**
     * Converts canonical millimetres to the legacy inspection unit.
     * @param {unknown} value Millimetre value.
     * @returns {number | undefined}
     */
    static #mil(value) {
        const number = Number(value)
        return Number.isFinite(number)
            ? Math.round(number * MIL_PER_MM * 1e9) / 1e9
            : undefined
    }
}
