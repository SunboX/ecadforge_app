/**
 * Resolves one selected component into symbol, footprint, and diagnostics data.
 */
export class SelectedPartResolver {
    /**
     * Resolves a selected part from a document model.
     * @param {{ documentModel?: object, documents?: { documentModel?: object }[], selectedComponentKey?: string }} options Resolution options.
     * @returns {{ designator: string, symbol: object, footprint: object, diagnostics: object[] }}
     */
    static resolve(options = {}) {
        const documentModel = options.documentModel || {}
        const documentModels = SelectedPartResolver.#documentModels(
            documentModel,
            options.documents
        )
        const designator = String(options.selectedComponentKey || '').trim()
        const schematicComponent = SelectedPartResolver.#findSchematicComponent(
            documentModels,
            designator
        )
        const pcbComponent = SelectedPartResolver.#findPcbComponent(
            documentModels,
            designator
        )
        const diagnostics = []

        if (!designator) {
            diagnostics.push(
                SelectedPartResolver.#diagnostic(
                    'error',
                    'selected_part_missing_selection',
                    'No selected component is available for export.'
                )
            )
        }

        if (!schematicComponent) {
            diagnostics.push(
                SelectedPartResolver.#diagnostic(
                    'error',
                    'selected_part_missing_symbol',
                    'No schematic symbol data was found for the selected component.'
                )
            )
        }

        if (!pcbComponent) {
            diagnostics.push(
                SelectedPartResolver.#diagnostic(
                    'error',
                    'selected_part_missing_footprint',
                    'No PCB footprint data was found for the selected component.'
                )
            )
        }

        return {
            designator,
            symbol: SelectedPartResolver.#buildSymbol(
                schematicComponent?.component || null,
                schematicComponent?.documentModel || documentModel,
                designator
            ),
            footprint: SelectedPartResolver.#buildFootprint(
                pcbComponent?.component || null,
                pcbComponent?.documentModel || documentModel,
                designator
            ),
            diagnostics
        }
    }

    /**
     * Finds one schematic component by selected key.
     * @param {object[]} documentModels Candidate document models.
     * @param {string} designator Selected component key.
     * @returns {{ component: object, documentModel: object } | null}
     */
    static #findSchematicComponent(documentModels, designator) {
        for (const documentModel of documentModels) {
            const component = SelectedPartResolver.#array(
                documentModel?.schematic?.components
            ).find((entry) =>
                SelectedPartResolver.#matchesComponent(entry, designator)
            )
            if (component) return { component, documentModel }
        }

        return null
    }

    /**
     * Finds one PCB component by selected key.
     * @param {object[]} documentModels Candidate document models.
     * @param {string} designator Selected component key.
     * @returns {{ component: object, documentModel: object } | null}
     */
    static #findPcbComponent(documentModels, designator) {
        for (const documentModel of documentModels) {
            const component = SelectedPartResolver.#array(
                documentModel?.pcb?.components
            ).find((entry) =>
                SelectedPartResolver.#matchesComponent(entry, designator)
            )
            if (component) return { component, documentModel }
        }

        return null
    }

    /**
     * Returns true when a component matches the selected key.
     * @param {object} component Candidate component.
     * @param {string} designator Selected key.
     * @returns {boolean}
     */
    static #matchesComponent(component, designator) {
        if (!designator) return false
        const keys = ['designator', 'reference', 'ownerIndex', 'name', 'id']

        return keys.some((key) => String(component?.[key] || '') === designator)
    }

    /**
     * Builds selected symbol export data.
     * @param {object | null} component Schematic component.
     * @param {object} documentModel Document model.
     * @param {string} designator Selected designator.
     * @returns {object}
     */
    static #buildSymbol(component, documentModel, designator) {
        const source = component || {}
        const schematic = documentModel?.schematic || {}
        const ownerKeys = SelectedPartResolver.#schematicOwnerKeys(
            source,
            schematic,
            designator
        )
        const pins = SelectedPartResolver.#array(schematic.pins).filter((pin) =>
            SelectedPartResolver.#pinBelongsTo(pin, ownerKeys)
        )
        const primitives = SelectedPartResolver.#schematicPrimitives(
            schematic,
            ownerKeys
        )

        return {
            name:
                source.libReference ||
                source.source ||
                source.value ||
                source.designator ||
                designator ||
                'Component',
            value: source.value || source.comment || '',
            pins: pins.map((pin, index) => ({
                ...pin,
                name: pin.name || pin.designator || pin.pinName || '',
                number:
                    pin.number ||
                    pin.pinNumber ||
                    pin.designator ||
                    String(index + 1)
            })),
            origin: SelectedPartResolver.#origin(source),
            ownerKeys: [...ownerKeys],
            ...primitives,
            rawNode:
                source.rawNode ||
                source.rawSymbol ||
                source.librarySymbol ||
                null,
            raw: source
        }
    }

    /**
     * Returns true when one schematic pin belongs to the selected component.
     * @param {object} pin Candidate pin.
     * @param {Set<string>} ownerKeys Selected owner keys.
     * @returns {boolean}
     */
    static #pinBelongsTo(pin, ownerKeys) {
        const keys = ['ownerIndex', 'ownerId', 'component', 'designator']

        return keys.some((key) =>
            ownerKeys.has(String(pin?.[key] || '').trim())
        )
    }

    /**
     * Builds selected footprint export data.
     * @param {object | null} component PCB component.
     * @param {object} documentModel Document model.
     * @param {string} designator Selected designator.
     * @returns {object}
     */
    static #buildFootprint(component, documentModel, designator) {
        const source = component || {}
        const pcb = documentModel?.pcb || {}
        const primitiveGroup = SelectedPartResolver.#pcbPrimitiveGroup(
            pcb,
            source,
            designator
        )
        const primitiveSource = primitiveGroup || source

        return {
            name:
                source.pattern ||
                source.footprintName ||
                source.footprint ||
                source.designator ||
                designator ||
                'Component',
            component: SelectedPartResolver.#footprintComponent(source),
            pads: SelectedPartResolver.#ownedPcbPrimitives(
                pcb,
                primitiveSource,
                source,
                'pads'
            ).map((pad, index) => ({
                ...pad,
                number:
                    pad.number ||
                    pad.designator ||
                    pad.name ||
                    String(index + 1),
                x: pad.x,
                y: pad.y,
                width: SelectedPartResolver.#firstFiniteNumber([
                    pad.width,
                    pad.sizeTopX,
                    pad.sizeMidX,
                    pad.sizeBottomX
                ]),
                height: SelectedPartResolver.#firstFiniteNumber([
                    pad.height,
                    pad.sizeTopY,
                    pad.sizeMidY,
                    pad.sizeBottomY
                ])
            })),
            tracks: SelectedPartResolver.#ownedPcbPrimitives(
                pcb,
                primitiveSource,
                source,
                'tracks'
            ),
            arcs: SelectedPartResolver.#ownedPcbPrimitives(
                pcb,
                primitiveSource,
                source,
                'arcs'
            ),
            fills: SelectedPartResolver.#ownedPcbPrimitives(
                pcb,
                primitiveSource,
                source,
                'fills'
            ),
            regions: SelectedPartResolver.#ownedPcbPrimitives(
                pcb,
                primitiveSource,
                source,
                'regions'
            ),
            shapeBasedRegions: SelectedPartResolver.#ownedPcbPrimitives(
                pcb,
                primitiveSource,
                source,
                'shapeBasedRegions'
            ),
            texts: SelectedPartResolver.#ownedPcbPrimitives(
                pcb,
                primitiveSource,
                source,
                'texts'
            ),
            models: SelectedPartResolver.#buildModelReferences(source),
            rawNode:
                source.rawNode ||
                source.rawFootprint ||
                source.kicadFootprintNode ||
                null,
            raw: { ...source, primitiveGroup: primitiveGroup || null }
        }
    }

    /**
     * Builds a component origin descriptor.
     * @param {object} source Source component.
     * @returns {{ x: number, y: number, rotation: number, layer: string }}
     */
    static #footprintComponent(source) {
        return {
            x: SelectedPartResolver.#number(source.x, 0),
            y: SelectedPartResolver.#number(source.y, 0),
            rotation: SelectedPartResolver.#number(source.rotation, 0),
            layer: String(source.layer || '')
        }
    }

    /**
     * Collects schematic owner keys for the selected component.
     * @param {object} component Schematic component.
     * @param {object} schematic Schematic model.
     * @param {string} designator Selected designator.
     * @returns {Set<string>}
     */
    static #schematicOwnerKeys(component, schematic, designator) {
        const ownerKeys = new Set(
            [designator, component.ownerIndex, component.ownerId, component.id]
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        )

        SelectedPartResolver.#addDesignatorTextOwnerKeys(
            ownerKeys,
            schematic,
            designator
        )
        SelectedPartResolver.#addOwnershipRecordOwnerKeys(
            ownerKeys,
            schematic,
            component
        )

        return ownerKeys
    }

    /**
     * Adds owner indexes from visible designator text records.
     * @param {Set<string>} ownerKeys Mutable owner key set.
     * @param {object} schematic Schematic model.
     * @param {string} designator Selected designator.
     * @returns {void}
     */
    static #addDesignatorTextOwnerKeys(ownerKeys, schematic, designator) {
        const selectedDesignator = String(designator || '').trim()
        if (!selectedDesignator) return

        for (const text of SelectedPartResolver.#array(schematic?.texts)) {
            const textValue = String(text?.text || '').trim()
            const textName = String(text?.name || '')
                .trim()
                .toLowerCase()
            const ownerIndex = String(text?.ownerIndex || '').trim()
            if (
                ownerIndex &&
                textValue === selectedDesignator &&
                (!textName || textName === 'designator')
            ) {
                ownerKeys.add(ownerIndex)
            }
        }
    }

    /**
     * Adds owner indexes inferred from schematic ownership records.
     * @param {Set<string>} ownerKeys Mutable owner key set.
     * @param {object} schematic Schematic model.
     * @param {object} component Schematic component.
     * @returns {void}
     */
    static #addOwnershipRecordOwnerKeys(ownerKeys, schematic, component) {
        const uniqueId = String(component?.uniqueId || '').trim()
        if (!uniqueId) return

        for (const record of SelectedPartResolver.#array(
            schematic?.ownership?.records
        )) {
            const recordUniqueId = String(record?.uniqueId || '').trim()
            const recordIndex = Number(record?.recordIndex)
            if (recordUniqueId === uniqueId && Number.isFinite(recordIndex)) {
                ownerKeys.add(String(recordIndex - 1))
            }
        }
    }

    /**
     * Collects owner-linked schematic primitives.
     * @param {object} schematic Schematic model.
     * @param {Set<string>} ownerKeys Selected owner keys.
     * @returns {object}
     */
    static #schematicPrimitives(schematic, ownerKeys) {
        return {
            lines: SelectedPartResolver.#ownedSchematicPrimitives(
                schematic,
                ownerKeys,
                'lines'
            ),
            polygons: SelectedPartResolver.#ownedSchematicPrimitives(
                schematic,
                ownerKeys,
                'polygons'
            ),
            rectangles: SelectedPartResolver.#ownedSchematicPrimitives(
                schematic,
                ownerKeys,
                'rectangles'
            ),
            roundedRectangles: SelectedPartResolver.#ownedSchematicPrimitives(
                schematic,
                ownerKeys,
                'roundedRectangles'
            ),
            ellipses: SelectedPartResolver.#ownedSchematicPrimitives(
                schematic,
                ownerKeys,
                'ellipses'
            ),
            arcs: SelectedPartResolver.#ownedSchematicPrimitives(
                schematic,
                ownerKeys,
                'arcs'
            ),
            texts: SelectedPartResolver.#ownedSchematicPrimitives(
                schematic,
                ownerKeys,
                'texts'
            ).filter((text) => !text.hidden)
        }
    }

    /**
     * Collects one owner-linked schematic primitive list.
     * @param {object} schematic Schematic model.
     * @param {Set<string>} ownerKeys Selected owner keys.
     * @param {string} key Primitive array key.
     * @returns {object[]}
     */
    static #ownedSchematicPrimitives(schematic, ownerKeys, key) {
        return SelectedPartResolver.#array(schematic?.[key]).filter(
            (primitive) =>
                ownerKeys.has(String(primitive?.ownerIndex || '').trim())
        )
    }

    /**
     * Finds a PCB component primitive group for the selected component.
     * @param {object} pcb PCB model.
     * @param {object} component PCB component.
     * @param {string} designator Selected designator.
     * @returns {object | null}
     */
    static #pcbPrimitiveGroup(pcb, component, designator) {
        const componentIndex = Number(component?.componentIndex)
        return (
            SelectedPartResolver.#array(pcb?.componentPrimitiveGroups).find(
                (group) =>
                    (Number.isFinite(componentIndex) &&
                        Number(group?.componentIndex) === componentIndex) ||
                    String(group?.designator || '').trim() === designator
            ) || null
        )
    }

    /**
     * Collects one PCB primitive list owned by the selected component.
     * @param {object} pcb PCB model.
     * @param {object} primitiveSource Component primitive group or source.
     * @param {object} component PCB component.
     * @param {string} key Primitive array key.
     * @returns {object[]}
     */
    static #ownedPcbPrimitives(pcb, primitiveSource, component, key) {
        const direct = SelectedPartResolver.#array(primitiveSource?.[key])
        if (direct.length) return direct

        const componentIndex = Number(component?.componentIndex)
        if (!Number.isFinite(componentIndex)) return []

        return SelectedPartResolver.#array(pcb?.[key]).filter(
            (primitive) =>
                Number(primitive?.componentIndex) === componentIndex ||
                Number(primitive?.ownerIndex) === componentIndex
        )
    }

    /**
     * Builds an origin point from a component.
     * @param {object} source Source component.
     * @returns {{ x: number, y: number }}
     */
    static #origin(source) {
        return {
            x: SelectedPartResolver.#number(source.x, 0),
            y: SelectedPartResolver.#number(source.y, 0)
        }
    }

    /**
     * Builds normalized model references from a PCB component.
     * @param {object} source PCB component source.
     * @returns {object[]}
     */
    static #buildModelReferences(source) {
        const references = [
            ...SelectedPartResolver.#array(source.models),
            ...SelectedPartResolver.#array(source.modelReferences)
        ]

        if (source.modelName || source.modelPath) {
            references.push({
                name: source.modelName || '',
                path: source.modelPath || '',
                transform: source.modelTransform || null
            })
        }

        return references.map((model) => ({
            name: model.name || model.modelName || model.fileName || '',
            path:
                model.path ||
                model.modelPath ||
                model.relativePath ||
                model.sourceUrl ||
                '',
            relativePath: model.relativePath || '',
            format: model.format || '',
            transform: model.transform || model.modelTransform || null,
            raw: model
        }))
    }

    /**
     * Returns the first finite number from a list.
     * @param {unknown[]} values Candidate values.
     * @returns {number | undefined}
     */
    static #firstFiniteNumber(values) {
        for (const value of values) {
            const parsed = Number(value)
            if (Number.isFinite(parsed)) return parsed
        }

        return undefined
    }

    /**
     * Creates one structured diagnostic.
     * @param {string} severity Diagnostic severity.
     * @param {string} code Stable diagnostic code.
     * @param {string} message User-facing message.
     * @returns {{ severity: string, code: string, message: string }}
     */
    static #diagnostic(severity, code, message) {
        return { severity, code, message }
    }

    /**
     * Builds an ordered unique list of session document models.
     * @param {object} activeDocumentModel Active document model.
     * @param {{ documentModel?: object }[] | undefined} documents Session documents.
     * @returns {object[]}
     */
    static #documentModels(activeDocumentModel, documents) {
        const models = [
            activeDocumentModel,
            ...SelectedPartResolver.#array(documents).map(
                (entry) => entry?.documentModel
            )
        ].filter(Boolean)
        const seen = new Set()
        const unique = []

        for (const model of models) {
            if (seen.has(model)) continue
            seen.add(model)
            unique.push(model)
        }

        return unique
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
     * @param {unknown} value Candidate value.
     * @param {number} fallback Fallback value.
     * @returns {number}
     */
    static #number(value, fallback) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : fallback
    }
}
