import { ComponentGrouping } from 'altium-toolkit/netlist-query'
import { WebMcpDesignAnalyzer } from './WebMcpDesignAnalyzer.mjs'

/**
 * Builds additional read-only WebMCP inspection and search responses.
 */
export class WebMcpDesignInspector {
    /**
     * Finds BOM rows by reference designator, MPN, or text pattern.
     * @param {object[]} entries Loaded entries.
     * @param {{ refdes?: string, mpn?: string, pattern?: string }} [args] Tool args.
     * @returns {{ items: object[], total_count: number } | { error: string }}
     */
    static queryBomItem(entries, args = {}) {
        const selector = WebMcpDesignInspector.#querySelector(args)
        if (!selector) {
            return {
                error: 'Provide refdes, mpn, or pattern to query BOM items.'
            }
        }

        const items = WebMcpDesignInspector.#bomItems(entries).filter((item) =>
            WebMcpDesignInspector.#itemMatchesSelector(item, selector)
        )

        return {
            items,
            total_count: items.length
        }
    }

    /**
     * Lists compact pin-to-net rows for one component.
     * @param {object} entry Loaded entry.
     * @param {{ refdes?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    static listPinConnections(entry, args = {}) {
        const requestedRefdes = String(args.refdes || '').trim()
        if (!requestedRefdes) {
            return { error: 'refdes is required.' }
        }

        const rows = WebMcpDesignInspector.#pinConnectionRows(
            entry.documentModel
        )
        const refdes = Object.keys(rows).find(
            (candidate) =>
                candidate.toLowerCase() === requestedRefdes.toLowerCase()
        )
        if (!refdes) {
            return {
                error:
                    "Component '" +
                    requestedRefdes +
                    "' was not found in loaded schematic connectivity."
            }
        }

        const pins = rows[refdes].sort((left, right) =>
            ComponentGrouping.naturalSort(left.pin, right.pin)
        )

        return {
            refdes,
            design: WebMcpDesignAnalyzer.entryName(entry),
            pins,
            pin_count: pins.length
        }
    }

    /**
     * Compares all schematic nets against PCB pad assignments.
     * @param {object} schematicEntry Loaded schematic entry.
     * @param {object} pcbEntry Loaded PCB entry.
     * @returns {object}
     */
    static compareSchematicPcb(schematicEntry, pcbEntry) {
        const schematicNets = WebMcpDesignInspector.#schematicNetMap(
            schematicEntry.documentModel
        )
        const pcbNets = WebMcpDesignInspector.#pcbNetMap(pcbEntry.documentModel)
        const netNames = WebMcpDesignInspector.#naturalSorted([
            ...new Set([...schematicNets.keys(), ...pcbNets.keys()])
        ])
        const mismatches = []
        let matchedNets = 0
        let schematicOnlyNets = 0
        let pcbOnlyNets = 0

        for (const netName of netNames) {
            const schematicPins = schematicNets.get(netName) || []
            const pcbPads = pcbNets.get(netName) || []
            const missingOnPcb = schematicPins.filter(
                (pin) => !pcbPads.includes(pin)
            )
            const missingOnSchematic = pcbPads.filter(
                (pad) => !schematicPins.includes(pad)
            )

            if (!schematicPins.length) pcbOnlyNets += 1
            if (!pcbPads.length) schematicOnlyNets += 1
            if (!missingOnPcb.length && !missingOnSchematic.length) {
                matchedNets += 1
                continue
            }

            mismatches.push({
                net: netName,
                missing_on_pcb: missingOnPcb,
                missing_on_schematic: missingOnSchematic
            })
        }

        return {
            status: mismatches.length ? 'mismatch' : 'matched',
            schematic: WebMcpDesignAnalyzer.entryName(schematicEntry),
            pcb: WebMcpDesignAnalyzer.entryName(pcbEntry),
            summary: {
                compared_nets: netNames.length,
                matched_nets: matchedNets,
                mismatched_nets: mismatches.length,
                schematic_only_nets: schematicOnlyNets,
                pcb_only_nets: pcbOnlyNets
            },
            mismatches
        }
    }

    /**
     * Summarizes loaded design state for agent planning.
     * @param {object[]} entries Loaded entries.
     * @param {object[]} supportedEntries Supported loaded entries.
     * @returns {{ summary: string, highlights: string[], next_steps: string[] }}
     */
    static summarizeDesign(entries, supportedEntries) {
        const review = WebMcpDesignAnalyzer.review(entries, supportedEntries)
        const issues = WebMcpDesignAnalyzer.auditIssues(supportedEntries)
        const activeEntry = entries.find((entry) => entry.active) || entries[0]
        const metadata = review.metadata_coverage
        const summary =
            String(review.summary.supported_designs) +
            ' supported designs loaded: ' +
            String(review.summary.components) +
            ' components, ' +
            String(review.summary.nets) +
            ' schematic nets, ' +
            String(review.summary.diagnostics) +
            ' diagnostics, and ' +
            String(issues.length) +
            ' audit issues.'

        return {
            summary,
            highlights: [
                'Active design: ' +
                    WebMcpDesignAnalyzer.entryName(activeEntry) +
                    ' (' +
                    String(activeEntry?.fileName || '') +
                    ').',
                'Connectivity is available for ' +
                    String(review.summary.designs_with_connectivity) +
                    ' design.',
                'Metadata coverage: ' +
                    String(metadata.with_mpn) +
                    '/' +
                    String(metadata.components) +
                    ' components have MPNs and ' +
                    String(metadata.with_footprint) +
                    '/' +
                    String(metadata.components) +
                    ' have footprints.'
            ],
            next_steps: [
                'Use compare_schematic_pcb to check schematic and PCB net parity.',
                'Use audit_design for parser, metadata, and connectivity issues.',
                'Use find_components to locate parts by refdes, MPN, value, description, or footprint.'
            ]
        }
    }

    /**
     * Finds components across common metadata fields.
     * @param {object[]} entries Loaded entries.
     * @param {{ query?: string, limit?: number }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    static findComponents(entries, args = {}) {
        const query = String(args.query || '')
            .trim()
            .toLowerCase()
        if (!query) {
            return { error: 'query is required.' }
        }

        const matches = WebMcpDesignInspector.#componentRecords(entries)
            .map((component) => ({
                ...component,
                matched_fields: WebMcpDesignInspector.#matchedFields(
                    component,
                    query
                )
            }))
            .filter((component) => component.matched_fields.length)
            .sort((left, right) =>
                ComponentGrouping.naturalSort(left.refdes, right.refdes)
            )
        const limit = WebMcpDesignInspector.#limit(args.limit, matches.length)
        const components = matches
            .slice(0, limit)
            .map((component) =>
                WebMcpDesignInspector.#withoutUndefined(component)
            )

        return {
            components,
            total_count: matches.length,
            returned_count: components.length,
            limit,
            has_more: components.length < matches.length
        }
    }

    /**
     * Builds a normalized selector from tool args.
     * @param {{ refdes?: string, mpn?: string, pattern?: string }} args Tool args.
     * @returns {{ field: string, value: string } | null}
     */
    static #querySelector(args) {
        for (const field of ['refdes', 'mpn', 'pattern']) {
            const value = String(args?.[field] || '').trim()
            if (value) return { field, value: value.toLowerCase() }
        }

        return null
    }

    /**
     * Returns true when one BOM item matches a selector.
     * @param {object} item BOM item.
     * @param {{ field: string, value: string }} selector Selector.
     * @returns {boolean}
     */
    static #itemMatchesSelector(item, selector) {
        if (selector.field === 'refdes') {
            return item.refdes.toLowerCase() === selector.value
        }
        if (selector.field === 'mpn') {
            return String(item.mpn || '')
                .toLowerCase()
                .includes(selector.value)
        }

        return [
            item.refdes,
            item.mpn,
            item.description,
            item.value,
            item.footprint
        ]
            .join(' ')
            .toLowerCase()
            .includes(selector.value)
    }

    /**
     * Builds normalized BOM item rows.
     * @param {object[]} entries Loaded entries.
     * @returns {object[]}
     */
    static #bomItems(entries) {
        const items = []

        for (const entry of entries) {
            for (const row of entry.documentModel?.bom || []) {
                const designators = WebMcpDesignInspector.#designators(row)
                for (const refdes of designators) {
                    items.push(
                        WebMcpDesignInspector.#withoutUndefined({
                            design: WebMcpDesignAnalyzer.entryName(entry),
                            refdes,
                            designators: [refdes],
                            quantity:
                                Number(row?.quantity) ||
                                designators.length ||
                                1,
                            mpn: WebMcpDesignInspector.#rowMpn(row),
                            description:
                                row?.source || row?.description || row?.comment,
                            value: row?.value,
                            footprint:
                                row?.footprint || row?.package || row?.pattern
                        })
                    )
                }
            }
        }

        return items.sort((left, right) =>
            ComponentGrouping.naturalSort(left.refdes, right.refdes)
        )
    }

    /**
     * Builds component metadata records.
     * @param {object[]} entries Loaded entries.
     * @returns {object[]}
     */
    static #componentRecords(entries) {
        const records = new Map()

        for (const entry of entries) {
            const design = WebMcpDesignAnalyzer.entryName(entry)
            const keyPrefix = (entry.baseName || entry.id) + ':'
            for (const component of entry.documentModel?.schematic
                ?.components || []) {
                WebMcpDesignInspector.#mergeComponentRecord(records, {
                    key: keyPrefix + WebMcpDesignInspector.#refdes(component),
                    design,
                    refdes: WebMcpDesignInspector.#refdes(component),
                    description: component?.description || component?.comment,
                    value: component?.value,
                    mpn: WebMcpDesignInspector.#componentMpn(component)
                })
            }
            for (const component of entry.documentModel?.pcb?.components ||
                []) {
                WebMcpDesignInspector.#mergeComponentRecord(records, {
                    key: keyPrefix + WebMcpDesignInspector.#refdes(component),
                    design,
                    refdes: WebMcpDesignInspector.#refdes(component),
                    description: component?.description || component?.comment,
                    value: component?.value,
                    mpn: WebMcpDesignInspector.#componentMpn(component),
                    footprint:
                        component?.footprint ||
                        component?.package ||
                        component?.pattern
                })
            }
            for (const item of WebMcpDesignInspector.#bomItems([entry])) {
                WebMcpDesignInspector.#mergeComponentRecord(records, {
                    key: keyPrefix + item.refdes,
                    design,
                    refdes: item.refdes,
                    description: item.description,
                    value: item.value,
                    mpn: item.mpn,
                    footprint: item.footprint
                })
            }
        }

        return [...records.values()].filter((record) => record.refdes)
    }

    /**
     * Merges one component metadata record.
     * @param {Map<string, object>} records Records.
     * @param {object} next Next values.
     * @returns {void}
     */
    static #mergeComponentRecord(records, next) {
        if (!next.refdes) return
        const current = records.get(next.key) || {
            design: next.design,
            refdes: next.refdes
        }
        records.set(next.key, {
            design: current.design || next.design,
            refdes: current.refdes || next.refdes,
            mpn:
                WebMcpDesignInspector.#trim(current.mpn) ||
                WebMcpDesignInspector.#trim(next.mpn),
            description:
                WebMcpDesignInspector.#trim(current.description) ||
                WebMcpDesignInspector.#trim(next.description),
            value:
                WebMcpDesignInspector.#trim(current.value) ||
                WebMcpDesignInspector.#trim(next.value),
            footprint:
                WebMcpDesignInspector.#trim(current.footprint) ||
                WebMcpDesignInspector.#trim(next.footprint)
        })
    }

    /**
     * Returns matched component fields.
     * @param {object} component Component row.
     * @param {string} query Lowercase query.
     * @returns {string[]}
     */
    static #matchedFields(component, query) {
        return ['refdes', 'mpn', 'description', 'value', 'footprint'].filter(
            (field) =>
                String(component?.[field] || '')
                    .toLowerCase()
                    .includes(query)
        )
    }

    /**
     * Builds pin connection rows keyed by refdes.
     * @param {object} documentModel Document model.
     * @returns {Record<string, object[]>}
     */
    static #pinConnectionRows(documentModel) {
        const rows = {}

        for (const net of documentModel?.schematic?.nets || []) {
            const netName = String(net?.name || '').trim()
            if (!netName) continue
            for (const pin of net?.pins || []) {
                const refdes = WebMcpDesignInspector.#pinRefdes(pin)
                const pinNumber = WebMcpDesignInspector.#pinNumber(pin)
                if (!refdes || !pinNumber) continue
                rows[refdes] ||= []
                rows[refdes].push(
                    WebMcpDesignInspector.#withoutUndefined({
                        pin: pinNumber,
                        name: WebMcpDesignInspector.#pinName(pin),
                        net: netName
                    })
                )
            }
        }

        return rows
    }

    /**
     * Builds a schematic net-to-pin map.
     * @param {object} documentModel Document model.
     * @returns {Map<string, string[]>}
     */
    static #schematicNetMap(documentModel) {
        const map = new Map()

        for (const net of documentModel?.schematic?.nets || []) {
            const name = String(net?.name || '').trim()
            if (!name) continue
            const pins = []
            for (const pin of net?.pins || []) {
                const refdes = WebMcpDesignInspector.#pinRefdes(pin)
                const pinNumber = WebMcpDesignInspector.#pinNumber(pin)
                if (refdes && pinNumber) pins.push(refdes + '.' + pinNumber)
            }
            map.set(name, WebMcpDesignInspector.#naturalSorted(pins))
        }

        return map
    }

    /**
     * Builds a PCB net-to-pad map.
     * @param {object} documentModel Document model.
     * @returns {Map<string, string[]>}
     */
    static #pcbNetMap(documentModel) {
        const map = new Map()

        for (const net of documentModel?.pcb?.nets || []) {
            const name = String(net?.name || '').trim()
            if (!name) continue
            map.set(name, [
                ...(map.get(name) || []),
                ...WebMcpDesignInspector.#netPads(net)
            ])
        }
        if (map.size) {
            return WebMcpDesignInspector.#sortedNetMap(map)
        }

        for (const component of documentModel?.pcb?.components || []) {
            const refdes = WebMcpDesignInspector.#refdes(component)
            if (!refdes) continue
            for (const pad of component?.pads || []) {
                const netName = String(
                    pad?.net || pad?.netName || pad?.net_name || ''
                ).trim()
                const pinNumber = WebMcpDesignInspector.#pinNumber(pad)
                if (!netName || !pinNumber) continue
                map.set(netName, [
                    ...(map.get(netName) || []),
                    refdes + '.' + pinNumber
                ])
            }
        }

        return WebMcpDesignInspector.#sortedNetMap(map)
    }

    /**
     * Returns a net map with unique naturally sorted node rows.
     * @param {Map<string, string[]>} map Net map.
     * @returns {Map<string, string[]>}
     */
    static #sortedNetMap(map) {
        for (const [name, pads] of map.entries()) {
            map.set(
                name,
                WebMcpDesignInspector.#naturalSorted([...new Set(pads)])
            )
        }

        return map
    }

    /**
     * Returns pad identifiers for one PCB net row.
     * @param {object} net Net row.
     * @returns {string[]}
     */
    static #netPads(net) {
        const pads = []
        for (const pad of [
            ...(Array.isArray(net?.pads) ? net.pads : []),
            ...(Array.isArray(net?.pins) ? net.pins : []),
            ...(Array.isArray(net?.nodes) ? net.nodes : [])
        ]) {
            const refdes = WebMcpDesignInspector.#pinRefdes(pad)
            const pinNumber = WebMcpDesignInspector.#pinNumber(pad)
            if (refdes && pinNumber) pads.push(refdes + '.' + pinNumber)
        }

        return pads
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
     * @param {object} component Component.
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
        const pinNumber = WebMcpDesignInspector.#pinNumber(pin)
        const name = String(pin?.name || '').trim()
        return name && name !== pinNumber ? name : ''
    }

    /**
     * Returns MPN-like metadata from a component row.
     * @param {object} component Component row.
     * @returns {string}
     */
    static #componentMpn(component) {
        return WebMcpDesignInspector.#trim(
            component?.mpn ||
                component?.partNumber ||
                component?.part_number ||
                component?.manufacturerPartNumber ||
                component?.manufacturer_part_number
        )
    }

    /**
     * Returns MPN-like metadata from a BOM row.
     * @param {object} row BOM row.
     * @returns {string}
     */
    static #rowMpn(row) {
        return WebMcpDesignInspector.#trim(
            row?.mpn ||
                row?.partNumber ||
                row?.part_number ||
                row?.manufacturerPartNumber ||
                row?.manufacturer_part_number ||
                row?.pattern
        )
    }

    /**
     * Resolves a positive result limit.
     * @param {unknown} value Raw value.
     * @param {number} fallback Fallback value.
     * @returns {number}
     */
    static #limit(value, fallback) {
        const parsed = Number.parseInt(String(value || ''), 10)
        return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
    }

    /**
     * Returns naturally sorted strings.
     * @param {string[]} values Values.
     * @returns {string[]}
     */
    static #naturalSorted(values) {
        return values
            .filter(Boolean)
            .sort((left, right) => ComponentGrouping.naturalSort(left, right))
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
