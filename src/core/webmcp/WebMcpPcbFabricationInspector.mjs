import { ComponentGrouping } from 'altium-toolkit/netlist-query'
import { WebMcpDesignAnalyzer } from './WebMcpDesignAnalyzer.mjs'

/**
 * Builds manufacturing-oriented WebMCP readiness checks for loaded PCBs.
 */
export class WebMcpPcbFabricationInspector {
    /**
     * Reviews loaded PCB data for fabrication-readiness signals.
     * @param {object} entry Loaded PCB entry.
     * @returns {object}
     */
    static review(entry) {
        const pcb = entry.documentModel?.pcb || {}
        const checks = [
            WebMcpPcbFabricationInspector.#boardOutlineCheck(pcb),
            WebMcpPcbFabricationInspector.#layerStackCheck(pcb),
            WebMcpPcbFabricationInspector.#drillDataCheck(pcb),
            WebMcpPcbFabricationInspector.#footprintCheck(pcb),
            WebMcpPcbFabricationInspector.#componentModelCheck(pcb),
            WebMcpPcbFabricationInspector.#pasteMaskCheck(pcb),
            WebMcpPcbFabricationInspector.#silkscreenValueCheck(pcb)
        ]
        const errors = checks.filter((check) => check.status === 'error').length
        const warnings = checks.filter(
            (check) => check.status === 'warning'
        ).length

        return {
            status: errors ? 'error' : warnings ? 'warning' : 'ready',
            design: WebMcpDesignAnalyzer.entryName(entry),
            summary: {
                checks: checks.length,
                passed: checks.filter((check) => check.status === 'pass')
                    .length,
                warnings,
                errors
            },
            checks
        }
    }

    /**
     * Builds the board-outline readiness check.
     * @param {object} pcb PCB model.
     * @returns {object}
     */
    static #boardOutlineCheck(pcb) {
        const outline = pcb.boardOutline || {}
        const evidence = {
            width_mil: WebMcpPcbFabricationInspector.#optionalNumber(
                outline.widthMil
            ),
            height_mil: WebMcpPcbFabricationInspector.#optionalNumber(
                outline.heightMil
            ),
            outline_segments: WebMcpPcbFabricationInspector.#array(
                outline.segments
            ).length
        }
        if (WebMcpPcbFabricationInspector.#outlinePresent(outline)) {
            return {
                code: 'board_outline',
                status: 'pass',
                message: 'Board outline is present.',
                evidence
            }
        }
        return {
            code: 'board_outline',
            status: 'error',
            message: 'Board outline data is missing.',
            evidence
        }
    }

    /**
     * Builds the layer-stack readiness check.
     * @param {object} pcb PCB model.
     * @returns {object}
     */
    static #layerStackCheck(pcb) {
        const layers = WebMcpPcbFabricationInspector.#array(pcb.layers).length
        const copperLayers =
            WebMcpPcbFabricationInspector.#copperLayerCount(pcb)
        if (layers && copperLayers >= 2) {
            return {
                code: 'layer_stack',
                status: 'pass',
                message: String(layers) + ' PCB layers are defined.',
                evidence: { layers, copper_layers: copperLayers }
            }
        }
        return {
            code: 'layer_stack',
            status: layers ? 'warning' : 'error',
            message: 'PCB layer stack data is incomplete.',
            evidence: { layers, copper_layers: copperLayers }
        }
    }

    /**
     * Builds the drill-data readiness check.
     * @param {object} pcb PCB model.
     * @returns {object}
     */
    static #drillDataCheck(pcb) {
        const pads = WebMcpPcbFabricationInspector.#allPads(pcb)
        const vias = WebMcpPcbFabricationInspector.#array(pcb.vias)
        const padHoles = pads.filter((pad) =>
            WebMcpPcbFabricationInspector.#hasHole(pad)
        ).length
        const viaHoles = vias.filter((via) =>
            WebMcpPcbFabricationInspector.#hasHole(via)
        ).length
        const total = padHoles + viaHoles

        return {
            code: 'drill_data',
            status: total ? 'pass' : 'warning',
            message: total
                ? String(total) + ' drill features are present.'
                : 'No drill features were found in PCB pad or via data.',
            evidence: { pad_holes: padHoles, via_holes: viaHoles }
        }
    }

    /**
     * Builds the footprint metadata readiness check.
     * @param {object} pcb PCB model.
     * @returns {object}
     */
    static #footprintCheck(pcb) {
        const missing = WebMcpPcbFabricationInspector.#missingComponentRefdes(
            pcb,
            (component) => !WebMcpPcbFabricationInspector.#footprint(component)
        )
        if (!missing.length) {
            return {
                code: 'footprints',
                status: 'pass',
                message: 'All PCB components have footprint metadata.',
                evidence: { missing: 0 }
            }
        }
        return {
            code: 'footprints',
            status: 'warning',
            message:
                String(missing.length) +
                ' PCB components are missing footprint metadata.',
            refdes: missing
        }
    }

    /**
     * Builds the component-model readiness check.
     * @param {object} pcb PCB model.
     * @returns {object}
     */
    static #componentModelCheck(pcb) {
        const missing = WebMcpPcbFabricationInspector.#missingComponentRefdes(
            pcb,
            (component) =>
                !WebMcpPcbFabricationInspector.#componentModel(component)
        )
        if (!missing.length) {
            return {
                code: 'component_models',
                status: 'pass',
                message: 'All PCB components reference a 3D model.',
                evidence: { missing: 0 }
            }
        }
        return {
            code: 'component_models',
            status: 'warning',
            message:
                String(missing.length) +
                ' PCB components do not reference a 3D model.',
            refdes: missing
        }
    }

    /**
     * Builds the paste/mask readiness check.
     * @param {object} pcb PCB model.
     * @returns {object}
     */
    static #pasteMaskCheck(pcb) {
        const pads = WebMcpPcbFabricationInspector.#allPads(pcb)
        const missing = pads.filter(
            (pad) => !WebMcpPcbFabricationInspector.#hasPasteMaskMetadata(pad)
        ).length
        if (pads.length && !missing) {
            return {
                code: 'paste_mask',
                status: 'pass',
                message: 'Pad paste/mask metadata is available.',
                evidence: { pads: pads.length }
            }
        }
        return {
            code: 'paste_mask',
            status: 'warning',
            message: 'Some PCB pads lack paste or solder-mask metadata.',
            evidence: { pads: pads.length, missing }
        }
    }

    /**
     * Builds the silkscreen value-text readiness check.
     * @param {object} pcb PCB model.
     * @returns {object}
     */
    static #silkscreenValueCheck(pcb) {
        const textValues = new Set(
            WebMcpPcbFabricationInspector.#array(pcb.texts)
                .map((text) => WebMcpPcbFabricationInspector.#trim(text?.text))
                .filter(Boolean)
        )
        const missing = WebMcpPcbFabricationInspector.#missingComponentRefdes(
            pcb,
            (component) => {
                const value = WebMcpPcbFabricationInspector.#trim(
                    component?.value
                )
                return !value || !textValues.has(value)
            }
        )

        if (!missing.length) {
            return {
                code: 'silkscreen_values',
                status: 'pass',
                message: 'Component value text is present in PCB text data.',
                evidence: { missing: 0 }
            }
        }
        return {
            code: 'silkscreen_values',
            status: 'warning',
            message:
                'Component value text was not found for ' +
                String(missing.length) +
                ' PCB components.',
            refdes: missing
        }
    }

    /**
     * Returns missing component refdes values for one predicate.
     * @param {object} pcb PCB model.
     * @param {(component: object) => boolean} predicate Missing predicate.
     * @returns {string[]}
     */
    static #missingComponentRefdes(pcb, predicate) {
        return WebMcpPcbFabricationInspector.#naturalSorted(
            WebMcpPcbFabricationInspector.#array(pcb.components)
                .filter(predicate)
                .map((component) =>
                    WebMcpPcbFabricationInspector.#refdes(component)
                )
                .filter(Boolean)
        )
    }

    /**
     * Returns all PCB pad rows, falling back to component-owned pads.
     * @param {object} pcb PCB model.
     * @returns {object[]}
     */
    static #allPads(pcb) {
        const pads = WebMcpPcbFabricationInspector.#array(pcb.pads)
        if (pads.length) return pads

        return WebMcpPcbFabricationInspector.#array(pcb.components).flatMap(
            (component) =>
                WebMcpPcbFabricationInspector.#array(component?.pads).map(
                    (pad) => ({
                        ...pad,
                        refdes: WebMcpPcbFabricationInspector.#refdes(component)
                    })
                )
        )
    }

    /**
     * Counts copper layers.
     * @param {object} pcb PCB model.
     * @returns {number}
     */
    static #copperLayerCount(pcb) {
        return WebMcpPcbFabricationInspector.#array(pcb.layers).filter(
            (layer) => WebMcpPcbFabricationInspector.#isCopperLayer(layer)
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
     * Returns one component reference designator.
     * @param {object} component Component row.
     * @returns {string}
     */
    static #refdes(component) {
        return WebMcpPcbFabricationInspector.#trim(
            component?.designator || component?.refdes || component?.reference
        )
    }

    /**
     * Returns one component footprint string.
     * @param {object} component Component row.
     * @returns {string}
     */
    static #footprint(component) {
        return WebMcpPcbFabricationInspector.#trim(
            component?.footprint || component?.package || component?.pattern
        )
    }

    /**
     * Returns component model metadata when present.
     * @param {object} component Component row.
     * @returns {object | undefined}
     */
    static #componentModel(component) {
        const model = WebMcpPcbFabricationInspector.#withoutUndefined({
            name:
                WebMcpPcbFabricationInspector.#trim(component?.modelName) ||
                WebMcpPcbFabricationInspector.#trim(component?.model?.name),
            path:
                WebMcpPcbFabricationInspector.#trim(component?.modelPath) ||
                WebMcpPcbFabricationInspector.#trim(component?.model?.path) ||
                WebMcpPcbFabricationInspector.#trim(
                    component?.externalModel?.path
                )
        })
        return Object.keys(model).length ? model : undefined
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
            WebMcpPcbFabricationInspector.#array(outline?.segments).length
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
     * Returns true when a pad has paste and mask metadata.
     * @param {object} pad Pad row.
     * @returns {boolean}
     */
    static #hasPasteMaskMetadata(pad) {
        return (
            Object.hasOwn(pad, 'solderMaskExpansion') &&
            Object.hasOwn(pad, 'solderPasteExpansion')
        )
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
