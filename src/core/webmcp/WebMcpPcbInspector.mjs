import { ComponentGrouping } from 'altium-toolkit/extensions'
import { EcadPcbInspectionModel } from '../ecad/EcadPcbInspectionModel.mjs'
import { WebMcpDesignAnalyzer } from './WebMcpDesignAnalyzer.mjs'
import { WebMcpPcbFabricationInspector } from './WebMcpPcbFabricationInspector.mjs'

/**
 * Builds focused read-only WebMCP responses for loaded PCB documents.
 */
export class WebMcpPcbInspector {
    /**
     * Returns true when a document has inspectable PCB data.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static hasPcbData(documentModel) {
        const pcb = EcadPcbInspectionModel.resolve(documentModel)
        return Boolean(
            pcb &&
            (WebMcpPcbInspector.#array(pcb.components).length ||
                WebMcpPcbInspector.#array(pcb.pads).length ||
                WebMcpPcbInspector.#array(pcb.nets).length ||
                WebMcpPcbInspector.#array(pcb.tracks).length ||
                WebMcpPcbInspector.#array(pcb.vias).length ||
                WebMcpPcbInspector.#array(pcb.layers).length ||
                WebMcpPcbInspector.#outlinePresent(pcb.boardOutline))
        )
    }

    /**
     * Returns placement, pad, and model metadata for one PCB component.
     * @param {object} entry Loaded PCB entry.
     * @param {{ refdes?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    static queryPcbComponent(entry, args = {}) {
        const requestedRefdes = String(args.refdes || '').trim()
        if (!requestedRefdes) return { error: 'refdes is required.' }

        const pcb = EcadPcbInspectionModel.resolve(entry.documentModel)
        const component = WebMcpPcbInspector.#array(pcb.components).find(
            (candidate) =>
                WebMcpPcbInspector.#refdes(candidate).toLowerCase() ===
                requestedRefdes.toLowerCase()
        )
        if (!component) {
            return {
                error:
                    "PCB component '" +
                    requestedRefdes +
                    "' was not found in loaded PCB data."
            }
        }

        const position = WebMcpPcbInspector.#position(component)
        const model = WebMcpPcbInspector.#componentModel(component)
        const pads = WebMcpPcbInspector.#componentPads(pcb, component).map(
            (pad) =>
                WebMcpPcbInspector.#withoutUndefined({
                    pad: WebMcpPcbInspector.#pinNumber(pad),
                    net: WebMcpPcbInspector.#netName(pad)
                })
        )

        return WebMcpPcbInspector.#withoutUndefined({
            refdes: WebMcpPcbInspector.#refdes(component),
            design: WebMcpDesignAnalyzer.entryName(entry),
            footprint: WebMcpPcbInspector.#footprint(component),
            side: WebMcpPcbInspector.#componentSide(component),
            layer: WebMcpPcbInspector.#trim(component?.layer),
            position_mil: position,
            rotation_deg: WebMcpPcbInspector.#optionalNumber(
                component?.rotation ?? component?.rotationDeg
            ),
            pads,
            pad_count: pads.length,
            model
        })
    }

    /**
     * Returns physical PCB membership for one net.
     * @param {object} entry Loaded PCB entry.
     * @param {{ net_name?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    static queryPcbNet(entry, args = {}) {
        const netName = WebMcpPcbInspector.#resolveNetName(
            EcadPcbInspectionModel.resolve(entry.documentModel),
            args.net_name
        )
        if (!String(args.net_name || '').trim()) {
            return { error: 'net_name is required.' }
        }
        if (!netName) {
            return {
                error:
                    "PCB net '" +
                    String(args.net_name || '') +
                    "' was not found in loaded PCB data."
            }
        }

        const pcb = EcadPcbInspectionModel.resolve(entry.documentModel)
        const pads = WebMcpPcbInspector.#netPads(pcb, netName)
        const tracks = WebMcpPcbInspector.#netTracks(pcb, netName)
        const vias = WebMcpPcbInspector.#netVias(pcb, netName)
        const zones = WebMcpPcbInspector.#netZones(pcb, netName)

        return {
            net: netName,
            design: WebMcpDesignAnalyzer.entryName(entry),
            layers: WebMcpPcbInspector.#naturalSorted([
                ...new Set(
                    [...pads, ...tracks, ...vias, ...zones]
                        .map((item) => item.layer)
                        .filter(Boolean)
                )
            ]),
            pads,
            pad_count: pads.length,
            tracks,
            track_count: tracks.length,
            vias,
            via_count: vias.length,
            zones,
            zone_count: zones.length
        }
    }

    /**
     * Summarizes loaded PCB board, placement, routing, and stackup metadata.
     * @param {object} entry Loaded PCB entry.
     * @returns {object}
     */
    static summarizePcb(entry) {
        const pcb = EcadPcbInspectionModel.resolve(entry.documentModel)
        const pads = WebMcpPcbInspector.#allPads(pcb)
        const vias = WebMcpPcbInspector.#array(pcb.vias)
        const layers = WebMcpPcbInspector.#layerNames(pcb)
        const sideCounts = WebMcpPcbInspector.#componentSideCounts(
            WebMcpPcbInspector.#array(pcb.components)
        )

        return {
            design: WebMcpDesignAnalyzer.entryName(entry),
            fileName: entry.fileName,
            sourceFormat: entry.sourceFormat,
            board: WebMcpPcbInspector.#boardSummary(pcb.boardOutline || {}),
            counts: {
                components: WebMcpPcbInspector.#array(pcb.components).length,
                nets: WebMcpPcbInspector.#array(pcb.nets).length,
                pads: pads.length,
                tracks: WebMcpPcbInspector.#array(pcb.tracks).length,
                vias: vias.length,
                zones: WebMcpPcbInspector.#zones(pcb).length,
                layers: layers.length
            },
            components: sideCounts,
            drills: {
                pad_holes: pads.filter((pad) =>
                    WebMcpPcbInspector.#hasHole(pad)
                ).length,
                via_holes: vias.filter((via) =>
                    WebMcpPcbInspector.#hasHole(via)
                ).length,
                total_holes:
                    pads.filter((pad) => WebMcpPcbInspector.#hasHole(pad))
                        .length +
                    vias.filter((via) => WebMcpPcbInspector.#hasHole(via))
                        .length
            },
            stackup: {
                layer_count: layers.length,
                copper_layers: WebMcpPcbInspector.#copperLayerCount(pcb),
                layers
            }
        }
    }

    /**
     * Lists compact normalized PCB design rules.
     * @param {object} entry Loaded PCB entry.
     * @returns {object}
     */
    static listDesignRules(entry) {
        const rules = WebMcpPcbInspector.#ruleRows(
            EcadPcbInspectionModel.resolve(entry.documentModel)
        )
            .map((rule) => WebMcpPcbInspector.#compactRule(rule))
            .sort((left, right) =>
                WebMcpPcbInspector.#ruleSortKey(left).localeCompare(
                    WebMcpPcbInspector.#ruleSortKey(right)
                )
            )

        return {
            design: WebMcpDesignAnalyzer.entryName(entry),
            summary: {
                rule_count: rules.length,
                enabled_rules: rules.filter((rule) => rule.enabled !== false)
                    .length,
                disabled_rules: rules.filter((rule) => rule.enabled === false)
                    .length,
                categories: WebMcpPcbInspector.#countBy(
                    rules.map((rule) => rule.category).filter(Boolean)
                ),
                kinds: WebMcpPcbInspector.#countBy(
                    rules.map((rule) => rule.kind).filter(Boolean)
                )
            },
            rules
        }
    }

    /**
     * Reviews board data for fabrication-readiness signals.
     * @param {object} entry Loaded PCB entry.
     * @returns {object}
     */
    static reviewFabricationReadiness(entry) {
        return WebMcpPcbFabricationInspector.review(entry)
    }

    /**
     * Builds compact rows for pads belonging to one component.
     * @param {object} pcb PCB model.
     * @param {object} component Component row.
     * @returns {object[]}
     */
    static #componentPads(pcb, component) {
        const refdes = WebMcpPcbInspector.#refdes(component)
        const componentPads = WebMcpPcbInspector.#array(component?.pads)
        const pads = componentPads.length
            ? componentPads
            : WebMcpPcbInspector.#allPads(pcb).filter(
                  (pad) =>
                      WebMcpPcbInspector.#pinRefdes(pad).toLowerCase() ===
                      refdes.toLowerCase()
              )

        return WebMcpPcbInspector.#uniqueRows(
            pads,
            (pad) =>
                WebMcpPcbInspector.#pinNumber(pad) +
                ':' +
                WebMcpPcbInspector.#netName(pad)
        ).sort((left, right) =>
            ComponentGrouping.naturalSort(
                WebMcpPcbInspector.#pinNumber(left),
                WebMcpPcbInspector.#pinNumber(right)
            )
        )
    }

    /**
     * Resolves a PCB net name case-insensitively.
     * @param {object} pcb PCB model.
     * @param {string | undefined} requestedNet Requested net.
     * @returns {string}
     */
    static #resolveNetName(pcb, requestedNet) {
        const normalized = String(requestedNet || '')
            .trim()
            .toLowerCase()
        if (!normalized) return ''

        return (
            WebMcpPcbInspector.#netNameCandidates(pcb).find(
                (candidate) => candidate.toLowerCase() === normalized
            ) || ''
        )
    }

    /**
     * Returns all known PCB net names.
     * @param {object} pcb PCB model.
     * @returns {string[]}
     */
    static #netNameCandidates(pcb) {
        return WebMcpPcbInspector.#naturalSorted([
            ...new Set(
                [
                    ...WebMcpPcbInspector.#array(pcb.nets).map((net) =>
                        WebMcpPcbInspector.#trim(net?.name)
                    ),
                    ...WebMcpPcbInspector.#allPads(pcb).map((pad) =>
                        WebMcpPcbInspector.#netName(pad)
                    ),
                    ...WebMcpPcbInspector.#array(pcb.tracks).map((track) =>
                        WebMcpPcbInspector.#netName(track)
                    ),
                    ...WebMcpPcbInspector.#array(pcb.vias).map((via) =>
                        WebMcpPcbInspector.#netName(via)
                    ),
                    ...WebMcpPcbInspector.#zones(pcb).map((zone) =>
                        WebMcpPcbInspector.#netName(zone)
                    )
                ].filter(Boolean)
            )
        ])
    }

    /**
     * Returns compact PCB pad rows for one net.
     * @param {object} pcb PCB model.
     * @param {string} netName Net name.
     * @returns {object[]}
     */
    static #netPads(pcb, netName) {
        const netPads = WebMcpPcbInspector.#array(pcb.nets)
            .filter(
                (net) =>
                    WebMcpPcbInspector.#trim(net?.name).toLowerCase() ===
                    netName.toLowerCase()
            )
            .flatMap((net) => [
                ...WebMcpPcbInspector.#array(net?.pads),
                ...WebMcpPcbInspector.#array(net?.pins),
                ...WebMcpPcbInspector.#array(net?.nodes)
            ])
            .map((pad) => WebMcpPcbInspector.#enrichNetPad(pcb, pad, netName))

        const explicitPads = WebMcpPcbInspector.#allPads(pcb)
            .filter(
                (pad) =>
                    WebMcpPcbInspector.#netName(pad).toLowerCase() ===
                    netName.toLowerCase()
            )
            .map((pad) => WebMcpPcbInspector.#compactNetPad(pad))

        return WebMcpPcbInspector.#uniqueRows(
            [...netPads, ...explicitPads],
            (pad) => pad.refdes + '.' + pad.pad
        )
            .filter((pad) => pad.refdes && pad.pad)
            .sort((left, right) =>
                ComponentGrouping.naturalSort(
                    left.refdes + '.' + left.pad,
                    right.refdes + '.' + right.pad
                )
            )
    }

    /**
     * Enriches a net-owned pad row with global pad metadata when available.
     * @param {object} pcb PCB model.
     * @param {object} pad Net pad row.
     * @param {string} netName Net name.
     * @returns {object}
     */
    static #enrichNetPad(pcb, pad, netName) {
        const refdes = WebMcpPcbInspector.#pinRefdes(pad)
        const pinNumber = WebMcpPcbInspector.#pinNumber(pad)
        const globalPad = WebMcpPcbInspector.#allPads(pcb).find(
            (candidate) =>
                WebMcpPcbInspector.#pinRefdes(candidate) === refdes &&
                WebMcpPcbInspector.#pinNumber(candidate) === pinNumber
        )

        return WebMcpPcbInspector.#compactNetPad({
            ...globalPad,
            ...pad,
            net: netName
        })
    }

    /**
     * Builds one compact net pad row.
     * @param {object} pad Pad row.
     * @returns {object}
     */
    static #compactNetPad(pad) {
        return WebMcpPcbInspector.#withoutUndefined({
            refdes: WebMcpPcbInspector.#pinRefdes(pad),
            pad: WebMcpPcbInspector.#pinNumber(pad),
            layer: WebMcpPcbInspector.#layerName(pad)
        })
    }

    /**
     * Returns compact track rows for one net.
     * @param {object} pcb PCB model.
     * @param {string} netName Net name.
     * @returns {object[]}
     */
    static #netTracks(pcb, netName) {
        return WebMcpPcbInspector.#array(pcb.tracks)
            .filter(
                (track) =>
                    WebMcpPcbInspector.#netName(track).toLowerCase() ===
                    netName.toLowerCase()
            )
            .map((track) =>
                WebMcpPcbInspector.#withoutUndefined({
                    layer: WebMcpPcbInspector.#layerName(track),
                    width_mil: WebMcpPcbInspector.#optionalNumber(track?.width)
                })
            )
    }

    /**
     * Returns compact via rows for one net.
     * @param {object} pcb PCB model.
     * @param {string} netName Net name.
     * @returns {object[]}
     */
    static #netVias(pcb, netName) {
        return WebMcpPcbInspector.#array(pcb.vias)
            .filter(
                (via) =>
                    WebMcpPcbInspector.#netName(via).toLowerCase() ===
                    netName.toLowerCase()
            )
            .map((via) =>
                WebMcpPcbInspector.#withoutUndefined({
                    layer: WebMcpPcbInspector.#layerName(via),
                    x_mil: WebMcpPcbInspector.#optionalNumber(via?.x),
                    y_mil: WebMcpPcbInspector.#optionalNumber(via?.y),
                    diameter_mil: WebMcpPcbInspector.#optionalNumber(
                        via?.diameter
                    ),
                    hole_diameter_mil: WebMcpPcbInspector.#optionalNumber(
                        via?.holeDiameter ?? via?.drill
                    )
                })
            )
    }

    /**
     * Returns compact copper zone rows for one net.
     * @param {object} pcb PCB model.
     * @param {string} netName Net name.
     * @returns {object[]}
     */
    static #netZones(pcb, netName) {
        return WebMcpPcbInspector.#zones(pcb)
            .filter(
                (zone) =>
                    WebMcpPcbInspector.#netName(zone).toLowerCase() ===
                    netName.toLowerCase()
            )
            .map((zone) =>
                WebMcpPcbInspector.#withoutUndefined({
                    layer: WebMcpPcbInspector.#layerName(zone),
                    type: WebMcpPcbInspector.#trim(zone?.type)
                })
            )
    }

    /**
     * Builds a compact board outline summary.
     * @param {object} outline Board outline row.
     * @returns {object}
     */
    static #boardSummary(outline) {
        return {
            width_mil: WebMcpPcbInspector.#optionalNumber(outline?.widthMil),
            height_mil: WebMcpPcbInspector.#optionalNumber(outline?.heightMil),
            outline_segments: WebMcpPcbInspector.#array(outline?.segments)
                .length,
            cutouts: WebMcpPcbInspector.#array(outline?.cutouts).length
        }
    }

    /**
     * Counts components by board side.
     * @param {object[]} components Component rows.
     * @returns {{ top: number, bottom: number, unknown: number }}
     */
    static #componentSideCounts(components) {
        const counts = { top: 0, bottom: 0, unknown: 0 }
        for (const component of components) {
            const side = WebMcpPcbInspector.#componentSide(component)
            if (side === 'top' || side === 'bottom') counts[side] += 1
            else counts.unknown += 1
        }
        return counts
    }

    /**
     * Returns normalized layer display names.
     * @param {object} pcb PCB model.
     * @returns {string[]}
     */
    static #layerNames(pcb) {
        return WebMcpPcbInspector.#array(pcb.layers).map((layer) =>
            WebMcpPcbInspector.#layerDisplayName(layer)
        )
    }

    /**
     * Counts copper layers.
     * @param {object} pcb PCB model.
     * @returns {number}
     */
    static #copperLayerCount(pcb) {
        return WebMcpPcbInspector.#array(pcb.layers).filter((layer) =>
            WebMcpPcbInspector.#isCopperLayer(layer)
        ).length
    }

    /**
     * Returns true when one layer is copper.
     * @param {object} layer Layer row.
     * @returns {boolean}
     */
    static #isCopperLayer(layer) {
        const text = [
            layer?.role,
            layer?.layerClass,
            layer?.name,
            layer?.displayName,
            layer?.canonicalName
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        return /\bcopper\b|\.cu\b|top layer|bottom layer/u.test(text)
    }

    /**
     * Returns compact raw design-rule rows.
     * @param {object} pcb PCB model.
     * @returns {object[]}
     */
    static #ruleRows(pcb) {
        return [
            ...WebMcpPcbInspector.#array(pcb.rules),
            ...WebMcpPcbInspector.#array(pcb.ruleReadModel?.rules),
            ...WebMcpPcbInspector.#array(pcb.designRules?.rules)
        ]
    }

    /**
     * Builds one compact design-rule row.
     * @param {object} rule Rule row.
     * @returns {object}
     */
    static #compactRule(rule) {
        return WebMcpPcbInspector.#withoutUndefined({
            name: WebMcpPcbInspector.#trim(rule?.name),
            kind: WebMcpPcbInspector.#ruleKind(rule),
            category: WebMcpPcbInspector.#ruleCategory(rule),
            enabled:
                typeof rule?.enabled === 'boolean' ? rule.enabled : undefined,
            priority: WebMcpPcbInspector.#optionalNumber(rule?.priority),
            scope: WebMcpPcbInspector.#ruleScope(rule),
            constraints: WebMcpPcbInspector.#ruleConstraints(rule)
        })
    }

    /**
     * Builds a stable sort key for one compact rule.
     * @param {object} rule Compact rule.
     * @returns {string}
     */
    static #ruleSortKey(rule) {
        return String(rule.priority ?? 9999).padStart(4, '0') + ':' + rule.name
    }

    /**
     * Returns a normalized design-rule kind.
     * @param {object} rule Rule row.
     * @returns {string}
     */
    static #ruleKind(rule) {
        return WebMcpPcbInspector.#trim(
            rule?.ruleType?.kind || rule?.kind || rule?.ruleKind
        ).toLowerCase()
    }

    /**
     * Returns a normalized design-rule category.
     * @param {object} rule Rule row.
     * @returns {string}
     */
    static #ruleCategory(rule) {
        return WebMcpPcbInspector.#trim(
            rule?.ruleType?.category || rule?.category
        ).toLowerCase()
    }

    /**
     * Returns one rule scope expression.
     * @param {object} rule Rule row.
     * @returns {string}
     */
    static #ruleScope(rule) {
        return WebMcpPcbInspector.#trim(
            rule?.scope1Expression ||
                rule?.condition ||
                rule?.scope ||
                rule?.scope1?.rawExpression
        )
    }

    /**
     * Returns compact rule constraints.
     * @param {object} rule Rule row.
     * @returns {object | undefined}
     */
    static #ruleConstraints(rule) {
        if (
            rule?.typedConstraints &&
            Object.keys(rule.typedConstraints).length
        ) {
            return rule.typedConstraints
        }
        if (
            rule?.constraintValues &&
            Object.keys(rule.constraintValues).length
        ) {
            return rule.constraintValues
        }
        if (Array.isArray(rule?.constraints)) {
            return { rows: rule.constraints }
        }
        if (rule?.constraints && Object.keys(rule.constraints).length) {
            return rule.constraints
        }
        return undefined
    }

    /**
     * Returns all PCB pad rows, falling back to component-owned pads.
     * @param {object} pcb PCB model.
     * @returns {object[]}
     */
    static #allPads(pcb) {
        const pads = WebMcpPcbInspector.#array(pcb.pads)
        if (pads.length) return pads

        return WebMcpPcbInspector.#array(pcb.components).flatMap((component) =>
            WebMcpPcbInspector.#array(component?.pads).map((pad) => ({
                ...pad,
                refdes: WebMcpPcbInspector.#refdes(component)
            }))
        )
    }

    /**
     * Returns all copper-zone-like PCB rows.
     * @param {object} pcb PCB model.
     * @returns {object[]}
     */
    static #zones(pcb) {
        return [
            ...WebMcpPcbInspector.#array(pcb.zones),
            ...WebMcpPcbInspector.#array(pcb.fills),
            ...WebMcpPcbInspector.#array(pcb.polygons),
            ...WebMcpPcbInspector.#array(pcb.regions)
        ]
    }

    /**
     * Returns one component reference designator.
     * @param {object} value Component or pad row.
     * @returns {string}
     */
    static #refdes(value) {
        return WebMcpPcbInspector.#trim(
            value?.designator || value?.refdes || value?.reference
        )
    }

    /**
     * Returns one pad's owning reference designator.
     * @param {object} value Pad row.
     * @returns {string}
     */
    static #pinRefdes(value) {
        return WebMcpPcbInspector.#trim(
            value?.refdes ||
                value?.componentRefdes ||
                value?.componentDesignator ||
                value?.ownerDesignator ||
                value?.reference
        )
    }

    /**
     * Returns one pad or pin number.
     * @param {object} value Pad row.
     * @returns {string}
     */
    static #pinNumber(value) {
        return WebMcpPcbInspector.#trim(
            value?.pinNumber || value?.number || value?.designator || value?.pad
        )
    }

    /**
     * Returns one row's net name.
     * @param {object} value Net-owned row.
     * @returns {string}
     */
    static #netName(value) {
        return WebMcpPcbInspector.#trim(
            value?.net || value?.netName || value?.name || value?.net_name
        )
    }

    /**
     * Returns one component footprint string.
     * @param {object} component Component row.
     * @returns {string}
     */
    static #footprint(component) {
        return WebMcpPcbInspector.#trim(
            component?.footprint || component?.package || component?.pattern
        )
    }

    /**
     * Returns one component board side.
     * @param {object} component Component row.
     * @returns {'top' | 'bottom' | ''}
     */
    static #componentSide(component) {
        const side = WebMcpPcbInspector.#trim(
            component?.side || component?.mountSide || component?.layer
        ).toLowerCase()
        if (side.includes('bottom') || side === 'b' || side.startsWith('b.')) {
            return 'bottom'
        }
        if (side.includes('top') || side === 'f' || side.startsWith('f.')) {
            return 'top'
        }
        return ''
    }

    /**
     * Returns one component position when present.
     * @param {object} component Component row.
     * @returns {{ x: number, y: number } | undefined}
     */
    static #position(component) {
        const x = WebMcpPcbInspector.#optionalNumber(
            component?.x ?? component?.position?.x
        )
        const y = WebMcpPcbInspector.#optionalNumber(
            component?.y ?? component?.position?.y
        )
        if (x === undefined || y === undefined) return undefined
        return { x, y }
    }

    /**
     * Returns component model metadata when present.
     * @param {object} component Component row.
     * @returns {{ name?: string, path?: string } | undefined}
     */
    static #componentModel(component) {
        const model = WebMcpPcbInspector.#withoutUndefined({
            name:
                WebMcpPcbInspector.#trim(component?.modelName) ||
                WebMcpPcbInspector.#trim(component?.model?.name),
            path:
                WebMcpPcbInspector.#trim(component?.modelPath) ||
                WebMcpPcbInspector.#trim(component?.model?.path) ||
                WebMcpPcbInspector.#trim(component?.externalModel?.path)
        })
        return Object.keys(model).length ? model : undefined
    }

    /**
     * Returns one primitive layer name.
     * @param {object} value Primitive row.
     * @returns {string}
     */
    static #layerName(value) {
        return WebMcpPcbInspector.#trim(
            value?.layer ||
                value?.layerName ||
                value?.displayName ||
                value?.canonicalName
        )
    }

    /**
     * Returns one layer display name.
     * @param {object} layer Layer row.
     * @returns {string}
     */
    static #layerDisplayName(layer) {
        return WebMcpPcbInspector.#trim(
            layer?.displayName || layer?.userName || layer?.name
        )
    }

    /**
     * Returns true when an outline is present.
     * @param {object} outline Board outline row.
     * @returns {boolean}
     */
    static #outlinePresent(outline) {
        return Boolean(
            Number(outline?.widthMil || 0) > 0 ||
            Number(outline?.heightMil || 0) > 0 ||
            WebMcpPcbInspector.#array(outline?.segments).length
        )
    }

    /**
     * Returns true when a pad or via has a drill hole.
     * @param {object} value Pad or via row.
     * @returns {boolean}
     */
    static #hasHole(value) {
        return Boolean(
            Number(value?.holeDiameter || 0) > 0 ||
            Number(value?.drill || 0) > 0 ||
            Number(value?.holeSize || 0) > 0
        )
    }

    /**
     * Returns unique rows using a caller-provided key.
     * @param {object[]} rows Rows.
     * @param {(row: object) => string} keyFor Key builder.
     * @returns {object[]}
     */
    static #uniqueRows(rows, keyFor) {
        const byKey = new Map()
        for (const row of rows) {
            const key = keyFor(row)
            if (!key || byKey.has(key)) continue
            byKey.set(key, row)
        }
        return [...byKey.values()]
    }

    /**
     * Counts string values.
     * @param {string[]} values Values.
     * @returns {Record<string, number>}
     */
    static #countBy(values) {
        const counts = {}
        for (const value of values) {
            counts[value] = (counts[value] || 0) + 1
        }
        return counts
    }

    /**
     * Returns an array value or an empty array.
     * @param {unknown} value Raw value.
     * @returns {unknown[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }

    /**
     * Returns a finite number or undefined.
     * @param {unknown} value Raw value.
     * @returns {number | undefined}
     */
    static #optionalNumber(value) {
        const number = Number(value)
        return Number.isFinite(number) ? number : undefined
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
