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
        const pins = SelectedPartResolver.#array(
            documentModel?.schematic?.pins
        ).filter((pin) => SelectedPartResolver.#pinBelongsTo(pin, designator))

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
                name: pin.name || pin.designator || pin.pinName || '',
                number:
                    pin.number ||
                    pin.pinNumber ||
                    pin.designator ||
                    String(index + 1)
            })),
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
     * @param {string} designator Selected designator.
     * @returns {boolean}
     */
    static #pinBelongsTo(pin, designator) {
        if (!designator) return false
        const keys = ['ownerIndex', 'ownerId', 'component', 'designator']

        return keys.some((key) => String(pin?.[key] || '') === designator)
    }

    /**
     * Builds selected footprint export data.
     * @param {object | null} component PCB component.
     * @param {string} designator Selected designator.
     * @returns {object}
     */
    static #buildFootprint(component, designator) {
        const source = component || {}

        return {
            name:
                source.pattern ||
                source.footprintName ||
                source.footprint ||
                source.designator ||
                designator ||
                'Component',
            pads: SelectedPartResolver.#array(source.pads).map(
                (pad, index) => ({
                    number:
                        pad.number ||
                        pad.designator ||
                        pad.name ||
                        String(index + 1),
                    x: pad.x,
                    y: pad.y,
                    width: pad.width,
                    height: pad.height
                })
            ),
            models: SelectedPartResolver.#buildModelReferences(source),
            rawNode:
                source.rawNode ||
                source.rawFootprint ||
                source.kicadFootprintNode ||
                null,
            raw: source
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
}
