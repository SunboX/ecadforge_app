import { ComponentGrouping } from 'altium-toolkit/extensions'
import { EcadDocumentBom } from '../ecad/EcadDocumentBom.mjs'
import { EcadDocumentComponents } from '../ecad/EcadDocumentComponents.mjs'
import { EcadDocumentConnectivity } from '../ecad/EcadDocumentConnectivity.mjs'
import { EcadDocumentDiagnostics } from '../ecad/EcadDocumentDiagnostics.mjs'
import { EcadDocumentSummary } from '../ecad/EcadDocumentSummary.mjs'
import { EcadDocumentType } from '../ecad/EcadDocumentType.mjs'

/**
 * Builds WebMCP review, audit, pagination, and cross-reference summaries.
 */
export class WebMcpDesignAnalyzer {
    /**
     * Reviews loaded design coverage for agent planning.
     * @param {object[]} entries Selected loaded entries.
     * @param {object[]} supportedEntries Supported loaded entries.
     * @returns {object}
     */
    static review(entries, supportedEntries) {
        const designs = supportedEntries.map((entry) =>
            WebMcpDesignAnalyzer.#reviewDesignEntry(entry)
        )
        const diagnostics = supportedEntries.reduce(
            (sum, entry) =>
                sum +
                WebMcpDesignAnalyzer.#diagnostics(entry.documentModel).length,
            0
        )

        return {
            summary: {
                loaded_designs: entries.length,
                supported_designs: supportedEntries.length,
                components: designs.reduce(
                    (sum, design) => sum + design.components,
                    0
                ),
                nets: designs.reduce((sum, design) => sum + design.nets, 0),
                diagnostics,
                designs_with_connectivity: designs.filter(
                    (design) => design.hasConnectivity
                ).length
            },
            metadata_coverage:
                WebMcpDesignAnalyzer.#metadataCoverage(supportedEntries),
            designs,
            top_issues: WebMcpDesignAnalyzer.parserIssues(
                supportedEntries
            ).slice(0, 10)
        }
    }

    /**
     * Audits loaded designs for parser, metadata, and connectivity issues.
     * @param {object[]} entries Selected loaded entries.
     * @param {object[]} supportedEntries Supported loaded entries.
     * @param {number} maxIssues Maximum issues to return.
     * @returns {{ summary: object, issues: object[] }}
     */
    static audit(entries, supportedEntries, maxIssues) {
        const issues = WebMcpDesignAnalyzer.auditIssues(supportedEntries).slice(
            0,
            maxIssues
        )

        return {
            summary: {
                designs: entries.length,
                issue_count: issues.length,
                errors: issues.filter((issue) => issue.severity === 'error')
                    .length,
                warnings: issues.filter((issue) => issue.severity === 'warning')
                    .length,
                info: issues.filter((issue) => issue.severity === 'info').length
            },
            issues
        }
    }

    /**
     * Cross-references one schematic net against matching PCB pads.
     * @param {object} schematicEntry Loaded schematic entry.
     * @param {object} pcbEntry Loaded PCB entry.
     * @param {string | undefined} requestedNetName Requested net.
     * @returns {object | { error: string }}
     */
    static crossrefNet(schematicEntry, pcbEntry, requestedNetName) {
        const netName = WebMcpDesignAnalyzer.#resolveCrossrefNetName(
            schematicEntry.documentModel,
            pcbEntry.documentModel,
            requestedNetName
        )
        if (!netName) {
            return {
                error:
                    "Net '" +
                    String(requestedNetName || '') +
                    "' was not found in matching schematic or PCB data."
            }
        }

        const schematicPins = WebMcpDesignAnalyzer.#schematicPinsForNet(
            schematicEntry.documentModel,
            netName
        )
        const pcbPads = WebMcpDesignAnalyzer.#pcbPadsForNet(
            pcbEntry.documentModel,
            netName
        )
        const matched = schematicPins.filter((pin) => pcbPads.includes(pin))
        const missingOnPcb = schematicPins.filter(
            (pin) => !pcbPads.includes(pin)
        )
        const missingOnSchematic = pcbPads.filter(
            (pad) => !schematicPins.includes(pad)
        )

        return {
            net: netName,
            status:
                missingOnPcb.length || missingOnSchematic.length
                    ? 'mismatch'
                    : 'matched',
            schematic: {
                design: WebMcpDesignAnalyzer.entryName(schematicEntry),
                pins: schematicPins,
                pin_count: schematicPins.length
            },
            pcb: {
                design: WebMcpDesignAnalyzer.entryName(pcbEntry),
                pads: pcbPads,
                pad_count: pcbPads.length
            },
            matched,
            missing_on_pcb: missingOnPcb,
            missing_on_schematic: missingOnSchematic
        }
    }

    /**
     * Shapes a list response with optional pagination and compact mode.
     * @param {object} result Query result.
     * @param {string} key List property key.
     * @param {object} args Query args.
     * @param {(item: object) => object} compactMapper Compact mapper.
     * @returns {object}
     */
    static shapeListResult(result, key, args, compactMapper) {
        if (!WebMcpDesignAnalyzer.#hasListOptions(args)) return result
        if (!result || result.error || !Array.isArray(result[key])) {
            return result
        }

        const totalCount = result[key].length
        const offset = WebMcpDesignAnalyzer.#offset(args.offset)
        const limit = WebMcpDesignAnalyzer.#listLimit(
            args.limit,
            totalCount,
            offset
        )
        const items = result[key]
            .slice(offset, offset + limit)
            .map((item) => (args.compact === true ? compactMapper(item) : item))

        return {
            ...result,
            [key]: items,
            total_count: totalCount,
            returned_count: items.length,
            offset,
            limit,
            has_more: offset + items.length < totalCount
        }
    }

    /**
     * Returns a compact component row.
     * @param {object} component Component row.
     * @returns {object}
     */
    static compactComponent(component) {
        return WebMcpDesignAnalyzer.#withoutUndefined({
            refdes: component?.refdes,
            mpn: component?.mpn,
            value: component?.value,
            count: component?.count,
            dns: component?.dns
        })
    }

    /**
     * Builds audit issues from loaded entries.
     * @param {object[]} entries Loaded entries.
     * @returns {object[]}
     */
    static auditIssues(entries) {
        return [
            ...WebMcpDesignAnalyzer.parserIssues(entries),
            ...WebMcpDesignAnalyzer.#duplicateComponentIssues(entries),
            ...WebMcpDesignAnalyzer.#metadataIssues(entries, [
                'mpn',
                'description',
                'value'
            ]),
            ...WebMcpDesignAnalyzer.#connectivityIssues(entries),
            ...WebMcpDesignAnalyzer.#metadataIssues(entries, ['footprint'])
        ]
    }

    /**
     * Builds parser diagnostic issues.
     * @param {object[]} entries Loaded entries.
     * @returns {object[]}
     */
    static parserIssues(entries) {
        const issues = []

        for (const entry of entries) {
            for (const diagnostic of WebMcpDesignAnalyzer.#diagnostics(
                entry.documentModel
            )) {
                issues.push({
                    severity: WebMcpDesignAnalyzer.#severity(
                        diagnostic?.severity
                    ),
                    code: 'parser.diagnostic',
                    design: WebMcpDesignAnalyzer.entryName(entry),
                    message:
                        String(diagnostic?.message || '').trim() ||
                        'Parser diagnostic.'
                })
            }
        }

        return issues
    }

    /**
     * Returns true when a document has schematic nets.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static hasSchematicNets(documentModel) {
        return Boolean(
            EcadDocumentType.isSchematic(documentModel) &&
            EcadDocumentConnectivity.resolve(documentModel).nets.length
        )
    }

    /**
     * Returns true when a document has PCB pads.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static hasPcbPads(documentModel) {
        const summary = EcadDocumentSummary.resolve(documentModel)
        return Boolean(
            EcadDocumentType.isPcb(documentModel) &&
            (summary.padCount ||
                EcadDocumentConnectivity.resolve(documentModel).nets.length)
        )
    }

    /**
     * Returns an entry display name.
     * @param {object} entry Loaded entry.
     * @returns {string}
     */
    static entryName(entry) {
        return (
            EcadDocumentSummary.resolve(entry?.documentModel).title ||
            entry?.baseName ||
            entry?.fileName ||
            entry?.id ||
            'Loaded design'
        )
    }

    /**
     * Builds one design review entry.
     * @param {object} entry Loaded entry.
     * @returns {object}
     */
    static #reviewDesignEntry(entry) {
        const documentModel = entry.documentModel
        const nets = WebMcpDesignAnalyzer.#schematicNetNames(documentModel)

        return {
            id: entry.id,
            name: WebMcpDesignAnalyzer.entryName(entry),
            fileName:
                entry.fileName || EcadDocumentType.fileName(documentModel),
            kind: EcadDocumentType.kind(documentModel),
            sourceFormat: entry.sourceFormat,
            active: entry.active,
            components:
                WebMcpDesignAnalyzer.#documentDesignators(documentModel).size,
            nets: nets.length,
            diagnostics:
                WebMcpDesignAnalyzer.#diagnostics(documentModel).length,
            hasConnectivity: Boolean(nets.length)
        }
    }

    /**
     * Builds metadata coverage over loaded entries.
     * @param {object[]} entries Loaded entries.
     * @returns {object}
     */
    static #metadataCoverage(entries) {
        const components = [
            ...WebMcpDesignAnalyzer.#metadataRecords(entries).values()
        ]

        return {
            components: components.length,
            with_mpn: components.filter((component) => component.mpn).length,
            missing_mpn: components.filter((component) => !component.mpn)
                .length,
            with_description: components.filter(
                (component) => component.description
            ).length,
            missing_description: components.filter(
                (component) => !component.description
            ).length,
            with_value: components.filter((component) => component.value)
                .length,
            missing_value: components.filter((component) => !component.value)
                .length,
            with_footprint: components.filter(
                (component) => component.footprint
            ).length,
            missing_footprint: components.filter(
                (component) => !component.footprint
            ).length
        }
    }

    /**
     * Builds duplicate reference-designator issues.
     * @param {object[]} entries Loaded entries.
     * @returns {object[]}
     */
    static #duplicateComponentIssues(entries) {
        const issues = []

        for (const entry of entries) {
            const counts = new Map()
            for (const refdes of WebMcpDesignAnalyzer.#componentDesignators(
                EcadDocumentComponents.resolve(entry.documentModel)
            )) {
                counts.set(refdes, (counts.get(refdes) || 0) + 1)
            }

            for (const [refdes, count] of counts.entries()) {
                if (count < 2) continue
                issues.push({
                    severity: 'warning',
                    code: 'component.duplicate_refdes',
                    design: WebMcpDesignAnalyzer.entryName(entry),
                    refdes,
                    message:
                        'Reference designator ' +
                        refdes +
                        ' appears ' +
                        String(count) +
                        ' times in the loaded design data.'
                })
            }
        }

        return issues
    }

    /**
     * Builds metadata coverage issues.
     * @param {object[]} entries Loaded entries.
     * @param {string[]} fields Metadata fields.
     * @returns {object[]}
     */
    static #metadataIssues(entries, fields) {
        const issues = []
        const records = [
            ...WebMcpDesignAnalyzer.#metadataRecords(entries).values()
        ].sort((left, right) =>
            ComponentGrouping.naturalSort(left.refdes, right.refdes)
        )

        for (const component of records) {
            for (const field of fields) {
                if (component[field]) continue
                issues.push({
                    severity: 'warning',
                    code: 'metadata.missing_' + field,
                    design: component.design,
                    refdes: component.refdes,
                    message:
                        'Component ' +
                        component.refdes +
                        ' is missing ' +
                        field.replaceAll('_', ' ') +
                        ' metadata.'
                })
            }
        }

        return issues
    }

    /**
     * Builds connectivity issues.
     * @param {object[]} entries Loaded entries.
     * @returns {object[]}
     */
    static #connectivityIssues(entries) {
        const issues = []

        for (const entry of entries) {
            const nets = EcadDocumentConnectivity.resolve(
                entry.documentModel
            ).nets
            if (
                EcadDocumentType.isSchematic(entry.documentModel) &&
                !nets.length
            ) {
                issues.push({
                    severity: 'warning',
                    code: 'connectivity.no_nets',
                    design: WebMcpDesignAnalyzer.entryName(entry),
                    message:
                        'No schematic connectivity is available for this design.'
                })
            }

            for (const net of nets) {
                const pins = Array.isArray(net?.pins) ? net.pins : []
                if (pins.length !== 1) continue
                issues.push({
                    severity: 'warning',
                    code: 'connectivity.single_pin_net',
                    design: WebMcpDesignAnalyzer.entryName(entry),
                    net: String(net?.name || ''),
                    message:
                        'Net ' +
                        String(net?.name || '') +
                        ' has only one connected pin.'
                })
            }
        }

        return issues
    }

    /**
     * Builds merged component metadata records.
     * @param {object[]} entries Loaded entries.
     * @returns {Map<string, object>}
     */
    static #metadataRecords(entries) {
        const records = new Map()

        for (const entry of entries) {
            const designKey = entry.baseName || entry.id
            const design = WebMcpDesignAnalyzer.entryName(entry)
            for (const component of EcadDocumentComponents.resolve(
                entry.documentModel
            )) {
                const refdes = WebMcpDesignAnalyzer.#refdes(component)
                if (!refdes) continue
                WebMcpDesignAnalyzer.#mergeMetadataRecord(records, {
                    key: designKey + ':' + refdes,
                    design,
                    refdes,
                    value: component?.value,
                    description: component?.description || component?.comment,
                    mpn: WebMcpDesignAnalyzer.#componentMpn(component),
                    footprint:
                        component?.footprint ||
                        component?.pattern ||
                        component?.package
                })
            }

            for (const row of EcadDocumentBom.resolve(entry.documentModel)) {
                for (const refdes of row?.designators || []) {
                    const normalizedRefdes = String(refdes || '').trim()
                    if (!normalizedRefdes) continue
                    WebMcpDesignAnalyzer.#mergeMetadataRecord(records, {
                        key: designKey + ':' + normalizedRefdes,
                        design,
                        refdes: normalizedRefdes,
                        value: row?.value,
                        description:
                            row?.source || row?.description || row?.comment,
                        mpn: WebMcpDesignAnalyzer.#rowMpn(row),
                        footprint:
                            row?.footprint || row?.package || row?.pattern
                    })
                }
            }
        }

        return records
    }

    /**
     * Merges one component metadata record.
     * @param {Map<string, object>} records Metadata records.
     * @param {object} next Next record fields.
     * @returns {void}
     */
    static #mergeMetadataRecord(records, next) {
        const current = records.get(next.key) || {
            design: next.design,
            refdes: next.refdes
        }
        records.set(next.key, {
            design: current.design || next.design,
            refdes: current.refdes || next.refdes,
            mpn:
                WebMcpDesignAnalyzer.#trim(current.mpn) ||
                WebMcpDesignAnalyzer.#trim(next.mpn),
            description:
                WebMcpDesignAnalyzer.#trim(current.description) ||
                WebMcpDesignAnalyzer.#trim(next.description),
            value:
                WebMcpDesignAnalyzer.#trim(current.value) ||
                WebMcpDesignAnalyzer.#trim(next.value),
            footprint:
                WebMcpDesignAnalyzer.#trim(current.footprint) ||
                WebMcpDesignAnalyzer.#trim(next.footprint)
        })
    }

    /**
     * Resolves a net name across schematic and PCB data.
     * @param {object} schematicModel Schematic document model.
     * @param {object} pcbModel PCB document model.
     * @param {string | undefined} netName Requested net name.
     * @returns {string}
     */
    static #resolveCrossrefNetName(schematicModel, pcbModel, netName) {
        const requested = String(netName || '')
            .trim()
            .toLowerCase()
        if (!requested) return ''

        return (
            [
                ...WebMcpDesignAnalyzer.#schematicNetNames(schematicModel),
                ...WebMcpDesignAnalyzer.#pcbNetNames(pcbModel)
            ].find((candidate) => candidate.toLowerCase() === requested) || ''
        )
    }

    /**
     * Returns schematic pin identifiers for one net.
     * @param {object} documentModel Document model.
     * @param {string} netName Net name.
     * @returns {string[]}
     */
    static #schematicPinsForNet(documentModel, netName) {
        const pins = new Set()
        const net = EcadDocumentConnectivity.resolve(documentModel).nets.find(
            (candidate) =>
                String(candidate?.name || '').toLowerCase() ===
                String(netName || '').toLowerCase()
        )

        for (const pin of net?.pins || []) {
            const refdes = WebMcpDesignAnalyzer.#pinRefdes(pin)
            const pinNumber = WebMcpDesignAnalyzer.#pinNumber(pin)
            if (refdes && pinNumber) {
                pins.add(refdes + '.' + pinNumber)
            }
        }

        return WebMcpDesignAnalyzer.#naturalSorted([...pins])
    }

    /**
     * Returns PCB pad identifiers for one net.
     * @param {object} documentModel Document model.
     * @param {string} netName Net name.
     * @returns {string[]}
     */
    static #pcbPadsForNet(documentModel, netName) {
        const pads = new Set()
        const normalizedNet = String(netName || '').toLowerCase()

        for (const net of EcadDocumentConnectivity.resolve(documentModel)
            .nets) {
            if (String(net?.name || '').toLowerCase() !== normalizedNet) {
                continue
            }
            for (const pad of [
                ...(Array.isArray(net?.pads) ? net.pads : []),
                ...(Array.isArray(net?.pins) ? net.pins : []),
                ...(Array.isArray(net?.nodes) ? net.nodes : [])
            ]) {
                const refdes = WebMcpDesignAnalyzer.#pinRefdes(pad)
                const pinNumber = WebMcpDesignAnalyzer.#pinNumber(pad)
                if (refdes && pinNumber) {
                    pads.add(refdes + '.' + pinNumber)
                }
            }
        }

        for (const component of EcadDocumentComponents.resolve(documentModel)) {
            const refdes = WebMcpDesignAnalyzer.#refdes(component)
            if (!refdes) continue
            for (const pad of component?.pads || []) {
                if (
                    WebMcpDesignAnalyzer.#padNetName(pad)
                        .toLowerCase()
                        .trim() !== normalizedNet
                ) {
                    continue
                }
                const pinNumber = WebMcpDesignAnalyzer.#pinNumber(pad)
                if (pinNumber) {
                    pads.add(refdes + '.' + pinNumber)
                }
            }
        }

        return WebMcpDesignAnalyzer.#naturalSorted([...pads])
    }

    /**
     * Returns schematic net names.
     * @param {object} documentModel Document model.
     * @returns {string[]}
     */
    static #schematicNetNames(documentModel) {
        return WebMcpDesignAnalyzer.#naturalSorted(
            EcadDocumentConnectivity.resolve(documentModel)
                .nets.map((net) => String(net?.name || '').trim())
                .filter(Boolean)
        )
    }

    /**
     * Returns PCB net names.
     * @param {object} documentModel Document model.
     * @returns {string[]}
     */
    static #pcbNetNames(documentModel) {
        const names = new Set()

        for (const net of EcadDocumentConnectivity.resolve(documentModel)
            .nets) {
            const name = String(net?.name || '').trim()
            if (name) names.add(name)
        }

        for (const component of EcadDocumentComponents.resolve(documentModel)) {
            for (const pad of component?.pads || []) {
                const name = WebMcpDesignAnalyzer.#padNetName(pad)
                if (name) names.add(name)
            }
        }

        return WebMcpDesignAnalyzer.#naturalSorted([...names])
    }

    /**
     * Returns unique designators for one document.
     * @param {object} documentModel Document model.
     * @returns {Set<string>}
     */
    static #documentDesignators(documentModel) {
        return new Set([
            ...WebMcpDesignAnalyzer.#componentDesignators(
                EcadDocumentComponents.resolve(documentModel)
            ),
            ...WebMcpDesignAnalyzer.#bomDesignators(
                EcadDocumentBom.resolve(documentModel)
            )
        ])
    }

    /**
     * Returns component designators from component rows.
     * @param {object[] | undefined} components Component rows.
     * @returns {string[]}
     */
    static #componentDesignators(components) {
        return (Array.isArray(components) ? components : [])
            .map((component) => WebMcpDesignAnalyzer.#refdes(component))
            .filter(Boolean)
    }

    /**
     * Returns component designators from BOM rows.
     * @param {object[] | undefined} bom Bom rows.
     * @returns {string[]}
     */
    static #bomDesignators(bom) {
        return (Array.isArray(bom) ? bom : [])
            .flatMap((row) =>
                Array.isArray(row?.designators) ? row.designators : []
            )
            .map((refdes) => String(refdes || '').trim())
            .filter(Boolean)
    }

    /**
     * Returns parser diagnostics.
     * @param {object} documentModel Document model.
     * @returns {object[]}
     */
    static #diagnostics(documentModel) {
        return EcadDocumentDiagnostics.resolve(documentModel)
    }

    /**
     * Returns a normalized component reference designator.
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
     * Returns a normalized pin reference designator.
     * @param {object} pin Pin or pad row.
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
     * Returns a normalized pin number.
     * @param {object} pin Pin or pad row.
     * @returns {string}
     */
    static #pinNumber(pin) {
        return String(
            pin?.pinNumber ||
                pin?.number ||
                pin?.designator ||
                pin?.pad ||
                pin?.name ||
                ''
        ).trim()
    }

    /**
     * Returns a normalized pad net name.
     * @param {object} pad Pad row.
     * @returns {string}
     */
    static #padNetName(pad) {
        return String(pad?.net || pad?.netName || pad?.net_name || '').trim()
    }

    /**
     * Returns component MPN-like metadata.
     * @param {object} component Component row.
     * @returns {string}
     */
    static #componentMpn(component) {
        return WebMcpDesignAnalyzer.#trim(
            component?.mpn ||
                component?.partNumber ||
                component?.part_number ||
                component?.manufacturerPartNumber ||
                component?.manufacturer_part_number
        )
    }

    /**
     * Returns BOM row MPN-like metadata.
     * @param {object} row BOM row.
     * @returns {string}
     */
    static #rowMpn(row) {
        return WebMcpDesignAnalyzer.#trim(
            row?.mpn ||
                row?.partNumber ||
                row?.part_number ||
                row?.manufacturerPartNumber ||
                row?.manufacturer_part_number ||
                row?.pattern
        )
    }

    /**
     * Returns a normalized severity.
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
     * Returns true when list args request shaping.
     * @param {object} args Query args.
     * @returns {boolean}
     */
    static #hasListOptions(args) {
        return (
            args?.compact === true ||
            args?.limit !== undefined ||
            args?.offset !== undefined
        )
    }

    /**
     * Resolves a list offset.
     * @param {unknown} value Raw value.
     * @returns {number}
     */
    static #offset(value) {
        const parsed = Number.parseInt(String(value || ''), 10)
        return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
    }

    /**
     * Resolves a list limit.
     * @param {unknown} value Raw value.
     * @param {number} totalCount Total items.
     * @param {number} offset Offset.
     * @returns {number}
     */
    static #listLimit(value, totalCount, offset) {
        const parsed = Number.parseInt(String(value || ''), 10)
        if (Number.isInteger(parsed) && parsed > 0) return parsed
        return Math.max(totalCount - offset, 0)
    }

    /**
     * Returns naturally sorted values.
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
