import { QueryService } from 'circuitjson-toolkit/query'
import { EcadCircuitJsonContext } from './EcadCircuitJsonContext.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Exposes shared canonical connectivity in app-facing component/net rows.
 */
export class EcadDocumentConnectivity {
    /**
     * Returns cached connectivity for a canonical or native document.
     * @param {unknown} documentModel Loaded document.
     * @returns {{ schema: string, components: object[], nets: object[], traces: object[], diagnostics: object[], statistics: object }} Connectivity projection.
     */
    static resolve(documentModel) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            return EcadDocumentConnectivity.#native(documentModel)
        }

        const context = EcadCircuitJsonContext.prepare(documentModel)
        return context.getOrCreateDerived('document', 'connectivity-v1', () =>
            EcadDocumentConnectivity.#canonical(context)
        )
    }

    /**
     * Builds canonical connectivity through the shared query service.
     * @param {import('circuitjson-toolkit').CircuitJsonDocumentContext} context Prepared context.
     * @returns {object} Connectivity projection.
     */
    static #canonical(context) {
        const netlist = QueryService.create(context).buildNetlist()
        const pinsByNetId = new Map()
        for (const component of netlist.components) {
            for (const pin of component.pins || []) {
                for (const netId of pin.netIds || []) {
                    if (!pinsByNetId.has(netId)) pinsByNetId.set(netId, [])
                    pinsByNetId.get(netId).push({
                        ...pin,
                        refdes: component.designator || component.name || '',
                        componentId: component.id
                    })
                }
            }
        }
        return {
            ...netlist,
            nets: netlist.nets.map((net) => ({
                ...net,
                pins: pinsByNetId.get(net.id) || [],
                pinCount: (pinsByNetId.get(net.id) || []).length
            }))
        }
    }

    /**
     * Preserves native connectivity arrays for retained source extensions.
     * @param {unknown} documentModel Native document.
     * @returns {object} Connectivity projection.
     */
    static #native(documentModel) {
        const schematic = documentModel?.schematic || {}
        const pcb = documentModel?.pcb || {}
        const components = Array.isArray(schematic.components)
            ? schematic.components
            : Array.isArray(pcb.components)
              ? pcb.components
              : []
        const nets = Array.isArray(schematic.nets)
            ? schematic.nets
            : Array.isArray(pcb.nets)
              ? pcb.nets
              : Array.isArray(documentModel?.nets)
                ? documentModel.nets
                : []
        return {
            schema: 'ecad-forge.native-connectivity.v1',
            components,
            nets,
            traces: [],
            diagnostics: [],
            statistics: {
                componentCount: components.length,
                netCount: nets.length,
                traceCount: 0
            }
        }
    }
}
