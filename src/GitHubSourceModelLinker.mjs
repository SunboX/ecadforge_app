/**
 * Applies GitHub source companion metadata to parser results.
 */
export class GitHubSourceModelLinker {
    /**
     * Applies discovered model references and companion assets in place.
     * @param {{ documents?: object[], assets?: object[] }} parseResult Parse result.
     * @param {{ assets?: object[], modelReferences?: object[] }} source Source descriptor.
     * @returns {void}
     */
    static apply(parseResult, source) {
        GitHubSourceModelLinker.#applyModelReferences(
            parseResult,
            source?.modelReferences || []
        )
        parseResult.assets = [
            ...(parseResult.assets || []),
            ...(source?.assets || [])
        ]
    }

    /**
     * Applies companion model references to matching normalized PCB components.
     * @param {{ documents?: object[] }} parseResult Parse result.
     * @param {{ designator?: string, modelName?: string, modelPath?: string, modelTransform?: object }[]} modelReferences Model references.
     * @returns {void}
     */
    static #applyModelReferences(parseResult, modelReferences) {
        const referencesByDesignator =
            GitHubSourceModelLinker.#indexReferences(modelReferences)

        ;(parseResult?.documents || []).forEach((documentModel) => {
            const components = Array.isArray(documentModel?.pcb?.components)
                ? documentModel.pcb.components
                : []

            components.forEach((component) => {
                GitHubSourceModelLinker.#applyComponentReference(
                    component,
                    referencesByDesignator.get(
                        String(component?.designator || '').trim()
                    )
                )
            })
        })
    }

    /**
     * Builds a first-reference-wins designator index.
     * @param {{ designator?: string }[]} modelReferences Model references.
     * @returns {Map<string, object>}
     */
    static #indexReferences(modelReferences) {
        const referencesByDesignator = new Map()
        ;(modelReferences || []).forEach((modelReference) => {
            const designator = String(modelReference?.designator || '').trim()
            if (designator && !referencesByDesignator.has(designator)) {
                referencesByDesignator.set(designator, modelReference)
            }
        })

        return referencesByDesignator
    }

    /**
     * Applies one model reference to a normalized component.
     * @param {object} component Normalized component.
     * @param {{ modelName?: string, modelPath?: string, modelTransform?: object } | undefined} modelReference Model reference.
     * @returns {void}
     */
    static #applyComponentReference(component, modelReference) {
        if (!component || !modelReference) {
            return
        }

        component.modelName = String(modelReference.modelName || '')
        component.modelPath = String(modelReference.modelPath || '')
        component.modelTransform = {
            ...(modelReference.modelTransform || {})
        }
    }
}
