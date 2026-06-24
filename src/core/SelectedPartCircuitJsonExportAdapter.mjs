import { CircuitJsonDocument } from 'circuitjson-toolkit'

/**
 * Builds standards-shaped CircuitJSON for selected-part ZIP exports.
 */
export class SelectedPartCircuitJsonExportAdapter {
    /**
     * Builds a CircuitJSON element array for one selected part.
     * @param {{ designator?: string, symbol?: object, footprint?: object }} selectedPart Selected part data.
     * @param {object} documentModel Active document model.
     * @param {string} partName Export artifact name.
     * @returns {object[]}
     */
    static build(selectedPart, documentModel, partName) {
        const designator = selectedPart.designator || 'selected-part'
        const idToken =
            SelectedPartCircuitJsonExportAdapter.#safeIdentifier(designator)
        const sourceComponentId = 'source_component_' + idToken
        const pcbComponentId = 'pcb_component_' + idToken
        const circuitJson = [
            {
                type: 'source_project_metadata',
                name: documentModel?.fileName || 'Selected part export',
                software_used_string:
                    documentModel?.sourceFormat || documentModel?.fileType || ''
            },
            {
                type: 'source_component',
                source_component_id: sourceComponentId,
                name: partName,
                ftype: 'simple_chip',
                manufacturer_part_number: selectedPart.symbol?.value || '',
                supplier_part_numbers: {}
            },
            {
                type: 'schematic_component',
                schematic_component_id: 'schematic_component_' + idToken,
                source_component_id: sourceComponentId,
                center: { x: 0, y: 0 },
                size: SelectedPartCircuitJsonExportAdapter.#schematicSize(
                    selectedPart
                ),
                rotation: 0
            },
            {
                type: 'pcb_component',
                pcb_component_id: pcbComponentId,
                source_component_id: sourceComponentId,
                center: SelectedPartCircuitJsonExportAdapter.#footprintCenter(
                    selectedPart
                ),
                layer: 'top',
                rotation: 0,
                width: SelectedPartCircuitJsonExportAdapter.#footprintSize(
                    selectedPart
                ).width,
                height: SelectedPartCircuitJsonExportAdapter.#footprintSize(
                    selectedPart
                ).height
            },
            ...SelectedPartCircuitJsonExportAdapter.#sourcePorts(
                selectedPart,
                sourceComponentId
            ),
            ...SelectedPartCircuitJsonExportAdapter.#pcbPads(
                selectedPart,
                pcbComponentId
            )
        ]

        CircuitJsonDocument.assertModel(circuitJson)
        return circuitJson
    }

    /**
     * Builds source port entries.
     * @param {{ symbol?: { pins?: object[] } }} selectedPart Selected part data.
     * @param {string} sourceComponentId Source component id.
     * @returns {object[]}
     */
    static #sourcePorts(selectedPart, sourceComponentId) {
        return SelectedPartCircuitJsonExportAdapter.#array(
            selectedPart.symbol?.pins
        ).map((pin, index) => {
            const pinName = String(pin.name || index + 1)
            const pinNumber = String(pin.number || index + 1)
            const entry = {
                type: 'source_port',
                source_port_id:
                    sourceComponentId +
                    '_port_' +
                    SelectedPartCircuitJsonExportAdapter.#safeIdentifier(
                        pinNumber
                    ),
                source_component_id: sourceComponentId,
                name: pinName,
                port_hints: [pinNumber]
            }
            const numericPinNumber =
                SelectedPartCircuitJsonExportAdapter.#numericPinNumber(
                    pinNumber
                )
            if (numericPinNumber !== null) entry.pin_number = numericPinNumber
            return entry
        })
    }

    /**
     * Builds PCB SMT pad entries.
     * @param {{ footprint?: { pads?: object[] } }} selectedPart Selected part data.
     * @param {string} pcbComponentId PCB component id.
     * @returns {object[]}
     */
    static #pcbPads(selectedPart, pcbComponentId) {
        return SelectedPartCircuitJsonExportAdapter.#array(
            selectedPart.footprint?.pads
        ).map((pad, index) =>
            SelectedPartCircuitJsonExportAdapter.#pcbPad(
                pad,
                index,
                pcbComponentId
            )
        )
    }

    /**
     * Builds one PCB SMT pad entry.
     * @param {object} pad Pad data.
     * @param {number} index Pad index.
     * @param {string} pcbComponentId PCB component id.
     * @returns {object}
     */
    static #pcbPad(pad, index, pcbComponentId) {
        const padNumber = String(pad.number || index + 1)
        const width = SelectedPartCircuitJsonExportAdapter.#number(
            pad.width,
            1
        )
        const height = SelectedPartCircuitJsonExportAdapter.#number(
            pad.height,
            1
        )
        const rotation = SelectedPartCircuitJsonExportAdapter.#number(
            pad.ccw_rotation ?? pad.rotation,
            0
        )
        const shape =
            rotation !== 0
                ? 'rotated_rect'
                : SelectedPartCircuitJsonExportAdapter.#padShape(
                      pad,
                      width,
                      height
                  )
        const entry = {
            type: 'pcb_smtpad',
            shape,
            pcb_smtpad_id:
                pcbComponentId +
                '_pad_' +
                SelectedPartCircuitJsonExportAdapter.#safeIdentifier(
                    padNumber
                ),
            pcb_component_id: pcbComponentId,
            port_hints: [padNumber],
            x: SelectedPartCircuitJsonExportAdapter.#number(pad.x, 0),
            y: SelectedPartCircuitJsonExportAdapter.#number(pad.y, 0),
            layer: SelectedPartCircuitJsonExportAdapter.#padLayer(pad)
        }

        if (shape === 'circle') {
            entry.radius = Math.max(width, height) / 2
        } else {
            entry.width = width
            entry.height = height
        }

        if (shape === 'rotated_rect') entry.ccw_rotation = rotation
        return entry
    }

    /**
     * Resolves the schematic component size.
     * @param {{ symbol?: { pins?: object[] } }} selectedPart Selected part data.
     * @returns {{ width: number, height: number }}
     */
    static #schematicSize(selectedPart) {
        const pinCount = SelectedPartCircuitJsonExportAdapter.#array(
            selectedPart.symbol?.pins
        ).length
        const edge = Math.max(2.54, Math.ceil(Math.sqrt(pinCount || 1)) * 2.54)
        return { width: edge, height: edge }
    }

    /**
     * Resolves footprint size from owned pads.
     * @param {{ footprint?: { pads?: object[] } }} selectedPart Selected part data.
     * @returns {{ width: number, height: number }}
     */
    static #footprintSize(selectedPart) {
        const bounds =
            SelectedPartCircuitJsonExportAdapter.#footprintBounds(selectedPart)
        return {
            width: Math.max(bounds.maxX - bounds.minX, 1),
            height: Math.max(bounds.maxY - bounds.minY, 1)
        }
    }

    /**
     * Resolves footprint center from owned pads.
     * @param {{ footprint?: { pads?: object[] } }} selectedPart Selected part data.
     * @returns {{ x: number, y: number }}
     */
    static #footprintCenter(selectedPart) {
        const bounds =
            SelectedPartCircuitJsonExportAdapter.#footprintBounds(selectedPart)
        return {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2
        }
    }

    /**
     * Resolves footprint pad bounds.
     * @param {{ footprint?: { pads?: object[] } }} selectedPart Selected part data.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #footprintBounds(selectedPart) {
        const pads = SelectedPartCircuitJsonExportAdapter.#array(
            selectedPart.footprint?.pads
        )
        if (!pads.length) return { minX: -0.5, minY: -0.5, maxX: 0.5, maxY: 0.5 }

        return pads.reduce(
            (bounds, pad) => {
                const x = SelectedPartCircuitJsonExportAdapter.#number(
                    pad.x,
                    0
                )
                const y = SelectedPartCircuitJsonExportAdapter.#number(
                    pad.y,
                    0
                )
                const halfWidth =
                    SelectedPartCircuitJsonExportAdapter.#number(
                        pad.width,
                        1
                    ) / 2
                const halfHeight =
                    SelectedPartCircuitJsonExportAdapter.#number(
                        pad.height,
                        1
                    ) / 2
                return {
                    minX: Math.min(bounds.minX, x - halfWidth),
                    minY: Math.min(bounds.minY, y - halfHeight),
                    maxX: Math.max(bounds.maxX, x + halfWidth),
                    maxY: Math.max(bounds.maxY, y + halfHeight)
                }
            },
            {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            }
        )
    }

    /**
     * Resolves an SMT pad shape.
     * @param {object} pad Pad data.
     * @param {number} width Pad width.
     * @param {number} height Pad height.
     * @returns {string}
     */
    static #padShape(pad, width, height) {
        const rawShape = String(
            pad.shape || pad.shapeTopName || pad.shapeName || ''
        ).toLowerCase()
        if (
            rawShape.includes('circle') ||
            rawShape.includes('round') ||
            rawShape.includes('oval')
        ) {
            return width === height ? 'circle' : 'rect'
        }
        return 'rect'
    }

    /**
     * Resolves an SMT pad layer.
     * @param {object} pad Pad data.
     * @returns {string}
     */
    static #padLayer(pad) {
        const layer = String(pad.layer || pad.layerName || '').toLowerCase()
        if (layer.includes('bottom') || layer === 'bottom' || pad.layerId === 32) {
            return 'bottom'
        }
        return 'top'
    }

    /**
     * Returns a number pin when a pin token is numeric.
     * @param {unknown} value Candidate pin number.
     * @returns {number | null}
     */
    static #numericPinNumber(value) {
        const text = String(value || '').trim()
        const parsed = Number(text)
        return text && Number.isFinite(parsed) ? parsed : null
    }

    /**
     * Creates a safe CircuitJSON id token.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #safeIdentifier(value) {
        return String(value || 'selected_part').replace(/[^a-z0-9_]/giu, '_')
    }

    /**
     * Normalizes a possible array.
     * @param {unknown} value Candidate array.
     * @returns {object[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }

    /**
     * Reads a finite number with fallback.
     * @param {unknown} value Candidate number.
     * @param {number} fallback Fallback number.
     * @returns {number}
     */
    static #number(value, fallback) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : fallback
    }
}
