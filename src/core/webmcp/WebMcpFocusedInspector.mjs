import { ComponentGrouping } from 'altium-toolkit/netlist-query'
import { WebMcpDesignAnalyzer } from './WebMcpDesignAnalyzer.mjs'

/**
 * Builds focused read-only WebMCP inspection responses.
 */
export class WebMcpFocusedInspector {
    /**
     * Returns direct schematic net membership without traversal.
     * @param {object} entry Loaded entry.
     * @param {{ net_name?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    static queryNet(entry, args = {}) {
        const requested = String(args.net_name || '')
            .trim()
            .toLowerCase()
        if (!requested) return { error: 'net_name is required.' }

        const net = (entry.documentModel?.schematic?.nets || []).find(
            (candidate) =>
                String(candidate?.name || '').toLowerCase() === requested
        )
        if (!net) {
            return {
                error:
                    "Net '" +
                    String(args.net_name || '') +
                    "' was not found in loaded schematic connectivity."
            }
        }

        const pins = WebMcpFocusedInspector.#schematicPins(net)
        const components = WebMcpFocusedInspector.#naturalSorted([
            ...new Set(pins.map((pin) => pin.refdes))
        ])

        return {
            net: String(net.name || ''),
            design: WebMcpDesignAnalyzer.entryName(entry),
            components,
            pins,
            pin_count: pins.length
        }
    }

    /**
     * Returns component counts by reference-designator prefix.
     * @param {object[]} entries Loaded entries.
     * @returns {{ designs: number, total_components: number, types: object[] }}
     */
    static listComponentTypes(entries) {
        const counts = new Map()
        const componentKeys = new Set()

        for (const entry of entries) {
            const designKey = entry.baseName || entry.id
            for (const refdes of WebMcpFocusedInspector.#componentRefdesList(
                entry.documentModel
            )) {
                const key = designKey + ':' + refdes
                if (componentKeys.has(key)) continue
                componentKeys.add(key)
                const type = WebMcpFocusedInspector.#refdesPrefix(refdes)
                if (!type) continue
                counts.set(type, (counts.get(type) || 0) + 1)
            }
        }

        return {
            designs: entries.length,
            total_components: componentKeys.size,
            types: [...counts.entries()]
                .map(([type, count]) => ({ type, count }))
                .sort((left, right) =>
                    ComponentGrouping.naturalSort(left.type, right.type)
                )
        }
    }

    /**
     * Lists parser diagnostics directly.
     * @param {object[]} entries Loaded entries.
     * @returns {{ diagnostics: object[], total_count: number }}
     */
    static listDiagnostics(entries) {
        const diagnostics = []

        for (const entry of entries) {
            for (const diagnostic of entry.documentModel?.diagnostics || []) {
                diagnostics.push(
                    WebMcpFocusedInspector.#withoutUndefined({
                        design: WebMcpDesignAnalyzer.entryName(entry),
                        severity: WebMcpFocusedInspector.#severity(
                            diagnostic?.severity
                        ),
                        message: String(diagnostic?.message || '').trim(),
                        code: diagnostic?.code
                    })
                )
            }
        }

        return {
            diagnostics,
            total_count: diagnostics.length
        }
    }

    /**
     * Compares BOM component rows against PCB components.
     * @param {object} bomEntry Loaded entry with BOM rows.
     * @param {object} pcbEntry Loaded PCB entry.
     * @returns {object}
     */
    static compareBomPcb(bomEntry, pcbEntry) {
        const bomComponents = WebMcpFocusedInspector.#bomComponentMap(bomEntry)
        const pcbComponents = WebMcpFocusedInspector.#pcbComponentMap(pcbEntry)
        const missingOnPcb = []
        const pcbOnlyComponents = []
        const footprintMismatches = []
        let matchedComponents = 0

        for (const [refdes, bomComponent] of bomComponents.entries()) {
            const pcbComponent = pcbComponents.get(refdes)
            if (!pcbComponent) {
                missingOnPcb.push(refdes)
                continue
            }

            if (
                bomComponent.footprint &&
                pcbComponent.footprint &&
                bomComponent.footprint !== pcbComponent.footprint
            ) {
                footprintMismatches.push({
                    refdes,
                    bom_footprint: bomComponent.footprint,
                    pcb_footprint: pcbComponent.footprint
                })
                continue
            }

            matchedComponents += 1
        }

        for (const refdes of pcbComponents.keys()) {
            if (!bomComponents.has(refdes)) {
                pcbOnlyComponents.push(refdes)
            }
        }

        return {
            status:
                missingOnPcb.length ||
                pcbOnlyComponents.length ||
                footprintMismatches.length
                    ? 'mismatch'
                    : 'matched',
            bom: WebMcpDesignAnalyzer.entryName(bomEntry),
            pcb: WebMcpDesignAnalyzer.entryName(pcbEntry),
            summary: {
                bom_components: bomComponents.size,
                pcb_components: pcbComponents.size,
                matched_components: matchedComponents,
                missing_on_pcb: missingOnPcb.length,
                pcb_only_components: pcbOnlyComponents.length,
                footprint_mismatches: footprintMismatches.length
            },
            missing_on_pcb: WebMcpFocusedInspector.#naturalSorted(missingOnPcb),
            pcb_only_components:
                WebMcpFocusedInspector.#naturalSorted(pcbOnlyComponents),
            footprint_mismatches: footprintMismatches.sort((left, right) =>
                ComponentGrouping.naturalSort(left.refdes, right.refdes)
            )
        }
    }

    /**
     * Lists schematic nets with exactly one connected pin.
     * @param {object[]} entries Loaded entries.
     * @returns {{ nets: object[], total_count: number }}
     */
    static listSinglePinNets(entries) {
        const nets = []

        for (const entry of entries) {
            for (const net of entry.documentModel?.schematic?.nets || []) {
                const pins = WebMcpFocusedInspector.#pinIds(net?.pins || [])
                if (pins.length !== 1) continue
                nets.push({
                    design: WebMcpDesignAnalyzer.entryName(entry),
                    net: String(net?.name || ''),
                    pins,
                    pin_count: pins.length
                })
            }
        }

        return {
            nets,
            total_count: nets.length
        }
    }

    /**
     * Returns compact pin rows for one schematic net.
     * @param {object} net Net row.
     * @returns {object[]}
     */
    static #schematicPins(net) {
        return (net?.pins || [])
            .map((pin) =>
                WebMcpFocusedInspector.#withoutUndefined({
                    refdes: WebMcpFocusedInspector.#pinRefdes(pin),
                    pin: WebMcpFocusedInspector.#pinNumber(pin),
                    name: WebMcpFocusedInspector.#pinName(pin)
                })
            )
            .filter((pin) => pin.refdes && pin.pin)
            .sort((left, right) =>
                ComponentGrouping.naturalSort(
                    left.refdes + '.' + left.pin,
                    right.refdes + '.' + right.pin
                )
            )
    }

    /**
     * Builds BOM component rows keyed by refdes.
     * @param {object} entry Loaded entry.
     * @returns {Map<string, object>}
     */
    static #bomComponentMap(entry) {
        const components = new Map()

        for (const row of entry.documentModel?.bom || []) {
            for (const refdes of WebMcpFocusedInspector.#designators(row)) {
                components.set(refdes, {
                    refdes,
                    footprint:
                        WebMcpFocusedInspector.#trim(row?.footprint) ||
                        WebMcpFocusedInspector.#trim(row?.package) ||
                        WebMcpFocusedInspector.#trim(row?.pattern)
                })
            }
        }

        return components
    }

    /**
     * Builds PCB component rows keyed by refdes.
     * @param {object} entry Loaded PCB entry.
     * @returns {Map<string, object>}
     */
    static #pcbComponentMap(entry) {
        const components = new Map()

        for (const component of entry.documentModel?.pcb?.components || []) {
            const refdes = WebMcpFocusedInspector.#refdes(component)
            if (!refdes) continue
            components.set(refdes, {
                refdes,
                footprint:
                    WebMcpFocusedInspector.#trim(component?.footprint) ||
                    WebMcpFocusedInspector.#trim(component?.package) ||
                    WebMcpFocusedInspector.#trim(component?.pattern)
            })
        }

        return components
    }

    /**
     * Returns component refdes values from schematic, PCB, and BOM rows.
     * @param {object} documentModel Document model.
     * @returns {string[]}
     */
    static #componentRefdesList(documentModel) {
        return [
            ...(documentModel?.schematic?.components || []).map((component) =>
                WebMcpFocusedInspector.#refdes(component)
            ),
            ...(documentModel?.pcb?.components || []).map((component) =>
                WebMcpFocusedInspector.#refdes(component)
            ),
            ...(documentModel?.bom || []).flatMap((row) =>
                WebMcpFocusedInspector.#designators(row)
            )
        ].filter(Boolean)
    }

    /**
     * Returns pin identifiers.
     * @param {object[]} pins Pin rows.
     * @returns {string[]}
     */
    static #pinIds(pins) {
        return WebMcpFocusedInspector.#naturalSorted(
            pins
                .map((pin) => {
                    const refdes = WebMcpFocusedInspector.#pinRefdes(pin)
                    const pinNumber = WebMcpFocusedInspector.#pinNumber(pin)
                    return refdes && pinNumber ? refdes + '.' + pinNumber : ''
                })
                .filter(Boolean)
        )
    }

    /**
     * Returns BOM row designators.
     * @param {object} row BOM row.
     * @returns {string[]}
     */
    static #designators(row) {
        return (Array.isArray(row?.designators) ? row.designators : [])
            .map((refdes) => String(refdes || '').trim())
            .filter(Boolean)
    }

    /**
     * Returns one component refdes.
     * @param {object} component Component row.
     * @returns {string}
     */
    static #refdes(component) {
        return String(
            component?.designator ||
                component?.refdes ||
                component?.reference ||
                ''
        ).trim()
    }

    /**
     * Returns a reference-designator prefix.
     * @param {string} refdes Reference designator.
     * @returns {string}
     */
    static #refdesPrefix(refdes) {
        return String(refdes || '')
            .trim()
            .replace(/[0-9].*$/, '')
            .toUpperCase()
    }

    /**
     * Returns a pin's owning refdes.
     * @param {object} pin Pin row.
     * @returns {string}
     */
    static #pinRefdes(pin) {
        return String(
            pin?.refdes ||
                pin?.componentRefdes ||
                pin?.componentDesignator ||
                pin?.ownerDesignator ||
                pin?.reference ||
                ''
        ).trim()
    }

    /**
     * Returns a pin number.
     * @param {object} pin Pin row.
     * @returns {string}
     */
    static #pinNumber(pin) {
        return String(
            pin?.pinNumber || pin?.number || pin?.designator || pin?.pad || ''
        ).trim()
    }

    /**
     * Returns a pin display name when useful.
     * @param {object} pin Pin row.
     * @returns {string}
     */
    static #pinName(pin) {
        const pinNumber = WebMcpFocusedInspector.#pinNumber(pin)
        const name = String(pin?.name || '').trim()
        return name && name !== pinNumber ? name : ''
    }

    /**
     * Normalizes diagnostic severity.
     * @param {unknown} value Raw severity.
     * @returns {'error' | 'warning' | 'info'}
     */
    static #severity(value) {
        const normalized = String(value || '').toLowerCase()
        if (normalized === 'error') return 'error'
        if (normalized === 'info') return 'info'
        return 'warning'
    }

    /**
     * Returns naturally sorted strings.
     * @param {string[]} values Values.
     * @returns {string[]}
     */
    static #naturalSorted(values) {
        return values.sort((left, right) =>
            ComponentGrouping.naturalSort(left, right)
        )
    }

    /**
     * Trims a value to a string.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #trim(value) {
        return String(value || '').trim()
    }

    /**
     * Removes undefined and empty-string properties.
     * @param {object} value Object value.
     * @returns {object}
     */
    static #withoutUndefined(value) {
        return Object.fromEntries(
            Object.entries(value).filter(
                ([, entry]) => entry !== undefined && entry !== ''
            )
        )
    }
}
